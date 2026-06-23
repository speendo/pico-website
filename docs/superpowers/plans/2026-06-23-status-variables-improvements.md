# Status Variables Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix live updates (server broadcasts every 3s), diversify form types in status fields (select/switch/radio/range), add `.secondary` to status nav links.

**Architecture:** A background asyncio task in the test server pushes updated status every 3s over the existing WS connection. The STATUS schema is revised to use fewer fields covering all form element types. The client `renderNav` gets a one-line addition for `.secondary` on status links.

**Tech Stack:** Python FastAPI (asyncio), ES5 JS, vitest, Playwright

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `test_server/main.py` | Server — STATUS schema, build_status, broadcaster, uptime format | Modify |
| `app.js` | Client — renderNav .secondary on status links | Modify |
| `tests/unit/app.test.js` | Unit tests — update status routing test data | Modify |
| `tests/e2e/app.test.js` | E2E tests — update field checks, add live-update test | Modify |

---

### Task 1: Test server — new STATUS schema, broadcaster, uptime format

**Files:**
- Modify: `test_server/main.py`

- [ ] **Step 1: Replace STATUS schema**

Replace the current `STATUS` dict (lines 32-43) with:

```python
STATUS = {
    "system": {
        "uptime":     ["text", "Uptime",     {"value": None}],
        "fw_version": ["select", "Firmware", {"options": [["2.0.0","2.0.0"],["2.1.0","2.1.0"],["2.2.0-beta","2.2.0-beta"]], "value": "2.1.0"}],
        "led":        ["switch", "LED",      {"value": True, "tooltip": "System LED indicator"}],
    },
    "network": {
        "mode":       ["radio", "Mode",      {"options": [["auto","Auto"],["manual","Manual"],["safe","Safe"]], "value": "auto", "tooltip": "Network operation mode"}],
        "signal":     ["range", "Signal",    {"attrs": {"min": 0, "max": 100, "step": 1}, "value": None, "tooltip": "Signal strength %"}],
        "connection": ["select", "Connection",{"options": [["connected","Connected"],["disconnected","Disconnected"],["error","Error"]], "value": "connected"}],
    },
    "sensors": {
        "temperature": ["number", "Temperature", {"value": None, "tooltip": "Celsius"}],
    },
}
```

- [ ] **Step 2: Replace build_status()**

Replace the `build_status` function (lines 86-109) with:

```python
def build_status():
    elapsed = time.time() - start_time
    hours = int(elapsed // 3600)
    minutes = int((elapsed % 3600) // 60)
    days = hours // 24
    seconds = int(elapsed % 60)
    uptime_str = f"{days}d {hours % 24}h {minutes % 60}m {seconds}s"

    result = {}
    for comp_id, fields in STATUS.items():
        group = {}
        for key, field_def in fields.items():
            ftype, flabel, fopts = field_def
            opts = dict(fopts)
            if key == "uptime":
                opts["value"] = uptime_str
            elif key == "signal":
                opts["value"] = str(50 + int(elapsed * 5) % 50)
            elif key == "temperature":
                opts["value"] = str(round(23.5 + (int(elapsed) % 10) * 0.1, 1))
            else:
                store_key = comp_id + "." + key
                opts["value"] = status_store.get(store_key, opts.get("value", ""))
            group[key] = [ftype, flabel, opts]
        result[comp_id] = group
    return result
```

- [ ] **Step 3: Add `import asyncio`**

Add `import asyncio` after `import time` at the top.

- [ ] **Step 4: Add `status_broadcaster` async function**

Add after `build_status()`:

```python
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

- [ ] **Step 5: Register broadcaster in startup**

In the `startup` function, after the two initialization loops, add:

```python
    asyncio.ensure_future(status_broadcaster())
```

- [ ] **Step 6: Run unit tests to verify basic server changes don't break anything**

Run: `. ~/.nvm/nvm.sh && export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH" && npm run test:unit -- --reporter=verbose 2>&1 | tail -10`

Expected: unit tests pass (status routing tests may still work since they use the old schema in test data — that's fine, they'll be updated in Task 2).

- [ ] **Step 7: Commit**

```bash
git add -A test_server/main.py
git commit -m "feat(test-server): add status broadcaster, updated STATUS schema with varied types"
```

---

### Task 2: Unit tests — update status routing test data

**Files:**
- Modify: `tests/unit/app.test.js`

- [ ] **Step 1: Update the status routing tests to use new schema fields**

Replace the two status-routing tests (they send `{ system: { uptime: [...] } }` as their data). The routing behavior is the same, just update the field data:

In the `it('routes type:status message to processStatus')` test, replace:
```js
data: JSON.stringify({ type: 'status', data: { system: { uptime: ['text', 'Uptime', { value: '1d 0h 0m' }] } } }),
```
with:
```js
data: JSON.stringify({ type: 'status', data: { network: { signal: ['range', 'Signal', { value: '75' }] } } }),
```

