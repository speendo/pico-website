# Status Variables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only status fields (system info, sensors) sourced from `/api/status` over WebSocket, rendered in the same accordion UI as settings with disabled inputs.

**Architecture:** Status data flows over the same WS connection as settings (`/api/events`), differentiated by `msg.type`. Status components are stored in a separate `statusComponents` array parallel to `components`. All mutation paths (`serialize`, `getPending`, `onUserInput`) are unchanged — they never iterate `statusComponents`. Fields are rendered with `disabled` attribute via a flag passed to `createField`.

**Tech Stack:** ES5 JS (no transpilation), Python FastAPI test server, vitest (unit), Playwright (e2e)

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `app.js` | Client-side JS — new `statusComponents` array, `processStatus()` function, `onWSMessage` routing, `renderForm` order, `createField` disabled flag | Modify |
| `test_server/main.py` | Python test server — `STATUS` schema, `build_status()`, `/api/events` WS endpoint, `external-status-change` endpoint | Modify |
| `tests/unit/app.test.js` | Unit tests for status: processStatus, routing, render order, disabled fields, mutation exclusion | Modify |
| `tests/e2e/app.test.js` | E2E tests for status: sections render, fields disabled, live updates | Modify |

---

### Task 1: Test server — STATUS schema, build_status, /api/events, handshake

**Files:**
- Modify: `test_server/main.py`

- [ ] **Step 1: Add imports and module-level state**

Add `import time` at the top. Add after `applied_store`:

```python
import time

status_store: dict[str, object] = {}
start_time = time.time()
```

- [ ] **Step 2: Add STATUS schema**

Add after the `SETTINGS` dict:

```python
STATUS = {
    "system": {
        "heap_free":  ["text", "Free Heap",  {"value": None, "tooltip": "Available heap in bytes"}],
        "uptime":     ["text", "Uptime",     {"value": None}],
        "fw_version": ["text", "Firmware",   {"value": "2.1.0"}],
        "mac":        ["text", "MAC Address", {"value": "a4:cf:12:34:56:78"}],
    },
    "sensors": {
        "temperature": ["number", "Temperature", {"value": "23.5", "tooltip": "Celsius"}],
        "humidity":    ["number", "Humidity",    {"value": "48.2"}],
    },
}
```

`value: None` marks computed fields (uptime, heap_free). Static fields (fw_version, mac, temperature, humidity) use `status_store`.

- [ ] **Step 3: Initialize status_store in startup**

Append to the `startup` function after the existing loop:

```python
    for comp_id, fields in STATUS.items():
        for key, field_def in fields.items():
            opts = field_def[2]
            val = opts.get("value")
            if val is not None:
                store_key = comp_id + "." + key
                status_store[store_key] = val
```

- [ ] **Step 4: Add build_status() function**

Add after `build_settings()`:

```python
def build_status():
    elapsed = time.time() - start_time
    hours = int(elapsed // 3600)
    minutes = int((elapsed % 3600) // 60)
    days = hours // 24
    uptime_str = f"{days}d {hours % 24}h {minutes}m"
    heap_val = max(10000, 123456 - int(elapsed * 10) % 50000)

    result = {}
    for comp_id, fields in STATUS.items():
        group = {}
        for key, field_def in fields.items():
            ftype, flabel, fopts = field_def
            opts = dict(fopts)
            if key == "uptime":
                opts["value"] = uptime_str
            elif key == "heap_free":
                opts["value"] = str(heap_val)
            else:
                store_key = comp_id + "." + key
                opts["value"] = status_store.get(store_key, opts.get("value", ""))
            group[key] = [ftype, flabel, opts]
        result[comp_id] = group
    return result
```

- [ ] **Step 5: Add /api/events WebSocket endpoint**

Replace the existing `settings_ws` endpoint:

```python
@app.websocket("/api/events")
async def events_ws(ws: WebSocket):
    await ws.accept()
    connected.add(ws)
    try:
        await ws.send_json({"type": "status", "data": build_status()})
        await ws.send_json({"type": "settings", "_dirty": nvs_store != applied_store, "data": build_settings()})
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            if msg.get("action") == "apply":
                for group_key, fields in msg.get("data", {}).items():
                    for field_key, field_arr in fields.items():
                        schema_entry = SETTINGS.get(group_key, {}).get(field_key)
                        if schema_entry is None:
                            continue
                        _, _, opts = schema_entry
                        store_key = group_key + "." + field_key
                        applied_store[store_key] = field_arr[2]["value"]
                payload = build_settings()
                for client in list(connected):
                    try:
                        await client.send_json({"type": "settings", "_dirty": nvs_store != applied_store, "data": payload})
                    except Exception:
                        connected.discard(client)
    except WebSocketDisconnect:
        pass
    finally:
        connected.discard(ws)
```

