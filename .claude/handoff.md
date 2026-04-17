# Handoff

**Date:** 2026-04-18
**Session:** Multi-plan arc around the eval agent. Closed three plans (`agent-roles`, `improvement-eval-agent-open-telemetry`, `bug-fix-eval-agent`), shipped indusk-mcp 1.17.0 → 1.19.1, spawned `eval-agent-mcp-access` as the next work item.

## What Was Being Worked On

Close-out of the agent-roles arc. Specifically:

1. Shipped `agent-roles` (1.17.0) — three-tier agent split, highlights queue, `/highlight` command, role docs
2. Phase 3 smoke revealed the eval-judge had been silently failing since 2026-04-11 → reopened and spawned 2 blocking micro-plans
3. Shipped `improvement-eval-agent-open-telemetry` (1.18.0 → 1.18.1 → 1.18.2 → 1.19.0) — OTel traces + logs + Dash0 agent-dataset routing
4. Shipped `bug-fix-eval-agent` (1.19.1) — fixed the silent crash (CJS `require()` in ESM-spawned Node subprocess) + uncaughtException/unhandledRejection handlers (silent-exits-become-loud)
5. Re-ran agent-roles Phase 3 smoke — hook-spawn works, scorecards arrive in 120s, BUT evaluator writes `graphitiWrites: 0` across every run because the `claude --print` subprocess has no MCP access
6. Spawned `eval-agent-mcp-access` to fix that

## Where It Stopped

Last thing completed: committed the close-out omnibus commit (`kpsnqryz 762914f4`) containing all archive moves, retros, lessons pages, and the new plan's brief. `jj status` shows working-copy changes because in jj the working copy IS a commit — those files are the CONTENTS of `kpsnqryz`, not uncommitted work.

The NEXT plan to work is `eval-agent-mcp-access` — brief accepted, impl.md not yet written.

## What's Next

1. **`jj new` before starting** to establish a clean boundary (recommended — every time you described-over a previous commit this session was a session-start-hygiene issue).
2. **`/planner eval-agent-mcp-access`** — create the impl.md following the `bug-fix-eval-agent` pattern (3 phases: diagnosis, fix, smoke). The brief at `.indusk/planning/eval-agent-mcp-access/brief.md` lists 4 hypotheses to verify in Phase 1.
3. **Most likely fix** per Phase 1 diagnosis: add `--mcp-config .mcp.json` flag to the hook's `claude --print` spawn args at `apps/indusk-mcp/hooks/eval-trigger.js` around line 272. Test by running the hook's exact invocation manually with + without that flag and seeing whether `mcp__indusk__*` tools become invokable from inside Claude.
4. **After that ships**: the original agent-roles Phase 3 smoke can actually complete — 3 queued highlights in `.indusk/highlights.jsonl` should get processed into Graphiti episodes, `.indusk/highlights-processed.jsonl` should grow, and `graphitiWrites` should go > 0.
5. **Then**: `/falsify` + `/retrospective` for eval-agent-mcp-access. Archive.

## Open Issues

- **`.indusk/highlights.jsonl` has 3 queued entries** that have never been processed (h-20260417-001, h-20260417-002, h-20260418-001). They'll stay queued until `eval-agent-mcp-access` ships. Not a bug — just pending work.
- **`.indusk/highlights-processed.jsonl` doesn't exist yet.** Will get created the first time the evaluator successfully calls `mcp__indusk__highlight_mark_processed`, which requires the MCP-access fix.
- **Claude Code's process env has the stale `eu-west-4` OTel URL** (captured at launch before composable.env was loaded). This means spans from hook-spawned evaluators go to a dead hostname. Not critical — a Claude Code restart + `set -a; source .indusk/extensions/dash0/.env.local; set +a` in the launching shell would fix it. Direct-invocation paths (when we source ce env first) work correctly.
- **The `evaluator-session.json` was cleared** during smoke; will get recreated on next `jj describe`.
- **`graphitiWrites: 0` is the symptom that motivates `eval-agent-mcp-access`.** If you see a scorecard land with `graphitiWrites > 0`, the MCP-access fix is working.

## Decisions Made This Session

- **Three-tier agent roles documented in CLAUDE.md Architecture + Key Decisions.** Working agent writes highlights, eval agent processes into Graphiti, infrastructure is the substrate. Already in CLAUDE.md.
- **Straight-to-impl micro-plan pattern validated 3×** (OTel, bug-fix, MCP-access). Brief + impl only, no ADR, no research. Works for small focused scope. Worth codifying as a first-class planner option in Dusk v2 — captured as a retro-lesson highlight.
- **Plan's architectural contract ≠ plan's runtime operation** — label them separately in impl.md going forward. agent-roles shipped the architecture but the operation (eval agent actually processing highlights) required three downstream plans. Captured in agent-roles' retrospective.
- **Resume-session prompts drop non-scorecard instructions** — the `claude --print --resume` short prompt doesn't re-state Steps 4-7 from the full catchup prompt. Either re-inject on every resume OR don't use resume for workflows with per-run requirements. Captured in agent-roles lessons.
- **Deferred Verification mitigations need specific observables per code-path layer** — "run it and see" hides too many silent-failure points. Future plans should write one observable per layer. Captured in agent-roles lessons.

## Watch Out For

- **`OTEL_EXPORTER_OTLP_ENDPOINT` is stale in Claude Code's process env** (see Open Issues). Restart Claude Code + source composable.env's `.env.local` at launch for correct `europe-west4` URL. Without this, OTel spans from hook-spawned evaluators can't reach Dash0 (though direct invocations still work if you source env first).
- **`jj describe` reuses the current change unless you `jj new` first.** Every time you want a new commit, `jj new` is required. Several times this session I described-over previous work; fixed retroactively by re-describing. Start sessions with `jj new -m ""` to avoid.
- **The hook's inline `evaluatorScript` is ESM** — never add `require()` to it. Use `import` from `node:` specifiers. The regression test at `apps/indusk-mcp/src/__tests__/falsification-hook-esm-require.test.ts` catches quote/whitespace/node:-prefix/backtick regressions, but not arbitrary indirection.
- **Don't run `pnpm ce` from sub-app dirs** — run from repo root. `apps/indusk-mcp/ce.json` was a legacy file that broke ce 1.20.2; we deleted it.
- **Falsification is load-bearing for this pipeline.** Each of the 4 plans' falsification rounds found one specific bug the author missed. Skip with `falsification: skipped` + `falsification_reason: "..."` ONLY for truly trivial plans.
- **`pnpm publish` requires OTP** from authenticator. User does this step, not the agent.
- **`indusk update` syncs skills/hooks into the project** but doesn't upgrade the global `@infinitedusky/indusk-mcp`. For that: `npm i -g @infinitedusky/indusk-mcp@latest`.
- **3 new lessons pages added to docs** (`eval-agent-otel.md`, `eval-agent-bug-fix.md`, `agent-roles.md`) but not yet added to VitePress sidebar config. A future docs pass should wire them into `apps/indusk-docs/src/.vitepress/config.ts`.

## Catchup Status
- [x] mcp-ready
- [x] handoff
- [x] lessons
- [x] skills
- [x] health
- [x] context
- [x] plans
- [x] extensions
- [x] graph
- [x] graphiti
