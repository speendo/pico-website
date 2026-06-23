# Unified Settings API & WebSocket Design

## Guiding Constraints

The server is an ESP32 with constrained RAM, flash storage, and CPU. All design
decisions favor shifting computation to the client (browser) to minimize server
load. JS code should follow DRY principles — reuse functions rather than duplicating
logic between HTTP and WebSocket paths, form rendering, and serialization.

## Overview

Consolidate the current per-component JSON file system into a single `/api/settings`
endpoint, introduce server-owned dirty tracking, add a Python test server, and
eventually swap HTTP transport for WebSocket.

## Phase Plan

| Phase | Scope | Key Changes | Testable via |
|---|---|---|---|
| 1 | Python test server | FastAPI mock serving current API (manifest + per-component JSON + POST endpoints) | Manual curl/browser |
| 2 | TDD for existing JS | Add vitest, write tests for current behavior | `npm test` |
| 3 | Spec document | This document — JSON structure, API contract | Review |
| 4 | Unified `/api/settings` | Nested JSON structure, drop manifest, single GET endpoint | Python server v2 |
| 5 | Server-owned `_dirty` | `_dirty` from ESP32, derived `_modified` concept (FV≠AV), no Apply button | Python server + tests |
| 6 | WebSocket transport | Apply on blur, server-push, reconnect fallback | Python server + tests |

---

## JSON Structure (`/api/settings`)

### Response shape

```json
{
  "_dirty": false,
  "wifi": {
    "ssid":     ["text", "SSID",     {"value": "MyNetwork", "tooltip": "WiFi network name"}],
    "password": ["password", "Password", {"value": "", "attrs": {"maxlength": 64}}],
    "mode":     ["select", "Mode",   {"value": "station", "options": [["station","Station"],["ap","Access Point"]]}]
  },
  "gpio": {
    "pin":       ["number", "Pin Number",  {"value": 2, "attrs": {"min": 0, "max": 39}}],
    "direction": ["select", "Direction",  {"value": "output", "options": [["input","Input"],["output","Output"]]}],
    "initial":   ["select", "Initial State", {"value": "low", "options": [["low","Low"],["high","High"]]}]
  }
}
```

### Field format

Each key under a component group is a 3-element array:

```
[type, label, opts]
```

- `type` — one of: `text`, `number`, `password`, `email`, `tel`, `url`, `color`,
  `switch`, `radio`, `select`, `range`, `textarea`
- `label` — display name for the form field
- `opts` — dictionary with keys:
  - `value` — current applied value (replaces `default` from old format)
  - `options` — for `select` and `radio`: `[["key1", "Label 1"], ...]`
  - `attrs` — HTML attributes: `{min, max, maxlength, step, placeholder}`
  - `tooltip` — help text string

### Meta fields

- `_dirty` (bool) — owned by ESP32. `true` when applied settings ≠ stored (NVS) settings.
  Server sends this **before** the `data` object in the JSON.
  Determines "Save & Apply" button availability.

### Naming conventions

- Component group labels are derived from top-level keys using this algorithm:
  1. Split on underscores, hyphens, or camelCase boundaries
  2. Capitalize the first letter of each word
  3. Join with spaces
  Examples: `wifi` → `"Wifi"`, `gpio` → `"Gpio"`, `audio_interface` → `"Audio Interface"`,
  `AudioInterface` → `"Audio Interface"`.
- Field labels use the `label` value from the field array directly.
- Underscore-prefixed keys (`_dirty`) are meta fields, never components.

### Component discovery

No manifest. The JS iterates top-level keys in the response, skipping `_`-prefixed
keys. Each key becomes an accordion section. The section label is derived from
the key name via case conversion.

---

## Transport

Both HTTP POST and WebSocket `apply` messages send only the fields that
changed, never the full settings object. The payload is a partial JSON object
matching the structure of `/api/settings` but containing only the affected keys.

HTTP GET and WS initial push respond with the **full** settings.

### Phase 4–5 (HTTP)

| Method | Endpoint | Purpose | Body |
|---|---|---|---|
| GET | `/api/settings` | Load full settings | — |
| POST | `/api/settings/save` | Persist diff to NVS | `{"wifi": {"ssid": ["text", "SSID", {"value": "MyNetwork"}]}}` |
| POST | `/api/settings/apply` | Activate diff live | same format |

- Success: HTTP 200 with empty body.
- Error: HTTP 4xx/5xx with plain text error message body.

### Phase 6 (WebSocket)

