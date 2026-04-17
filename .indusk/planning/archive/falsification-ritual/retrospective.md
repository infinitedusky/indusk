---
title: "Falsification Ritual — Retrospective"
date: 2026-04-17
---

# Falsification Ritual — Retrospective

## What We Set Out to Do

Close the hole `tests-first-planning` left open. The Test Trajectory made universal deferral structurally impossible, but authors can only name the tests they can think of — happy-path thinking produces happy-path tests, and the author is the last person likely to notice the gaps in their own thinking. The Numero lesson `verification-gates-need-adversarial-framing.md` captured one instance (the PokerV2 harness that passed while the code bypassed the interface the plan claimed to validate). We operationalized that lesson as a ritual — a bullshit detector between `/work` and `/retrospective`.

Delivered:
- `/falsify {plan}` skill driving a bounty-hunting loop (investigate → hypothesize → write failing test → run) with same-agent goal-flip
- Three outcomes per failing test (fix in scope, spawn new plan, accept as finding) with hybrid agent-proposes-user-confirms exit
- Append-only log at `.indusk/planning/{plan}/falsification.md` with typed library (`appendHypothesis`, `markTerminated`, `readFalsificationLog`, `isFalsificationComplete`, `isFalsificationSkipped`)
- Retrospective skill hard-blocks without a completed log or two-field skip frontmatter
- Work skill directs users to `/falsify` at completion
- User-facing guide with worked example + sidebar entry + lesson cross-link
- Published as `@infinitedusky/indusk-mcp@1.16.0`

## What Actually Happened

Five phases shipped — planned four, added Phase 5 during the dogfood.

**Phase 1–4 tracked the plan closely.** Library, gate integration, docs, skill. Tests added cumulatively (23 at end of Phase 1, 33 after Phase 2, 43 after Phase 3, 51 after Phase 4 with T13 skill-prose assertions).

**Phase 4's dogfood produced Phase 5.** Running `/falsify falsification-ritual` against the plan's own completed impl confirmed two hypotheses:

- **H1**: The log parser is line-oriented (`/^\*\*Hypothesis:\*\* (.+)$/m`); a newline in hypothesis/note/reason fields silently truncates on round-trip. Three of four multiline round-trip tests failed.
- **H2**: JS regex `/m` mode treats CR (`\r`), LS (U+2028), and PS (U+2029) as line terminators too. Same class of bug — discovered by inspecting the regex spec after H1's fix. Confirmed via direct tsx eval.

Both were fix-in-scope outcomes — Phase 5 was added to the impl with trajectory row T15, the fix (`assertSingleLine` rejecting LF/CR/LS/PS), test updates (multiline.falsify.test.ts rewritten to assert throws), and context/document gates updated.

The ritual worked. It found real bugs in the system that built the ritual.

### Divergences from the plan

1. **Y-statement format thrashing.** Three rounds of refinement before settling on the final bold-label-with-colon shape: (a) I wrote verbose 7-clause Y-statements; (b) Sandy asked to reformat with bullets + colons; (c) I combined "In the context of" + "facing" into "In context facing" (wrong — those are distinct canonical clauses); (d) Sandy caught this, restored seven clauses; (e) I used bold labels without colons on their own lines; (f) Sandy asked for bold labels WITH colons, no blank line between label and paragraph. Final shape landed at iteration six. Each iteration rewrote the ADR + the planner skill template + the docs reference.

2. **`indusk update` invocation bug.** Running `indusk update` from within `apps/indusk-mcp/` wrote skills into `apps/indusk-mcp/.claude/` instead of the repo root's `.claude/`. This was half-anticipated (we'd hit a related bug with 1.15.1 hook sync) but the fix — CLI walk-up to `.indusk/config.json` — was unplanned scope, shipped as 1.16.1.

3. **Sub-app directory cleanup.** Deleting `apps/indusk-mcp/.claude/` (16 skills, 13 lessons, 5 hooks, settings.json) and `apps/indusk-mcp/.indusk/` (eval, extensions) — historical scaffolding from an earlier errant init run that had never been cleaned up. Unplanned but necessary hygiene.

