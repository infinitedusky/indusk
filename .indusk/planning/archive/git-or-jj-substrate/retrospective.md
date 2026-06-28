---
title: "git-or-jj-substrate — Retrospective"
date: 2026-06-28
plan_dates: "2026-05-03 → 2026-05-07 (shipped 1.28.9), retrospected 2026-06-28"
status: superseded by git-only-substrate (2026-06-27 → 1.31.0)
---

# git-or-jj-substrate — Retrospective

## What We Set Out to Do

Make InDusk function on plain-git projects without regressing jj behavior. The triggering observation: dusk and Numero ran jj, but `dawn-fde-toolkit` (the Avoca engagement) used plain git, and InDusk hard-failed there — `NotAJjRepoError` from the semantic graph, `jj new`/`jj describe` in the eval baseline command, jj-only prose in skills. Adoption was blocked on every team that didn't already run jj.

The brief committed to a "dual-SCM with graceful degrade" model:
- `scm: "jj" | "git"` field in `.indusk/config.json` set at init
- Single `lib/scm/` helper module that branches on the config field
- Semantic graph features become jj-only with a "git mode — semantic graph unavailable" message on git
- Eval prompts and CLI go SCM-aware
- Skills go SCM-agnostic; new `git.md` skill alongside `jj.md`
- 5 phases of planned work; ended up shipping 7 (Phase 6 + 7 were falsification rounds)

## What Actually Happened

The plan shipped cleanly on **2026-05-07 as indusk-mcp 1.28.9**. All 18 trajectory rows passing, including the T8 manual smoke against the real Avoca codebase — a `git commit` inside a Claude Code session produced a full scorecard within ~62s. The headline claim ("InDusk functions on plain-git projects") was verified end-to-end.

Then **`git-only-substrate` reversed the entire direction on 2026-06-27 → indusk-mcp 1.31.0**. The dual-SCM model this plan shipped — the `lib/scm/detect.ts` module, `lib/semantic-graph/jj.ts`, `getScm()` defaults, the `jj.md` skill, the dual-form sections in `work.md`/`highlight.md`/`eval-review.md` — was deleted entirely. Git is now the only SCM InDusk supports.

So the honest summary is: **this plan shipped successfully, and was right to ship, and was then completely torn out six weeks later.**

That sequence raises a sharp question — was this plan a waste? The honest answer is "no, but mostly because we needed to ship it to learn what to do next." The dual-SCM model proved that the abstraction *worked*, then made the cost of maintaining it visible enough that Sandy decided git-only was the better answer. Without shipping the dual model, the git-only decision wouldn't have been informed.

### Phase-by-phase summary