Endpoint: `ws://<host>/api/settings/ws`

#### Client → Server

| Message | Trigger |
|---|---|
| `{"action": "apply", "data": {"wifi": {"ssid": ["text", "SSID", {"value": "MyNetwork"}]}}}` | User blurs a modified field |

Only changed fields sent (same partial format as POST). The `apply` action activates the settings live without
persisting to NVS. Persistence is always done via POST `/api/settings/save`.

#### Server → Client

| Message                                                                  | When                                                     |
| --------------------------------------------------------------------------| ----------------------------------------------------------|
| `{"_dirty": true, "type": "settings", "data": {<full settings object>}}` | Initial connect, reconnect, after external config change |
| `{"type": "error", "message": "..."}`                                    | Processing error                                         |

- `_dirty` appears **before** `type` and `data` in the JSON.
- Server push is handled by the state machine (see Data Model section below):
  - **Case 3** (external update, user idle): notification with "Load" / "Keep" choice.
  - **Case 4** (coincidental sync): silent sync.
  - **Case 5** (collision): conflict prompt listing all changed fields, single global
    decision: "Keep all local" or "Accept all server".
- The notification element is a `<mark id="server-changed" role="alert" hidden>`
  placed below `<header>`, reusing the same sticky bar CSS as `footer.pending`
  (shared class `.sticky-bar` for `position: sticky`, `z-index`, `box-shadow`,
  with `.sticky-bar.top` / `.sticky-bar.bottom` for `top`/`bottom` offsets).

#### Connection lifecycle

1. Page loads → set `aria-busy="true"` on form container (Pico CSS loading indicator).
2. JS opens WS connection.
3. Server sends full settings → remove `aria-busy`, render form.
4. If WS connection fails → show error state with retry button.
5. On reconnect → set `aria-busy`, server sends full settings again + current `_dirty` state → remove `aria-busy`.

---

## Data Model

### Three values, two owners

| Value | Owner | Where | Persistence |
|---|---|---|---|---|
| Stored (NVS) | ESP32 only | Never sent to client | Survives reboot |
| Applied (AV) | ESP32 | Sent via `/api/settings` (Phase 4–5: HTTP GET; Phase 6: WS push) | Active in RAM |
| Form value (FV) | Browser | Local form state | Transient |

Plus two client-local tracking fields per form field:

- **LS** (Last Sent) — the last value sent to the server via WS
- **inFlight** (boolean) — `LS !== AV`, meaning a WS message hasn't been echoed back yet

`_modified` is a derived concept, not a stored variable: it means FV differs from AV
when inFlight is false (the user has local changes ready to send).

### State machine (Phase 6, WebSocket)

**Case table:**

| FV=LS? | LS=AV? | FV=AV? | inFlight | Interpretation | Action |
|---|---|---|---|---|---|
| yes | yes | yes | false | **Idle:** everything in sync | No action |
| no | yes | no | false | **Local Input:** client changed form value | Push FV to server; set LS = FV; inFlight = true |
| yes | no | no | false | **External Update:** server pushed new value while idle | Notify user, list changed field(s), offer "Load" or "Keep"; on Load: FV = AV, LS = AV |
| no | no | yes | false | **Coincidental Sync:** server echoed the same value client was about to send | Silently sync: LS = AV |
| no | no | no | false | **Collision:** client has local changes AND server pushed conflicting value | Show prompt listing all conflicting fields, single choice: "Keep all local" (push FV, LS = FV, inFlight = true) or "Accept all server" (FV = AV, LS = AV) |
| yes | yes | yes | true | **Echo Received:** server confirmed change, no new local input | inFlight = false |
| no | yes | no | true | **Echo + Queued Input:** server confirmed change, user already changed value again | inFlight = false; immediately push FV; LS = FV; inFlight = true |
| yes | no | no | true | **Waiting for Echo (stale packet):** received old or external packet | Ignore packet |
| no | no | yes | true | **Waiting for Echo (revert):** user reverted to old value while waiting | Ignore packet; on echo → Case 1 |
| no | no | no | true | **Waiting for Echo (conflict):** conflicting external packet while in-flight | Ignore packet; on echo → Case 5 |

### Pseudocode implementation