4. **Conversation style correction.** Mid-plan, Sandy corrected the output cadence — too many walls of text before confirming agreement on the premise. Switched to question-first, shorter responses. Applied for the rest of the plan.

### Commit structure

Phase 4+5 landed as three distinct commits after a jj split surgery: (A) the falsification-ritual plan work itself, (B) indusk-mcp 1.16.1 CLI walk-up fix + `.gitignore` + sub-app dir deletion, (C) `.claude/` auto-sync refresh from running `indusk update` at the repo root. Splitting after the fact is doable but annoying — would have been cleaner to `jj new` between each intent shift.

## Getting to Done

Four unplanned bits of work beyond the original impl:

1. **Y-statement format standardization** across planner skill template + plan.md docs reference + this plan's own ADR (6 iterations over 2 rounds of back-and-forth with Sandy)
2. **`indusk update` walk-up fix** — introduced `resolveProjectRoot(startDir)` in config.ts, threaded `rootOrExit()` helper through every non-init command in cli.ts (~15 replacements), bumped to 1.16.1, added `.gitignore` entries for `apps/*/.claude/` and `apps/*/.indusk/`
3. **Sub-app directory cleanup** — deleted both dirs; jj split surgery to isolate the deletion from Phase 4+5's intentional work
4. **jj split across 3 commits** — required re-running `jj split` twice (once to separate Phase 4+5, once to separate the 1.16.1 fix from the auto-sync refresh)

None of these were on the original plan. All were caused by the plan's own activity (running `/falsify` triggered `indusk update` which exposed the sub-dir bug which exposed the accumulated cruft in `apps/indusk-mcp/.claude/`).

## What We Learned

1. **The dogfood catches real bugs.** Within ~15 minutes of running `/falsify` against the plan's own impl, two genuine regressions were found in the library. Not contrived edge cases — both are reachable from legitimate user input (multi-paragraph hypothesis text, text with CRLF line endings from Windows input). Falsification is productive when done seriously.

2. **Bounty hunting vs candidate generation is load-bearing.** The ritual's instruction "investigate the code, form a specific hypothesis, write the test that targets that hypothesis" is meaningfully different from "write N hopeful tests and see which ones fail." When I caught myself reaching for candidate generation (after H2), the skill prose's explicit anti-pattern warning pulled me back. The distinction isn't rhetorical — it changes what gets found.

3. **Skill-level enforcement is sufficient for the retrospective gate.** No Node-level validator hook, no PreToolUse block — just Step 0 in the retrospective skill, with a clear refusal message. Worked for the dogfood without requiring structural enforcement. The skip-reason frontmatter escape hatch is the safety valve.

4. **JS `/m` regex mode treats multiple characters as line terminators.** Not just `\n` — also `\r`, U+2028, U+2029. This is in the spec but easy to forget. The `assertSingleLine` fix in log.ts now rejects all four. Worth a Known Gotcha (already added).

5. **Plans can grow mid-closure productively.** Phase 5 was added during the dogfood via the fix-in-scope outcome, with the plan status flipping from `completed` back to `in-progress` for the additional work, then back to `completed`. The ADR explicitly allowed this and it worked. "Building the plane while flying" is a real mode, not just a metaphor.

6. **Format thrashing costs real time.** The Y-statement format conversation took six iterations to settle. Early alignment on shape (before writing ADRs with the format) would have saved ~30 minutes.

## What We'd Do Differently

1. **Front-load format decisions.** When a format is going to be standardized (as the Y-statement shape was), agree on it BEFORE writing documents using it. Otherwise every document has to be rewritten when the format changes. Next time, when a format feels up-in-the-air: write one example, agree on the shape, then write the rest.

2. **Anticipate sub-app `.claude/` accumulation earlier.** `apps/indusk-mcp/.claude/` had been sitting there since April 12 — well before this plan. Adding the gitignore + CLI walk-up fix to an earlier plan (tests-first-planning? 1.15.1?) would have prevented the current plan's scope creep. Rule of thumb: any time we ship CLI behavior that writes to `.claude/`, check what happens when it runs from a sub-app.

