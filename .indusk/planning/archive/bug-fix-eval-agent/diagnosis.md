# Diagnosis — Eval Agent Silent Failure

**Date:** 2026-04-18
**Plan:** bug-fix-eval-agent
**Root cause identified via:** the `improvement-eval-agent-open-telemetry` plan's falsification ritual (see [`falsification.md`](../archive/improvement-eval-agent-open-telemetry/falsification.md)), NOT directly via Dash0 trace inspection — because the hook-spawned evaluator dies BEFORE it can initialize OTel, so there is no span to look at.

## The observable

- `.indusk/eval/results.log`: last successful hook-spawned scorecard `2026-04-11T14:45:23Z` (entry's own timestamp). Everything since has been either silence or error entries about missing package paths (resolved post-rename) — **no successful scorecards from the hook path**.
- `.indusk/eval/system.log`: every `jj describe` since has logged `evaluator spawned — source: commit, pid: N`, never followed by `evaluator process started — changeId: ...`, `evaluator module loaded — ...`, `evaluator completed — ...`, or `evaluator crashed — ...`. The spawned subprocess vanishes.
- Dash0 `agent` dataset: receives eval.run + children from direct invocations only (confirmed by correlating spans' `changeId` attribute vs. `results.log` entries). No eval.run from hook-spawned runs appears in Dash0. OTel itself works; the hook's spawned process never reaches `initEvalOtel`.

## The failing span … isn't

There is no failing Dash0 span for the hook-spawn path. That's the clue. If `initEvalOtel` had run, there would be an `eval.run` root at minimum. Its absence means the spawned process crashes before line 1 of `otel.ts` executes.

The falsification ritual's specific-hypothesis discipline caught this:

> "What if the hook's embedded script violates some contract we haven't re-verified since the rename?"

## Root cause

**File:** `apps/indusk-mcp/hooks/eval-trigger.js`
**Lines:** 229–237 (the `evaluatorScript` template literal)
**Detail:** the hook spawns a detached Node child with `node --input-type=module -e <evaluatorScript>`. The inline script's first two statements are:

```js
const fs = require("fs");
const path = require("path");
```

`require` is not defined in ESM scope. The subprocess throws `ReferenceError: require is not defined in ES module scope` at parse, **line 2 of the script**, before any user code runs — before `import(evaluatorRunnerPath)`, before `initEvalOtel`, before anything observable.

`stdio: "ignore"` on the spawn (line 274) silences the stderr. The detached + unref'd parent never sees the crash.

**Proof:** ran the exact minimal pattern in isolation:

```sh
node --input-type=module -e 'const fs = require("fs"); console.log("got fs:", !!fs);'
```

Output:

```
ReferenceError: require is not defined in ES module scope, you can use import instead
    at file:///[...]/[eval1]:1:12
```

Captured in the failing falsification test at `apps/indusk-mcp/src/__tests__/falsification-hook-esm-require.test.ts`. Currently `describe.skip` — flip to `describe` in Phase 2 when the fix lands and it turns green.

## Why this broke on 2026-04-11

Probably a Node version or Claude Code hook runtime change that flipped the default/implicit module type to ESM. Before that, the inline script may have run as CJS (where `require` IS defined). The specific trigger isn't identified and isn't necessary to fix — the fix holds regardless of what changed upstream.

## The fix (Phase 2)

Two correct shapes:

### Option A (preferred): Convert the inline script to ESM-native imports

Use static `import` or `createRequire` from `node:module`. In inline `-e` mode with `--input-type=module`, static imports at the top of the script work fine:

```js
import * as fs from "node:fs";
import * as path from "node:path";
// ... rest of script
```

### Option B: Switch the spawn to CJS

Drop `--input-type=module`, change `import(...)` in the body to a CJS-compatible dynamic import pattern. More invasive — we'd lose top-level `await` in the inline script.

**Recommend Option A.** Minimal change, preserves top-level await, matches the rest of the codebase's ESM-first convention.

## The change (specific)

Edit `apps/indusk-mcp/hooks/eval-trigger.js` `evaluatorScript` template literal:

**Before (lines 230–237):**
```js
const fs = require("fs");
const path = require("path");
function syslog(msg) {
  try {
    fs.mkdirSync(path.dirname("${syslogPath}"), { recursive: true });
    fs.appendFileSync("${syslogPath}", new Date().toISOString() + " " + msg + "\\n");
  } catch {}
}
```

**After:**
```js
import { mkdirSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";
function syslog(msg) {
  try {
    mkdirSync(dirname("${syslogPath}"), { recursive: true });
    appendFileSync("${syslogPath}", new Date().toISOString() + " " + msg + "\\n");
  } catch {}
}
```

Also update the later `path.join(...)` call in the `.catch` block (line 257) and `fs.mkdirSync`/`fs.appendFileSync` on lines 258, 267.

## Regression test (Phase 2)

Unskip the falsification bounty test at `apps/indusk-mcp/src/__tests__/falsification-hook-esm-require.test.ts`. After the fix, the grep-against-real-source test flips from failing to passing. Rename from `falsification-*` to `evaluator-runner.regression.test.ts` per the plan's trajectory naming (or keep the falsification name and add a companion — the plan allows either).

## Scope summary

- One file touched: `apps/indusk-mcp/hooks/eval-trigger.js`
- ~6 lines changed
- No external API surface change
- Regression test already exists (falsification bounty) — just needs to be un-skipped after fix
- Phase 3 hardening (silent-exits-become-loud + uncaughtException handlers) is additive — different scope
