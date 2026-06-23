# Checkbox Type (archived)

## Why removed

`checkbox` and `switch` are redundant — both represent boolean values.
`switch` is the Pico-CSS-native on/off toggle and is visually more
appropriate for ESP32 settings. Keeping both added bytes to `app.js`
(dual-type guards) and `index.html` (checkbox-specific CSS workaround).

Removed in 2026-06-23. See `docs/superpowers/specs/2026-06-23-remove-checkbox-type.md`
for the full design.

## Future revival

If a multi-boolean group (dict of labeled booleans) is needed later, it
would warrant a new field type (e.g. `checkgroup`) with its own wire format:

```json
["checkgroup", "Features", {
  "options": [["verbose", "Verbose Logging", true],
              ["telnet", "Telnet", false]]}]
```

This would render as a group of checkboxes under one legend. The current
`checkbox` type was a single boolean field — not this.
