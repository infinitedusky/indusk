---
title: "main-suite-green"
date: 2026-10-14
status: complete
---

# main-suite-green — Research

## Question

Why does `pnpm test` fail on main (2026-10-14, after skip-reason-why landed at `fd08052e`), and what is the smallest correct fix for each failure?

## Background

Landing skip-reason-why ran the everyday suite and found failures, none from that plan. Run per package on main: `apps/indusk-mcp` 7 failed / 2826 passed; `apps/indusk-admin` 684 passed. From the root (`pnpm test`, every package at once) the admin also failed `new-project-accept` A30 (5 s timeout), `new-project-accept-route` A5 and, once, `cockpit-nav` A13 (that one was skip-reason-why's fixture, fixed before landing); each passes alone.

## Findings

Six causes behind the seven mcp failures. None is a regression in shipped behaviour.

### 1. `always-on-cleanup.test.ts:98` (A29, the Jaeger URL is normalized once) — the test's pattern is too broad
It counts every `replace(/\/+$/, "")` in source. `f07829219` (brief-as-the-contract) added two in `lib/promises/interface-files.ts:29,59` that strip trailing slashes from *file paths*. The URL rule is still once, `lib/promises/telemetry.ts:101`. Fix: match `.trim().replace(/\/+$/, "")`, the URL form. Deterministic.

### 2. `impl-corpus.test.ts:114` (A4, every impl that validated still validates) — three causes, one of them a real bug
- **The contract check cannot read a large impl reliably (code bug).** `hooks/validate-impl-structure.js:191` pipes the impl to `indusk promises contract <plan> --impl-stdin`; `src/bin/commands/promises.ts:257` reads it with `readFileSync(0)`, which throws `EAGAIN` (or the hook sees `EPIPE`) on a pipe once the impl is over ~64 KB. Six archived impls are 68–143 KB, so which of them is refused changes run to run. Introduced by `bb886556a` (planner-promises). Fix: read stdin asynchronously (`text(process.stdin)` from `node:stream/consumers`). This is the one failure a person writing a plan would meet: a large impl can be refused, at random, by the write hook.
- **Two archived impls cite rows they do not have (data).** `archive/browser-template-claims` (Build Phase 1 cites A1, A3, A9, A13 — cases of another plan's file) since `018ad0408`; `archive/untrack-mcp-json` (cites T4) since `45fd80d26`.
- **One active brief predates a rule (data).** `cockpit-audit-fixes`'s brief has no `## Looks`; its impl lists admin files and was approved 10-10, two days before `f07829219` made the section required.
- The hook runs the *installed* `indusk`, so the result also depends on what is on PATH.

### 3. `looks-admin-components.test.ts:79` (A2, `promise: a-component-has-one-implementation`) — approved looks on main ahead of their code
`plan-looks.*` (plan-page-shows-its-looks, `219d77582`, 0 of 23 items built) and `subplan-row.*` (plan-stories, `607ebbf18`, 0 of 71; `SubplanRow.tsx` exists only on `plan/plan-stories`). `plans approve` merges a plan's documents and looks to main before any code, so every plan that proposes a new component turns this test red from its approval to its landing. Deterministic.

### 4. `plan-worktrees-cli.test.ts:118` (A13, git status stays clean) — stale fixture
`6ce30c10f` (untrack-mcp-json) writes `.mcp.json` into every new worktree; real projects ignore it (`init.ts:35` adds it to `.gitignore`), the fixture repo has no `.gitignore`. Fix: write `.gitignore` with `.mcp.json` in `helpers/plan-worktree-fixture.ts` before its `git add -A` (line 89). Deterministic.

### 5. `registry-leak-scan.test.ts:63` (A22, no test writes the real registry) — stale scan
Flags `init-browser-telemetry.test.ts` and `mcp-config-regenerate.test.ts` for calling `runCli` without `INDUSK_HOME`; since `f67cf9bc0` (2026-09-16) `runCli`/`runCliAsync` set a temp `INDUSK_HOME` on every call. No leak. Fix: stop counting `runCli(` as a raw spawn (`registry-leak-scan.test.ts:25`); keep scanning direct `CLI_BIN` / `cli.js` spawns. Deterministic.

### 6. `inbox.test.ts:45,65` (A17, `promise: a-break-reaches-the-working-agent`) — the test's clock expired
The fixture's violation is pinned at 2026-10-08T20:00Z; `recordBreaks` uses the real clock when no `now` is given (`record.ts:111`) and reminds after every pass (`:114`). Since 2026-10-09T20:00Z the new incident is over a day old, so it gets a `reminder` entry at once — the incident-recording ADR's D7, working as decided. Fix: pass `now` in each `recordBreaks` call. `lesson: code-that-decides-takes-its-clock-and-its-reads`. Deterministic from that date.

### Root-level timeouts
`new-project-accept` A30 (5 s) and `new-project-accept-route` A5 pass alone and fail only when every package runs at once. Not yet diagnosed.

## Decisions

- Findings 1, 4, 5, 6 fix the test, not the code: each test is stale against a decided behaviour (Sandy's plan, 2026-10-14).
- Finding 3: the component check holds only looks whose plan has landed (Sandy, 2026-10-14) — approval merges looks to main before code, so every plan proposing a component would otherwise turn main red until it lands. This changes `a-component-has-one-implementation`'s sentence.
- Finding 2's archived impls are recorded as known failures in the corpus test, not repaired (Sandy, 2026-10-14).
- cockpit-audit-fixes' brief is amended with its `## Looks`, and Sandy re-approves it (Sandy, 2026-10-14).
- The root-level timeouts are in this plan (Sandy, 2026-10-14).

## Open Questions

- Why the two admin tests time out only under the root run — load, a shared port or lock, or a fixed timeout too short for a loaded machine.

## Sources

- Read-only diagnosis of each failing file on main, 2026-10-14; commits named above.