Key differences from old endpoint:
- Path changed to `/api/events`
- On connect: sends status first (`{"type": "status", "data": ...}`), then settings (`{"type": "settings", "_dirty": ..., "data": ...}`)
- Apply response also wrapped in `{"type": "settings", ...}` to match the new format

- [ ] **Step 6: Add external-status-change endpoint**

Add after `external_change`:

```python
@app.post("/api/settings/external-status-change")
async def external_status_change(body: dict):
    """Simulate an external status update (for e2e testing)."""
    for group_key, fields in body.items():
        if group_key not in STATUS:
            continue
        for field_key, field_arr in fields.items():
            store_key = group_key + "." + field_key
            status_store[store_key] = field_arr[2]["value"]
    payload = build_status()
    for client in list(connected):
        try:
            await client.send_json({"type": "status", "data": payload})
        except Exception:
            connected.discard(client)
    return {"ok": True}
```

- [ ] **Step 7: Remove old /api/settings/ws endpoint**

Delete the old route. The `settings_ws` function can be removed entirely since `events_ws` replaces it.

- [ ] **Step 8: Test the server starts**

Run: `pip install fastapi uvicorn -q && uvicorn test_server.main:app --host 0.0.0.0 --port 8000` in the background, then curl the endpoints:

```bash
curl -s http://localhost:8000/api/settings | python3 -m json.tool | head -3
curl -s http://localhost:8000/api/settings/reset
```

Expected: settings responds, reset returns `{}`.

- [ ] **Step 9: Commit**

```bash
git add test_server/main.py
git commit -m "feat: add status schema, /api/events WS endpoint, build_status"
```

---

### Task 2: app.js — WS URL, statusComponents, processStatus, onWSMessage routing

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Write failing unit test for status message routing**

Add to `tests/unit/app.test.js` at the end (before the final `})` closure of the IIFE — just insert before any `describe` that ends the file):

```js
describe('status message routing', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = ''
    document.getElementById('nav-list').innerHTML = ''
    document.getElementById('status-bar').textContent = ''
    window.__test.components = []
    window.__test.dirty = false
  })

  it('routes type:status message to processStatus', () => {
    window.__test.receiveWSMessage({
      data: JSON.stringify({ type: 'status', data: { system: { uptime: ['text', 'Uptime', { value: '1d 0h 0m' }] } } }),
    })
    expect(window.__test.statusComponents.length).toBe(1)
    expect(window.__test.statusComponents[0].id).toBe('system')
    expect(window.__test.statusComponents[0].fields[0].key).toBe('uptime')
  })

  it('does not route status message to settings handling', () => {
    window.__test.receiveWSMessage({
      data: JSON.stringify({ type: 'status', data: { system: { uptime: ['text', 'Uptime', { value: '1d 0h 0m' }] } } }),
    })
    expect(window.__test.dirty).toBe(false)
    expect(window.__test.components.length).toBe(0)
  })

  it('routes type:settings messages correctly', () => {
    window.__test.receiveWSMessage({
      data: JSON.stringify({ type: 'settings', _dirty: true, data: { wifi: { ssid: ['text', 'SSID', { value: 'Net' }] } } }),
    })
    expect(window.__test.components.length).toBeGreaterThan(0)
    expect(window.__test.dirty).toBe(true)
  })
})
```

- [ ] **Step 2: Run unit tests to verify failure**

Run: `. ~/.nvm/nvm.sh && export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH" && npm run test:unit -- --reporter=verbose 2>&1 | tail -20`

Expected: tests fail because `processStatus` is not defined or doesn't work yet.

- [ ] **Step 3: Add `statusComponents` global variable**

In `app.js`, after `var components = [];` (line 11), add:

```js
/** @type {Array} Read-only status component definitions, parallel to components. */
var statusComponents = [];
```

- [ ] **Step 4: Change WS URL in connectWS**

In `connectWS()` (around line 181), change:

```js
ws = new WebSocket(proto + '//' + location.host + '/api/settings/ws');
```

to:

```js
ws = new WebSocket(proto + '//' + location.host + '/api/events');
```

- [ ] **Step 5: Add `processStatus` function**

Add after `processSettings` (after line 255):

