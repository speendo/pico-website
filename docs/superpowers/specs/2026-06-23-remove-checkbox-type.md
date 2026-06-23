# Remove `checkbox` Type

## Motivation

`checkbox` and `switch` are redundant — both represent boolean values. `switch` is the Pico-CSS-native approach for on/off toggles and is visually more appropriate for ESP32 settings. Keeping both adds bytes to `app.js` (dual-type guards) and `index.html` (checkbox-specific CSS workaround).

No current or planned use case for plain `checkbox`. If a multi-boolean grouping type is needed later (e.g. `checkgroup` rendering a dict of labeled booleans), it would be a new field type with its own wire format.

## What Changes

### `app.js`

1. `serialize()` (line 45): `field.type === 'checkbox' || field.type === 'switch'` → `field.type === 'switch'`
2. `populateFromComponents()` (line 86): same change
3. `createField()` (lines 690-693): the `if (type === 'switch')` conditional for `input.role` becomes unconditional — `input.role = 'switch'` always runs (no `checkbox` type to skip it for)

`readFormValue()`, `bindChangeListeners()`, and `buildPatch()` are unaffected — they use DOM attributes (`el.type`, `el.checked`) or reference `field.type` for serialization, not the wire type string.

### `index.html`

Remove the CSS rule (lines 34-39):

```css
#config-form div:has(> [type="checkbox"]) > small {
  display: block;
  width: 100%;
  margin-bottom: var(--pico-spacing);
  color: var(--pico-muted-color);
}
```

This was a layout workaround for plain `checkbox` fields. Switches use Pico CSS default styling and don't need it.

### `test_server/main.py`

GPIO fields change wire type from `"checkbox"` to `"switch"`:

- `"enabled"`: `"checkbox"` → `"switch"`
- `"inverted"`: `"checkbox"` → `"switch"`

### `docs/superpowers/specs/2026-06-18-unified-settings-design.md`

Remove `checkbox` from the supported type list (line 58).

### Tests

- `tests/unit/app.test.js`: update field type strings and test descriptions
- `tests/e2e/app.test.js`: update test descriptions referencing checkbox

## Archive

Before cleanup, the current checkbox implementation is captured in branch `checkpoint/checkbox` with a brief note at `docs/superpowers/archive/checkbox.md` explaining the removal rationale and sketching a future `checkgroup` type for dict-of-booleans grouping.
