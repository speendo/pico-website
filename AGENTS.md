# Project Constraints

The target server is an **ESP32** with limited RAM, flash storage, and CPU.
All design decisions must favor shifting computation to the client (browser)
to minimize server load.

- Prefer client-side computation over server-side where possible
- Keep wire formats compact — every byte on the wire matters
- Reuse JS functions across HTTP and WebSocket paths (DRY)
- Avoid unnecessary dependencies on the ESP32
- Static files (HTML, JS, CSS) are served from the ESP32's filesystem

See `docs/superpowers/specs/2026-06-18-unified-settings-design.md` for the
current architecture and API design.