```js
/**
 * Parse a status data payload into statusComponents and render.
 * On first call (statusComponents empty) builds the full component tree.
 * On subsequent calls (partial updates) merges changed field values and
 * updates the DOM via populateFromComponents.
 * @param {Object} data - status payload keyed by component ID
 */
function processStatus(data) {
  if (statusComponents.length === 0) {
    for (var key in data) {
      if (key[0] === '_') continue;
      var group = data[key];
      var fields = [];
      for (var fieldKey in group) {
        var arr = group[fieldKey];
        fields.push({key: fieldKey, type: arr[0], label: arr[1], opts: arr[2]});
      }
      statusComponents.push({id: key, label: labelFromKey(key), fields: fields});
    }
    if (components.length > 0) {
      renderForm();
      populateFromComponents(statusComponents);
      populateFromComponents();
      setBaseline();
      updateUI();
    }
  } else {
    for (var cid in data) {
      if (cid[0] === '_') continue;
      for (var sci = 0; sci < statusComponents.length; sci++) {
        if (statusComponents[sci].id !== cid) continue;
        var comp = statusComponents[sci];
        for (var fk in data[cid]) {
          for (var fi = 0; fi < comp.fields.length; fi++) {
            if (comp.fields[fi].key === fk) {
              comp.fields[fi].opts.value = data[cid][fk][2].value;
            }
          }
        }
      }
    }
    populateFromComponents(statusComponents);
  }
}
```

- [ ] **Step 6: Update onWSMessage routing**

At the top of `onWSMessage`, before the existing type-checking code (before `if (msg.type === 'error')`), insert:

```js
if (msg.type === 'status') { processStatus(msg.data); return; }
```

The existing error and settings routing remains unchanged. The full top of `onWSMessage` should now read:

```js
function onWSMessage(event) {
  var msg = JSON.parse(event.data);
  if (msg.type === 'status') { processStatus(msg.data); return; }
  if (msg.type === 'error') { showError(msg.message); return; }
  if (msg.type !== 'settings' && msg._dirty === undefined) return;
  ...
```

- [ ] **Step 7: Populate status field values in processSettings**

After the `populateFromComponents()` call (before `setBaseline()`), add:

```js
if (statusComponents.length > 0) populateFromComponents(statusComponents);
```

This sets status field values into the DOM after the form is rendered.
The `var data = msg.data || msg;` line already handles both formats, no change needed.

- [ ] **Step 8: Add processStatus and statusComponents to test-expose**

In the `/* test-expose */` line (around line 822), add these before the closing:

```js
window.processStatus=processStatus;
Object.defineProperty(window.__test,'statusComponents',{get:function(){return statusComponents},set:function(v){statusComponents=v}});
```

- [ ] **Step 9: Run tests again**

Run: `. ~/.nvm/nvm.sh && export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH" && npm run test:unit -- --reporter=verbose 2>&1 | tail -30`

Expected: status routing tests pass. All existing tests still pass.

- [ ] **Step 10: Commit**

```bash
git add app.js tests/unit/app.test.js
git commit -m "feat: add statusComponents, processStatus, WS routing for status messages"
```

---

### Task 3: app.js — renderForm order, renderNav, createField disabled flag

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Write failing unit test for render order and disabled fields**

Add to `tests/unit/app.test.js`:

```js
describe('status rendering', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = ''
    document.getElementById('nav-list').innerHTML = ''
    window.__test.components = [
      { id: 'wifi', label: 'Wifi', fields: [
        { key: 'ssid', type: 'text', label: 'SSID', opts: { value: 'Net' } },
      ]},
    ]
    var origStatus = window.__test.statusComponents
    window.__test.statusComponents = [
      { id: 'system', label: 'System', fields: [
        { key: 'uptime', type: 'text', label: 'Uptime', opts: { value: '1d 0h' } },
      ]},
    ]
  })

  afterEach(() => {
    window.__test.statusComponents = origStatus
  })

  it('renders status sections before settings sections', () => {
    window.renderForm()
    var details = document.querySelectorAll('#config-form details')
    expect(details.length).toBe(2)
    expect(details[0].id).toBe('system')
    expect(details[1].id).toBe('wifi')
  })

  it('status summary has secondary class', () => {
    window.renderForm()
    var summary = document.querySelector('#system summary')
    expect(summary.className).toBe('secondary')
    expect(document.querySelector('#wifi summary').className).toBe('')
  })

  it('status field is disabled', () => {
    window.renderForm()
    var input = document.querySelector('[name="system.uptime"]')
    expect(input.disabled).toBe(true)
  })

  it('settings field is not disabled', () => {
    window.renderForm()
    var input = document.querySelector('[name="wifi.ssid"]')
    expect(input.disabled).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `. ~/.nvm/nvm.sh && export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH" && npm run test:unit -- --reporter=verbose 2>&1 | tail -20`

