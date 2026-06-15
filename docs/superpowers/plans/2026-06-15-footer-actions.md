# Footer Action Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three action buttons to the footer for saving/ applying/resetting ESP32 config, with pending-changes detection and sticky footer behavior.

**Architecture:** All logic stays in `app.js` (single IIFE, no deps). Buttons are static HTML in `index.html`, toggled via `disabled` attribute and `.pending` CSS class. Form inputs use qualified names (`component.key`) for flat key-value serialization. A `baseline` snapshot drives change detection by comparing current `serialize()` output against the last-fetched defaults.

**Tech Stack:** Vanilla JS, Pico CSS v2, ESPAsyncWebServer (serving only).

---

## File Structure

```
/config/workspace/pico-website/
├── index.html          # MODIFY: footer buttons + sticky CSS
├── app.js              # MODIFY: all new logic
├── app.min.js          # REBUILD: minified from app.js
└── docs/superpowers/
    └── specs/
        └── 2026-06-15-footer-actions-design.md  # EXISTING (spec reference)
```

---

### Task 1: Update `index.html` — add buttons and sticky footer CSS

**Files:**
- Modify: `/config/workspace/pico-website/index.html`

- [ ] **Step 1: Restructure footer with button group**

Replace the existing `<footer>` with a flex container holding the status bar and three buttons in a `role="group"`:

```html
    <footer>
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <p id="status-bar" style="margin: 0;"></p>
            <div role="group">
                <button id="btn-save-apply" class="contrast" disabled>Save &amp; Apply</button>
                <button id="btn-apply" class="primary" disabled>Apply</button>
                <button id="btn-reset" class="secondary" disabled>Reset</button>
            </div>
        </div>
    </footer>
```

- [ ] **Step 2: Add sticky footer CSS in `<head>`**

Insert this `<style>` block after the Pico CSS `<link>`:

```html
    <link rel="stylesheet" href="pico.jade.min.css">
    <style>
      footer.pending {
        position: sticky;
        bottom: 0;
        z-index: 10;
        background: var(--pico-background-color);
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      }
    </style>
```

- [ ] **Step 3: Verify the updated HTML**

Run:
```bash
python3 -m http.server 8080 --directory /config/workspace/pico-website
```

Expected: Footer shows three disabled buttons ("Save & Apply", "Apply", "Reset") and the status bar. No console errors (app.js errors about manifest are OK — components/ dir may not exist yet in a fresh copy, but the buttons should render).

---

### Task 2: Add qualified field naming

**Files:**
- Modify: `/config/workspace/pico-website/app.js`

- [ ] **Step 1: Add `namePrefix` parameter to `createField()`**

Change `createField` signature from `createField(field)` to `createField(namePrefix, field)`. Replace all 7 occurrences of `input.name = key` / `input.name = key` / `radio.name = key` with the prefixed version.

Current line 123:
```js
  function createField(field) {
```

Replace with:
```js
  function createField(namePrefix, field) {
```

Then inside the function, replace every `input.name = key` with `input.name = namePrefix + '.' + key`. The affected locations are lines 139, 153, 174, 196, 202, 215, 231.

These two inputs set `name` with bare `key`:
```js
      input.name = key;       // line 139 (checkbox)
      input.name = key;       // line 153 (switch)
```

Replace both with:
```js
      input.name = namePrefix + '.' + key;
```

Radio inputs (line 174):
```js
          radio.name = key;
```
Replace with:
```js
          radio.name = namePrefix + '.' + key;
```

Input type branches (lines 196, 202, 215, 231):
```js
      input.name = key;       // line 196 (inputTypes)
      input.name = key;       // line 202 (range)
      input.name = key;       // line 215 (select)
      input.name = key;       // line 231 (textarea)
```

Replace all four with:
```js
      input.name = namePrefix + '.' + key;
```

- [ ] **Step 2: Update `renderForm()` to pass `comp.id` as prefix**

Current lines 39-43 in `renderForm()`:
```js
      if (comp.fields) {
        for (const field of comp.fields) {
          const fieldEl = createField(field);
```

Replace with:
```js
      if (comp.fields) {
        for (const field of comp.fields) {
          const fieldEl = createField(comp.id, field);
```

- [ ] **Step 3: Verify by serving the page**

Run:
```bash
python3 -m http.server 8080 --directory /config/workspace/pico-website
```

Open dev tools console, inspect form inputs. Expected: each input has a `name` like `wifi.ssid`, `gpio.pin`, etc. All fields still render correctly. Submit still shows names in serialized form data.

---

### Task 3: Add shared functions — serialize, populate, baseline, refresh

**Files:**
- Modify: `/config/workspace/pico-website/app.js`

- [ ] **Step 1: Add DOM references and `baseline` variable**

After the existing DOM references (line 13), add:
```js
  const footer = document.querySelector('footer');
  const btnSaveApply = document.getElementById('btn-save-apply');
  const btnApply = document.getElementById('btn-apply');
  const btnReset = document.getElementById('btn-reset');

  let baseline = null;
```

- [ ] **Step 2: Add `serialize()` function**

Add after `clearError()` (after line 25):
```js
  function serialize() {
    const data = {};
    for (const comp of components) {
      if (!comp.fields) continue;
      for (const field of comp.fields) {
        const key = field[0], type = field[1], name = comp.id + '.' + key;
        const el = configForm.querySelector('[name="' + name + '"]');
        if (!el) continue;
        data[name] = type === 'checkbox' || type === 'switch' ? el.checked
          : type === 'radio' ? (configForm.querySelector('[name="' + name + '"]:checked') || {}).value || null
          : el.value;
      }
    }
    return data;
  }
```

- [ ] **Step 3: Add `setBaseline()` and `getPending()`**

