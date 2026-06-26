# Group Label Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support an optional `"label"` key in component group JSON to override the auto-derived group label from `labelFromKey()`.

**Architecture:** Two changes in `app.js` (one per `processSettings` and `processStatus`): use `group.label` if present, skip `"label"` when iterating fields. One test server change to exercise it. Two unit tests. Two spec doc updates (architecture spec + backlog triage).

**Tech Stack:** Vanilla JS, Python (FastAPI test server), vitest + jsdom (unit)

---

### Task 1: Update `processSettings` — use `group.label` and skip it in field loop

**Files:**
- Modify: `app.js` (lines in `processSettings`)

- [ ] **Step 1.1: Skip `"label"` key in field iteration loop**

In `app.js`, in function `processSettings`, inside `for (var fieldKey in group)`, add a guard before the `fields.push` line. The current code:

```js
      for (var fieldKey in group) {
        var arr = group[fieldKey];
        fields.push({key: fieldKey, type: arr[0], label: arr[1], opts: arr[2]});
      }
```

Change to:

```js
      for (var fieldKey in group) {
        if (fieldKey === 'label') continue;
        var arr = group[fieldKey];
        fields.push({key: fieldKey, type: arr[0], label: arr[1], opts: arr[2]});
      }
```

- [ ] **Step 1.2: Use `group.label` as priority label for the component**

In `app.js`, in function `processSettings`, change the `comps.push` line. The current code:

```js
      comps.push({id: key, label: labelFromKey(key), fields: fields});
```

Change to:

```js
      comps.push({id: key, label: group.label || labelFromKey(key), fields: fields});
```

- [ ] **Step 1.3: Commit**

```bash
git add app.js
git commit -m "feat: use group.label in processSettings to override auto-derived label"
```

---

### Task 2: Update `processStatus` — same changes for status components

**Files:**
- Modify: `app.js` (lines in `processStatus`)

- [ ] **Step 2.1: Skip `"label"` key in field iteration loop**

In `app.js`, in function `processStatus`, inside the first `for (var fieldKey in group)` loop (the initial-build path). The current code:

```js
        for (var fieldKey in group) {
          var arr = group[fieldKey];
          fields.push({key: fieldKey, type: arr[0], label: arr[1], opts: arr[2]});
        }
```

Change to:

```js
        for (var fieldKey in group) {
          if (fieldKey === 'label') continue;
          var arr = group[fieldKey];
          fields.push({key: fieldKey, type: arr[0], label: arr[1], opts: arr[2]});
        }
```

- [ ] **Step 2.2: Use `group.label` as priority label for the component**

In `app.js`, in function `processStatus`, change the `statusComponents.push` line. The current code:

```js
        statusComponents.push({id: key, label: labelFromKey(key), fields: fields});
```

Change to:

```js
        statusComponents.push({id: key, label: group.label || labelFromKey(key), fields: fields});
```

- [ ] **Step 2.3: Commit**

```bash
git add app.js
git commit -m "feat: use group.label in processStatus to override auto-derived label"
```

---

### Task 3: Add `"label"` to one group in test server for e2e exercise

**Files:**
- Modify: `test_server/main.py`

- [ ] **Step 3.1: Add `"label"` key to the wifi group**

In `test_server/main.py`, in the `SETTINGS` dict, add `"label": "Wi-Fi"` as the first entry in the `"wifi"` group. The current code (line 16-22):

```python
    "wifi": {
        "ssid": ["text", "SSID", {"attrs": {"maxlength": 32, "placeholder": "MyNetwork", "required": True}, "value": "MyNetwork", "help": "WiFi network name \u2014 required, 1\u201332 characters"}],
        "password": ["password", "Password", {"attrs": {"maxlength": 64, "placeholder": "Enter password", "required": True}, "value": "", "help": "WiFi password \u2014 required, up to 64 characters"}],
        "mode": ["select", "Mode", {"options": [["station", "Station"], ["ap", "Access Point"]], "value": "station", "help": "WiFi operating mode: Station or Access Point"}],
        "hidden": ["switch", "Hidden SSID", {"value": False, "help": "Hide network from scans"}],
        "channel": ["range", "Channel", {"attrs": {"min": 1, "max": 13, "step": 1}, "value": 6, "help": "WiFi channel 1\u201313"}],
    },
```

