# Form Validation Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `:invalid` styling not showing on form fields (by adding `reportValidity()` to blur/change handlers), expand test server schema with diverse validation constraints, and add test coverage for all constraint types.

**Architecture:** Five tasks. Task 0 adds two creative component groups (MQTT + Notifications) to the test server schema, exercising `pattern`, `minlength`, `maxlength`, `step`, and HTML5 type validation on top of existing `required`/`min`/`max`. Task 1 is a one-line code fix in `app.js:680`. Tasks 2–3 add unit and e2e tests against the richer schema. Task 4 does final verification.

**Tech Stack:** Vanilla JS, vitest + jsdom (unit), Playwright (e2e), terser (build), Python/FastAPI (test server)

---

### Task 0: Expand test server schema with creative validation fields

**Files:**
- Modify: `test_server/main.py` (SETTINGS dict)

- [ ] **Step 1: Add MQTT and Notifications component groups to SETTINGS**

Open `test_server/main.py`. After the `"gpio"` block (line 30), add two new component groups before the closing `}` of SETTINGS:

```python
    "mqtt": {
        "broker":      ["text", "Broker URL",   {"attrs": {"required": True, "pattern": r"^(mqtts?|tcp|ssl|ws|wss)://[a-zA-Z0-9._-]+(:\d{1,5})?$", "placeholder": "mqtt://broker.local:1883"}, "value": "mqtt://broker.local:1883", "tooltip": "MQTT broker connection URL"}],
        "client_id":   ["text", "Client ID",    {"attrs": {"required": True, "minlength": 3, "maxlength": 64, "pattern": r"^[a-zA-Z0-9_-]+$"}, "value": "esp32-001", "tooltip": "Unique MQTT client identifier"}],
        "topic_prefix":["text", "Topic Prefix",  {"attrs": {"maxlength": 128, "pattern": r"^[a-zA-Z0-9_/.#+\-]*$", "placeholder": "home/esp32"}, "value": "home/esp32", "tooltip": "Prefix for publish/subscribe topics"}],
        "keepalive":   ["number", "Keepalive (s)", {"attrs": {"min": 1, "max": 65535, "step": 5}, "value": 60, "tooltip": "MQTT keepalive interval in seconds"}],
        "qos":         ["select", "QoS Level",  {"options": [["0", "0 — At most once"], ["1", "1 — At least once"], ["2", "2 — Exactly once"]], "value": "1", "tooltip": "Quality of Service level"}],
        "retain":      ["switch", "Retain",     {"value": False, "tooltip": "Retain last message on broker"}],
    },
    "notifications": {
        "host":         ["text", "SMTP Host",       {"attrs": {"required": True, "minlength": 5, "pattern": r"^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$", "placeholder": "smtp.gmail.com"}, "value": "", "tooltip": "SMTP server hostname"}],
        "port":         ["number", "SMTP Port",     {"attrs": {"min": 1, "max": 65535}, "value": 587, "tooltip": "SMTP server port"}],
        "sender":       ["email", "Sender Email",   {"attrs": {"required": True, "placeholder": "esp32@example.com"}, "value": "", "tooltip": "From address for alerts"}],
        "recipient":    ["email", "Recipient Email",{"attrs": {"required": True, "placeholder": "admin@example.com"}, "value": "", "tooltip": "Alert destination address"}],
        "min_interval": ["range", "Min Interval (s)", {"attrs": {"min": 30, "max": 3600, "step": 30}, "value": 300, "tooltip": "Minimum time between alert emails"}],
        "enabled":      ["switch", "Alerts Enabled", {"value": False, "tooltip": "Enable email notifications"}],
    },
```

These two groups exercise every validation constraint:
- `pattern` — broker URL regex, client_id alphanumeric, topic_prefix MQTT-safe chars, SMTP hostname
- `minlength` — client_id (3), SMTP host (5)
- `maxlength` — client_id (64), topic_prefix (128)
- `min`/`max` — keepalive (1–65535), SMTP port (1–65535), min_interval (30–3600)
- `step` — keepalive (5), min_interval (30)
- `required` — broker, client_id, SMTP host, sender email, recipient email
- HTML5 type validation — `email` type on sender/recipient (browser validates email format)

- [ ] **Step 2: Restart test server and run existing e2e tests for regressions**

