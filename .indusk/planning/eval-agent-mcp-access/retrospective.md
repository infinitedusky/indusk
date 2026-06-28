---
title: "eval-agent-mcp-access"
date: 2026-06-28
---

# eval-agent-mcp-access — Retrospective

## What We Set Out to Do

The April 2026 brief: the eval agent (the background subprocess spawned on every commit) wasn't calling any MCP tools. Every scorecard logged `graphitiWrites: 0`. `.indusk/highlights-processed.jsonl` didn't exist. The `agent-roles` architecture had shipped its working-agent half — interactive sessions could call `mcp__indusk__highlight` fine — but the eval-agent half was a no-op.

The named goal: restore MCP tool access in the spawned `claude --print` subprocess so the eval agent could read highlights, write Graphiti episodes, and mark entries processed. The success criterion: a `jj describe` (later: `git commit`) with queued highlights produces a scorecard with `graphitiWrites > 0` and a populated `highlights-processed.jsonl`.

Straight-to-implementation micro-plan — no ADR, no extended research, brief + diagnosis + impl + retrospective.

## What Actually Happened

The plan took 70 days of wall-clock time, but the work itself happened in two distinct bursts separated by 2 months of silent regression.

### Burst 1: April 19, 2026

Phase 1 (diagnosis) ran against the hook's exact `claude --print` invocation. Two A/B tests against the same prompt with and without `--mcp-config .mcp.json` produced a definitive answer in 0.49 USD of API cost: the project's MCP servers aren't auto-discovered by `claude --print`. Test A with the flag showed `mcp__indusk__*` tools in the inventory; Test B without showed only globally-installed servers (`context7`, `tmux`, `playwright`). The secondary finding: the resume code path also needed `--permission-mode bypassPermissions` (note: not `acceptEdits` — that auto-accepts file edits but not MCP calls; this took 3 publish cycles in 1.23.0/1.23.1/1.23.2 to get right).

Phase 2 (fix) added both flags to four spawn sites in `persistent-evaluator.ts` and `evaluator-runner.ts`. Verification via a live `jj describe` produced 3 highlights processed in `.indusk/highlights-processed.jsonl`. Plan considered done. Impl status: `in-progress` because Phase 3 (regression test) was deferred. April moved on.

### The 2-month silent regression

Between April 19 and June 27, the eval agent ran on every commit (197 evals across the persistent session `12cb92bb-...`). The April-processed highlights stayed at exactly 3 in `highlights-processed.jsonl`. The `highlights.jsonl` queue grew to 52. Nobody noticed because:
- Scorecards continued to land in `results.log` — the rubric-scoring path worked fine.
- The eval agent's *commit-scoring* job (job A) was successful on every run.
- The eval agent's *highlights-processing* job (job B) silently no-op'd.
- There was no monitoring on `highlights-processed.jsonl` growth.

### Burst 2: June 27-28, 2026

The reopening trigger was actually `git-only-substrate`'s falsification ritual on June 27, which noticed dusk's `scm: git` config meant the file-linkage layer was silently disabled. That investigation led Sandy to the broader question: "is Graphiti actually working at all?" The session diverged through a long diagnostic detour — checking infra container health, inspecting the global indusk install version, hunting the path-lookup bug that became 1.30.2 — before circling back to the highlights pipeline itself.

The actual second-bug-discovery moment: the manual `node .claude/hooks/eval-trigger.js --source verify-1.30.2` fire spawned a working evaluator, scorecard landed, but highlights queue stayed at 44 unprocessed / 3 processed. Sandy's response: *"the eval pipeline is RUNNING but isn't processing highlights."*

The original eval-agent-mcp-access plan was reopened with a Phase 4 capturing the second cause: the **resume prompt** in `persistent-evaluator.ts:222-245` hand-rolled a minimal "Evaluate a new commit ... output the JSON scorecard" stub and **omitted Step 4 (process highlights) entirely**. Only the fresh-spawn path (~1 in 197 evals) received Step 4. The April verification was that fresh spawn; every commit since was a resume.

