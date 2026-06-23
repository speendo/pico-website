# Code Cleanup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead code, DRY up repeated patterns, extract helpers, and fix the `#server-changed` notification to use the `.sticky-bar.top` CSS already defined.

**Architecture:** All changes are to `app.js` (extract helpers, merge duplicate code paths, remove dead functions) and `index.html` (one class addition). Tests in `tests/unit/app.test.js` are updated in lockstep — dead function tests removed, new helper tests added.

**Tech Stack:** Vanilla JS (no dependencies), vitest + jsdom for unit tests, terser for minification.

**IMPORTANT:** Tasks must be executed in order (1→8). Line numbers are from the _unmodified_ original files. After each task modifies a file, subsequent tasks should use the described code patterns (not line numbers) to locate the right blocks. Run `npm run test:unit` at the end of every task to catch regressions immediately.

---

### Task 1: Make #server-changed a sticky top bar

**Files:**
- Modify: `index.html:48`

The CSS `.sticky-bar.top { top: 0; }` already exists at line 24. The `<mark id="server-changed">` just needs the classes.

- [ ] **Step 1: Add `sticky-bar top` classes to `#server-changed`**

Line 48, change:
```html
  <mark id="server-changed" role="alert" hidden>
```
To:
```html
  <mark id="server-changed" class="sticky-bar top" role="alert" hidden>
```

- [ ] **Step 2: Verify visually (manual)**

Open `index.html` in a browser with the test server running. The notification bar for external changes should stick to the top of the viewport.

- [ ] **Step 3: Run tests to confirm no regressions**