Run: `npm run test:e2e`
Expected: All existing e2e tests pass. New components appear on page but don't interfere with existing selectors.

- [ ] **Step 3: Commit**

```bash
git add test_server/main.py
git commit -m "test: expand test server schema with MQTT and notifications validation fields"
```

---

### Task 1: Add `reportValidity()` to blur/change handler

**Files:**
- Modify: `app.js:680`

- [ ] **Step 1: Change `checkValidity()` to `reportValidity()` in the blur/change handler**

```js
// app.js line 680 — change this line:
          if (!el.checkValidity()) { updateUI(); return; }
// to:
          if (!el.reportValidity()) { updateUI(); return; }
```

`reportValidity()` returns the same boolean as `checkValidity()`, but also fires the `invalid` event and triggers the browser's `:invalid` CSS pseudo-class natively (which Pico CSS uses for red borders). The `input` event handler at line 694 already uses `updateUI()` which calls the lighter-weight `configForm.checkValidity()` — that stays unchanged (no tooltips on every keystroke).

- [ ] **Step 2: Build minified JS**

Run: `npm run build`
Expected: terser runs, producing updated `app.min.js`

- [ ] **Step 3: Run unit tests for regressions**

Run: `npm run test:unit`
Expected: All existing tests pass

- [ ] **Step 4: Run e2e tests for regressions**

Run: `npm run test:e2e`
Expected: All e2e tests pass

- [ ] **Step 5: Commit**

```bash
git add app.js app.min.js
git commit -m "fix: use reportValidity() in blur handler to trigger :invalid CSS"
```

---

### Task 2: Add unit tests for validation constraint behavior

**Files:**
- Modify: `tests/unit/app.test.js` (append new `describe` block)

- [ ] **Step 1: Write tests exercising `reportValidity`, `minlength`, `pattern`, `min`/`max`, `step`**

Append to `tests/unit/app.test.js`:

