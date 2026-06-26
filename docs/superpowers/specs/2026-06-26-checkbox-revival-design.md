# Checkbox Three-State + Helper Text CSS

## Motivation

The `checkbox` field type was originally removed in favor of `switch` (both
represented the same boolean value). Unlike `switch`, a plain checkbox supports
the **indeterminate** state — a visual "not yet set" state that is neither
checked nor unchecked. For settings where the user must explicitly choose (no
safe default), the indeterminate checkbox signals that the field requires
attention.

Additionally, PicoCSS v2.1.1 provides `<small>` helper text styling for
`<input>`, `<textarea>`, and `<select>` via its global `small` rule, but its
`margin-top: calc(var(--pico-spacing) * -0.75)` negative margin assumes the
helper sits directly after a block-level input. For inline elements
(checkbox, radio, switch, range) and for `<select>` inside a `<div>` wrapper,
this negative margin creates visual gaps. A targeted CSS rule normalises the
helper text appearance for these types.

## Wire format

| State | Wire value | HTML state |
|---|---|---|
| Checked | `true` | `checked`, `indeterminate=false` |
| Unchecked | `false` | `checked=false`, `indeterminate=false` |
| Unset | `null` | `checked=false`, `indeterminate=true` |

`null` is distinct from `false` and `true` on the wire. The state machine
comparisons (`String(serverVal) === String(lastSent[key])`) already
distinguish them: `String(null)` = `"null"`, `String(true)` = `"true"`,
`String(false)` = `"false"`.

## Click behavior

`indeterminate` is a JS-only property — the browser never returns a checkbox
to indeterminate via user interaction. When the user clicks an indeterminate
checkbox, the browser: (1) sets `indeterminate = false`, (2) sets
`checked = true`. Subsequent clicks cycle checked ↔ unchecked.

This is desirable for the "not yet set" semantics: once the user clicks, they
have made an explicit choice and the checkbox stays binary from then on.

## DOM structure (createField)

The `checkbox` type uses the same structure as `switch` but without
`role="switch"`:

```html
<div>
  <input type="checkbox" name="prefix.key" id="prefix.key">
  <label for="prefix.key"> Label*</label>
  <small id="prefix.key-helper">tooltip text</small>
</div>
```

**On populate (null):** `el.checked = false; el.indeterminate = true`
**On populate (true/false):** `el.checked = !!value; el.indeterminate = false`
**On serialize:** `el.indeterminate ? null : el.checked`

## Changes per function

### createField
- Add `type === 'checkbox'` branch alongside the existing `type === 'switch'`
  branch, but omit `input.role = 'switch'`.

### serialize (already has checkbox branch)
- Change `el.checked` → `el.indeterminate ? null : el.checked`

### populateFromComponents (already has checkbox branch)
- When `fopts.value` is `null`: set `el.checked = false` and
  `el.indeterminate = true`
- When truthy/falsy: keep current `el.checked = !!fopts.value` plus
  `el.indeterminate = false`

### readFormValue
- Currently returns `el.checked` for checkbox — change to
  `el.indeterminate ? null : el.checked`

### bindChangeListeners
- The blur/change handler for checkbox currently reads `el.checked` directly
  in the inline ternary. This uses `readFormValue` instead (already the case
  for radio), but the checkbox path in the handler uses a direct `el.checked`
  — align it to use `readFormValue`.

### Validation handler
- Add a custom check: if field is `type === 'checkbox'` and `required` and
  `el.indeterminate`, treat as invalid (`aria-invalid="true"`, block send).
  Native `el.checkValidity()` does not flag indeterminate as invalid.
- This is a small addition to the blur/change handler's validity check.

## CSS rule (index.html)

Add to the existing `<style>` block in `index.html`:

```css
input[type="checkbox"] + label + small,
fieldset + small,
select + small,
input[type="range"] + small {
  display: block;
  color: var(--pico-muted-color);
}
```

This overrides PicoCSS's global `small { margin-top: calc(...) }` for these
element types where the negative margin creates visual gaps inside the `<div>`
wrapper. The `color` and `font-size` still come from PicoCSS's global `small`
rule.

## Validation

| Scenario | `aria-invalid` | Blocks save/apply |
|---|---|---|
| Not required, indeterminate | `"false"` | No |
| Not required, checked | `"false"` | No |
| Not required, unchecked | `"false"` | No |
| Required, indeterminate | `"true"` (custom check) | Yes |
| Required, checked | `"false"` | No |
| Required, unchecked | `"true"` (native) | Yes |

## Docs update

Add `checkbox` row to the supported types table in
`docs/reference/field-format.md`:

```diff
+| `checkbox` | `<input type="checkbox">` | yes | settings, status |
```

Add a note under "value Coercion":

```diff
+| `checkbox` | boolean or null (`el.indeterminate ? null : el.checked`) |
```
