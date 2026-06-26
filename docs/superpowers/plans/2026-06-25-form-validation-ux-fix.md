# Form Validation UX Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix console regex errors, add `aria-invalid` for PicoCSS validation styling, improve helper texts to explain constraints, and give required fields default values so the form is valid on load.

**Architecture:** Five tasks. Task 0 fixes the broken regex in test data. Task 1 adds `aria-invalid` state management to `app.js`. Task 2 gives required fields non-empty defaults in test data. Task 3 rewrites helper text tooltips to describe validation rules. Task 4 builds minified JS and runs full test suite. Task 5 updates three spec files that reference the old `reportValidity()` / `:invalid` approach and example data.

**Tech Stack:** Vanilla JS, Python (FastAPI test server), vitest + jsdom (unit), Playwright (e2e), terser (build)

---

### Task 0: Fix regex `/` in character class for `v`-flag compatibility

**Files:**
- Modify: `test_server/main.py:34`

- [ ] **Step 0.1: Escape `/` inside the topic_prefix character class**

In `test_server/main.py`, line 34. The raw string `r"^[a-zA-Z0-9_/.#+\\-]*$"` produces `^[a-zA-Z0-9_/.#+\-]*$` in the browser. Modern browsers compile `pattern` attributes with the `v` (unicodeSets) flag, which requires `/` to be escaped as `\/` inside character classes.

Change this line:

```python
        "topic_prefix":["text", "Topic Prefix",  {"attrs": {"maxlength": 128, "pattern": r"^[a-zA-Z0-9_/.#+\-]*$", "placeholder": "home/esp32"}, "value": "home/esp32", "tooltip": "Prefix for publish/subscribe topics"}],
```

To (escape `/` inside the character class with `\/`):

```python
        "topic_prefix":["text", "Topic Prefix",  {"attrs": {"maxlength": 128, "pattern": r"^[a-zA-Z0-9_\/.#+\-]*$", "placeholder": "home/esp32"}, "value": "home/esp32", "tooltip": "Prefix for publish/subscribe topics"}],
```

Note: `r"^[a-zA-Z0-9_\/.#+\\-]*$"` in Python produces the string `^[a-zA-Z0-9_\/.#+\-]*$`. When serialized to JSON and parsed by the browser, the `\/` escape is recognized as a literal `/` inside the character class, which works with both `v` and `u` flags.

- [ ] **Step 0.2: Verify the fix with Node.js**

Run: `. ~/.nvm/nvm.sh && node -e "try { new RegExp('^[a-zA-Z0-9_\\\\/.#+\\\\-]*\$', 'v'); console.log('PASS: v-flag regex compiles') } catch(e) { console.log('FAIL:', e.message) }"`
Expected: `PASS: v-flag regex compiles`

- [ ] **Step 0.3: Commit**

```bash
git add test_server/main.py
git commit -m "fix: escape / in topic_prefix regex character class for v-flag compat"
```

---

### Task 1: Add `aria-invalid` attribute management for PicoCSS validation styling

**Files:**
- Modify: `tests/unit/app.test.js` (append 2 new tests)
- Modify: `app.js:621-625` (renderForm)
- Modify: `app.js:666-676` (bindChangeListeners handler)

- [ ] **Step 1.1: Write failing test — renderForm sets aria-invalid="false" on all named fields**

Append to the end of `tests/unit/app.test.js` (after the last `})` of the existing `describe('form validation')` block at line 1519):

```js
describe('aria-invalid', function () {
  it('sets aria-invalid="false" on all named form fields after renderForm', function () {
    window.__test.components = [{ id: 'wifi', label: 'WiFi', fields: [
      { key: 'ssid', type: 'text', label: 'SSID', opts: {} }
    ]}]
    window.__test.statusComponents = []
    window.renderForm()
    var input = document.querySelector('[name="wifi.ssid"]')
    expect(input.getAttribute('aria-invalid')).toBe('false')
  })

  it('sets aria-invalid="true" on invalid field, "false" on valid field', function () {
    document.querySelector('#config-form').innerHTML = '<input name="mqtt.client_id" value="" required minlength="3" />'
    window.__test.components = [{ id: 'mqtt', fields: [
      { key: 'client_id', type: 'text', label: 'Client ID', opts: {} }
    ]}]
    window.__test.dirty = false
    window.setBaseline()
    window.bindChangeListeners()
    var input = document.querySelector('[name="mqtt.client_id"]')

    // Empty + required + minlength → invalid, aria-invalid should be "true"
    input.value = ''
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(input.getAttribute('aria-invalid')).toBe('true')

    // Fill with valid value → aria-invalid should become "false"
    input.value = 'my-device'
    input.dispatchEvent(new Event('blur', { bubbles: true }))
    expect(input.getAttribute('aria-invalid')).toBe('false')
  })
})
```

