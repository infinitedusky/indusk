---
title: "system-tests-catch-up"
date: 2026-10-09
---

# system-tests-catch-up — Retrospective

## What happened

The 1.69.0 release stopped on three system-tier tests. None was a product bug: each asserted what a deliberate 2026-10-08 change had replaced. The catchup skill was reworded ("outrank the roadmap"), and the admin began recording production breaks itself, which turns a broken promise `known-violated` (amber) and opens the incident a hand-written one sat beside. The three tests were rewritten to assert the new behaviour (A1–A3, regression guards), and the whole system tier passes (A4).

Sandy noticed that every system-tier run opened a VS Code window saying all extensions were disabled, and asked whether the test tested what it claimed. It did not: the install contract test (vscode-extension A16) ran VS Code with `--disable-extensions` and loaded the installed folder in development mode. A5 now loads the extension as installed, through a probe extension. It still activates, so the extension itself was fine.

## What we learned

- **A tier that runs at nobody's moment falls behind silently.** From 2026-10-08 the system tier ran at neither landing nor phase close, so the first run after two deliberate changes was a release, which it stopped. release-records-its-failures moves the run after the publish and records what it finds; landing is its follow-up.
- **A test's launch flags can quietly narrow what it proves.** `--disable-extensions` plus a development-mode load meant "activates after install" was never tested on the install path. The visible symptom (a disabled-extensions window) was the only clue, and a person noticed it, not a check.

## Quality ratchet

No lint or type errors recurred; no Biome rule is warranted. Shape: 0 findings raised across both phases, 0 judged wrong.

## Metrics

- 3 test files rewritten, 1 probe extension fixture added, 1 CLAUDE.md line, 1 changelog entry.
- System tier: indusk-mcp 42 files / 170 tests, indusk-admin 13 / 56, vscode-extension 1 / 3, all passing.
- Falsification, cleanup and audit skipped with reasons (test-only repair).

Landed on main at 24518255, 2026-10-09. Installed with `pnpm install:local`; nothing published.
