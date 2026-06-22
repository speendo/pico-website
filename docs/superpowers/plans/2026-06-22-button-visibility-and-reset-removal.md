# Button Visibility & Reset Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save button shows+enables when `_dirty=true`, hides+disables otherwise. Reset button removed. Footer hides when no button and no error message. Button renamed from "Save & Apply" to "Save".

**Architecture:** Reset was a no-op in the WS flow. External updates and collisions handled by notification bar. Footer visibility is CSS-only via `has()`: hidden when no visible button exists AND no error message. Adding a new button to the footer later automatically participates in the rule.

**Tech Stack:** Vanilla JS (ES5), vitest, Playwright, terser for minification

**Manual Testing (test server already running on port 8000):**
- Open `http://localhost:8000` — button hidden, footer hidden
- Edit a field and tab away → WS apply → `_dirty=true` → button + footer appear
- Click "Save" → server persists → `_dirty=false` → button + footer hide
- Simulate external change: `curl -X POST http://localhost:8000/api/settings/external-change -H 'Content-Type: application/json' -d '{"wifi":{"ssid":["text","SSID",{"value":"Remote"}]}}'` → notification bar appears

---

### Task 1: Update `index.html` — Remove Reset, rename to Save, add CSS, start hidden

**Files:**
- Modify: `index.html:8-31` (CSS block)
- Modify: `index.html:59-67` (footer button group)

- [ ] **Step 1: Add CSS rule for footer visibility**

  Add to the `<style>` block (line 31, before the closing `</style>`):

  ```css
      footer:not(:has(button:not([hidden]))):has(#status-bar:empty) {
        display: none;
      }
  ```

  This hides the footer when both conditions are true:
  - No visible button exists in the footer (all buttons have `[hidden]`)
  - Status bar is empty (no error message)

  The `:not(:has(button:not([hidden])))` pattern is future-proof — adding a new button to the footer later will automatically keep the footer visible when that button isn't hidden.

- [ ] **Step 2: Edit the footer button group**

  Replace the `<div role="group">` block to remove Reset, rename button, add `hidden`:

  ```html
        <div role="group">
          <button id="btn-save-apply" class="contrast" disabled hidden>Save</button>
        </div>
  ```

- [ ] **Step 3: Verify**

  Run: `grep -n 'btn-reset\|btn-save-apply\|Save &amp; Apply' index.html`
  Expected: one match for `btn-save-apply` with text "Save", zero for `btn-reset` and `Save &amp; Apply`.

---

### Task 2: Update `app.js` — Remove Reset, simplify updateUI (no footer logic)

**Files:**
- Modify: `app.js:9` (remove btnReset var)
- Modify: `app.js:110-121` (updateUI — just button hidden/disabled)
- Modify: `app.js:444-448` (remove handleReset function)
- Modify: `app.js:558-560` (wireButtons — remove Reset click wiring)
- Modify: `app.js:606` (init guard — remove btnReset check)
- Modify: `app.js:725-728` (test-expose — remove handleReset export)

- [ ] **Step 1: Remove btnReset variable declaration**

  Delete line 9: `var btnReset = document.getElementById('btn-reset');`

- [ ] **Step 2: Rewrite updateUI()**

  Replace lines 110-121. Remove Reset tracking, remove `modified` calculation. Only toggle button `hidden` and `disabled`. Footer visibility is handled by CSS now — no JS needed:

  ```javascript
  function updateUI() {
    var formOk = configForm.checkValidity();
    var showBtn = dirty && formOk;
    btnSaveApply.hidden = !showBtn;
    btnSaveApply.disabled = !showBtn;
  }
  ```

- [ ] **Step 3: Remove handleReset function**

  Delete the entire `function handleReset() { ... }` block (lines 444-448).

- [ ] **Step 4: Remove Reset click wiring from wireButtons**

  Delete line 560: `btnReset.addEventListener('click', handleReset);`
  (This is the line right after `btnSaveApply.addEventListener(...)`.)

- [ ] **Step 5: Update init guard**

  Change `!btnSaveApply || !btnReset` to just `!btnSaveApply`:
  ```javascript
  if (!configForm || !navList || !statusBar || !footer || !btnSaveApply) return;
  ```

- [ ] **Step 6: Remove handleReset from test-expose export**

  In the export string on line 728, remove `window.handleReset=handleReset;`. This is between `window.handleSaveApply=handleSaveApply;` and `window.renderNav=renderNav;`.

---

### Task 3: Update unit tests — Remove Reset tests, add hidden assertions

**Files:**
- Modify: `tests/unit/app.test.js:86-137` (updateUI describe block)