Add after `serialize()`:
```js
  function setBaseline() {
    baseline = serialize();
  }

  function getPending() {
    if (!baseline) return {};
    const current = serialize();
    const changes = {};
    for (const key in current) {
      if (current[key] !== baseline[key]) changes[key] = current[key];
    }
    return changes;
  }
```

- [ ] **Step 4: Add `populateFromComponents()` function**

Add after `getPending()`:
```js
  function populateFromComponents(components) {
    for (const comp of components) {
      if (!comp.fields) continue;
      for (const field of comp.fields) {
        const key = field[0];
        const type = field[1];
        const opts = field[3] || {};
        const name = comp.id + '.' + key;
        const el = configForm.querySelector('[name="' + name + '"]');
        if (!el) continue;
        if (type === 'checkbox' || type === 'switch') {
          el.checked = !!opts.default;
        } else if (type === 'radio') {
          const radios = configForm.querySelectorAll('[name="' + name + '"]');
          for (const radio of radios) {
            radio.checked = opts.default !== undefined && String(radio.value) === String(opts.default);
          }
        } else {
          el.value = opts.default !== undefined ? opts.default : '';
        }
      }
    }
  }
```

- [ ] **Step 5: Add `refreshComponents()` function**

Add after `populateFromComponents()`:
```js
  async function refreshComponents() {
    const results = await Promise.allSettled(
      components.map(async (comp) => {
        const res = await fetch('/' + comp.file);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        comp.fields = await res.json();
      })
    );
    if (results.some(r => r.status === 'rejected')) {
      showError('Failed to refresh component values');
    }
  }
```

- [ ] **Step 6: Add `updateUI()` function**

Add after `populateFromComponents()` or `refreshComponents()`:
```js
  function updateUI() {
    const pending = Object.keys(getPending()).length > 0;
    btnSaveApply.disabled = !pending;
    btnApply.disabled = !pending;
    btnReset.disabled = !pending;
    footer.classList.toggle('pending', pending);
  }
```

- [ ] **Step 7: Verify by serving the page**

Same server command. Open console, call `serialize()` in the console. Expected: returns an object like `{ "wifi.ssid": "", "wifi.password": "", "gpio.pin": "2", ... }`. After changing a form value, `hasPending()` returns `true`.

---

### Task 4: Add API calls, button handlers, and update init

**Files:**
- Modify: `/config/workspace/pico-website/app.js`

- [ ] **Step 1: Add `postJSON()` function**

Add after `updateUI()`:
```js
  async function postJSON(url, data) {
    clearError();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      return true;
    } catch (err) {
      showError('Request failed: ' + err.message);
      return false;
    }
  }
```

- [ ] **Step 2: Add button click handlers with shared `syncThen()`**

Add after `postJSON()`:
```js
  function syncThen(doPopulate) {
    refreshComponents().then(function () {
      if (doPopulate) populateFromComponents(components);
      setBaseline();
      updateUI();
      clearError();
    });
  }

  function handleSaveApply() {
    const data = getPending();
    if (Object.keys(data).length === 0) return;
    postJSON('/api/save', data).then(function (ok) {
      if (ok) syncThen(true);
    });
  }

  function handleApply() {
    const data = getPending();
    if (Object.keys(data).length === 0) return;
    postJSON('/api/apply', data).then(function (ok) {
      if (ok) syncThen(false);
    });
  }

  function handleReset() {
    clearError();
    syncThen(true);
  }
```

- [ ] **Step 3: Add change listeners and wire button clicks**

Add after `handleHash()` (after line 59):
```js
  function bindChangeListeners() {
    configForm.addEventListener('input', updateUI);
    configForm.addEventListener('change', updateUI);
  }

  function wireButtons() {
    btnSaveApply.addEventListener('click', handleSaveApply);
    btnApply.addEventListener('click', handleApply);
    btnReset.addEventListener('click', handleReset);
  }
```

- [ ] **Step 4: Extend `init()` to populate, baseline, and wire up**

Replace the existing `init()` (lines 61-68) with:
```js
  async function init() {
    if (!configForm || !navList || !statusBar) return;
    const ok = await loadManifest();
    if (!ok) return;
    await loadComponents();
    renderNav();
    renderForm();
    populateFromComponents(components);
    setBaseline();
    bindChangeListeners();
    wireButtons();
    updateUI();
    handleHash();
  }
```

Also update the early-return guard in `init()` to include the new refs:
```js
  async function init() {
    if (!configForm || !navList || !statusBar || !footer || !btnSaveApply || !btnApply || !btnReset) return;
```

- [ ] **Step 5: Verify full integration**

Serve and test:
```bash
python3 -m http.server 8080 --directory /config/workspace/pico-website
```

Expected behaviors:
- Page loads with all 3 buttons disabled
- Changing a form value enables all 3 buttons
- Footer becomes sticky when buttons are enabled
- Changing value back to default disables buttons, footer unsticks
- Clicking Reset re-populates form from JSON defaults, buttons disable
- Clicking "Save & Apply" / "Apply" with no server → status bar shows error, buttons stay enabled for retry

---

### Task 5: Rebuild `app.min.js`

**Files:**
- Create (rebuild): `/config/workspace/pico-website/app.min.js`

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected output: terser creates/overwrites `app.min.js`.

- [ ] **Step 2: Verify minified version works**

Temporarily change the script tag in `index.html` from `app.js` to `app.min.js` and serve. Same behavior as the unminified version. Revert the script tag change.

- [ ] **Step 3: Commit**

```bash
git add index.html app.js app.min.js docs/superpowers/plans/2026-06-15-footer-actions.md
git commit -m "feat: add footer action buttons with pending-changes tracking"
```