| Phase | What landed | Notes |
|---|---|---|
| 1 | `lib/scm/detect.ts` + `lib/scm/index.ts` + `scm` config field + init/update detection | Surfaced the "init must tolerate `NoScmDetectedError`" gotcha (test harnesses run in bare tmpdirs). |
| 2 | Semantic graph callers routed through `lib/scm`; git-mode graceful-degrade in `sync-engine.ts` + `graphiti-log-wrapper.ts` | The "graceful degrade" choice was the architecture trap (see lessons). |
| 3 | Eval prompts SCM-aware via `PromptBuilderOptions.scm`; baseline CLI branches between `jj new`/`jj describe` and `git commit --allow-empty` | TDZ trap in `persistent-evaluator.ts` — `scm`/`diffCommand` consts MUST be hoisted above the `try { withSpan(...) }` block; declaring after puts them in TDZ when `buildArgsAndPrompt` runs inside the span callback. Cost: 5 evaluator-spans test failures before the hoist landed. |
| 4 | New `apps/indusk-mcp/skills/git.md`; dual-form prose in work/highlight/eval-review skills; `jj.md` byte-equal-pinned as regression target; user-facing `apps/indusk-docs/src/guide/scm.md` | Skills auto-sync via existing `globSync("*.md")` — no plumbing changes. |
| 5 | End-to-end harness `git-mode-e2e.test.ts`; T8 manual smoke procedure documented | T8 the only row that stayed `skipped` through the planned phases — flipped to `passing` on 2026-05-06 against Avoca. |
| **6 (Falsification round 1)** | **Five hypotheses, two confirmed real**: H1 (the brief's claim that eval-trigger already worked on git was wrong on three counts — filter rejected git commit, change-ID extractor had no git fallback, and init didn't even copy the hook file because of a hardcoded list); H2 (graph status/rebuild had misleading UX on git — said "run sync first" which would no-op). | The headline brief claim was wrong, and falsification found it. **Without Phase 6, the plan would have shipped with a broken end-to-end story.** |
| **7 (Falsification round 2)** | **Three more hypotheses, all confirmed real**: H3 (Phase 6's `String.includes` filter false-positives on `git committer` substring + similar); H4 (hooks fire regardless of Bash exit_code → failed commits produce eval noise against previous SHA); H5 (init silently omits the `scm` field when neither SCM is detected — UX footgun for users who run init before `git init`). | Phase 7 was Sandy's call to re-falsify after Phase 6's fixes. Compounding falsification produced 3 more real findings. |

## Getting to Done

**Unplanned work that mattered:**

1. **The init-tolerates-NoScmDetectedError fix** (Phase 1, discovered) — caught by existing telemetry tests that run init in bare tmpdirs. Without it, every existing init test that didn't bootstrap an SCM would regress. Added the deferral path + matching `indusk update` migration.
2. **The persistent-evaluator TDZ trap** (Phase 3) — required hoisting `scm`/`diffCommand` consts above the `withSpan` block. Cost: 5 falsely-failing evaluator-spans tests before the cause was found.
3. **Heavy subprocess test timeout** (Phase 5) — git-mode-e2e tests needed `{ timeout: 60000 }` on the describe block to survive parallel test pressure.
4. **Phase 6 entirely** — Sandy decided to run falsification mid-impl when the brief's "eval-trigger already works on git" claim felt suspicious on re-read. Surfaced two load-bearing bugs.
5. **Phase 7 entirely** — Sandy re-falsified after Phase 6, found three more real bugs in Phase 6's own fixes. The compounding cost was real: 8 trajectory rows landed across the two falsification phases.
6. **MCP wrapper coverage** (Phase 6 H2-C) — initial fix only covered the CLI `graph status/rebuild` commands. Discovered mid-implementation that `mcp__indusk__graph_*` MCP tools went through `tools/graph-tools.ts` directly, bypassing the CLI. Added matching `getScm()` early-returns in the MCP wrappers.

## What We Learned

### "Plan claims X works" without source-code verification is a load-bearing risk

The brief's exact words: *"the eval hook (eval-trigger.js) already works on git — it tries jj first and falls back to git rev-parse HEAD for the change ID, and matches both jj describe and git commit as trigger commands."* Reading the actual `eval-trigger.js` source during Phase 6 falsification: all three of those claims were wrong. Filter rejected `git commit`; change-ID extractor used `jj log` with no git fallback; init didn't even copy the hook file because the hook-files array was hardcoded and missing `eval-trigger.js`.

The brief author (me) wrote those claims based on what `eval-trigger.js` *should* have done given the plan's design intent, not what the file actually did. **This is the cheat-sheet effect at brief-authoring time** — the author knows the design but reads the existing code looking for confirmation rather than ground truth.

The discipline: **any "X already works" claim in a brief must be ground-truth verified by source-code reading before the brief is accepted.** Not "I read the brief and the code looks right" — actually quote the relevant code lines into the brief.

### Substring matching is fragile across natural-language shell inputs

H3 (Phase 7) found that `String.includes("git commit")` fires on `git config user.email "git committer"` (because "committer" contains "commit"), on `cat git-commit-template.md`, on `echo "Don't forget to git commit!"`, and on any other Bash command whose string content contains the trigger as a substring. The fix: anchored regex `/\b(jj describe|git commit)\b/`. The git-only-substrate plan tightened this further to `/\bgit commit(?=$|\s|;|&|\|)/` (right-edge lookahead) because the bare `\b` matches `t`→`-` and false-positives on `git commit-tree` plumbing.

**Lesson**: when matching against shell command strings, use anchored regex with boundary conditions; don't ever use `String.includes` for trigger detection.

### PostToolUse hooks MUST check `tool_response.exit_code`

H4 (Phase 7) — failed `git commit` operations (no staged changes, pre-commit hook rejection, signing failure) still trigger PostToolUse hooks, which then run eval against the *previous* commit's SHA and produce misleading scorecards. The hook event JSON contains `tool_response.exit_code` but Phase 6 didn't read it.

**Lesson**: every PostToolUse hook that triggers downstream work must check `event.tool_response?.exit_code` and skip when non-zero. Failed commands don't produce evaluable state.

### "Graceful degrade" is sometimes the architecture trap

This plan picked the graceful-degrade approach for the semantic graph rather than committing to either "make git work" or "stop pretending git is supported." That deferral cost:

- 6 weeks of dual-SCM code paths to maintain (`lib/scm/detect.ts`, `lib/semantic-graph/jj.ts`, branching logic at 14 call sites, dual-form sections in 4 skills)
- Then the rip-out in `git-only-substrate` was significant work itself

The `git-only-substrate` ADR explicitly rejected "keep graceful-degrade dual-SCM" as an alternative, naming the exact failure mode: *"compounding debt, dusk's own file-linkage layer stays off."* Sandy's exact phrasing during the git-only decision: the graceful-degrade choice meant the semantic graph stayed off on dusk's own codebase, which meant **dusk wasn't using its own semantic-graph features**.

**Lesson**: graceful-degrade is a one-way ratchet that defers the harder commitment question. Pick it deliberately as "we're going to commit to the other path eventually," not as "this is a good long-term answer."

### Two-round falsification compounds

Phase 6 found H1 + H2. Phase 7 re-falsified Phase 6's fixes and found H3, H4, H5 — three more real bugs in code that had just been written and tested. Each round produced different failure modes (load-bearing claim being wrong; UX gaps; substring false-positives; exit_code missing; init-before-SCM footgun).

**Lesson**: falsification rounds are roughly orthogonal — round N's findings aren't a subset of round N-1's. Plans that ship without re-falsification after each major fix are leaving signal on the table. The marginal cost of a second round is small relative to the marginal value.

## What We'd Do Differently

1. **Skip the dual-SCM model entirely.** Knowing what we know now: had we picked git-only as the target from the start, we'd have saved 6 weeks of dual-substrate maintenance + the eventual rip-out work. The dual-SCM choice was the result of incomplete commitment — "we don't want to break jj users *yet*." The right framing at brief-time: "is jj a substrate we're committed to long-term, yes or no?" If no, drop it now.

2. **Ground-truth-verify every "X already works" claim in the brief before acceptance.** Phase 6's H1 cost ~4 hours of falsification investigation + fix work because the brief's three claims about `eval-trigger.js` were all wrong. Verification at brief time would have been ~20 minutes.

3. **Run falsification at LEAST twice for any plan touching shell-string parsing or hook event handling.** The first round caught the load-bearing claim being wrong. The second round caught three production-relevant bugs in the first round's fixes. The third round would probably have caught more. The marginal value-per-round was high.

4. **Test the MCP tool surface separately from the CLI surface, structurally.** Phase 6 H2-C surfaced that the MCP wrappers at `tools/graph-tools.ts` bypassed the CLI entirely — they called `runSync`/`replay` directly. The CLI fix didn't reach them. **The MCP and CLI surfaces are independent SCM call sites** and any SCM-aware behavior must be tested at both.

## Insights Worth Carrying Forward

### Plans that ship and get superseded aren't failures — they're substrate

This is the second plan today archived under this pattern (the other was handoff-multi-agent, superseded by handoff-multi-agent-section-shape mid-flight). Three signals where this happens:

1. **Falsification finds the headline claim was wrong** (this plan, Phase 6 H1)
2. **Direction shifts from "support both" to "drop one"** (this plan, superseded by git-only-substrate)
3. **Better design emerges before publish** (handoff-multi-agent → section-shape)

In all three cases the original plan's substrate work persisted into the successor. The dual-SCM work proved `lib/scm/` was the right abstraction layer; git-only just deleted the jj branch. The handoff-multi-agent work proved the session-ID + sanitizer + init scaffolding; section-shape kept those and reshaped the top level. Plans don't have to "succeed permanently" to be valuable — they can be substrate that informs the next plan.

### The "I wrote this brief and the code looks right" trap

Brief author bias is the most expensive bug class encountered on this plan. Phase 6 H1's three wrong claims cost ~4 hours of investigation that ground-truth verification at brief time would have prevented in 20 minutes. The cost ratio is ~12×.

The same pattern likely applies to any brief that asserts what existing code does without quoting source. The discipline that prevents it: **a brief is not accepted until every "X already works / X currently does Y" claim is annotated with a source-code line range or a quoted snippet.**

### Compounding falsification rounds are cheaper than they look

The two falsification phases here found 5 real bugs that would have shipped if either round had been skipped. The cost of each round was modest (~half a day each). The cost of those 5 bugs shipping to users would have been: failed commits producing eval noise (regular trigger, hard to diagnose), `git committer` false-positives spinning up subprocess (cost-bearing), init-before-SCM silently writing wrong config (UX footgun with no signal).

**Default for any plan touching infrastructure that fires on user actions: minimum two falsification rounds.**

### Dawn-relevant: this is exactly the petal-correlation use case

The 5 bugs found across falsification rounds all involved cross-signal correlation — hook events × tool exit codes × shell command strings × init-time configuration × MCP vs CLI surface. The Dawn correlation engine model is built for exactly this class of finding. *In Dawn, a watcher agent observing the eval-trigger hook's spawn pattern + the resulting scorecard's `changeId` could have caught H4 (failed-commit-fires-against-previous-SHA) automatically.* The lessons here are inputs to Dawn's design.

## Audit Status

- **Falsification gate**: PASSED — Phase 6 + 7 ran the falsification ritual, all 18 trajectory rows in terminal state.
- **Test trajectory audit**: PASSED — no blocked rows, no Deferred Verification rows requiring mitigation review.
- **Docs accuracy**: The plan's docs landed in `apps/indusk-docs/src/guide/scm.md` and changelog. **Most of those docs are now wrong** because `git-only-substrate` superseded the dual-SCM direction. The docs site reflects the *current* state (git-only) — the original plan's docs were superseded by git-only-substrate's own doc pass.
- **Lessons captured**: The retrospective produced 4 lessons worth promoting: brief author bias, substring matching is fragile, PostToolUse exit_code discipline, graceful-degrade architecture trap. Highlighting below for eval-agent capture.
- **Context audit**: CLAUDE.md's Known Gotchas and Conventions both contain entries from this plan AND from git-only-substrate. The git-only entries supersede where they overlap. Re-checked — no contradictions surfaced.

## What Survives the Archive

The plan's artifacts that have lasting value beyond the supersession:

- **The `lib/scm/index.ts` abstraction layer** — git-only-substrate kept it (now git-only) rather than deleting the file. Provides `getCurrentChangeId()` + `getReachableChangeIds()` as the canonical SCM-facing API.
- **The falsification ritual discipline** — Phase 6 + 7 demonstrated that compounding falsification rounds produce orthogonal findings. The git-only-substrate plan's own Phase 6 falsification (which found H1, H3, H5 in its own different context) inherited this pattern.
- **The `git.md` skill** — though the plan was superseded, the `apps/indusk-mcp/skills/git.md` content remained mostly intact through git-only-substrate's Phase 3 ("dual-form sections collapsed to single-SCM prose").
- **The end-to-end test harness pattern** — `git-mode-e2e.test.ts` shape is still in `apps/indusk-mcp/src/__tests__/` (renamed; still tests the same flow).