Phase 4 extracted Step 4 into `buildHighlightsInstructions({ projectGroup })` and had the resume prompt prepend it. T3 source-grep regression: the helper exports + the resume branch calls it before the commit-evaluation literal.

Phase 5 (falsification of Phase 4): three more hypotheses, all real bugs.
- **H14** — "answer the same evaluation questions as before" pulled the inner Claude back to 197-turn pre-fix muscle memory of skipping Step 4. Rewording: drop "as before."
- **H15** — empty-list behavior was undefined; helper only handled "unavailable." Added explicit "if empty, note '(no unprocessed highlights)' once."
- **H16** — T3 pinned prompt shape but not the spawn flags. Source-grep regression added asserting both `--mcp-config` AND `bypassPermissions` literals appear ≥ 2 times each.

T4 (live smoke after publish + upgrade): **the queue drained.** 52/52 unique highlight IDs processed across 4 successful post-upgrade evals. **But** `highlights-processed.jsonl` grew to 98 lines — 46 highlights got marked twice. The agent called `highlights_unprocessed` in only 3 of 4 evals; the 4th processed highlights from session memory.

Phase 6 (dedup fix in scope): two-pronged. (a) Strengthened Step 4 with a **CRITICAL** preamble forbidding memory-based processing and direct file reads. (b) Changed `markProcessed` from idempotent-append to write-time rejection: read processed log first; if ID present, return `{ already_processed: true, original_processedAt }` without appending. ProcessedMark interface extended additively.

Phase 7 (falsification of Phase 6): one more hypothesis, also real.
- **H19** — `readAllProcessed` silently skips malformed JSON lines via try/catch. If `highlights-processed.jsonl` had a corrupted historic entry carrying the target ID (truncated, hand-edit, version mismatch), the Phase 6 check would think the ID wasn't present and append a duplicate. Defense: new file-private `isIdInRawProcessed` helper checks raw bytes for `"id":"<escaped id>"` substring before deciding "not present."

Plan status: completed. 10 trajectory rows passing. 5 commits on the branch across the June 27-28 session.

## Getting to Done

The 70-day timeline is the load-bearing fact. The original April plan was scoped as a straight-to-implementation micro-plan because the brief framed the problem narrowly: "MCP tools aren't reachable from the subprocess." Phase 1 diagnosis confirmed exactly that, Phase 2 fixed exactly that. Sandy verified the fix produced 3 processed highlights and moved on. No CI regression for the runtime behavior was created (the brief noted CI for `claude --print` is impractical), so the per-commit successful-write counter was never automated.