Expected: status rendering tests fail (renderForm doesn't use statusComponents yet, createField has no disabled flag).

- [ ] **Step 3: Update renderForm to iterate statusComponents first**

Replace the existing `renderForm` function:

```js
/**
 * Render the accordion form in #config-form from statusComponents first,
 * then components. Status sections get a .secondary class on summary.
 */
function renderForm() {
  configForm.innerHTML = '';
  for (var si = 0; si < statusComponents.length; si++) {
    var comp = statusComponents[si];
    var details = document.createElement('details');
    details.id = comp.id;
    var summary = document.createElement('summary');
    summary.className = 'secondary';
    summary.textContent = comp.label;
    details.appendChild(summary);
    if (comp.fields) {
      for (var fi = 0; fi < comp.fields.length; fi++) {
        var fieldEl = createField(comp.id, comp.fields[fi], 1);
        if (fieldEl) details.appendChild(fieldEl);
      }
    }
    configForm.appendChild(details);
  }
  for (var ci = 0; ci < components.length; ci++) {
    var comp = components[ci];
    var details = document.createElement('details');
    details.id = comp.id;
    var summary = document.createElement('summary');
    summary.textContent = comp.label;
    details.appendChild(summary);
    if (comp.fields) {
      for (var fi = 0; fi < comp.fields.length; fi++) {
        var fieldEl = createField(comp.id, comp.fields[fi], 0);
        if (fieldEl) details.appendChild(fieldEl);
      }
    }
    configForm.appendChild(details);
  }
}
```

Note: `1` and `0` are shorter than `true`/`false`.

- [ ] **Step 4: Update renderNav to include status sections**

Change the JSDoc from `Render navigation links in #nav-list from the components array.` to `Render navigation links in #nav-list from statusComponents and components.`. Then after `navList.innerHTML = '';` and before the existing `for` loop over `components`, add:

```js
for (var si = 0; si < statusComponents.length; si++) {
  var comp = statusComponents[si];
  var li = document.createElement('li');
  var a = document.createElement('a');
  a.href = '#' + comp.id;
  a.textContent = comp.label;
  li.appendChild(a);
  navList.appendChild(li);
}
```

- [ ] **Step 5: Update createField to accept isStatus parameter**

Change the function signature from:

```js
/**
 * Create a DOM element for a settings field.
 * @param {string} namePrefix - component ID (e.g. "wifi")
 * @param {Object} field - { key, type, label, opts }
 * @param {number} [isStatus] - truthy to render field as disabled (read-only)
 * @returns {HTMLElement|null}
 */
function createField(namePrefix, field) {
```

to:

```js
/**
 * Create a DOM element for a settings or status field.
 * @param {string} namePrefix - component ID (e.g. "wifi")
 * @param {Object} field - { key, type, label, opts }
 * @param {number} [isStatus] - truthy to render field as disabled (read-only)
 * @returns {HTMLElement|null}
 */
function createField(namePrefix, field, isStatus) {
```

Then add `disabled` to each input type:
- For `switch`: after `applyAttrs(input, opts.attrs);`, add `if (isStatus) input.disabled = true;`
- For `radio`: after the radio creation loop (before the container append), add a check: `if (isStatus) radio.disabled = true;` inside the loop
- For `text/number/etc` (inputTypes path): after `applyAttrs(input, opts.attrs);` or `input.value = ...`, add `if (isStatus) input.disabled = true;`
- For `range`: same as inputTypes
- For `select`: after `applyAttrs(input, opts.attrs);`, add `if (isStatus) input.disabled = true;`
- For `textarea`: same pattern

The exact positions:

```js
    if (type === 'switch') {
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.role = 'switch';
      input.name = input.id = namePrefix + '.' + key;
      if (opts.value) input.checked = true;
      applyAttrs(input, opts.attrs);
      if (isStatus) input.disabled = true;   // ADD THIS
      ...
    }

    if (type === 'radio') {
      ...
      for (var oi = 0; oi < opts.options.length; oi++) {
        var opt = opts.options[oi];
        var radioId = namePrefix + '.' + key + '.' + opt[0];
        var radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = namePrefix + '.' + key;
        radio.id = radioId;
        radio.value = opt[0];
        if (opts.value !== undefined && String(opt[0]) === String(opts.value)) {
          radio.checked = true;
        }
        if (isStatus) radio.disabled = true;  // ADD THIS
        ...
      }
      ...
    }

    if (inputTypes.indexOf(type) !== -1) {
      input = document.createElement('input');
      input.type = type;
      input.name = input.id = namePrefix + '.' + key;
      if (opts.value !== undefined) input.value = opts.value;
      applyAttrs(input, opts.attrs);
      if (isStatus) input.disabled = true;   // ADD THIS
    } else if (type === 'range') {
      ...
      applyAttrs(input, opts.attrs);
      if (isStatus) input.disabled = true;   // ADD THIS
      ...
    } else if (type === 'select') {
      ...
      applyAttrs(input, opts.attrs);
      if (isStatus) input.disabled = true;   // ADD THIS
    } else if (type === 'textarea') {
      ...
      applyAttrs(input, opts.attrs);         // (no attrs but consistent)
      if (isStatus) input.disabled = true;   // ADD THIS — but textarea may have no applyAttrs call, so after value assignment
    }
```

- [ ] **Step 6: Run tests**

Run: `. ~/.nvm/nvm.sh && export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH" && npm run test:unit -- --reporter=verbose 2>&1 | tail -30`

Expected: all tests pass including the new rendering tests.

- [ ] **Step 7: Run the existing e2e tests to make sure nothing is broken**

```bash
. ~/.nvm/nvm.sh
export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH"
npx playwright install chromium 2>/dev/null
npm run test:e2e -- --reporter=line 2>&1 | tail -20
```

Expected: all existing e2e tests pass.

- [ ] **Step 8: Commit**

```bash
git add app.js tests/unit/app.test.js
git commit -m "feat: render status sections first with disabled fields"
```

---

### Task 4: E2E tests for status

**Files:**
- Modify: `tests/e2e/app.test.js`

- [ ] **Step 1: Write e2e tests**

Add a new `describe` block at the end of `tests/e2e/app.test.js`:

```js
test.describe('Status variables', () => {
  test('renders status sections before settings', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('details#system')).toBeVisible()
    await expect(page.locator('details#sensors')).toBeVisible()
    var allDetails = page.locator('#config-form details')
    await expect(allDetails.nth(0)).toHaveId('system')
    await expect(allDetails.nth(1)).toHaveId('sensors')
  })

  test('status summary has secondary class', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#system summary')).toHaveClass('secondary')
    await expect(page.locator('#sensors summary')).toHaveClass('secondary')
  })

  test('settings summary does not have secondary class', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#wifi summary')).not.toHaveClass('secondary')
  })

  test('status fields are disabled', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[name="system.uptime"]')).toBeDisabled()
    await expect(page.locator('[name="system.heap_free"]')).toBeDisabled()
    await expect(page.locator('[name="sensors.temperature"]')).toBeDisabled()
  })

  test('settings fields are not disabled', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[name="wifi.ssid"]')).not.toBeDisabled()
  })

  test('status shows dynamic values (uptime changes)', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)
    var uptime1 = await page.locator('[name="system.uptime"]').inputValue()
    await page.waitForTimeout(2000)
    var uptime2 = await page.locator('[name="system.uptime"]').inputValue()
    expect(uptime1).not.toBe(uptime2)
  })

  test('status nav links are present', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#nav-list a[href="#system"]')).toBeVisible()
    await expect(page.locator('#nav-list a[href="#sensors"]')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run e2e tests**

```bash
. ~/.nvm/nvm.sh
export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH"
npm run test:e2e 2>&1 | tail -30
```

Expected: all e2e tests pass (existing + new status tests).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/app.test.js
git commit -m "test: add e2e tests for status variables"
```

---

### Task 5: Build and final verification

**Files:** (none — just run commands)

- [ ] **Step 1: Run the full test suite**

```bash
. ~/.nvm/nvm.sh
export PATH="/config/.nvm/versions/node/v24.17.0/bin:$PATH"
npm test 2>&1 | tail -40
```

Expected: all unit tests + e2e tests pass.

- [ ] **Step 2: Build (minify)**

```bash
npm run build 2>&1
```

Expected: terser produces `app.min.js` without error.

- [ ] **Step 3: Verify app.min.js was updated**

```bash
git diff --stat app.min.js
```

Expected: `app.min.js` shows changes (or is new if git tracks it).

- [ ] **Step 4: Commit build artifact**

```bash
git add app.min.js
git commit -m "build: regenerate app.min.js after status variables feature"
```

- [ ] **Step 5: Print final summary**

Git log status:

```bash
git log --oneline -6
```