```js
describe('form validation', () => {
  beforeEach(() => {
    document.querySelector('#config-form').innerHTML = [
      '<input name="mqtt.client_id" value="" required minlength="3" maxlength="64" pattern="^[a-zA-Z0-9_-]+$" />',
      '<input name="mqtt.keepalive" value="60" type="number" min="1" max="65535" step="5" />',
      '<input name="notifications.sender" value="" type="email" required />',
    ].join('')
    window.__test.components = [{ id: 'mqtt', fields: [
      { key: 'client_id', type: 'text', label: 'Client ID', opts: {} },
      { key: 'keepalive', type: 'number', label: 'Keepalive', opts: {} },
    ]}, { id: 'notifications', fields: [
      { key: 'sender', type: 'email', label: 'Sender', opts: {} },
    ]}]
    window.__test.dirty = false
    window.setBaseline()
  })

  it('calls reportValidity on blur of an invalid field', () => {
    var called = false
    var input = document.querySelector('[name="mqtt.client_id"]')
    var orig = input.reportValidity
    input.reportValidity = function () { called = true; return false }
    window.bindChangeListeners()
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(called).toBe(true)
    input.reportValidity = orig
  })

  it('does not send WS when field is invalid on blur', () => {
    window.__test.lastSent = {}
    window.__test.inFlight = {}
    window.connectWS()
    window.__test.wsReady()
    var sendCalled = false
    var origSend = window.sendToServer
    window.sendToServer = function () { sendCalled = true }
    var input = document.querySelector('[name="mqtt.client_id"]')
    var origReport = input.reportValidity
    input.reportValidity = function () { return false }
    window.bindChangeListeners()
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(sendCalled).toBe(false)
    window.sendToServer = origSend
    input.reportValidity = origReport
  })

  it('sends WS when field becomes valid on blur', () => {
    window.__test.lastSent = {}
    window.__test.inFlight = {}
    window.connectWS()
    window.__test.wsReady()
    var sentData = null
    var origSend = window.sendToServer
    window.sendToServer = function (key, val) { sentData = { key: key, val: val } }
    var input = document.querySelector('[name="mqtt.client_id"]')
    input.value = 'my-device'
    var origReport = input.reportValidity
    input.reportValidity = function () { return true }
    window.bindChangeListeners()
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(sentData).toEqual({ key: 'mqtt.client_id', val: 'my-device' })
    window.sendToServer = origSend
    input.reportValidity = origReport
  })

  it('hides save button when field violates minlength', () => {
    window.bindChangeListeners()
    window.__test.dirty = true
    var input = document.querySelector('[name="mqtt.client_id"]')
    input.value = 'ab'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(document.getElementById('btn-save-apply').hidden).toBe(true)
  })

  it('shows save button when field meets minlength', () => {
    window.bindChangeListeners()
    window.__test.dirty = true
    var input = document.querySelector('[name="mqtt.client_id"]')
    input.value = 'abc'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(document.getElementById('btn-save-apply').hidden).toBe(false)
  })

  it('hides save button when field violates pattern', () => {
    window.bindChangeListeners()
    window.__test.dirty = true
    var input = document.querySelector('[name="mqtt.client_id"]')
    input.value = 'invalid client!'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(document.getElementById('btn-save-apply').hidden).toBe(true)
  })

  it('hides save button when field exceeds maxlength', () => {
    window.bindChangeListeners()
    window.__test.dirty = true
    var input = document.querySelector('[name="mqtt.client_id"]')
    input.value = 'a'.repeat(65)
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(document.getElementById('btn-save-apply').hidden).toBe(true)
  })

  it('hides save button when field violates max constraint', () => {
    window.bindChangeListeners()
    window.__test.dirty = true
    var input = document.querySelector('[name="mqtt.keepalive"]')
    input.value = '100000'
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.getElementById('btn-save-apply').hidden).toBe(true)
  })

  it('hides save button when field violates step constraint', () => {
    window.bindChangeListeners()
    window.__test.dirty = true
    var input = document.querySelector('[name="mqtt.keepalive"]')
    input.value = '62'
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.getElementById('btn-save-apply').hidden).toBe(true)
  })

  it('hides save button when email field has invalid format', () => {
    window.bindChangeListeners()
    window.__test.dirty = true
    var input = document.querySelector('[name="notifications.sender"]')
    input.value = 'not-an-email'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(document.getElementById('btn-save-apply').hidden).toBe(true)
  })

  it('shows save button when all fields are valid', () => {
    window.bindChangeListeners()
    window.__test.dirty = true
    document.querySelector('[name="mqtt.client_id"]').value = 'dev01'
    document.querySelector('[name="notifications.sender"]').value = 'dev@test.com'
    document.querySelector('[name="mqtt.client_id"]').dispatchEvent(new Event('blur', { bubbles: true }))
    document.querySelector('[name="notifications.sender"]').dispatchEvent(new Event('blur', { bubbles: true }))
    expect(document.getElementById('btn-save-apply').hidden).toBe(false)
  })
})
```

- [ ] **Step 2: Run unit tests to verify they pass**

