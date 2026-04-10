---
title: "Context System Evaluation"
date: 2026-04-12
---

# Context System Evaluation — Retrospective

## What We Set Out to Do

Build a commit-triggered evaluation system that measures whether InDusk's context system makes agents better. The brief proposed a judge agent that runs after every jj commit, scores work quality against a rubric, writes derived insights to Graphiti, and logs structured scorecards. Baseline mode would pit a vanilla agent against the same rubric to measure the delta.

## What Actually Happened

The plan grew significantly during implementation — from 6 phases to 8 — driven by real usage feedback as we tested on two codebases (infinitedusky and Numero).

**Phase 1-3** went smoothly. The eval log types, rubric, prompt builder, and judge runner followed established patterns from the semantic graph log system. 15 tests, clean build.

**Phase 4** hit the first surprise: jj 0.39.0 has no native hook system. Pivoted from jj hooks to Claude Code PostToolUse hooks on Bash — detecting `jj describe` in the command string. This works but is Claude Code-specific (noted as a future adapter interface concern).

**Phase 4-6 integration testing** exposed a cascade of issues:
- `claude --print` with `--allowed-tools` spreading as separate args consumed the prompt as a tool name
- The prompt with inline diff was 170KB+ — had to switch to the judge reading the diff via tool calls
- `detached: true` + `unref()` caused the child process close handler to never fire — switched to `runJudgeSync`
- The hook's inline script imported from a hardcoded monorepo path that doesn't exist on other projects — had to add multi-strategy package resolution (`which indusk` → global install path)

**Phase 7** (findings feedback loop) was added mid-session when we realized findings need to persist and surface on the next commit. The `findings.json` state file and unresolved-finding nudges came from a conversation about "how does the agent know to act on findings?"

**Phase 8** (persistent judge) was added when we realized each eval costs $2-4 because of the full catchup. `claude --print --resume <sessionId>` works — first eval pays catchup cost, subsequent evals are cheap.

**Post-impl fixes** (versions 1.11.0 through 1.13.2) were substantial:
- `claude mcp add` doesn't overwrite existing entries — had to `remove` then `add`
- CGC graph name migration preserved wrong values instead of enforcing `cgc-{project}`
- `init` hook registration skipped new hooks when any existing hook was found
- `update` hook sync skipped new hook files that didn't exist in target
- MCP server had zero error handling — added stderr logging and global exception handlers
- `isScorecard` type guard wasn't defensive enough for malformed judge output
- `system.log` added for full eval lifecycle visibility

## Getting to Done

The "getting to done" story is the version number: 1.11.0 → 1.13.2 over two sessions. Every version was a fix for something that didn't work when tested on a real project. The eval system worked on infinitedusky (the monorepo where it was built) but broke on Numero in multiple ways — package paths, MCP config, hook registration, summary command crashes.

The most frustrating issue was the lack of observability into the eval system itself. The hook fired silently, the judge ran silently, and when something failed there was no indication. `system.log` was added specifically to make the system debuggable.

## What We Learned

1. **"Works on my machine" applies to developer tools too.** The eval system worked perfectly in the monorepo where it was built, then broke in 6+ ways on Numero. Every hardcoded path, every assumption about package location, every "this file exists" — all wrong on a different project.

2. **`claude mcp add` is append-only, not upsert.** It silently does nothing if the server name exists. Every migration that uses `claude mcp add` must `claude mcp remove` first.

3. **Developer tools need observability from day one.** We added `system.log` at the end after hours of "is it working? I can't tell." Should have been in Phase 1.

4. **`--allowed-tools` takes comma-separated values, not space-separated.** The CLI help doesn't make this clear. Space-separated tools get parsed as positional args.

5. **Detached child processes with `unref()` lose their event handlers.** The parent exits, the child runs, but `on('close')` never fires because the event loop drained. Use a separate process that stays alive instead.

6. **Brief/ADR evolved significantly during implementation.** The original brief was a simple commit-triggered scorer. By the end it was a knowledge distillation layer with persistent sessions, a findings feedback loop, baseline mode, and usage tracking. The conversation with the user shaped the product more than the plan did.

7. **The biggest cost isn't the eval — it's the catchup.** At $2-4 per eval, most of the tokens go to the judge doing `/catchup`. The persistent session (Phase 8) is the most impactful optimization.

## What We'd Do Differently

1. **Test on a second project from Phase 4.** We didn't test on Numero until after Phase 6, and every issue that emerged was a cross-project portability bug. If we'd tested on Numero at Phase 4 (when the hook was first wired), we'd have caught the package path issue, the MCP migration issue, and the hook registration issue much earlier.

2. **Add `system.log` in Phase 1, not as a post-impl fix.** The eval system is a background process — you can't debug it interactively. Logging should be foundational, not an afterthought.

3. **Don't embed large data in prompts.** The 170KB inline diff was an obvious mistake in hindsight. The judge has tool access — let it read the diff itself. This applies generally: if the agent can look something up, don't pre-fetch it.

4. **Scope the impl more tightly, add phases for discovered work.** Phases 7 and 8 were added during implementation because they emerged from real usage. That's fine — but the original 6-phase impl could have been tighter (skip baseline CLI until eval mode is proven).

## Insights Worth Carrying Forward

- **Evaluation is easier than creation** is a real architectural principle, not just a slogan. The judge consistently produces better analysis than the working agent could self-report, because it starts from the outcome.
- **`claude --print --resume`** is a powerful pattern for amortizing context costs. Any system that spawns repeated `claude --print` calls should consider session persistence.
- **PostToolUse hooks on Bash** are a viable trigger mechanism for jj operations until jj gets native hooks. The pattern (detect command string, spawn background work) generalizes.
- **Findings that persist until resolved** create a feedback pressure that self-evaluation reports don't. The agent sees them every commit and is motivated to fix them.

## Quality Ratchet

The `isScorecard` bug (crashing on malformed entries) suggests a possible Biome rule: functions that do `entry.field` on parsed JSON should validate the field exists first. However, this is more of a runtime validation pattern than something Biome can enforce statically. No new Biome rule — but the lesson is captured: type guards on parsed JSON must be defensive.

## Metrics

- Sessions spent: 2 (one long session spanning two days, one short session for retro)
- Phases: 8 (6 planned + 2 emergent)
- Files created: 10 eval modules + 3 docs + 1 hook + 1 skill
- Files modified: cli.ts, init.ts, update.ts, settings.json, config.json, CLAUDE.md, server/index.ts, validate-impl-structure.js
- Lines added: ~2,010
- Tests: 15 eval-specific (2 test files)
- Versions published: 1.11.0 → 1.13.2 (13 patch releases, each fixing a real bug found in testing)
- Cost per eval: ~$2.58 average (from Numero data, 8 evals = $20.66 total)
- Confirmed working on: infinitedusky, Numero
