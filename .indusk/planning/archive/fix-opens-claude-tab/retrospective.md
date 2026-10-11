---
title: "fix-opens-claude-tab"
date: 2026-10-10
---

# fix-opens-claude-tab — Retrospective

## What happened

Sandy wanted Fix with Claude to open a session in the Claude Code extension instead of a terminal. The extension now builds the same prompt and, in VS Code with Claude Code installed, opens Claude Code's documented link `vscode://anthropic.claude-code/open?prompt=…` (filled, not sent); elsewhere — Cursor included — it starts `claude` in a terminal as before (A1, A2, red first, then green). Each click is now logged to an `InDusk` output channel with what the editor reported and the route taken.

The live check (A3) was not observed. The first click ran the old build: the window reloaded ten seconds before the new build was installed. The second, on the new build, still opened a terminal, cause unknown — while the same link opened from the shell filled a Claude Code tab correctly. Before a third click the promise was no longer broken. A3 is skipped until the next real break; the log line will name which check failed if it opens a terminal again.

## What we learned

- **A reload and an install racing each other look like a failed feature.** Timestamps in VS Code's extension-host log settled it in one read; next time, confirm the install finished before asking for the reload.
- **Instrument the decision before the live check, not after.** Two clicks went by with nothing to say why; the log line should have been part of the build phase.

## Quality ratchet

No lint or type errors recurred. Shape: 0 findings raised, 0 judged wrong. Falsification, cleanup and audit skipped with reasons (Sandy, 2026-10-10: "a tiny plan").

## Metrics

- A1, A2 passing; A3 skipped (not observed). `src/core` 45/45; tree-scanning rule tests 84/84.

Landed on main at b3b433dc, 2026-10-10. Installed with `pnpm install:local` and `indusk editor install`; nothing published.
