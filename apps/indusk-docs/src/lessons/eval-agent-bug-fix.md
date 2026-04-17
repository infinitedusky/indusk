# Lessons — Eval Agent Silent Failure Fix

Distilled from the [`bug-fix-eval-agent`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/bug-fix-eval-agent) plan, shipped as indusk-mcp 1.19.1.

## Absence of signal is a diagnostic signal

When debugging silent failures, look for what *should have been* logged and wasn't.

For this bug, OTel spans in the Dash0 "agent" dataset showed exactly zero `eval.run` entries for hook-spawned `changeId`s — but direct-invocation `changeId`s had the full span tree. The absence localized the failure to "before `initEvalOtel` runs" — which is a very narrow window. That narrowing made the bounty hunt possible; the specific hypothesis "the inline script's ESM contract is violated somewhere" fell out naturally.

**Rule:** when your monitoring is silent, don't assume "nothing happened." Cross-check against other code paths where the same signal WOULD have fired, and let the gap between "should have" and "did" guide the search.

## Regression tests written from a single observed failure are narrower than the invariant

The original regression test used `/require\("fs"\)/` — catches the exact pre-fix double-quoted pattern. Six semantically-equivalent variants (single quotes, backticks, `node:` prefix, whitespace) would have slipped through. The falsification ritual found this and the fix (Phase 4) broadened the regex.

**Rule:** when you write a regression test, ask "what invariant is this protecting?" not "what was the bug?" Then write the test against the invariant. The first version is almost always too narrow.

## `stdio: "ignore"` on detached subprocesses with inline scripts is a latent bug farm

The original bug existed for ~6 days in silence. The subprocess spawned, hit `ReferenceError` at parse, died. `stdio: "ignore"` swallowed the stderr. No log, no alert, no Dash0 signal, no CI failure — because the bug was in an inline script that never runs in unit tests.

Two mitigations, both required:

1. **Silent-exits-become-loud discipline:** add `process.on("uncaughtException")` and `process.on("unhandledRejection")` handlers that write a loud error entry to a known file before `process.exit(1)`. See `apps/indusk-mcp/hooks/eval-trigger.js` `writeErrorResult()` for the pattern. Note the limit: these handlers only help if the subprocess survives long enough to REGISTER them. Parse-time errors happen before that — which is why the next point matters.

2. **Keep inline spawn scripts short or externalize them.** Every byte of inline spawn code is a surface for parse failure. An externalized helper file at a fixed path in the package has its own `package.json` type declaration, and the hook just `spawn("node", ["path/to/wrapper.js", ...])`. The long-term fix for bugs of this class is to eliminate the inline-script surface entirely.

## ESM/CJS boundary bugs come from module-context assumptions

The bug wasn't in ESM or CJS separately — it was in assuming an inline script's module context. When you spawn a subprocess with code strings (`node -e "..."` or `node --input-type=X -e "..."`), you MUST write the code in the language that the flag/heuristic declares.

If you see `--input-type=module`, the code is ESM: use `import` statements, never `require()`. If you see `--input-type=commonjs` (or no flag, depending on Node version + package.json detection), the code is CJS: use `require()`, never top-level `import`.

**Rule:** when reviewing any `spawn("node", args)` call in a hook or helper, read the args and the inline code string together. They are one unit. If the flag says ESM but the script uses `require`, that's the bug.

## Micro-plans work best when the predecessor plan delivered clean diagnostic tooling

This bug-fix plan shipped four phases in ~90 minutes because the upstream `improvement-eval-agent-open-telemetry` plan had already (a) shipped OTel traces + logs, and (b) run the falsification ritual that identified the root cause. A cold-start bug-fix plan without this scaffolding would have needed its own diagnosis phase and would have taken hours longer.

**Rule:** the discipline of the predecessor plan compounds into the next. Shipping observability FIRST, then using it as the diagnostic for subsequent plans, is the right order.

## Falsification ritual has positive ROI even on 1-file fixes

The falsification round on this plan (~$0.50 agent time) bought a ~10× broader regression guard. Don't skip the ritual for small plans — the discipline is worth more than the ceremony cost. The only plans where skipping is honest are typo fixes and pure renames with no behavior change.

---

## Pointer

Full retrospective: [`.indusk/planning/archive/bug-fix-eval-agent/retrospective.md`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/bug-fix-eval-agent/retrospective.md)

Falsification log: [`.indusk/planning/archive/bug-fix-eval-agent/falsification.md`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/bug-fix-eval-agent/falsification.md)

Diagnosis: [`.indusk/planning/archive/bug-fix-eval-agent/diagnosis.md`](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/archive/bug-fix-eval-agent/diagnosis.md) — canonical example of diagnosing a silent-parse-crash using OTel signal-absence.
