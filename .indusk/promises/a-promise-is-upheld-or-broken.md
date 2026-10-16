---
name: a-promise-is-upheld-or-broken
kind: state
lifetime: holds
state: enforced
domain: admin
owner: one-promise-language
sites:
  - apps/indusk-admin/src/lib/promise-dashboard.ts
  - apps/indusk-mcp/src/lib/promises/health-line.ts
  - apps/indusk-mcp/src/lib/promises/vocabulary.ts
  - apps/vscode-extension/src/core/view.ts
tests:
  - apps/indusk-mcp/src/lib/promises/outcome-words.test.ts
  - apps/indusk-mcp/src/lib/promises/signal-writers.test.ts
  - apps/indusk-mcp/src/lib/promises/known-broken.test.ts
  - apps/indusk-admin/src/components/PromiseWords.test.tsx
  - apps/indusk-mcp/src/__tests__/promises-cli-words.test.ts
  - apps/vscode-extension/src/core/view-words.test.ts
  - apps/vscode-extension/src/core/activity.test.ts
  - apps/indusk-mcp/src/__tests__/promise-words.test.ts
  - apps/indusk-mcp/src/lib/promises/record-broken.test.ts
  - apps/indusk-mcp/src/lib/always-on/announce-broken.test.ts
  - apps/indusk-mcp/src/lib/promises/standing.test.ts
  - apps/indusk-mcp/src/__tests__/suite-speed.test.ts
  - apps/indusk-admin/src/components/ui/PromiseRow.test.tsx
incidents: []
---

Every signal, record and page says a promise or a clause is upheld or broken — holding or broken when live, no signal when unknown — and never failed, passed or violated.

## History
- 2026-10-15 — declared (one-promise-language), from its planning conversation.
- 2026-10-16 — enforced, confirmed for one-promise-language: proven by row A1, row A2, row A3, row A4, row A5, row A6, row A7, row A8, row A9, row A10, row A11, row A12, row A13, row A14, row A15, row A16, row A17, row A18, row A19, row A20, row A21.