What "done" actually required, in retrospect:
- Phase 1-2 in April (MCP flags) — necessary but not sufficient
- A runtime monitor on `highlights-processed.jsonl` line count (never built — would have caught the regression on the second commit after April's verification)
- Phase 4 in June (resume prompt includes Step 4) — second necessary fix
- Phase 5 falsification (three real bugs that survived Phase 4's T3 source-grep)
- Phase 6 in June (write-time dedup guard) — third necessary fix found by runtime audit
- Phase 7 falsification (one real bug that survived Phase 6's T9 source-grep + happy-path test)
- T4 smoke verification (the load-bearing runtime proof — caught the dup issue that motivated Phase 6)

Without each of these, the pipeline would have continued to be silently broken or partially broken. The plan's brief named the symptom; it didn't name the failure mode. The 4 actual bugs (missing `--mcp-config`, missing Step 4 in resume, agent processes from memory, malformed-line bypass) all converge on the symptom but require independent fixes.

The cost of "the brief named the symptom, not the failure mode" was the 2-month regression and the ~6 hours of June investigation + execution. If T4 (live smoke + counter monitoring) had been a hard requirement at April's close, the regression would have been caught within a week.

## What We Learned

- **A fix that worked at the time can hide a second bug for 2 months.** April's 3-highlights-processed verification was a fresh spawn (the persistent session was new — created by that first eval). Every commit since was a resume, which exercised a different prompt path. The verification was correct for what it tested, but the test surface was 1 of 198 eval invocations. Future verification of background-process fixes should explicitly test BOTH first-run and subsequent-run code paths, especially when the runtime architecture distinguishes "first" from "subsequent" (catchup-vs-resume, fresh-vs-cached, cold-vs-warm).

- **Per-commit success counters are cheaper than CI regressions for background processes.** The brief's note that "CI for `claude --print` is impractical" was correct, but it didn't motivate a substitute — a runtime success counter on `highlights-processed.jsonl` line count. A 5-line `indusk eval doctor` subcommand that compared "processed since last upgrade" against "queued since last upgrade" would have surfaced the regression. The wrong lesson is "CI is impractical → skip verification." The right lesson is "CI is impractical → build a doctor."

- **Falsification rituals are particularly load-bearing for prompt-engineering work.** Phase 5 found 3 hypotheses on top of Phase 4's source-grep test — all real bugs. Phase 7 found 1 hypothesis on top of Phase 6's happy-path test — also real. The pattern: a source-grep test pins surface shape; falsification probes the boundary cases (phrasing, empty inputs, malformed inputs, persistent-session muscle memory). Without the rituals, the plan would have closed at the end of Phase 4 with a known-incomplete fix.

- **Inner-Claude conversation history is a load-bearing context the runtime test surfaces.** T4 smoke processed 52/52 IDs across 4 evals, but 46 got marked twice — the agent processed from memory in at least one eval despite the (then-weaker) Step 4 prompt. The session JSONL was the only artifact that exposed this. **Session-JSONL inspection should be a first-class diagnostic tool** for any eval-agent regression, not an ad-hoc investigation step. A `indusk eval session-tools <id> <session>` subcommand that summarizes tool-call counts per eval would close the diagnostic gap for future regressions.

- **Prompt instructions are code with a softer compiler.** Three of the four bugs (H14 "as before," H15 empty-list ambiguity, the Phase 6 agent-processes-from-memory pattern) were prompt-engineering bugs — the helper text didn't tell the agent precisely enough what to do in a specific scenario. The other one (H19 malformed-line bypass) was a code bug. Treat prompt instructions with the same rigor as code: probe phrasing, name edge cases explicitly, test that the prompt's behavior survives the agent's natural failure modes. Source-grep tests on prompt content are the equivalent of unit tests on code.

## What We'd Do Differently

- **Make T4-style runtime success counters a required exit criterion** for plans whose verification path is "manual smoke against a live subprocess." The original April plan had T1 + T2 trajectory rows with `Passes at: Phase 2` / `Phase 3` for *the smoke* but never named a recurring monitor. A per-week or per-N-commits check on `highlights-processed.jsonl` growth would have surfaced the regression within days of April's close, not 2 months later. Concrete commitment for the next similar plan: ship a doctor subcommand as part of the fix, not as a follow-up.

- **Resume-mode + persistent-session paths deserve their own trajectory rows from the start.** Phase 4 only existed because the original plan didn't distinguish "the catchup-fresh path" from "the resume path." Both are spawn-from-the-hook paths; both run the same prompt-builder lineage; but the resume path was hand-rolled separately and silently diverged. Future plans touching background-process spawn args or prompts should enumerate every distinct prompt-construction path in scope and have a trajectory row asserting each path's correctness.

- **Inspect the eval session JSONL during Phase 1 diagnosis, not at Phase 6 in a panic.** Today's Phase 6 diagnosis went straight to the right answer (count tool calls in the session JSONL → 8 `highlights_unprocessed` calls vs 52 expected) within minutes. April's Phase 1 didn't look at the session JSONL because the symptom (`graphitiWrites: 0`) seemed to be about tool *availability*, not about the agent's *behavior*. The 7-line Python tool-call counter we used today should be packaged as a permanent diagnostic — every eval-agent regression in the future starts with that question.

- **Don't ship a strict-equality interface change (`markProcessed` from idempotent-append → write-time rejection) without also auditing consumers.** Phase 6 changed `ProcessedMark` additively (safe) AND changed `markProcessed`'s behavior from "always append" to "reject duplicates" (not safe). No code in dusk's tree relied on the old behavior, but no downstream consumer audit was performed either. For the same fix in a multi-consumer ecosystem, this would be a breaking change requiring coordinated upgrade. Document the contract change loudly in the changelog (we did) AND grep the workspace for callers before shipping.

## Insights Worth Carrying Forward

The biggest reusable insight is **"a fix that worked at the time can hide a second bug for 2 months."** It's worth a standalone lessons page — the pattern recurs in any system with a "first-call code path that diverges from subsequent-call code path" (cold-cache vs warm-cache, fresh session vs resumed session, first DB connection vs pooled connection). The verification surface is whatever you *thought* you were testing; the runtime surface is what's actually exercised on every subsequent call.

A secondary insight: **runtime success counters are the cheapest possible substitute for background-process CI.** When CI is genuinely impractical (LLM-in-the-loop, paid third-party integration, cross-machine dependency), a single line-count check on the success-side artifact catches >90% of regressions. The cost of building one is hours; the cost of skipping one is the kind of 2-month silent regression we just shipped through.

Both insights are good candidates for `.indusk/research/` if a similar pattern recurs in 1-2 more plans.

## Quality Ratchet

Reviewed recurring mistakes during this plan's implementation:

- **Stale IDE diagnostics**: the Edit hook reported `isIdInRawProcessed` as "unused" immediately after I added a call site to it. The diagnostic was looking at a pre-edit snapshot. Not a code-quality concern — a tooling artifact. No new Biome rule.
- **Test regex span tuning**: T6's source-extraction regex had a 3000-char span that worked in Phase 5 but broke in Phase 6 when the helper grew past it. Had to bump to 6000. This is the kind of thing a "regex with bounded char count" Biome rule could catch, but it's domain-specific to source-grep tests and not a general anti-pattern. No new rule.
- **CLAUDE.md gotcha extension fatigue**: the same "eval-agent resume prompt" gotcha got extended 4 times across Phases 4-7. Each extension is necessary, but the cumulative length is now substantial. No code-quality fix — this is a documentation-shape concern. Worth a future plan if it happens again with another gotcha.

No new Biome rules added.

## Metrics

- Sessions spent: 2 (April 1-day burst + June 1-day burst)
- Wall-clock duration: 70 days (April 18 → June 28)
- Phases shipped: 7 (1-2 in April; 4-7 in June)
- Falsification rounds: 3 (April's was implicit "verify the smoke worked"; June's Phase 5 found 3 bugs; June's Phase 7 found 1 bug)
- Trajectory rows: 10 (T1-T10), all passing at close
- Bugs found: 4 (missing `--mcp-config`, missing Step 4 in resume, agent processes from memory, malformed-line bypass)
- Bugs found by falsification: 4 of 4 (the original brief's hypothesis space had 4 candidates; 1 was the truth in April. Phase 5 found 3; Phase 7 found 1)
- Highlights processed at plan close: 52 unique IDs (entire backlog drained)
- Wasted writes detected: 46 duplicate `graph_capture` calls (the gap that motivated Phase 6)
- Tests added: ~9 (5 in Phase 4-5, 4 in Phase 6, 2 in Phase 7)
- Test suite at plan close: 667 passed, 11 skipped, 0 failed
- Versions on the branch: 1.31.1 (Phase 4-5) → 1.31.2 (Phase 6, shipped before Phase 7 falsification) → 1.31.3 (Phase 7 follow-up)
- **Process note**: the original close plan was for Phases 6-7 to ride a single publish. Phase 6 was rushed to npm before Phase 7's falsification ran, forcing Phase 7's malformed-line defense into its own version. The pre-publish discipline that would have caught this: never publish a patch whose neighbor patches haven't both falsified and closed.