- [ ] **Step 1.2: Run unit tests to verify they fail**

Run: `npm run test:unit`
Expected: The 2 new tests FAIL because `aria-invalid` is never set.

- [ ] **Step 1.3: Set `aria-invalid="false"` on all form fields after `renderForm()`**

In `app.js`, modify `renderForm()` (lines 621-625) to set initial `aria-invalid="false"` on all named form fields after building the DOM:

```javascript
  /** Render the accordion form in #config-form from statusComponents first, then components. */
  function renderForm() {
    configForm.innerHTML = '';
    for (var si = 0; si < statusComponents.length; si++) renderSection(statusComponents[si], true);
    for (var ci = 0; ci < components.length; ci++) renderSection(components[ci], false);
    var fields = configForm.querySelectorAll('input, select, textarea');
    for (var fi = 0; fi < fields.length; fi++) {
      if (fields[fi].name) fields[fi].setAttribute('aria-invalid', 'false');
    }
  }
```

- [ ] **Step 1.4: Update `aria-invalid` after per-field `checkValidity()` in blur/change handler**

In `app.js`, modify the handler inside `bindChangeListeners()` (lines 669-676) to set `aria-invalid` based on the `checkValidity()` result:

```javascript
        var handler = function () {
          formInteracted = true;
          var valid = el.checkValidity();
          el.setAttribute('aria-invalid', valid ? 'false' : 'true');
          if (!valid) { var d = el.closest('details'); if (d) d.open = true; updateUI(); return; }
          var val = (el.type === 'checkbox') ? el.checked :
                    (el.type === 'number' || el.type === 'range') ? parseFloat(el.value) : el.value;
          onUserInput(key, val);
          updateUI();
        };
```

- [ ] **Step 1.5: Build minified JS**

Run: `npm run build`
Expected: terser runs, producing updated `app.min.js`

- [ ] **Step 1.6: Run unit tests to verify all pass**

Run: `npm run test:unit`
Expected: All 125 tests pass (123 existing + 2 new aria-invalid tests).

- [ ] **Step 1.7: Commit**

```bash
git add app.js app.min.js tests/unit/app.test.js
git commit -m "feat: set aria-invalid on form fields for PicoCSS validation styling"
```

---

### Task 2: Give required fields non-empty default values in test server

**Files:**
- Modify: `test_server/main.py:17-18`

- [ ] **Step 2.1: Set default values for wifi.ssid and wifi.password**

In `test_server/main.py`, lines 17-18, change the `"value"` fields from `""` to meaningful defaults:

```python
        "ssid": ["text", "SSID", {"attrs": {"maxlength": 32, "placeholder": "MyNetwork", "required": True}, "value": "MyNetwork", "tooltip": "WiFi network name"}],
        "password": ["password", "Password", {"attrs": {"maxlength": 64, "placeholder": "Enter password", "required": True}, "value": "password", "tooltip": "WiFi password"}],
```

- [ ] **Step 2.2: Commit**

```bash
git add test_server/main.py
git commit -m "fix: give required wifi fields non-empty default values"
```

---

### Task 3: Rewrite helper text tooltips to explain validation rules

**Files:**
- Modify: `test_server/main.py:17-46`

- [ ] **Step 3.1: Update tooltip strings for all SETTINGS fields with constraints**

In `test_server/main.py`, replace the tooltip strings. Find each `tooltip` key in the `SETTINGS` dict (lines 17-46) and update as shown below:

