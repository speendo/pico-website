# Status Variables Improvements

**Date:** 2026-06-23

**Goal:** Fix live updates, diversify form element types in status fields, and add visual distinction to status nav links.

---

## 1. Live Updates via Server Broadcast

Currently the test server sends status once on WebSocket connect and never pushes updates. Add an asyncio background task that broadcasts `build_status()` to all connected clients every 3 seconds.

### Implementation

In `test_server/main.py`, add after `build_status()`:

```python
import asyncio

async def status_broadcaster():
    while True:
        await asyncio.sleep(3)
        payload = build_status()
        for client in list(connected):
            try:
                await client.send_json({"type": "status", "data": payload})
            except Exception:
                connected.discard(client)
```

Register the background task in the `startup` event:

```python
@app.on_event("startup")
async def startup():
    # ... existing initialization ...
    asyncio.ensure_future(status_broadcaster())
```

This makes uptime, heap, signal, and temperature values update in real-time every 3 seconds.

### Uptime format

Add seconds to the format so users see it ticking:
- Current: `"{days}d {hours % 24}h {minutes}m"`
- New: `"{days}d {hours % 24}h {minutes % 60}m {int(seconds) % 60}s"`

This makes the 3-second broadcast visibly change the value.

---

## 2. Revised STATUS Schema

Replace the current 6 input-heavy fields with fewer fields covering all form element types:

| Group | Key | Type | Details |
|---|---|---|---|
| `system` | `uptime` | text | Computed dynamic: `"{days}d {hours % 24}h {minutes % 60}m {int(seconds) % 60}s"` |
| `system` | `fw_version` | select | Options: `[["2.0.0","2.0.0"],["2.1.0","2.1.0"],["2.2.0-beta","2.2.0-beta"]]`, value: `"2.1.0"` |
| `system` | `led` | switch | Read-only indicator, value: `true`, tooltip: "System LED indicator" |
| `network` | `mode` | radio | Options: `[["auto","Auto"],["manual","Manual"],["safe","Safe"]]`, value: `"auto"`, tooltip: "Network operation mode" |
| `network` | `signal` | range | Min: 0, Max: 100, Step: 1, value: computed (varies 30-99 every broadcast), tooltip: "Signal strength %" |
| `network` | `connection` | select | Options: `[["connected","Connected"],["disconnected","Disconnected"],["error","Error"]]`, value: `"connected"` |
| `sensors` | `temperature` | number | Current reading, value: computed (varies ±0.5 around 23.5 every broadcast), tooltip: "Celsius" |

Key changes:
- **removed:** `heap_free`, `mac`, `humidity` fields
- **added:** `fw_version` as select, `led` as switch, `mode` as radio, `signal` as range, `connection` as select
- **dynamic fields:** `uptime`, `signal`, `temperature` change with each 3s broadcast

### build_status() changes

- Remove `heap_free` and `mac` computation
- Add `signal` computation: `50 + int(elapsed * 5) % 50` (varies 50–99)
- Add `temperature` computation: `23.5 + (int(elapsed) % 10) * 0.1` (varies around 23.5)
- `uptime` format adds seconds: `f"{days}d {hours % 24}h {minutes % 60}m {int(seconds) % 60}s"`

### status_store initialization

Update to match new schema — only `fw_version`, `led`, `mode`, `connection` have static values initialized in startup.

---

## 3. Nav Links with `.secondary` Class

In `app.js` `renderNav()`, when creating `<a>` elements for status components, set `className = 'secondary'` so Pico CSS renders them with a distinct muted color.

Change:
```js
var a = document.createElement('a');
a.href = '#' + comp.id;
a.textContent = comp.label;
```

To (for status sections):
```js
var a = document.createElement('a');
a.href = '#' + comp.id;
a.className = 'secondary';
a.textContent = comp.label;
```

This is consistent with the existing `.secondary` class on status accordion `<summary>` elements.

---

## 4. Test Updates

### Unit tests (`tests/unit/app.test.js`)

- Existing `createField` tests already cover all types (text, select, switch, radio, range, number) with `isStatus` parameter
- Update the "status message routing" test data to use new field types
- No structural test changes needed — the same rendering and routing tests continue to work

### E2E tests (`tests/e2e/app.test.js`)

- Update field names in "status fields are disabled" test: `system.uptime`, `system.fw_version`, `system.led`, `network.mode`, `network.signal`, `network.connection`, `sensors.temperature`
- Update "status shows computed values" to check at least `system.uptime`, `network.signal`, `sensors.temperature`
- Add a "status values update over time" test that reads a value, waits 4 seconds (past the 3s broadcast), and checks the value changed

---

## 5. File Changes Summary

| File | Change |
|---|---|
| `test_server/main.py` | Add `status_broadcaster()` background task; add `asyncio` import; update `STATUS` schema; update `build_status()`; update `startup`; update uptime format with seconds |
| `app.js` | In `renderNav`, add `className = 'secondary'` to status section nav links |
| `tests/unit/app.test.js` | Update status test data for new field types |
| `tests/e2e/app.test.js` | Update field names in existing tests; add live update test |

---

## 6. Architecture Notes

- The 3-second broadcast interval is chosen to be fast enough to see updates without overwhelming the WS connection
- On a real ESP32, this mechanism would be driven by firmware event changes instead of a timer
- All dynamic values are computed in `build_status()` — no client-side timers needed
- The `processStatus` function's "subsequent calls" path handles partial updates from broadcasts correctly (only updates fields present in the data payload)