- [ ] **Step 1: Rewrite the updateUI describe block**

  Replace lines 86-137. Tests now check `hidden` and `disabled`. No footer visibility tests (CSS handles that):

  ```javascript
  describe('updateUI', () => {
    beforeEach(() => {
      document.querySelector('#config-form').innerHTML = `
        <input name="wifi.ssid" value="" required />
      `
      window.__test.components = [
        { id: 'wifi', fields: [{ key: 'ssid', type: 'text', label: 'SSID', opts: {} }] },
      ]
      window.__test.dirty = false
      window.setBaseline()
    })

    it('hides and disables Save when not dirty', () => {
      window.updateUI()
      expect(document.getElementById('btn-save-apply').hidden).toBe(true)
      expect(document.getElementById('btn-save-apply').disabled).toBe(true)
    })

    it('shows and enables Save when dirty', () => {
      document.querySelector('[name="wifi.ssid"]').value = 'Net'
      window.__test.dirty = true
      window.updateUI()
      expect(document.getElementById('btn-save-apply').hidden).toBe(false)
      expect(document.getElementById('btn-save-apply').disabled).toBe(false)
    })

    it('disables and hides Save when form is invalid even if dirty', () => {
      window.__test.dirty = true
      document.querySelector('[name="wifi.ssid"]').value = ''
      window.updateUI()
      expect(document.getElementById('btn-save-apply').hidden).toBe(true)
      expect(document.getElementById('btn-save-apply').disabled).toBe(true)
    })

    it('hides Save after dirty is cleared', () => {
      document.querySelector('[name="wifi.ssid"]').value = 'Net'
      window.__test.dirty = true
      window.updateUI()
      expect(document.getElementById('btn-save-apply').hidden).toBe(false)
      window.__test.dirty = false
      window.updateUI()
      expect(document.getElementById('btn-save-apply').hidden).toBe(true)
    })

    it('btn-reset does not exist in DOM', () => {
      expect(document.getElementById('btn-reset')).toBeNull()
    })
  })
  ```

- [ ] **Step 2: Run unit tests**

  Run: `npm run test:unit`
  Expected: all tests pass (green)

---

### Task 4: Update e2e tests — Remove Reset-dependent tests

**Files:**
- Modify: `tests/e2e/app.test.js:24-28` (no pending initially)
- Modify: `tests/e2e/app.test.js:29-33` (tooltip test — update for small helper)
- Modify: `tests/e2e/app.test.js:41-80` (remove Pending detection block)
- Modify: `tests/e2e/app.test.js:82-104` (update Save & Apply tests with hidden checks)
- Modify: `tests/e2e/app.test.js:160-169` (remove reset restores defaults test)

- [ ] **Step 1: Update "no pending changes initially" test**

  Replace with hidden check:

  ```javascript
    test('no pending changes initially', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('#btn-save-apply')).toBeHidden()
    })
  ```

- [ ] **Step 2: Update tooltip test to match small-helper approach**

  Replace the `title` attribute check with `aria-describedby`:
  ```javascript
    test('tooltip is rendered', async ({ page }) => {
      await page.goto('/')
      await page.locator('details#wifi summary').click()
      await expect(page.locator('[name="wifi.ssid"]')).toHaveAttribute('aria-describedby', 'wifi.ssid-helper')
      await expect(page.locator('#wifi\\.ssid-helper')).toHaveText('WiFi network name')
    })
  ```

- [ ] **Step 3: Remove entire "Pending detection" describe block**

  Delete lines 41-80 (the `test.describe('Pending detection', ...)` block and all 5 sub-tests).

- [ ] **Step 4: Update "Save & Apply button" tests to check hidden**

  In "enabled when dirty flag true" (line 84), add:
  ```javascript
      await expect(page.locator('#btn-save-apply')).not.toBeHidden()
  ```

  In "clears dirty after save" (line 93), add after the disabled check:
  ```javascript
      await expect(page.locator('#btn-save-apply')).toBeHidden()
  ```

- [ ] **Step 5: Remove "reset restores default values" test**

  Delete lines 161-168 (the `test('reset restores default values', ...)` block inside `Error states`).

- [ ] **Step 6: Run e2e tests**

  Run: `npm run test:e2e`
  Expected: all tests pass (green)

---

### Task 5: Rebuild minified JS

**Files:**
- Modify: `app.min.js` (regenerated by build)

- [ ] **Step 1: Run npm run build**

  Run: `npm run build`
  Expected: terser minifies `app.js` → `app.min.js` with no errors

- [ ] **Step 2: Verify no btn-reset references in minified output**

  Run: `grep -c 'btn-reset' app.min.js`
  Expected: 0

---

### Task 6: Run full test suite

- [ ] **Step 1: Run all tests**

  Run: `npm test`
  Expected: unit + e2e tests all pass

- [ ] **Step 2: Manual verification on test server**

  1. Open `http://localhost:8000` in browser
  2. Confirm: footer invisible, no Save button visible
  3. Change a field (e.g. SSID), tab away
  4. Confirm: footer appears with enabled Save button
  5. Click Save
  6. Confirm: footer hides, button gone
  7. Disconnect network / stop test server momentarily
  8. Confirm: error appears in status bar, footer visible (even without button)
