---
id: i-2026-09-15-gates-silently-off
promise: gates-ran-at-every-checkoff
source: desk
status: fixed
date: 2026-09-15
---

## Symptom
Eight checkoffs passed Gate B with two trajectory rows still non-terminal; nothing was red because nothing ran.

## Root cause
Hook commands were registered relative to the session's working directory (`node .claude/hooks/x.js`). Claude Code runs hooks in the session's cwd and treats a load failure as non-blocking, so after any `cd` the gate chain failed to load with exit 1 and the model never saw it.

## Fix
hook-cwd-independence (closed 2026-09-15): every hook registered by the project root through `hookCommand(name)` — `node "${CLAUDE_PROJECT_DIR:-.}"/.claude/hooks/<name>.js` — and `indusk update` rewrites the old form. Found by reading, which is why the source is `desk`; the gate ledger (Day step 5) is what would have detected it from a run.