```python
SETTINGS = {
    "wifi": {
        "ssid": ["text", "SSID", {"attrs": {"maxlength": 32, "placeholder": "MyNetwork", "required": True}, "value": "MyNetwork", "tooltip": "WiFi network name — required, 1–32 characters"}],
        "password": ["password", "Password", {"attrs": {"maxlength": 64, "placeholder": "Enter password", "required": True}, "value": "password", "tooltip": "WiFi password — required, up to 64 characters"}],
        "mode": ["select", "Mode", {"options": [["station", "Station"], ["ap", "Access Point"]], "value": "station", "tooltip": "WiFi operating mode: Station or Access Point"}],
        "hidden": ["switch", "Hidden SSID", {"value": False, "tooltip": "Hide network from scans"}],
        "channel": ["range", "Channel", {"attrs": {"min": 1, "max": 13, "step": 1}, "value": 6, "tooltip": "WiFi channel 1–13"}],
    },
    "gpio": {
        "pin": ["number", "Pin Number", {"attrs": {"min": 0, "max": 39, "placeholder": "0"}, "value": 2, "tooltip": "GPIO pin number 0–39"}],
        "direction": ["select", "Direction", {"options": [["input", "Input"], ["output", "Output"]], "value": "output", "tooltip": "Pin direction: Input or Output"}],
        "pull": ["radio", "Pull Resistor", {"options": [["none", "None"], ["up", "Pull Up"], ["down", "Pull Down"]], "value": "none", "tooltip": "Internal pull resistor: None, Pull Up, or Pull Down"}],
        "enabled": ["switch", "GPIO Enabled", {"value": True, "tooltip": "Enable this GPIO pin"}],
        "inverted": ["switch", "Inverted", {"value": False, "tooltip": "Invert GPIO signal level"}],
        "initial": ["select", "Initial State", {"options": [["low", "Low"], ["high", "High"]], "value": "low", "tooltip": "Initial output state: Low or High"}],
    },
    "mqtt": {
        "broker":      ["text", "Broker URL",   {"attrs": {"required": True, "pattern": r"^(mqtts?|tcp|ssl|ws|wss)://[a-zA-Z0-9_\-]+(:\d{1,5})?$", "placeholder": "mqtt://broker.local:1883"}, "value": "mqtt://broker-local:1883", "tooltip": "MQTT broker URL — required, start with protocol://host"}],
        "client_id":   ["text", "Client ID",    {"attrs": {"required": True, "minlength": 3, "maxlength": 64, "pattern": r"^[a-zA-Z0-9_\-]+$"}, "value": "esp32-001", "tooltip": "Unique client ID — required, 3–64 chars, alphanumeric, _ or -"}],
        "topic_prefix":["text", "Topic Prefix",  {"attrs": {"maxlength": 128, "pattern": r"^[a-zA-Z0-9_\/.#+\-]*$", "placeholder": "home/esp32"}, "value": "home/esp32", "tooltip": "MQTT topic prefix — up to 128 chars, letters, numbers, / . # + -"}],
        "keepalive":   ["number", "Keepalive (s)", {"attrs": {"min": 1, "max": 65535, "step": 5}, "value": 56, "tooltip": "Keepalive interval in seconds — 1–65535, steps of 5"}],
        "qos":         ["select", "QoS Level",  {"options": [["0", "0 — At most once"], ["1", "1 — At least once"], ["2", "2 — Exactly once"]], "value": "1", "tooltip": "Quality of Service — 0: at most once, 1: at least once, 2: exactly once"}],
        "retain":      ["switch", "Retain",     {"value": False, "tooltip": "Retain last message on broker"}],
    },
    "notifications": {
        "host":         ["text", "SMTP Host",       {"attrs": {"required": True, "minlength": 5, "pattern": r"^[a-zA-Z0-9]([a-zA-Z0-9_\-]*[a-zA-Z0-9])?$", "placeholder": "smtp.gmail.com"}, "value": "smtp-example-com", "tooltip": "SMTP server hostname — required, 5+ characters"}],
        "port":         ["number", "SMTP Port",     {"attrs": {"min": 1, "max": 65535}, "value": 587, "tooltip": "SMTP server port — 1–65535"}],
        "sender":       ["email", "Sender Email",   {"attrs": {"required": True, "placeholder": "esp32@example.com"}, "value": "esp32@example.com", "tooltip": "From address for alerts — required, valid email"}],
        "recipient":    ["email", "Recipient Email",{"attrs": {"required": True, "placeholder": "admin@example.com"}, "value": "admin@example.com", "tooltip": "Alert destination address — required, valid email"}],
        "min_interval": ["range", "Min Interval (s)", {"attrs": {"min": 30, "max": 3600, "step": 30}, "value": 300, "tooltip": "Minimum time between alerts — 30–3600s, steps of 30"}],
        "enabled":      ["switch", "Alerts Enabled", {"value": False, "tooltip": "Enable email notifications"}],
    },
}
```