Change the first line to include `"label"`:

```python
    "wifi": {
        "label": "Wi-Fi",
        "ssid": ["text", "SSID", {"attrs": {"maxlength": 32, "placeholder": "MyNetwork", "required": True}, "value": "MyNetwork", "help": "WiFi network name \u2014 required, 1\u201332 characters"}],
        "password": ["password", "Password", {"attrs": {"maxlength": 64, "placeholder": "Enter password", "required": True}, "value": "", "help": "WiFi password \u2014 required, up to 64 characters"}],
        "mode": ["select", "Mode", {"options": [["station", "Station"], ["ap", "Access Point"]], "value": "station", "help": "WiFi operating mode: Station or Access Point"}],
        "hidden": ["switch", "Hidden SSID", {"value": False, "help": "Hide network from scans"}],
        "channel": ["range", "Channel", {"attrs": {"min": 1, "max": 13, "step": 1}, "value": 6, "help": "WiFi channel 1\u201313"}],
    },
```

- [ ] **Step 3.2: Commit**

```bash
git add test_server/main.py
git commit -m "test: add label 'Wi-Fi' to wifi group in test server settings"
```

---

### Task 4: Add unit tests for group label override

**Files:**
- Modify: `tests/unit/app.test.js`

- [ ] **Step 4.1: Add two tests in the `processSettings` describe block**

Find the `describe('processSettings', ()` block in `tests/unit/app.test.js`. After the last `it(...)` block inside this `describe` (before the closing `})`), add these two tests:

```js

  it('uses group.label when present instead of labelFromKey', function () {
    var data = {
      wifi: { label: 'Wi-Fi', ssid: ['text', 'SSID', { value: 'MyNet' }] }
    }
    window.processSettings(data, false)
    expect(window.__test.components.length).toBe(1)
    expect(window.__test.components[0].label).toBe('Wi-Fi')
  })

  it('does not add label key as a field', function () {
    var data = {
      wifi: {
        label: 'Custom Label',
        ssid: ['text', 'SSID', { value: 'MyNet' }],
        channel: ['range', 'Channel', { value: 6 }]
      }
    }
    window.processSettings(data, false)
    expect(window.__test.components.length).toBe(1)
    var hasLabelField = window.__test.components[0].fields.some(function (f) { return f.key === 'label' })
    expect(hasLabelField).toBe(false)
    expect(window.__test.components[0].fields.length).toBe(2)
  })
```

- [ ] **Step 4.2: Run unit tests to verify the new tests pass**

Run: `npm run test:unit`
Expected: All tests pass (existing tests + 2 new ones).

- [ ] **Step 4.3: Commit**

```bash
git add tests/unit/app.test.js
git commit -m "test: add unit tests for group.label override"
```

---

### Task 5: Build minified JS and run e2e tests

**Files:**
- Modify: `app.min.js` (generated)

- [ ] **Step 5.1: Build minified JS**

Run: `npm run build`
Expected: terser produces `app.min.js` without errors.

- [ ] **Step 5.2: Run e2e tests**

Run: `npm run test:e2e`
Expected: All e2e tests pass. The test server now serves wifi group with `"label": "Wi-Fi"` and the accordion section label should display "Wi-Fi" instead of "Wifi".

- [ ] **Step 5.3: Commit built file**

```bash
git add app.min.js
git commit -m "build: update minified JS with group.label support"
```

---

### Task 6: Update architecture spec — document `label` group-level attribute

**Files:**
- Modify: `docs/superpowers/specs/2026-06-18-unified-settings-design.md`

- [ ] **Step 6.1: Update the example JSON to show `label`**

In `docs/superpowers/specs/2026-06-18-unified-settings-design.md`, the example JSON block (lines 44-57). Current:

```json
{
  "_dirty": false,
  "wifi": {
    "ssid":     ["text", "SSID",     {"value": "MyNetwork", "tooltip": "WiFi network name \u2014 required, 1\u201332 characters"}],
    "password": ["password", "Password", {"value": "", "attrs": {"maxlength": 64}, "tooltip": "WiFi password \u2014 required, up to 64 characters"}],
    "mode":     ["select", "Mode",   {"value": "station", "options": [["station","Station"],["ap","Access Point"]]}]
  },
```

Add `"label": "Wi-Fi",` as the first line inside the `"wifi"` object:

```json
{
  "_dirty": false,
  "wifi": {
    "label": "Wi-Fi",
    "ssid":     ["text", "SSID",     {"value": "MyNetwork", "tooltip": "WiFi network name \u2014 required, 1\u201332 characters"}],
    "password": ["password", "Password", {"value": "", "attrs": {"maxlength": 64}, "tooltip": "WiFi password \u2014 required, up to 64 characters"}],
    "mode":     ["select", "Mode",   {"value": "station", "options": [["station","Station"],["ap","Access Point"]]}]
  },
```

- [ ] **Step 6.2: Update "Naming conventions" section to document `label`**

In `docs/superpowers/specs/2026-06-18-unified-settings-design.md`, the "Naming conventions" section (lines 82-91). Current:

```markdown
### Naming conventions

- Component group labels are derived from top-level keys using this algorithm:
  1. Split on underscores, hyphens, or camelCase boundaries
  2. Capitalize the first letter of each word
  3. Join with spaces
  Examples: `wifi` → `"Wifi"`, `gpio` → `"Gpio"`, `audio_interface` → `"Audio Interface"`,
  `AudioInterface` → `"Audio Interface"`.
- Field labels use the `label` value from the field array directly.
- Underscore-prefixed keys (`_dirty`) are meta fields, never components.
```

Change to:

```markdown
### Naming conventions

- Component group labels default to the auto-derived name from the top-level key
  (see algorithm below), but can be overridden with an optional `"label"` key at
  the group level. When `"label"` is present, it is used directly and the key-name
  derivation is skipped. Example: `"wifi": {"label": "Wi-Fi", "ssid": [...]}`.
- Group label derivation algorithm (used when no `"label"` key is present):
  1. Split on underscores, hyphens, or camelCase boundaries
  2. Capitalize the first letter of each word
  3. Join with spaces
  Examples: `wifi` → `"Wifi"`, `gpio` → `"Gpio"`, `audio_interface` → `"Audio Interface"`,
  `AudioInterface` → `"Audio Interface"`.
- Field labels use the `label` value from the field array directly.
- Underscore-prefixed keys (`_dirty`) are meta fields, never components.
```

- [ ] **Step 6.3: Update "Component discovery" section**

In `docs/superpowers/specs/2026-06-18-unified-settings-design.md`, the "Component discovery" section (lines 93-97). Current:

```markdown
### Component discovery

No manifest. The JS iterates top-level keys in the response, skipping `_`-prefixed
keys. Each key becomes an accordion section. The section label is derived from
the key name via case conversion.
```

Change to:

```markdown
### Component discovery

No manifest. The JS iterates top-level keys in the response, skipping `_`-prefixed
keys. Each key becomes an accordion section. The section label is the group-level
`"label"` value if present, otherwise derived from the key name via case conversion.
```

- [ ] **Step 6.4: Commit**

```bash
git add docs/superpowers/specs/2026-06-18-unified-settings-design.md
git commit -m "docs: document group-level label override in architecture spec"
```

---

### Task 7: Update backlog triage — mark completed items, fix label naming

**Files:**
- Modify: `docs/superpowers/specs/2026-06-23-backlog-triage.md`

- [ ] **Step 7.1: Mark item #1 (Form validation) as resolved**

In `docs/superpowers/specs/2026-06-23-backlog-triage.md`, line 14 currently reads:

```markdown
### 1. Fix form validation
```

The item already has the resolved status and fix details. No change needed — it's already updated.

- [ ] **Step 7.2: Fix item #5 (Group name labels) — change `_label` to `label`**

