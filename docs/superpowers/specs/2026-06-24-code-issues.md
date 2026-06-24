# Code Issues Found During Doc Tidy — 2026-06-24

## 1. Duplicate `populateFromComponents(statusComponents)` call

**File:** `app.js:280-282`

```js
renderForm();
populateFromComponents(statusComponents);       // line 280
populateFromComponents();                        // line 281
if (statusComponents.length > 0) populateFromComponents(statusComponents);  // line 282
```

Line 280 already populates status fields. Line 282 does the same thing redundantly. The `if` guard on 282 also always passes since `statusComponents.length > 0` is guaranteed by being inside the first-run branch (where statusComponents was just built from `processStatus` data).

**Fix:** Remove line 282.

---

## 2. Inconsistent indentation in `processStatus`

**File:** `app.js:281-283`

Lines 281-283 use 4-space indent while the enclosing `if` body on lines 279-280 and 284 uses 8-space indent. The code is functionally inside the `if` block but the indentation misleadingly suggests lines 281-283 are at the same level as the `if` itself.

**Fix:** Re-indent lines 281-283 to match the surrounding block.

---

## 3. `reportValidity()` not called on blur

**File:** `app.js:684`

```js
if (!el.checkValidity()) { updateUI(); return; }
```

The blur handler for text/password/email/tel/url fields calls `checkValidity()` to gate the auto-apply, but never calls `reportValidity()`. This means Pico CSS `:invalid` pseudo-class may not trigger on some browsers, and the user sees no visual feedback that a field is invalid.

**Fix (from backlog triage item #1):** Call `el.reportValidity()` before/after `checkValidity()`.

---

## 4. Status processing modifies settings baseline

**File:** `app.js:283`

```js
setBaseline();
```

In `processStatus()` first-run branch, after re-rendering the form (which includes both status AND settings fields), `setBaseline()` captures the baseline for the settings `components` array. This is correct behavior (re-establish after re-render) but is triggered by a status event — status changes shouldn't need to touch settings baseline at all. A future optimization would be to render status fields without destroying settings DOM elements.

---

## 5. `_dirty` position in WS message doesn't match spec

**File:** `test_server/main.py:187`

```python
await ws.send_json({"type": "settings", "_dirty": ..., "data": build_settings()})
```

The spec says `_dirty` appears before `type` and `data`. Here it appears after `type`. JSON key order doesn't affect parsing, so this is a documentation nit only. But the spec should match reality.