- [ ] **Step 3.2: Commit**

```bash
git add test_server/main.py
git commit -m "docs: update tooltips to describe validation constraints"
```

---

### Task 4: Build, test, and verify end-to-end

**Files:**
- No changes. Verification only.

- [ ] **Step 4.1: Build minified JS**

Run: `npm run build`
Expected: terser produces `app.min.js` without errors.

- [ ] **Step 4.2: Run unit tests**

Run: `npm run test:unit`
Expected: All 125 tests pass.

- [ ] **Step 4.3: Run e2e tests**

Run: `npm run test:e2e`
Expected: All e2e tests pass. The test server now has non-empty defaults for required fields and updated tooltips.

- [ ] **Step 4.4: Start the test server manually and verify in browser console**

Run: `. ~/.nvm/nvm.sh && pip install fastapi uvicorn 2>/dev/null; uvicorn test_server.main:app --host 0.0.0.0 --port 8000 &`
Open `http://localhost:8000` and check:
- No regex errors in the JS console
- Required fields (SSID, Password) are pre-filled with defaults
- Helper texts show validation rules (e.g. "WiFi network name — required, 1–32 characters")
- After typing invalid input and blurring, the field gets a red border (`aria-invalid="true"` triggers PicoCSS styling)
- After typing valid input, the field shows green border (`aria-invalid="false"`)
- Save button appears after making a valid change

- [ ] **Step 4.5: Commit (if applicable)**

If any files were re-generated during build:

```bash
git add app.min.js
git commit -m "build: update minified JS with aria-invalid changes"
```

---

### Task 5: Update spec files to reflect `aria-invalid` approach and new defaults

**Files:**
- Modify: `docs/superpowers/specs/2026-06-18-unified-settings-design.md`
- Modify: `docs/superpowers/specs/2026-06-24-code-issues.md`
- Modify: `docs/superpowers/specs/2026-06-23-backlog-triage.md`

- [ ] **Step 5.1: Update `unified-settings-design.md` example JSON and validation section**

**Part A — Example JSON (lines 47-57):** Replace the `wifi` block to show validation-aware tooltips and non-empty password default:

```json
  "wifi": {
    "ssid":     ["text", "SSID",     {"value": "MyNetwork", "tooltip": "WiFi network name \u2014 required, 1\u201332 characters"}],
    "password": ["password", "Password", {"value": "password", "attrs": {"maxlength": 64}, "tooltip": "WiFi password \u2014 required, up to 64 characters"}],
    "mode":     ["select", "Mode",   {"value": "station", "options": [["station","Station"],["ap","Access Point"]]}]
  },
```

**Part B — `attrs` key description (line 74):** Add `minlength` and `pattern` to the list (they are supported but not documented here):

```diff
-   - `attrs` — HTML attributes: `{min, max, maxlength, step, placeholder, required}`
+   - `attrs` — HTML attributes: `{min, max, maxlength, minlength, step, placeholder, required, pattern}`
```

**Part C — Form Validation section (lines 286-298):** Replace the first paragraph and the blur gate paragraph with the `aria-invalid` approach:

```diff
 Validation rules are declared as HTML attributes (`required`, `min`, `max`,
 `minlength`, `maxlength`, `pattern`, `step`) in the `attrs` field of component
-schemas. Pico CSS applies `:invalid` styling natively via the browser's
-Constraint Validation API — no custom CSS or JavaScript calls are needed.
+schemas. PicoCSS validation state styling is driven by the `aria-invalid`
+attribute: `"false"` shows green (valid) styling, `"true"` shows red (invalid)
+styling. The JS manages this attribute on every form field.

-**CSS validation states:** The browser applies `:invalid` / `:valid` pseudo-classes
-after the user interacts with a field (blur for text inputs, change for select/number).
-No `reportValidity()` is needed — the CSS styling works natively. The `input` event
-handler calls `updateUI()` for live save-button feedback during typing.
+**Initial state:** After `renderForm()` builds the DOM, all named form fields
+(`input`, `select`, `textarea`) receive `aria-invalid="false"` so they start
+with neutral styling. No fields appear invalid before user interaction.

-**Blur gate:** When a user leaves a field, the handler calls `el.checkValidity()`.
-Invalid fields block the auto-apply WebSocket send and keep the field out of the
-Save-enabled state. The handler also forces the parent `<details>` accordion open
-so the user can see the invalid field even if they had closed the section.
+**Per-field validation:** On blur/change/click (determined by field type), the
+handler calls `el.checkValidity()` and sets `aria-invalid` to `"true"` or
+`"false"` based on the result. Invalid fields block the auto-apply WebSocket
+send and keep the field out of the Save-enabled state. The handler also forces
+the parent `<details>` accordion open so the user can see the invalid field
+even if they had closed the section. The `reportValidity()` method is NOT used
+(to avoid native browser validation pop-ups).
```

- [ ] **Step 5.2: Update `2026-06-24-code-issues.md` item #3**

Replace lines 30-41 (item #3) with the correct fix approach:

```markdown
## 3. `aria-invalid` not set on form fields after validation

**File:** `app.js:684` (resolved in 2026-06-25)

```js
// Before (fixed on 2026-06-25):
if (!el.checkValidity()) { var d = el.closest('details'); if (d) d.open = true; updateUI(); return; }

// Fixed:
var valid = el.checkValidity();
el.setAttribute('aria-invalid', valid ? 'false' : 'true');
if (!valid) { var d = el.closest('details'); if (d) d.open = true; updateUI(); return; }
```

PicoCSS validation styling uses `aria-invalid` attributes (`"true"` for red,
`"false"` for green), not just the native `:invalid` pseudo-class. The blur
handler now sets `aria-invalid` after each `checkValidity()` call, and
`renderForm()` initializes all fields to `aria-invalid="false"`.
`reportValidity()` is intentionally NOT called to avoid browser-native
validation pop-ups.
```

- [ ] **Step 5.3: Update `2026-06-23-backlog-triage.md` item #1**

Replace lines 14-27 (item #1) with the actual fix approach:

```markdown
### 1. Fix form validation

**Status:** Resolved — 2026-06-25

**Symptom:** Required fields didn't show validation styling (red/green borders)
after the WS + blur refactor.

**Root cause (two issues):**
1. PicoCSS v2 validation styling is driven by `aria-invalid` attributes
   (`"true"` = invalid/red, `"false"` = valid/green), not the native
   `:invalid` pseudo-class. The code never set `aria-invalid` on any field.
2. The `mqtt.topic_prefix` regex pattern `^[a-zA-Z0-9_/.#+\-]*$` had an
   unescaped `/` inside the character class, which breaks in the `v`
   (unicodeSets) flag used by modern browsers. This caused a console error
   and prevented pattern validation.

**Fix (two parts):**
1. `renderForm()` now sets `aria-invalid="false"` on all named fields. The
   blur/change handler sets `aria-invalid` based on `checkValidity()` result.
   `reportValidity()` is intentionally NOT called (avoids native pop-ups).
2. Escaped `/` as `\/` in the `topic_prefix` pattern character class.
```

- [ ] **Step 5.4: Commit**

```bash
git add docs/superpowers/specs/2026-06-18-unified-settings-design.md docs/superpowers/specs/2026-06-24-code-issues.md docs/superpowers/specs/2026-06-23-backlog-triage.md
git commit -m "docs: update specs to reflect aria-invalid validation approach and regex fix"
```