3. **Commit with `jj new` at intent boundaries.** The 3-way split at the end worked but was annoying. The pattern I should have used: right after the dogfood found H1, before adding Phase 5 to the impl, `jj new` to start a fresh change; then `jj new` again before the `indusk update` experiment that triggered the sub-dir bug. Intent-based commits would have split themselves.

4. **Test the skill prose's "bounty hunting, not candidate generation" framing earlier.** I wrote that framing in the ADR but didn't exercise it until Phase 4's dogfood. Had I exercised it earlier (e.g., against the Phase 1 library), the skill prose might have surfaced its own ambiguities sooner.

5. **Document the `indusk update` writes-to-cwd-not-root contract explicitly.** In hindsight, that contract was implicit; making it explicit in 1.14.x would have either surfaced the bug or the fix earlier. Undocumented behavior decays into surprise.

## Insights Worth Carrying Forward

- **Falsification at plan-close produces more value than falsification at plan-author.** Authoring-time falsification would have to hypothesize against an imaginary implementation; plan-close falsification hypothesizes against real code. The ritual's placement between `/work` and `/retrospective` is load-bearing, not incidental.
- **Same-agent goal-flip is sufficient.** No need for a persona switch, no need for `complementary-personas` to ship first. The mechanism is asking the same brain a different question. This simplifies the mental model and removes a dependency.
- **Line-oriented markdown formats have hidden edge cases.** Anything that parses `**Field:** {value}\n` with a `/m` regex silently loses content on CR/LS/PS. Either use a multi-line structural format (YAML block scalars, fenced blocks), or reject at the boundary (as `assertSingleLine` does).
- **"Building the plane while flying" is the intended mode, not a failure mode.** Plans that reopen during closure when real gaps are found are working as designed.

## Quality Ratchet

No new Biome rules emerged from this plan. Most mistakes were either:
- Format-thrashing (not lintable)
- jj workflow (not lintable)
- JS regex gotcha (documented as Known Gotcha; no rule catches it pre-runtime)
- Subprocess cwd assumptions (same — behavioral, not syntactic)

The lesson `.claude/lessons/verification-gates-need-adversarial-framing.md` is the quality-ratchet artifact from this plan's ADR-level thinking. The cross-link to the guide was added during Phase 3.

Per-project Biome rules: unchanged. Global Biome rules: unchanged.

## Metrics

- Sessions spent: 1 (long — same session as tests-first-planning)
- Commits: 5 distinct commits for this plan (brief+ADR+Y-format, Phase 1, Phase 2, Phase 3, Phase 4+5) plus side-commits (1.16.1 CLI fix, `.claude/` auto-sync refresh)
- Files touched: ~25 source + docs + plans
- Lines added/removed: roughly +3200 / -450 (excluding `apps/indusk-mcp/.claude/` deletion which was -4959 lines of historical cruft)
- Tests added: 51 vitest unit+integration tests across `log.test.ts`, `skip.test.ts`, `integration.test.ts`, `multiline.falsify.test.ts` — all passing
- Bugs caught by the dogfood: 2 (both fix-in-scope, both in the plan's own library)
- Package versions published: 1.16.0 (feature), 1.16.1 (CLI walk-up fix)
- Self-validation: `isFalsificationComplete` returns `true` for this plan's own log (3 entries: 2 confirmed hypotheses + 1 terminator)

## References

- `.indusk/planning/falsification-ritual/brief.md`
- `.indusk/planning/falsification-ritual/adr.md`
- `.indusk/planning/falsification-ritual/impl.md`
- `.indusk/planning/falsification-ritual/falsification.md` — the dogfood session's log
- `.claude/lessons/verification-gates-need-adversarial-framing.md` — the Numero origin lesson
- `apps/indusk-docs/src/guide/falsification-ritual.md` — user-facing guide
- `apps/indusk-docs/src/reference/falsification/log.md` — library reference with content-constraints section
- `apps/indusk-mcp/skills/falsify.md` — the skill prose
