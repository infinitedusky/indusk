---
name: a-browser-test-passes-on-a-cold-cache
kind: state
lifetime: holds
state: enforced
domain: gates
owner: template-reload-on-cold-cache
sites:
  - apps/indusk-mcp/vitest.templates.config.ts
tests:
  - apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts
incidents: []
---

The browser template tests pass on the first run after Vite's dependency cache is cleared, with no page reload partway through the run.

## History
- 2026-10-15 — declared (template-reload-on-cold-cache), from its planning conversation.
- 2026-10-15 — enforced, confirmed for template-reload-on-cold-cache: proven by row A1, row A5, row A6, row A7.