```
// Per-field state
let FV = AV      // Form Value (from UI)
let LS = AV      // Last Sent
let AV = server  // Applied Value (from server)
let inFlight = false

// ── Event: User changes form field ──
function onUserInput(newValue):
    FV = newValue
    updateUI(FV)

    if inFlight == false and FV != LS then
        sendToServer(FV)
        LS = FV
        inFlight = true

// ── Event: WebSocket message received ──
function onServerMessage(newAV):
    AV = newAV

    // Step 1: Echo resolution (Cases 6 & 7)
    if inFlight == true and LS == AV then
        inFlight = false
        if FV != LS then            // Case 7: queued input
            sendToServer(FV)
            LS = FV
            inFlight = true
            return

    // Step 2: Routing
    if inFlight == true then
        // Cases 8, 9, 10 — ignore packets while waiting for echo
        ignorePacket()
    else
        // Cases 1, 3, 4, 5 — not in-flight, server pushed new value
        if FV != AV then
            if FV == LS then
                // Case 3: External update, user has no unsent changes
                showNotification(
                    "Server settings changed",
                    changedFields,           // list of field labels
                    onLoad: () => {
                        FV = AV
                        LS = AV
                        updateUI(FV)
                    },
                    onKeep: () => {
                        // dismiss notification, keep FV unchanged
                    }
                )
            else
                // User has unsent changes (Cases 4 & 5)
                if FV == AV then
                    LS = AV                 // Case 4: Coincidental Sync
                else
                    // Case 5: Collision — prompt user once with all conflicts
                    showConflictPrompt(
                        conflictingFields,   // list of field labels + values
                        onKeepLocal: () => {
                            sendToServer(FV)
                            LS = FV
                            inFlight = true
                        },
                        onAcceptServer: () => {
                            FV = AV
                            LS = AV
                            updateUI(FV)
                        }
                    )
        else
            LS = AV                         // Case 1: Synced
```

### Buttons

| Button | Phase 4–5 | Phase 6 |
|---|---|---|
| Save & Apply | Enabled when FV ≠ AV (→ `_modified`) | Enabled when `_dirty` is true |
| Apply | Enabled when FV ≠ AV (→ `_modified`) | Removed — apply on blur via WS |
| Reset | Requests fresh settings via GET | Requests fresh settings via WS |

---

## Phase Details

### Phase 1: Python Test Server

- Framework: FastAPI + uvicorn
- Location: `test_server/main.py`
- Serves: static files (current `index.html`, `app.js`), manifest JSON,
  per-component JSON files, POST `/api/save`, POST `/api/apply`
- State: in-memory dictionary, mimic NVS semantics
- Startup: `pip install fastapi uvicorn && uvicorn test_server.main:app`

### Phase 2: TDD for existing JS

- Test framework: vitest
- Location: `tests/`
- Scope: existing JS functions — `serialize`, `getPending`, `createField`,
  `populateFromComponents`, `applyAttrs`
- Approach: mock `fetch` / DOM as needed, test current behavior
- These tests evolve in later phases as the code changes

### Phase 3: Spec Document & Project Guidance

- This document.
- Write `AGENTS.md` in project root documenting ESP32 constraints: favor
  client-side computation, compact wire formats, DRY across HTTP/WS paths, DRY for JS functions,
  avoid unnecessary server dependencies.

### Phase 4: Unified `/api/settings`

- JS drops manifest loading
- Single GET `/api/settings` on init
- JS iterates top-level keys for component discovery
- Field `value` replaces `default` as the initial form value
- Test server upgraded to serve new JSON structure

### Phase 5: Server-Owned `_dirty`

- JS stores last known applied values as `baseline`
- `_modified` is a derived concept: FV ≠ AV (baseline vs current form)
- `_dirty` from server drives Save & Apply button
- Apply button kept (removed in Phase 6 when WS blur replaces it)
- Test server tracks `_dirty` internally

### Phase 6: WebSocket

- WS endpoint added to test server
- JS connects WS on page load
- Apply button removed (replaced by apply-on-blur over WS)
- Server-push for external changes
- WS reconnect fallback with error + retry UI
- POST `/api/settings/save` remains HTTP
- HTTP GET `/api/settings` replaced by WS initial push

---

## Error Handling

- POST errors: HTTP 4xx/5xx with plain text body, displayed in status bar.
- WS errors: `{"type": "error", "message": "..."}`, displayed in status bar.
- WS connection failure: error state with retry button. Page shows "Cannot
  connect to device" with a Retry button.
- Form validation: client-side HTML5 validation (unchanged from current).

---

## Future Considerations

- `/api/system/restart`, `/api/firmware/upload` etc. — new top-level API paths
- Status info pushed over WS (heap, uptime, signal strength)
- Multiple clients: `_dirty` collision resolution
