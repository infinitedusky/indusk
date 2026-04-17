---
title: "Falsification Ritual — Implementation"
date: 2026-04-17
status: in-progress
trajectory: required
gate_policy: strict
---

# Falsification Ritual

## Goal

Ship `/falsify {plan}` as a new skill that runs between `/work` completion and `/retrospective`. The skill drives the same working agent through a bounty-hunting loop — investigate the code, form a specific hypothesis about what should be broken, write the test that confirms the hypothesis, run it — producing either real failing tests that expose gaps or a clean termination when the agent can no longer form an in-scope hypothesis. Plans can grow mid-closure via the "fix in scope" outcome. The retrospective skill hard-blocks without a falsification record or an explicit skip-reason.

## Scope

### In Scope
- New library module `apps/indusk-mcp/src/lib/falsification/` — types + log read/write + completion/skip detection
- New skill `apps/indusk-mcp/skills/falsify.md` — the skill prompt that directs the agent through the bounty-hunting loop
- Retrospective skill integration — refuses to run until falsification is complete or explicitly skipped
- Work skill integration — directs the user to run `/falsify` when impl completes
- Validator acknowledgement of `falsification: skipped — reason: {text}` frontmatter (not blocking, but parsed and surfaced by the retrospective gate)
- User-facing guide at `apps/indusk-docs/src/guide/falsification-ritual.md`
- VitePress sidebar entry
- Cross-link from `.claude/lessons/verification-gates-need-adversarial-framing.md` to the guide
- Dogfood: run `/falsify` against this plan's own completed impl before its retrospective

### Out of Scope
- A persona system for the adversary (same agent, goal-flip only)
- Automated property-derivation tooling (the agent hunts; tooling records)
- `Kind: adversarial` column on Trajectory
- Phase-close falsification (plan-close only for v1)
- Retrofitting completed plans (tests-first-planning, graphiti-infrastructure, etc.) with post-hoc falsification logs — optional if there's appetite, but not required by this plan
- A validator hook that structurally blocks `/retrospective` at the Node level (the skill-level block with skip-reason escape hatch is v1)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `falsification/log.ts` types + `appendHypothesis` / `readFalsificationLog` / `markTerminated` / `isFalsificationComplete` / `isFalsificationSkipped`; unit tests | `.indusk/` directory structure |
| Phase 2 | `retrospective.md` Step 0 gate; `work.md` completion handoff prose; frontmatter acknowledgement for `falsification: skipped` | Phase 1 library |
| Phase 3 | `apps/indusk-docs/src/guide/falsification-ritual.md`; sidebar entry; community-lesson cross-link | ADR, Phase 1 + 2 behavior |
| Phase 4 | New skill `apps/indusk-mcp/skills/falsify.md`; end-to-end dogfood run against this plan | Phases 1–3 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `appendHypothesis(plan, entry)` creates `.indusk/planning/{plan}/falsification.md` if missing and appends a structured entry (hypothesis, test path, outcome) | Phase 1 | Phase 1 | passing |
| T2 | `readFalsificationLog(plan)` parses the log back into an ordered list of entries, preserving insertion order | Phase 1 | Phase 1 | passing |
| T3 | `markTerminated(plan, reason)` appends a terminator line with the user-confirmed reason; subsequent `readFalsificationLog` includes it as the last entry | Phase 1 | Phase 1 | passing |
| T4 | `isFalsificationComplete(plan)` returns false when no log exists; true when the log has a terminator entry; false when the log has hypotheses but no terminator | Phase 1 | Phase 1 | passing |
| T5 | `isFalsificationSkipped(implBody)` returns true when impl frontmatter has `falsification: skipped` AND `falsification_reason: {non-empty text}`; false otherwise (missing, empty reason, or malformed) | Phase 1 | Phase 1 | passing |
| T6 | `readFalsificationLog` returns an empty array (not throws) when `.indusk/planning/{plan}/falsification.md` does not exist | Phase 1 | Phase 1 | passing |
| T7 | `retrospective.md` skill prose references the falsification gate and the skip-reason escape hatch — grep for `falsification` in the skill markdown returns both the completion check and the skip pattern | Phase 2 | Phase 2 | passing |
| T8 | `work.md` skill prose, at impl completion, directs the user to run `/falsify {plan}` before `/retrospective` — grep for `/falsify` in work.md returns at least one reference in the completion section | Phase 2 | Phase 2 | passing |
| T9 | End-to-end integration: given a plan whose impl is `completed` but has no `falsification.md` and no `falsification: skipped` frontmatter, the retrospective skill's prose Step 0 refuses to proceed and names the gate explicitly | Phase 2 | Phase 2 | passing |
| T10 | `apps/indusk-docs/src/guide/falsification-ritual.md` exists and contains sections for: the ritual (bounty-hunting), the principle (bullshit detector), the three outcomes, a worked example, the bookend symmetry with Test Trajectory | Phase 3 | Phase 3 | passing |
| T11 | VitePress sidebar at `apps/indusk-docs/src/.vitepress/config.ts` has an entry linking to `/guide/falsification-ritual` | Phase 3 | Phase 3 | passing |
| T12 | `.claude/lessons/verification-gates-need-adversarial-framing.md` cross-links the user-facing guide (grep for the guide path in the lesson file) | Phase 3 | Phase 3 | passing |
| T13 | `apps/indusk-mcp/skills/falsify.md` exists and contains the bounty-hunting loop prose (investigate → hypothesize → write test → run → outcome), the three-outcome handling, and the hybrid exit criterion (agent proposes, user confirms) | Phase 4 | Phase 4 | planned |
| T14 | Dogfood: running `/falsify falsification-ritual` against this plan's own `completed` impl produces at least one targeted hypothesis (fails against the attested state or confirms no in-scope hypothesis remained). `falsification.md` is written with the session record. | Phase 4 | Phase 4 | planned |