Run: `npm run test:unit`
Expected: All tests pass (11 new validation tests + existing tests). jsdom 25 supports `reportValidity()`, `pattern`, `minlength`, and `email` type validation.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/app.test.js
git commit -m "test: add unit tests for pattern, minlength, step, email validation"
```

---

### Task 3: Add e2e tests for `:invalid` CSS pseudo-class

**Files:**
- Modify: `tests/e2e/app.test.js` (append new `test.describe` block)

- [ ] **Step 1: Write e2e tests verifying `:invalid` styling and diverse constraint types end-to-end**

Append to `tests/e2e/app.test.js`:

```js
test.describe('form validation UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#config-form:not([aria-busy])', { timeout: 8000 })
  })

  test('required empty field shows :invalid after blur', async ({ page }) => {
    var input = page.locator('[name="wifi.ssid"]')
    await input.focus()
    await input.blur()
    var isInvalid = await input.evaluate(function (el) { return el.matches(':invalid') })
    expect(isInvalid).toBe(true)
  })

  test('required field loses :invalid after filling valid value', async ({ page }) => {
    var input = page.locator('[name="wifi.ssid"]')
    await input.fill('MyNetwork')
    var isInvalid = await input.evaluate(function (el) { return el.matches(':invalid') })
    expect(isInvalid).toBe(false)
  })

  test('field with maxlength shows :invalid when exceeding limit', async ({ page }) => {
    var input = page.locator('[name="wifi.ssid"]')
    await input.fill('a'.repeat(33))
    await input.blur()
    var isInvalid = await input.evaluate(function (el) { return el.matches(':invalid') })
    expect(isInvalid).toBe(true)
  })

  test('minlength violation shows :invalid after blur', async ({ page }) => {
    var input = page.locator('[name="mqtt.client_id"]')
    await input.fill('ab')
    await input.blur()
    var isInvalid = await input.evaluate(function (el) { return el.matches(':invalid') })
    expect(isInvalid).toBe(true)
  })

  test('minlength satisfied does not show :invalid', async ({ page }) => {
    var input = page.locator('[name="mqtt.client_id"]')
    await input.fill('esp32-living-room')
    await input.blur()
    var isInvalid = await input.evaluate(function (el) { return el.matches(':invalid') })
    expect(isInvalid).toBe(false)
  })

  test('pattern violation shows :invalid after blur', async ({ page }) => {
    var input = page.locator('[name="mqtt.client_id"]')
    await input.fill('bad id!')
    await input.blur()
    var isInvalid = await input.evaluate(function (el) { return el.matches(':invalid') })
    expect(isInvalid).toBe(true)
  })

  test('email type validation shows :invalid for malformed email', async ({ page }) => {
    var input = page.locator('[name="notifications.sender"]')
    await input.fill('not-an-email')
    await input.blur()
    var isInvalid = await input.evaluate(function (el) { return el.matches(':invalid') })
    expect(isInvalid).toBe(true)
  })

  test('email type validation passes for valid email', async ({ page }) => {
    var input = page.locator('[name="notifications.sender"]')
    await input.fill('device@example.com')
    await input.blur()
    var isInvalid = await input.evaluate(function (el) { return el.matches(':invalid') })
    expect(isInvalid).toBe(false)
  })

  test('number min constraint shows :invalid', async ({ page }) => {
    var input = page.locator('[name="notifications.min_interval"]')
    await input.fill('5')
    await input.blur()
    var isInvalid = await input.evaluate(function (el) { return el.matches(':invalid') })
    expect(isInvalid).toBe(true)
  })

  test('number step constraint shows :invalid', async ({ page }) => {
    var input = page.locator('[name="mqtt.keepalive"]')
    await input.fill('62')
    await input.blur()
    var isInvalid = await input.evaluate(function (el) { return el.matches(':invalid') })
    expect(isInvalid).toBe(true)
  })

  test('save button hidden when form has invalid fields', async ({ page }) => {
    var input = page.locator('[name="wifi.ssid"]')
    await input.fill('MyNetwork')
    await input.blur()
    var channel = page.locator('[name="wifi.channel"]')
    await channel.fill('0')
    await channel.blur()
    var saveBtn = page.locator('#btn-save-apply')
    await expect(saveBtn).toBeHidden()
  })

  test('save button visible when form is valid and dirty', async ({ page }) => {
    var input = page.locator('[name="wifi.ssid"]')
    await input.fill('MyNetwork')
    await input.blur()
    var saveBtn = page.locator('#btn-save-apply')
    await expect(saveBtn).toBeVisible({ timeout: 5000 })
  })
})
```

- [ ] **Step 2: Run e2e tests to verify they pass**

Run: `npm run test:e2e`
Expected: All tests pass. Chromium headless shell is available via `test-deps/lib/`. The test server resets before each test per `playwright.config.js`.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/app.test.js
git commit -m "test: add e2e tests for minlength, pattern, email, step validation and :invalid CSS"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All unit tests and e2e tests pass with no regressions.

- [ ] **Step 2: Verify build is up to date**

Run: `npm run build`
Expected: `app.min.js` is regenerated and matches current `app.js`.

**Coverage summary:**

| Constraint | Unit test | E2E test |
|---|---|---|
| `required` | ✓ (existing) | ✓ |
| `maxlength` | ✓ | ✓ |
| `minlength` | ✓ | ✓ |
| `pattern` | ✓ | ✓ |
| `min` on number | ✓ | ✓ |
| `max` on number | ✓ | — |
| `step` on number | ✓ | ✓ |
| `email` type | ✓ | ✓ |
| `reportValidity` called | ✓ | — |
| WS blocked on invalid | ✓ | — |
| Save button gating | ✓ | ✓ |
| `:invalid` CSS | — | ✓ |