Run: `npm test`
Expected: all unit + e2e tests pass.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: make server-changed notification a sticky top bar"
```

---

### Task 2: Extract `addHelperText()` and trim createField

**Files:**
- Modify: `app.js` — add `addHelperText()` function, replace 4 repeated `<small>` blocks
- Modify: `tests/unit/app.test.js` — update "radio tooltip outside fieldset" test to reference helper

The pattern of creating a `<small>` element for helper text with `aria-describedby` is repeated identically in four places within `createField()`: checkbox (630-636), switch (653-659), radio (689-694), general fields (751-756). The radio case differs — no `aria-describedby` because the container wraps a `<fieldset>`, not a single input. The extracted function handles both.

- [ ] **Step 1: Add the `addHelperText` test**

In `tests/unit/app.test.js`, after the `'does not create small helper when tooltip is empty'` test (line 251), add:

```javascript
describe('addHelperText', function () {
  it('creates small element with aria-describedby', function () {
    var container = document.createElement('div')
    var input = document.createElement('input')
    input.id = 'test.field'
    container.appendChild(input)
    window.addHelperText(container, input.id, 'Help text', input)
    var small = container.querySelector('small')
    expect(small).not.toBeNull()
    expect(small.id).toBe('test.field-helper')
    expect(small.textContent).toBe('Help text')
    expect(input.getAttribute('aria-describedby')).toBe('test.field-helper')
  })

  it('creates small without aria-describedby when describedEl is absent', function () {
    var container = document.createElement('div')
    window.addHelperText(container, 'radio.key', 'Radio help', null)
    var small = container.querySelector('small')
    expect(small).not.toBeNull()
    expect(small.id).toBe('radio.key-helper')
    expect(small.textContent).toBe('Radio help')
  })

  it('does nothing when text is empty', function () {
    var container = document.createElement('div')
    window.addHelperText(container, 'x.y', '', null)
    expect(container.querySelector('small')).toBeNull()
  })

  it('does nothing when text is undefined', function () {
    var container = document.createElement('div')
    window.addHelperText(container, 'x.y', undefined, null)
    expect(container.querySelector('small')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: `addHelperText is not defined`

- [ ] **Step 3: Add `addHelperText` function and expose it**

After the `applyAttrs` function (line 771), add:

```javascript
function addHelperText(container, baseId, text, describedEl) {
  if (!text) return;
  var helper = document.createElement('small');
  helper.id = baseId + '-helper';
  helper.textContent = text;
  if (describedEl) describedEl.setAttribute('aria-describedby', helper.id);
  container.appendChild(helper);
}
```

Add to the test-expose line (before the closing `}`):
```javascript
window.addHelperText=addHelperText;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`
Expected: 4 `addHelperText` tests PASS

- [ ] **Step 5: Replace checkbox helper code (app.js:630-636)**

Replace:
```javascript
      if (opts.tooltip) {
        var helper = document.createElement('small');
        helper.id = input.id + '-helper';
        helper.textContent = opts.tooltip;
        input.setAttribute('aria-describedby', helper.id);
        container.appendChild(helper);
      }
```
With:
```javascript
      addHelperText(container, input.id, opts.tooltip, input);
```

- [ ] **Step 6: Replace switch helper code (app.js:653-659)**

Replace:
```javascript
      if (opts.tooltip) {
        var helper = document.createElement('small');
        helper.id = input.id + '-helper';
        helper.textContent = opts.tooltip;
        input.setAttribute('aria-describedby', helper.id);
        container.appendChild(helper);
      }
```
With:
```javascript
      addHelperText(container, input.id, opts.tooltip, input);
```

- [ ] **Step 7: Replace radio helper code (app.js:689-694)**

Replace:
```javascript
      if (opts.tooltip) {
        var helper = document.createElement('small');
        helper.id = namePrefix + '.' + key + '-helper';
        helper.textContent = opts.tooltip;
        container.appendChild(helper);
      }
```
With:
```javascript
      addHelperText(container, namePrefix + '.' + key, opts.tooltip, null);
```

- [ ] **Step 8: Replace general fields helper code (app.js:751-756)**

Replace:
```javascript
    if (opts.tooltip) {
      var helper = document.createElement('small');
      helper.id = input.id + '-helper';
      helper.textContent = opts.tooltip;
      input.setAttribute('aria-describedby', helper.id);
      container.appendChild(helper);
    }
```
With:
```javascript
    addHelperText(container, input.id, opts.tooltip, input);
```

- [ ] **Step 9: Run full test suite**

Run: `npm test`
Expected: all unit + e2e tests pass.

- [ ] **Step 10: Commit**

```bash
git add app.js tests/unit/app.test.js
git commit -m "refactor: extract addHelperText helper to DRY up createField"
```

---

### Task 3: Merge checkbox and switch code paths in `createField()`

**Files:**
- Modify: `app.js:619-661` — merge two near-identical blocks

The checkbox block (619-637) and switch block (640-661) differ only in three lines: switch sets `input.role = 'switch'` and calls `applyAttrs()`. After merging, `applyAttrs` is called for both (safe since it handles null/undefined). One test (`'creates switch (checkbox with role)'` at line 165) passes `attrs: { role: 'switch' }` redundantly — we clean that up.

- [ ] **Step 1: Merge the two blocks**

Replace lines 619-661 (the `if (type === 'checkbox')` block and the `if (type === 'switch')` block) with:

```javascript
    if (type === 'checkbox' || type === 'switch') {
      var input = document.createElement('input');
      input.type = 'checkbox';
      if (type === 'switch') input.role = 'switch';
      input.name = input.id = namePrefix + '.' + key;
      if (opts.value) input.checked = true;
      applyAttrs(input, opts.attrs);
      var label = document.createElement('label');
      label.setAttribute('for', input.id);
      label.textContent = ' ' + labelText + (required ? '*' : '');
      var container = document.createElement('div');
      container.appendChild(input);
      container.appendChild(label);
      addHelperText(container, input.id, opts.tooltip, input);
      return container;
    }
```

- [ ] **Step 2: Clean up redundant `role: 'switch'` in switch test**

In `tests/unit/app.test.js` line 168, the switch test passes `attrs: { role: 'switch' }` which is now redundant since `applyAttrs` would set it AND the code also sets `input.role = 'switch'` directly. Remove the attrs from the test:

Replace:
```javascript
      opts: { attrs: { role: 'switch' }, value: true },
```
With:
```javascript
      opts: { value: true },
```

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app.js tests/unit/app.test.js
git commit -m "refactor: merge checkbox and switch code paths in createField"
```

---

### Task 4: Extract `findField(compId, fieldKey)` helper

**Files:**
- Modify: `app.js` — add `findField()`, use in `buildPatch()` and `sendToServer()`
- Modify: `tests/unit/app.test.js` — add `findField` tests

The pattern of iterating `components[ci].fields[fi]` to find a specific field by component ID and field key is duplicated in `buildPatch()` (123-133) and `sendToServer()` (371-378).

- [ ] **Step 1: Add `findField` tests**

In `tests/unit/app.test.js`, before the `'buildPatch'` describe block (line 625), add:

```javascript
describe('findField', function () {
  beforeEach(function () {
    window.__test.components = [
      { id: 'wifi', fields: [
        { key: 'ssid', type: 'text', label: 'SSID', opts: { value: 'MyNet' } },
        { key: 'channel', type: 'range', label: 'Channel', opts: { value: 6 } },
      ]},
      { id: 'gpio', fields: [
        { key: 'pin', type: 'number', label: 'Pin', opts: { value: 2 } },
      ]},
    ]
  })

  it('returns the field object for a matching comp and key', function () {
    var field = window.findField('wifi', 'ssid')
    expect(field).not.toBeNull()
    expect(field.key).toBe('ssid')
    expect(field.type).toBe('text')
  })

  it('returns the field for a different component', function () {
    var field = window.findField('gpio', 'pin')
    expect(field).not.toBeNull()
    expect(field.key).toBe('pin')
    expect(field.opts.value).toBe(2)
  })

  it('returns null for unknown component ID', function () {
    expect(window.findField('nonexistent', 'ssid')).toBeNull()
  })

  it('returns null for unknown field key', function () {
    expect(window.findField('wifi', 'nonexistent')).toBeNull()
  })

  it('returns null for component with no fields', function () {
    window.__test.components = [{ id: 'empty' }]
    expect(window.findField('empty', 'x')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: `findField is not defined`

- [ ] **Step 3: Add `findField` function and expose it**

Add after `labelFromKey` (before `processSettings`), or before `buildPatch`:

```javascript
function findField(compId, fieldKey) {
  for (var ci = 0; ci < components.length; ci++) {
    if (components[ci].id !== compId) continue;
    var fields = components[ci].fields;
    if (!fields) return null;
    for (var fi = 0; fi < fields.length; fi++) {
      if (fields[fi].key === fieldKey) return fields[fi];
    }
    return null;
  }
  return null;
}
```

Add to test-expose: `window.findField=findField;`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`
Expected: all `findField` tests PASS

- [ ] **Step 5: Refactor `buildPatch()` to use `findField()`**

Replace `buildPatch` body (lines 117-137):

```javascript
  function buildPatch(changes) {
    var data = {};
    for (var name in changes) {
      var dot = name.indexOf('.');
      var compId = name.slice(0, dot);
      var fieldKey = name.slice(dot + 1);
      if (!data[compId]) data[compId] = {};
      var field = findField(compId, fieldKey);
      if (field) data[compId][fieldKey] = [field.type, field.label, { value: changes[name] }];
    }
    return data;
  }
```

- [ ] **Step 6: Refactor `sendToServer()` to use `findField()`**

Replace `sendToServer` body (lines 363-382):

```javascript
  function sendToServer(key, value) {
    if (!ws || ws.readyState !== 1) return;
    lastSent[key] = value;
    inFlight[key] = true;
    var parts = key.split('.');
    var compId = parts[0];
    var fieldKey = parts[1];
    var field = findField(compId, fieldKey);
    if (!field) return;
    var patch = {};
    patch[compId] = {};
    patch[compId][fieldKey] = [field.type, field.label, { value: value }];
    ws.send(JSON.stringify({action: 'apply', data: patch}));
  }
```

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add app.js tests/unit/app.test.js
git commit -m "refactor: extract findField helper to DRY up component field lookups"
```

---

### Task 5: Use `readFormValue()` in `onWSMessage` and `wireButtons`

**Files:**
- Modify: `app.js:289-307` — changed-fields loop in `onWSMessage`
- Modify: `app.js:573-588` — Keep button handler in `wireButtons`

`readFormValue()` already exists (line 400) and handles `checkbox→checked`, `number/range→parseFloat`, or `value`. Two places inline the same logic instead of calling it.

- [ ] **Step 1: Replace inline value reading in `onWSMessage` changed-fields loop**

Lines 301-304, replace:
```javascript
        var el = document.querySelector('[name="' + comp.id + '.' + field.key + '"]');
        if (!el) continue;
        var fv = (el.type === 'checkbox') ? el.checked :
                 (el.type === 'number' || el.type === 'range') ? parseFloat(el.value) : el.value;
```
With:
```javascript
        var fv = readFormValue([comp.id, field.key]);
        if (fv === undefined) continue;
```

- [ ] **Step 2: Replace inline value reading in `wireButtons` Keep handler**

Lines 579-583, replace:
```javascript
          var el = document.querySelector('[name="' + comp.id + '.' + field.key + '"]');
          if (!el) continue;
          var fv = (el.type === 'checkbox') ? el.checked :
                   (el.type === 'number' || el.type === 'range') ? parseFloat(el.value) : el.value;
```
With:
```javascript
          var fv = readFormValue([comp.id, field.key]);
          if (fv === undefined) continue;
```

- [ ] **Step 3: Run `npm run test:unit`**

Expected: all unit tests pass (the onWSMessage state machine tests and radio event tests cover these code paths).

- [ ] **Step 4: Run `npm run test:e2e`**

Expected: all e2e tests pass (the "Keep" button and external-change notification tests cover this path).

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "refactor: use readFormValue consistently in onWSMessage and wireButtons"
```

---

### Task 6: Remove dead code — JS functions and unused vitest configs

**Files:**
- Modify: `app.js` — remove `refreshComponents` (84-107), `loadSettings` (461-485), and their test-expose entries
- Modify: `tests/unit/app.test.js` — remove `refreshComponents` tests (522-558), `loadSettings` tests (364-437)
- Delete: `vitest.config.noopt.js` — unused config (disables Vite optimizer, troubleshoot artifact)
- Delete: `vitest.config.debug.js` — unused config (no setupFiles, can't run tests)

Neither function is called in the production flow. `init()` calls `connectWS()` + `wireButtons()` only. Settings arrive via WebSocket. The extra vitest configs are not referenced by any `npm` script and don't work standalone.

- [ ] **Step 1: Remove `refreshComponents` tests**

Delete the entire `describe('refreshComponents', ...)` block from `tests/unit/app.test.js`.

- [ ] **Step 2: Remove `loadSettings` tests**

Delete the entire `describe('loadSettings', ...)` block from `tests/unit/app.test.js`.

- [ ] **Step 3: Remove `refreshComponents` function from `app.js`**

Delete the `async function refreshComponents()` definition (original lines 84-107).

- [ ] **Step 4: Remove `loadSettings` function from `app.js`**

Delete the `async function loadSettings()` definition (original lines 461-485).

- [ ] **Step 5: Remove test-expose entries for `refreshComponents` and `loadSettings`**

In the test-expose line, remove:
```
window.refreshComponents=refreshComponents;window.loadSettings=loadSettings;
```

- [ ] **Step 6: Delete `vitest.config.noopt.js`**

```bash
rm vitest.config.noopt.js
```

- [ ] **Step 7: Delete `vitest.config.debug.js`**

```bash
rm vitest.config.debug.js
```

- [ ] **Step 8: Run `npm run test:unit`**

Expected: all remaining tests pass. No reference to `refreshComponents` or `loadSettings` remains.

- [ ] **Step 9: Run `npm test`**

Expected: all unit + e2e tests pass.

- [ ] **Step 10: Rebuild minified JS**

Run: `npm run build`
Expected: `app.min.js` regenerated without dead code.

- [ ] **Step 11: Commit**

```bash
git add app.js app.min.js tests/unit/app.test.js
git rm vitest.config.noopt.js vitest.config.debug.js
git commit -m "refactor: remove dead refreshComponents, loadSettings, and unused vitest configs"
```

---

### Task 7: Add JSDoc and inline comments to `app.js`

**Files:**
- Modify: `app.js` — add JSDoc blocks to all functions, inline comments for the `onWSMessage` state machine

Comments are safe because `terser -c` strips them from `app.min.js`. The unminified `app.js` should be readable and maintainable.

- [ ] **Step 1: Add JSDoc comments to every function**

Add `/** JSDoc block */` above each function in `app.js`. Note: `refreshComponents` and `loadSettings` are already removed by Task 6 and are not listed below.

```javascript
/** Show an error message in the status bar. @param {string} msg */
function showError(msg) {
  statusBar.textContent = msg;
  statusBar.style.color = 'var(--pico-color-red)';
}

/** Clear the status bar error. */
function clearError() {
  statusBar.textContent = '';
  statusBar.style.color = '';
}

/**
 * Serialize all form field values into a flat key-value object.
 * Keys are "compId.fieldKey", values are native types (string, boolean).
 * @returns {Object<string, (string|boolean)>}
 */
function serialize() { ... }

/** Snapshot current form values as the baseline for diffing. */
function setBaseline() {
  baseline = serialize();
}

/**
 * Return only the fields whose form value differs from the baseline.
 * @returns {Object<string, (string|boolean)>}
 */
function getPending() { ... }

/**
 * Populate form elements from component field definitions' opts.value.
 * @param {Array} [comps] — optional component array, defaults to global `components`
 */
function populateFromComponents(comps) { ... }

/**
 * Determine whether the Save button should be visible.
 * Visible when `dirty` is true and the form is valid.
 */
function updateUI() { ... }

/**
 * Build a nested JSON patch body from a flat changes object.
 * Input:  {"wifi.ssid": "MyNet"}
 * Output: {"wifi": {"ssid": ["text", "SSID", {"value": "MyNet"}]}}
 * @param {Object<string, *>} changes — flat key→value map of changed fields
 * @returns {Object}
 */
function buildPatch(changes) { ... }

/**
 * POST JSON to a URL, display errors on failure.
 * @param {string} url
 * @param {*} data — JSON-serializable body
 * @returns {Promise<boolean>} true on success, false on error
 */
async function postJSON(url, data) { ... }

/** Open a WebSocket connection to /api/settings/ws. Sets aria-busy on the form. */
function connectWS() { ... }

/** Close the WebSocket and cancel any reconnect timer. */
function disconnectWS() { ... }

/** Handle WS close: exponential backoff reconnect up to 5 retries, then show manual retry button. */
function onWSClose() { ... }

/**
 * Parse the full settings JSON from the server into the `components` array,
 * render nav + form, bind listeners, set baseline, handle hash navigation.
 * Called on initial WebSocket load (when components is empty).
 * @param {Object} data — settings payload (without _dirty)
 * @param {boolean} dirtyFlag — server `_dirty` flag
 */
function processSettings(data, dirtyFlag) { ... }

/**
 * WebSocket message handler — implements the 10-case state machine.
 *
 * Echo resolution:   Cases 6-7 — match inFlight sends against server echo
 * External updates:  Cases 1,3,4,5 — handle server-pushed changes
 * In-flight defer:   Cases 8-9-10 — ignore packets while awaiting echo
 *
 * @param {MessageEvent} event — WS message with JSON data
 */
function onWSMessage(event) { ... }

/**
 * Copy Applied Values from a server settings payload into
 * the in-memory component field definitions (field.opts.value).
 * @param {Object} data — settings payload keyed by component ID
 */
function updateAV(data) { ... }

/** Write AV from in-memory fields into the DOM form and update baseline. */
function applyAV() { ... }

/**
 * Sync the lastSent tracking map with current AV values
 * (so subsequent user changes are detected as new).
 */
function syncLS() { ... }

/**
 * Resolve a nested property path within an object.
 * @param {Object} obj
 * @param {string[]} parts — path segments, e.g. ["wifi", "ssid"]
 * @returns {*|undefined}
 */
function resolveNested(obj, parts) { ... }

/**
 * Read a form field's value by compound key path.
 * Handles type coercion: checkbox→boolean, number/range→float.
 * @param {string[]} parts — path segments, e.g. ["wifi", "ssid"]
 * @returns {(string|number|boolean|undefined)}
 */
function readFormValue(parts) { ... }

/**
 * Send a single field value to the server over WebSocket as an `apply` action.
 * Sets lastSent and inFlight tracking.
 * @param {string} key — "compId.fieldKey"
 * @param {*} value
 */
function sendToServer(key, value) { ... }

/**
 * Fire-and-forget a user-initiated field change to the server.
 * No-ops if inFlight, or if the value matches lastSent.
 * @param {string} key — "compId.fieldKey"
 * @param {*} newValue
 */
function onUserInput(key, newValue) { ... }

/** Show the "Server settings changed" notification bar (external update, user idle). */
function showExternalNotification(fields) { ... }

/** Show the conflict resolution prompt when both local and server values changed. */
function showConflictPrompt(conflicts) { ... }

/** Hide the server-changed notification bar and remove pending style from footer. */
function hideNotification() { ... }

/** Reset dirty flag, set baseline, update UI — called after successful save. */
function syncThen() { ... }

/** Handle the Save button click: POST pending changes to /api/settings/save. */
function handleSaveApply() { ... }

/**
 * Derive a human-readable label from a camelCase/snake_case key.
 * "wifi_ssid" → "Wifi Ssid", "AudioInterface" → "Audio Interface"
 * @param {string} key
 * @returns {string}
 */
function labelFromKey(key) { ... }

/** Render navigation links in #nav-list from the components array. */
function renderNav() { ... }

/** Render the accordion form in #config-form from the components array. */
function renderForm() { ... }

/** Bind hashchange listener and open the details section matching the current URL hash. */
function handleHash() { ... }

/**
 * Bind input/change/blur/click listeners on all form fields.
 * Text/password/email/tel/url use blur; radio uses click; everything else uses change.
 * All fields get an `input` listener that calls updateUI for validation feedback.
 */
function bindChangeListeners() { ... }

/**
 * Create a DOM element for a settings field.
 * @param {string} namePrefix — component ID (e.g. "wifi")
 * @param {Object} field — { key, type, label, opts }
 * @returns {HTMLElement|null}
 */
function createField(namePrefix, field) { ... }

/**
 * Append helper text (small element) to a container, optionally with aria-describedby.
 * @param {HTMLElement} container
 * @param {string} baseId — used for the helper's id attribute
 * @param {string} text — helper text content (no-op if falsy)
 * @param {HTMLElement|null} describedEl — element to receive aria-describedby, or null
 */
function addHelperText(container, baseId, text, describedEl) { ... }

/**
 * Find a field definition by component ID and field key.
 * @param {string} compId — e.g. "wifi"
 * @param {string} fieldKey — e.g. "ssid"
 * @returns {Object|null} the field object {key, type, label, opts} or null if not found
 */
function findField(compId, fieldKey) { ... }

/** Apply HTML attributes from an object to a DOM element. */
function applyAttrs(el, attrs) { ... }

/** Wire up button click handlers (Save, notification bar actions). */
function wireButtons() { ... }

/**
 * Initialization: wire buttons, open WebSocket connection.
 * Bound to DOMContentLoaded.
 */
async function init() { ... }
```

- [ ] **Step 2: Add inline comments to the `onWSMessage` state machine**

Inside `onWSMessage`, add section markers for the three phases:

```javascript
  // ━━━ Phase 1: Echo resolution ━━━ (Cases 6-7)
  ...
  // ━━━ Phase 2: In-flight defer ━━━ (Cases 8-10)
  ...
  // ━━━ Phase 3: Idle external update ━━━ (Cases 1,3,4,5)
  ...
```

Add a brief comment for each case branch:

```javascript
  // Case 6: Echo received, no queued input → clear inFlight
  ...
  // Case 7: Echo received + user already changed value again → send queued input
  ...
  // Case 8-10: Ignore while inFlight
  ...
  // Initial load — no components yet
  ...
  // Case 3: External update, user idle → show "Load"/"Keep" notification
  ...
  // Case 4: Coincidental sync (FV == new AV) → silent
  ...
  // Case 5: Collision → show conflict prompt
  ...
```

- [ ] **Step 3: Run `npm run test:unit`**

Expected: all tests still pass (comments don't affect behavior).

- [ ] **Step 4: Run `npm run build`**

Verify `app.min.js` is smaller than/comparable to before (comments stripped by terser).

- [ ] **Step 5: Commit**

```bash
git add app.js app.min.js
git commit -m "docs: add JSDoc comments and state machine annotations to app.js"
```

---

### Task 8: Final verification — build + full test suite

- [ ] **Step 1: Rebuild minified JS**

Run: `npm run build`

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all unit + e2e tests pass.

- [ ] **Step 3: Verify minified file loads without errors**

Open `test.html` or `index.html` in a browser and confirm no console errors, settings load normally.

- [ ] **Step 4: Commit any leftover build changes**

```bash
git add app.min.js
git commit -m "build: update minified app.js after cleanup"
```