### Deferred Verification

- **The bounty-hunting framing actually finds gaps the happy-path author missed**
  - reason: cannot deterministically assert that goal-flipping surfaces real bugs without running the ritual across many plans with varying authors and domains
  - would require: 5+ plans across different codebases using `/falsify`, with retrospective audit confirming gaps found were non-trivial and would have shipped otherwise
  - mitigation: retrospective audit on the next 3 plans that use `/falsify` (this plan, agent-roles, and the first plan after agent-roles) explicitly counts hypotheses-that-fell and their downstream impact; findings captured in Graphiti as `falsification-value-{plan}` episodes so the eval agent can trend whether the ritual is producing value over time.

- **Agent self-declared "no more in-scope hypotheses" is honest, not premature**
  - reason: an agent that can't think of more hypotheses may have either exhausted the search (good termination) or run out of ideas (premature termination)
  - would require: comparing termination points across same-plan runs with different agents or different prompt phrasings
  - mitigation: the hybrid exit criterion requires user confirmation at termination — the user sees the summary of hypotheses investigated and can point at unexplored regions; retrospective audit adds a check "were any hypotheses the user added during termination confirmation productive?" If yes, the agent under-investigated and the skill prose should be tightened.

## Checklist

### Phase 1: Falsification Log Library

**Goal:** A typed library for reading and writing the falsification log file, detecting completion state, and recognizing the skip-reason frontmatter. Self-contained — no skill or hook changes yet.

#### Implementation

