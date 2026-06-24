# Checkbox Type Archive

The `checkbox` field type was removed in favor of `switch` (the Pico-CSS-native
boolean toggle). Both types represented the same boolean value, so keeping both
was redundant.

The old implementation, including `checkbox`-specific guards in `serialize()`,
`populateFromComponents()`, `createField()`, and a layout workaround in
`index.html`, is preserved in the `checkpoint/checkbox` branch.

If a multi-boolean grouping type is needed later (e.g., `checkgroup` rendering
a dict of labeled booleans), it would be a new field type with its own wire
format.

