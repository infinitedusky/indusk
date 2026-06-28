---
title: eval-agent-mcp-access — Lessons
date: 2026-06-28
---

# Eval Agent MCP Access — Lessons

A plan that took 70 days of wall-clock to close, in two bursts separated by a 2-month silent regression. April fixed the *first* bug. June found and fixed three more on top of it. The interesting parts aren't the bugs themselves — they're how the bugs survived, how they were eventually caught, and what to do differently next time.

## The headline lesson

> **A fix that worked at the time can hide a second bug for 2 months.**

April 19's verification produced 3 highlights in `.indusk/highlights-processed.jsonl` and the plan closed (mostly). That verification was *correct for what it tested* — but the test surface was 1 of 198 eval invocations. The persistent eval session was *fresh* at the time; every commit after April 19 was a *resume*, which exercised a different prompt-construction path. The resume path had been hand-rolled separately and silently diverged: it omitted Step 4 (process unprocessed highlights) from the prompt entirely. So 197 consecutive evals over 2 months processed zero highlights, and nobody noticed because the commit-scoring side of the eval kept working fine.

The pattern recurs in any system with a *first-call code path that diverges from a subsequent-call code path*:

- Cold cache vs warm cache
- Fresh session vs resumed session
- First DB connection vs pooled connection
- First webhook delivery vs retry
- Lazy-initialized state vs reused state

**The verification surface is whatever you *thought* you were testing.** The runtime surface is whatever's actually exercised on every subsequent call. If those differ, your fix has a 50%+ chance of being half-baked, and you'll find out about it later from production — or not at all.

**What to do next time:** for any plan whose fix touches a background-process spawn path or a stateful subprocess, write a trajectory row that names *each distinct prompt-construction or initialization path*. Verify each independently. The plan's original Phase 3 trajectory had T1 (the smoke) but no row distinguishing "the catchup-fresh-spawn path" from "the resume path." Phase 4 only existed because that distinction was missing.

## Runtime success counters are the cheapest substitute for background-process CI

The April brief noted that "CI for `claude --print` is impractical." Correct — running a real LLM in CI is slow, paid, and flaky. But the brief stopped at the negative: it didn't motivate a substitute.

The substitute that would have caught the regression on the *second* commit after April: a 5-line check on `highlights-processed.jsonl` line-count growth. "Did this file grow in the last N commits with non-zero highlights queued?" If no, surface a warning. Cost to build: under an hour. Cost of the alternative (the actual regression): 2 months of silent failure, ~6 hours of June investigation.

**The wrong lesson is "CI is impractical → skip verification."**

**The right lesson is "CI is impractical → build a doctor."** A doctor subcommand is a one-shot runtime audit — checks invariants that should hold in steady-state, surfaces violations without taking action. Cheaper than CI to build, cheaper than monitoring to operate, catches the same class of bug as either.

Concrete commitment for the next similar plan: ship the doctor subcommand alongside the fix, not as a follow-up. The follow-up never gets written.

## Falsification is load-bearing for prompt-engineering work

This plan ran two falsification rounds in the June burst (Phase 5 and Phase 7). Each round found real bugs on top of code that *already had passing happy-path tests*.

**Phase 5** found three hypotheses on top of Phase 4's source-grep test:
- **H14** — the resume prompt said *"answer the same evaluation questions as before"*. That "as before" pulled the inner Claude back to its 197-turn pre-fix muscle memory of skipping Step 4. Reword: drop "as before."
- **H15** — empty-list behavior was undefined. The helper only handled `highlights_unprocessed` being unavailable, not returning `[]`. Added explicit handling.
- **H16** — Phase 4's test pinned prompt shape but not the spawn flags. A future refactor could drop `--mcp-config` or `bypassPermissions` and the prompt test would still pass. Added source-grep regression.

**Phase 7** found one hypothesis on top of Phase 6's happy-path test:
- **H19** — Phase 6's `markProcessed` write-time dedup relied on `readAllProcessed`, which silently skips malformed JSON lines via try/catch. A corrupted historic entry carrying the target ID was invisible to the parsed dedup check. Added defensive substring-on-raw-content check.

**4 of 4 hypotheses confirmed as real bugs.** Without falsification, this plan would have closed at Phase 4 with a known-incomplete fix.

**The pattern**: source-grep tests pin the *surface shape* of a prompt or contract. Falsification probes the *boundary cases* — phrasing nuance, empty inputs, malformed inputs, persistent-session muscle memory. Happy-path tests can't reach those boundaries. The ritual is the mechanism.

For any plan where the deliverable is *agent instructions* (prompts, skills, slash commands, MCP tool descriptions), assume Phase N's tests pin a shape that has at least one boundary you didn't think of. Budget falsification time accordingly. It will find something.

## Prompt instructions are code with a softer compiler

Three of the four bugs in this plan were prompt-engineering bugs — the helper text didn't tell the agent precisely enough what to do in a specific scenario:

- "as before" muscle-memory anchoring
- Undefined behavior on empty highlights list
- Agent processing from session memory instead of calling `highlights_unprocessed`

Each was solved by making the prompt *more explicit*: a CRITICAL preamble, explicit empty-list handling, explicit "STOP on already_processed: true". None of these would be needed if a real compiler enforced the contract. But there is no real compiler — the agent's runtime is its conversation history and the prompt instructions, parsed by the same statistical machinery that's running every other token.

**Treat prompt instructions with the same rigor as code:**

- Probe phrasing for backwards-anchoring or ambiguity
- Name edge cases explicitly (empty, missing, malformed) — don't assume the agent will infer the right behavior
- Source-grep tests on prompt content are the equivalent of unit tests on code — write them
- For persistent-session work, remember the agent has muscle memory from prior turns. New instructions compete with old behavior; CRITICAL preambles exist for a reason

## Process: don't publish a patch whose neighbor patches haven't both falsified and closed

This is the meta-lesson from how 1.31.2 vs 1.31.3 actually shipped. The original plan was for Phase 6 (dedup fix) and Phase 7 (whatever falsification surfaced after Phase 6) to ride a single publish — 1.31.2 — once both phases closed. Phase 6 was rushed to npm before Phase 7's falsification ran, so the malformed-line defense couldn't ride along and forced a 1.31.3 follow-up publish two hours later.

The cost was small here — one extra `pnpm publish` cycle, one extra version number to maintain. But the principle is general: **falsification of Phase N can produce a Phase N+1 that's a fix-in-scope for Phase N**. Publishing Phase N before falsifying it is publishing a fix you haven't bullshit-detected yet.

**Rule of thumb**: when a plan has falsification phases planned (or in retrospect, likely), publish after the final falsification closes — not after each individual phase. The eval hook fires on every commit anyway; the per-commit feedback loop doesn't depend on publishing.

## Inspect the eval session JSONL during diagnosis, not in a panic

June's Phase 6 diagnosis went straight to the right answer in minutes: count tool calls in the eval-agent's session JSONL (`~/.claude/projects/<pkg>/<sessionId>.jsonl`). Over 197 evals: 8 `highlights_unprocessed` calls, 0 `graph_capture`, 0 `mark_processed`. The empirical case for "the agent isn't even seeing the instruction" was built in 7 lines of Python.

April's Phase 1 didn't look at the session JSONL — the symptom (`graphitiWrites: 0`) seemed to be about tool *availability*, not about agent *behavior*. The Phase 1 diagnostic protocol was "A/B test the spawn flags," which was correct for the bug at hand but blind to the resume-prompt divergence that would surface later.

**Concrete commitment**: package the 7-line tool-call counter as a permanent `indusk eval session-tools <id> <session>` subcommand. Every future eval-agent regression starts with that question — *which tools is the agent actually calling?* — before any A/B testing of inputs.

## Don't ship a strict-equality interface change without auditing consumers

Phase 6 changed `ProcessedMark` additively (safe — TypeScript consumers don't break) AND changed `markProcessed`'s behavior from "always append" to "reject duplicates" (not safe). No code in dusk's tree relied on the old behavior, but no downstream consumer audit was performed either.

For the same change in a multi-consumer ecosystem (numero, concierge, future projects), this would have been a breaking change requiring coordinated upgrade. **Document the contract change loudly in the changelog** (we did) AND **grep the workspace for callers before shipping** (we should have).

When a function's *return shape* or *side-effect contract* changes between versions, the loudness of the changelog is not enough — a `grep` against every workspace package importing the module is the only honest check.

## Reusable artifacts from this plan

- `apps/indusk-mcp/src/__tests__/eval-resume-prompt-includes-highlights.test.ts` — source-grep regression pinning the resume prompt shape + spawn flags + CRITICAL preamble + already_processed handling. Pattern is reusable for any persistent-subprocess plan.
- `apps/indusk-mcp/src/lib/highlights/highlights.ts:isIdInRawProcessed` — defensive substring-on-raw-content check as a belt-and-suspenders layer on top of a tolerant parser. Pattern is reusable wherever a parser silently drops malformed inputs AND a writer needs to detect "this thing was already seen."
- The 7-line eval-agent-session tool-call counter (not yet packaged) — first-line diagnostic for any "the agent isn't behaving" complaint. Should land as `indusk eval session-tools` in a follow-up plan.

## Related plans

- [Agent Roles](/decisions/agent-roles) — the three-tier architecture that created the highlights queue this plan was about
- [Eval Agent Bug Fix](/lessons/eval-agent-bug-fix) — the April 2026 sibling plan that fixed the CJS-require-in-ESM hook-spawn crash
- [Eval Agent OTel](/lessons/eval-agent-otel) — opt-in OTel for the eval agent (diagnostic tool that could have made the 2-month regression visible earlier)
- [Falsification Ritual](/guide/falsification-ritual) — the discipline that surfaced 4 of 4 bugs this plan's June burst landed