- [x] Create `apps/indusk-mcp/src/lib/falsification/log.ts`:
  - Types: `HypothesisOutcome = "fix-in-scope" | "spawn-plan" | "accept-finding"`; `HypothesisEntry = { kind: "hypothesis"; hypothesis; testPath; outcome; note?; timestamp }`; `TerminatorEntry = { kind: "terminator"; reason; timestamp }`; `LogEntry = HypothesisEntry | TerminatorEntry`; plus `MalformedLine` for the onMalformed callback
  - `appendHypothesis(planRoot, entry)` — creates log with a header if missing; appends an H2 section per entry (`## Hypothesis {ISO timestamp}` then fields); throws if already terminated; returns the stored entry for confirmation
  - `markTerminated(planRoot, reason)` — appends a terminator H2 section; throws on double terminator or empty reason
  - `readFalsificationLog(planRoot, opts?)` — parses the markdown using a section-scanning regex (`^## (Hypothesis|Terminated) {timestamp}$`); calls `opts.onMalformed` callback for entries with missing/invalid fields (mirroring the semantic-graph log's pattern); returns `[]` on missing file
  - `isFalsificationComplete(planRoot)` — true iff log exists and last entry is a terminator
- [x] Create `apps/indusk-mcp/src/lib/falsification/skip.ts`:
  - `isFalsificationSkipped(implContent)` — parses frontmatter via `gray-matter`, returns `{ skipped: true, reason }` when `falsification: skipped` AND `falsification_reason: "non-empty text"` are BOTH present. **Spec deviation from ADR**: the ADR wrote `falsification: skipped — reason: {text}` as an inline single-field pattern; the implementation uses two separate frontmatter fields (`falsification` + `falsification_reason`) to avoid YAML parser ambiguity around inner colons inside em-dash-separated values. Equivalent semantics, cleaner parser.
- [x] Write Vitest tests for T1–T6 — 15 tests in `log.test.ts` (uses `tmpdir()` for per-test isolation with `beforeEach` / `afterEach` cleanup; no external fixture files needed) + 8 tests in `skip.test.ts` covering happy path, missing fields, empty/whitespace reasons, wrong flag value, non-string reason, and malformed YAML resilience.

#### Phase 1 Verification

- [x] T1 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- falsification` — log.test.ts, 3 cases under T1)
- [x] T2 passes (same command — log.test.ts T2 block, 1 case)
- [x] T3 passes (same command — log.test.ts T3 block, 4 cases including throw paths)
- [x] T4 passes (same command — log.test.ts T4 block, 4 lifecycle cases)
- [x] T5 passes (same command — skip.test.ts, 8 cases covering all happy/sad paths)
- [x] T6 passes (same command — log.test.ts T6 block, 3 cases including malformed-entry resilience)
- [x] `pnpm check` passes on Phase 1 deliverables (biome auto-fixed minor formatting; all four files clean). Full indusk-mcp test suite green at 223/223.

#### Phase 1 Context

- [x] Added CLAUDE.md Conventions bullet: covers the ritual purpose (bounty hunt), log location (`.indusk/planning/{plan}/falsification.md`), library pointer (`apps/indusk-mcp/src/lib/falsification/log.ts`), and the two-field skip opt-out (`falsification: skipped` + `falsification_reason: "..."`) with a link to the ADR.

#### Phase 1 Document

- [x] Wrote reference page at `apps/indusk-docs/src/reference/falsification/log.md` — documents the log format with a worked example, the `LogEntry` / `HypothesisOutcome` types, the five library functions (`appendHypothesis`, `markTerminated`, `readFalsificationLog`, `isFalsificationComplete`, `isFalsificationSkipped`), the hook-integration contract for the retrospective gate, and the "two fields vs inline pattern" rationale for the skip frontmatter.

### Phase 2: Retrospective Gate and Work Handoff

**Goal:** The retrospective skill refuses to run until falsification is complete or explicitly skipped. The work skill, at impl completion, directs the user to run `/falsify` before declaring the plan ready for retrospective.

#### Implementation

- [x] Updated `apps/indusk-mcp/skills/retrospective.md`: added Step 0 Falsification Gate at the top of the Audit Checklist. Step 0 is blocking — no writing the retrospective until the gate passes. Names both satisfying conditions (completion via `isFalsificationComplete` or skip via `isFalsificationSkipped`), spells out the two-field frontmatter shape, and surfaces the refusal message as a blockquote with a copy-pasteable skip block.
- [x] Updated `apps/indusk-mcp/skills/work.md`: Step 15 Completion now directs the user to run `/falsify {plan}` before `/retrospective`, notes that the ritual may reopen the impl (status back to `in-progress` for fix-in-scope), references the skip opt-out, and links the guide + ADR. The final user-facing message is spelled out explicitly.
- [x] Wrote integration tests for T7, T8, T9 in `apps/indusk-mcp/src/lib/falsification/integration.test.ts` — 10 tests:
  - T7 (4 tests): Step 0 exists, references both helper functions by name, names both skip fields, explicitly refuses to proceed
  - T8 (4 tests): Step 15 exists, mentions /falsify in the completion section, /falsify appears BEFORE /retrospective in that section, references the skip opt-out
  - T9 (2 tests): gate logic applied to a synthetic plan with no record (fails) and a synthetic plan with valid skip frontmatter (passes)

#### Phase 2 Verification

- [x] T7 passes (`pnpm test falsification` — integration.test.ts, 4 assertions on retrospective.md Step 0)
- [x] T8 passes (same command — 4 assertions on work.md Step 15, including /falsify-before-/retrospective ordering)
- [x] T9 passes (same command — 2 synthetic-plan gate-check assertions; full suite: 233/233 green)

#### Phase 2 Context

- [x] Added CLAUDE.md Conventions bullet: "Retrospective hard-blocks without falsification" — names Step 0 in retrospective.md, the two helper functions used to evaluate the gate, and the work skill's role in directing users to /falsify first. Notes skill-level enforcement over Node-level validator hooks as a deliberate v1 choice.

#### Phase 2 Document

- [x] Updated `apps/indusk-docs/src/reference/skills/retrospective.md` — inserted Step 0 Falsification Gate before Step 1, names both satisfying conditions, points at the library reference and (forward-link) the user-facing guide.
- [x] Updated `apps/indusk-docs/src/reference/skills/work.md` — added a new section "### 11. Plan completion — run `/falsify` next" between the Advance step and the Hook Enforcement section, covering the three ritual outcomes, the retrospective hard-block, and links to the guide.

### Phase 3: User-Facing Guide and Cross-Links

**Goal:** Ship the user-facing guide for the falsification ritual, link it from the sidebar, and cross-reference the origin lesson so future readers find the lineage.

#### Implementation

- [x] Wrote `apps/indusk-docs/src/guide/falsification-ritual.md` — covers motivation (the universal-deferral/Trajectory/rubber-stamp arc), the bullshit-detector principle with three supporting arguments (asymmetric prove-failure, unknown unknowns, deterrent byproduct), same-agent-flipped-goal, bounty hunting vs candidate generation (the load-bearing framing), the seven-step ritual, the three outcomes with a decision matrix, the hybrid exit criterion, a full worked example (crash-recovery subsystem with 4 hypotheses across fix-in-scope / pass / spawn-plan / terminate paths), log location, skip-reason escape hatch, retrospective hard-block contract, and the relationship to complementary-personas. Plus See Also.
- [x] Added sidebar entry to `apps/indusk-docs/src/.vitepress/config.ts` — "Falsification Ritual" link, placed after "Test Trajectory" in the Guide section (bookend adjacency).
- [x] Updated `.claude/lessons/verification-gates-need-adversarial-framing.md` — appended "## See Also" section pointing to the guide, naming this as the lesson's operationalization, and noting the split (lesson covers the technique; ritual covers the discipline).

#### Phase 3 Verification

- [x] T10 passes — integration.test.ts T10 (5 assertions: guide exists, all section headings present including "Bounty hunting, not candidate generation", three outcomes named, two-field skip documented, bookend symmetry established)
- [x] T11 passes — integration.test.ts T11 (2 assertions: sidebar contains the link path, entry has the expected "Falsification Ritual" label)
- [x] T12 passes — integration.test.ts T12 (3 assertions: lesson file exists, references the guide path, has a See Also section). Full suite: 243/243 green.

#### Phase 3 Context

- [x] Updated CLAUDE.md Key Decisions — added a bullet summarizing the ritual, its bookend relationship to `tests-first-planning`, the three outcomes, the hybrid exit, and the retrospective hard-block. Links the ADR and the user-facing guide.

#### Phase 3 Document

- [x] Added changelog entry at `apps/indusk-docs/src/changelog.md` — `Falsification Ritual (1.16.0)` under Added, describing the skill, the bounty-hunting loop, the three outcomes, the hybrid exit, the retrospective hard-block, and the bookend relationship to Test Trajectory. Links the guide.

### Phase 4: The Skill, Dogfood, and Version Bump

**Goal:** Write the `/falsify` skill itself and run it end-to-end against this plan's own completed impl. The skill prose is the last piece because the previous phases build the scaffolding it uses.

#### Implementation

- [ ] Write `apps/indusk-mcp/skills/falsify.md`:
  - Frontmatter: `name: falsify`, description, `argument-hint: "[plan name]"`
  - Skill body: the bounty-hunting loop prose (investigate → hypothesize → write test → run → outcome), explicit that this is the SAME AGENT under a goal-flip (not a persona), the three outcomes with decision criteria, the hybrid exit criterion, references to `apps/indusk-mcp/src/lib/falsification/log.ts` for log writes, and the graduation handoff to `/retrospective` after clean termination
  - Includes a "How to hunt" sub-section: concrete prompts the agent asks itself — "what's an edge case not covered by T1–Tn?", "what's an implicit invariant the attestation makes that the Trajectory doesn't test?", "what's a concurrent/partial/malformed input path?", "what would a malicious user try?"
  - Includes explicit anti-pattern warnings: "do not write hopeful candidate tests — hunt a specific target each iteration"
- [ ] Add the skill to `apps/indusk-mcp/update.ts` hook sync list if hardcoded (it shouldn't be after the 1.15.1 fix which switched to glob-discovery, but verify)
- [ ] **Dogfood: run `/falsify falsification-ritual` against this plan's own impl** once Phases 1–3 are complete (i.e., impl is `completed` except for Phase 4 Verification and below). The ritual should exercise the full loop against this plan's attested state ("the log library works, the retrospective gate blocks without falsification, the guide explains the ritual, the skill drives the bounty-hunt"). Produce `.indusk/planning/falsification-ritual/falsification.md` with the session record. Either:
  - Find a real gap → add a phase to THIS impl, flip status back to `in-progress`, fix, re-falsify. (Legitimate mid-plan growth — this is the ritual working on itself.)
  - OR terminate cleanly → the attested state holds, no in-scope hypothesis remained. Document the hypotheses investigated in the log.
- [ ] Bump `apps/indusk-mcp/package.json` version: `1.15.1 → 1.16.0` (minor — new feature, additive, no breaking changes)

#### Phase 4 Verification

- [ ] T13 passes — grep for required sections in the skill markdown (`bounty`, `investigate`, `hypothesis`, `three outcomes`, `hybrid exit`, `same agent`)
- [ ] T14 passes — `.indusk/planning/falsification-ritual/falsification.md` exists with at least one hypothesis entry and a terminator; `isFalsificationComplete` returns true when called against this plan
- [ ] `pnpm check` passes on all Phase 4 deliverables
- [ ] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes (full suite green, including any tests added across Phases 1–4)
- [ ] Manual sanity: running the retrospective skill against this plan with the completed falsification log proceeds cleanly past Step 0 (no gate refusal)

#### Phase 4 Context

- [ ] Update CLAUDE.md Current State: add a sentence noting `/falsify` is the new plan-close ritual and `falsification-ritual` plan is archived (or will be after retrospective).
- [ ] Update CLAUDE.md Known Gotchas: "Falsification logs live at `.indusk/planning/{plan}/falsification.md` alongside research/brief/adr/impl/retrospective. They survive in the archive. The log format is append-only markdown — never edit in place; new entries are appended via `appendHypothesis` / `markTerminated`."

#### Phase 4 Document

- [ ] Publish the guide page (happens on merge to main if docs build passes)
- [ ] Ensure changelog entry is present (written in Phase 3) and reflects the 1.16.0 version
