# Contributing

Run `pnpm install` and `pnpm check` before opening a change.

Changes to the allowlist require tests for scripts, event attributes, active
URLs, DOM clobbering, embedded documents and network-loading elements. The
default renderer must continue to return a `DocumentFragment` and must never
write untrusted strings through `innerHTML`.