And update the assertion:
```js
expect(window.__test.statusComponents[0].id).toBe('network')
expect(window.__test.statusComponents[0].fields[0].key).toBe('signal')
```

In the `it('does not route status message to settings handling')` test, same data change but keep expectations the same (dirty stays false, components length stays 0).

- [ ] **Step 2: Run tests to verify they pass**

Run: `. ~/.nvm/nvm.sh && export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH" && npm run test:unit -- --reporter=verbose 2>&1 | tail -10`

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/app.test.js
git commit -m "test: update unit tests for new status schema field types"
```

---

### Task 3: app.js — nav links .secondary class

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add .secondary to status nav links**

In `renderNav()` (around line 597), add `a.className = 'secondary';` after the `<a>` element creation for status components:

```js
for (var si = 0; si < statusComponents.length; si++) {
  var comp = statusComponents[si];
  var li = document.createElement('li');
  var a = document.createElement('a');
  a.href = '#' + comp.id;
  a.className = 'secondary';
  a.textContent = comp.label;
  li.appendChild(a);
  navList.appendChild(li);
}
```

- [ ] **Step 2: Run unit tests to verify**

Run: `. ~/.nvm/nvm.sh && export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH" && npm run test:unit -- --reporter=verbose 2>&1 | tail -10`

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add .secondary class to status nav links"
```

---

### Task 4: E2E tests — update field names, add live-update test

**Files:**
- Modify: `tests/e2e/app.test.js`

- [ ] **Step 1: Update "renders status sections before settings" test**

Replace `expect(allDetails.nth(1)).toHaveId('sensors')` with `expect(allDetails.nth(1)).toHaveId('network')` (since the new schema has system→network→sensors order).

- [ ] **Step 2: Update "status summary has secondary class" test**

Replace `sensors` with `network` in the second assertion.

- [ ] **Step 3: Update "status fields are disabled" test**

Replace:
```js
await expect(page.locator('[name="system.uptime"]')).toBeDisabled()
await expect(page.locator('[name="system.heap_free"]')).toBeDisabled()
await expect(page.locator('[name="sensors.temperature"]')).toBeDisabled()
```
with:
```js
await expect(page.locator('[name="system.uptime"]')).toBeDisabled()
await expect(page.locator('[name="system.fw_version"]')).toBeDisabled()
await expect(page.locator('[name="system.led"]')).toBeDisabled()
await expect(page.locator('[name="network.mode"]')).toBeDisabled()
await expect(page.locator('[name="network.signal"]')).toBeDisabled()
await expect(page.locator('[name="network.connection"]')).toBeDisabled()
await expect(page.locator('[name="sensors.temperature"]')).toBeDisabled()
```

- [ ] **Step 4: Update "status shows computed values" test**

Replace:
```js
await expect(page.locator('[name="system.uptime"]')).not.toHaveValue('')
await expect(page.locator('[name="system.heap_free"]')).not.toHaveValue('')
await expect(page.locator('[name="sensors.temperature"]')).not.toHaveValue('')
```
with:
```js
await expect(page.locator('[name="system.uptime"]')).not.toHaveValue('')
await expect(page.locator('[name="network.signal"]')).not.toHaveValue('')
await expect(page.locator('[name="sensors.temperature"]')).not.toHaveValue('')
```

- [ ] **Step 5: Update "status nav links are present" test**

Replace `sensors` with `network` in the second assertion.

- [ ] **Step 6: Add live-update test**

Add after the "status nav links are present" test, before the closing `})`:

```js
test('status values update over time', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(500)
  var val1 = await page.locator('[name="network.signal"]').inputValue()
  await page.waitForTimeout(4000)
  var val2 = await page.locator('[name="network.signal"]').inputValue()
  expect(val1).not.toBe(val2)
})
```

- [ ] **Step 7: Run e2e tests**

```bash
. ~/.nvm/nvm.sh
export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH"
npm run test:e2e 2>&1 | tail -30
```

Expected: all existing + new e2e tests pass.

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/app.test.js
git commit -m "test: update e2e tests for new status schema and add live-update test"
```

---

### Task 5: Build and final verification

**Files:** (none — just run commands)

- [ ] **Step 1: Run full test suite**

```bash
. ~/.nvm/nvm.sh
export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH"
npm test 2>&1 | tail -40
```

Expected: all unit + e2e tests pass.

- [ ] **Step 2: Build (minify)**

```bash
npm run build 2>&1
```

Expected: terser produces `app.min.js` without error.

- [ ] **Step 3: Commit build artifact**

```bash
git add app.min.js
git commit -m "build: regenerate app.min.js after status variables improvements"
```

- [ ] **Step 4: Print final git log**

```bash
git log --oneline -8
```