In `docs/superpowers/specs/2026-06-23-backlog-triage.md`, the "Group name labels" section (lines 95-118). Change the JSON shape example and references from `_label` to `label`.

Current lines 106-117:

```markdown
**JSON shape change:**
```json
{
  "wifi": {
    "_label": "Wi-Fi Configuration",
    "ssid": ["text", "SSID", {"value": "MyNetwork"}]
  }
}
```

Meta key `_label` fits the existing `_`-prefix convention for metadata.

**Changes:** 2-3 lines in `processSettings`.
```

Change to:

```markdown
**JSON shape change:**
```json
{
  "wifi": {
    "label": "Wi-Fi Configuration",
    "ssid": ["text", "SSID", {"value": "MyNetwork"}]
  }
}
```

The `"label"` key is reserved at the group level. It overrides the auto-derived
label from `labelFromKey()`. When absent, the existing key-name derivation applies.
Unlike `_dirty` (a wire-protocol envelope key), `"label"` lives inside the group
object and is a user-facing attribute, so it does not need the `_` prefix.

**Changes:** 4 lines in `processSettings` and `processStatus`.
```

- [ ] **Step 7.3: Mark item #7 (Checkbox re-implementation) as done**

In `docs/superpowers/specs/2026-06-23-backlog-triage.md`, the "Checkbox re-implementation" section (lines 139-159). Add a status line at the top:

Current line 139:

```markdown
### 7. Checkbox re-implementation (third indeterminate state)
```

Change to:

```markdown
### 7. Checkbox re-implementation (third indeterminate state)

**Status:** Completed — 2026-06-26
```

- [ ] **Step 7.4: Mark item #12 (Spec/plan doc tidy) as completed**

This item already has the ✅ and completion date (2026-06-24). No change needed.

- [ ] **Step 7.5: Update the "Recommended Order" section**

The recommended order (lines 255-268) lists checkbox revival as #6 and doesn't reflect completed items. Update to show current status:

Current:

```markdown
## Recommended Order

1. Doc tidy (clean slate, makes everything easier to find)
2. Validation fix (quick bug fix, unblocks nothing but annoying)
3. Group name labels (trivial, 5-minute change)
4. Nav image/favicon (trivial, 5-minute change)
5. Edge cases audit (important before backend, could catch JS protocol issues)
6. Checkbox revival (pure client, no backend dependency)
7. ESP32 backend (biggest item, enables everything else)
8. Reset button (needs backend)
9. Reboot (needs backend)
10. Firmware upload (needs backend, most complex)
11. Export/import (can be done independently)
12. GitHub/docs (last, to reflect final state)
```

Change to:

```markdown
## Recommended Order

1. ~~Doc tidy~~ ✅ (completed 2026-06-24)
2. ~~Validation fix~~ ✅ (resolved 2026-06-25)
3. ~~Group name labels~~ ✅ (completed 2026-06-26)
4. Nav image/favicon (trivial, 5-minute change)
5. Edge cases audit (important before backend, could catch JS protocol issues)
6. ~~Checkbox revival~~ ✅ (completed 2026-06-26)
7. ESP32 backend (biggest item, enables everything else)
8. Reset button (needs backend)
9. Reboot (needs backend)
10. Firmware upload (needs backend, most complex)
11. Export/import (can be done independently)
12. GitHub/docs (last, to reflect final state)
```

- [ ] **Step 7.6: Commit**

```bash
git add docs/superpowers/specs/2026-06-23-backlog-triage.md
git commit -m "docs: update backlog triage — mark completed items, fix label naming"
```

---

### Task 8: Final verification

**Files:**
- No changes. Verification only.

- [ ] **Step 8.1: Run full test suite**

Run: `npm test`
Expected: All unit and e2e tests pass.

- [ ] **Step 8.2: Verify group label displays in browser (optional manual check)**

Run the test server: `uvicorn test_server.main:app --host 0.0.0.0 --port 8000`
Open `http://localhost:8000` and check that the first accordion section header shows "Wi-Fi" (not "Wifi").
