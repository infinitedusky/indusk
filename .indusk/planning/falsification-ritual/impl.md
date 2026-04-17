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
| T1 | `appendHypothesis(plan, entry)` creates `.indusk/planning/{plan}/falsification.md` if missing and appends a structured entry (hypothesis, test path, outcome) | Phase 1 | Phase 1 | planned |
| T2 | `readFalsificationLog(plan)` parses the log back into an ordered list of entries, preserving insertion order | Phase 1 | Phase 1 | planned |
| T3 | `markTerminated(plan, reason)` appends a terminator line with the user-confirmed reason; subsequent `readFalsificationLog` includes it as the last entry | Phase 1 | Phase 1 | planned |
| T4 | `isFalsificationComplete(plan)` returns false when no log exists; true when the log has a terminator entry; false when the log has hypotheses but no terminator | Phase 1 | Phase 1 | planned |
| T5 | `isFalsificationSkipped(implBody)` returns true when impl frontmatter has `falsification: skipped — reason: {non-empty text}`; false otherwise (missing, empty reason, or malformed) | Phase 1 | Phase 1 | planned |
| T6 | `readFalsificationLog` returns an empty array (not throws) when `.indusk/planning/{plan}/falsification.md` does not exist | Phase 1 | Phase 1 | planned |
| T7 | `retrospective.md` skill prose references the falsification gate and the skip-reason escape hatch — grep for `falsification` in the skill markdown returns both the completion check and the skip pattern | Phase 2 | Phase 2 | planned |
| T8 | `work.md` skill prose, at impl completion, directs the user to run `/falsify {plan}` before `/retrospective` — grep for `/falsify` in work.md returns at least one reference in the completion section | Phase 2 | Phase 2 | planned |
| T9 | End-to-end integration: given a plan whose impl is `completed` but has no `falsification.md` and no `falsification: skipped` frontmatter, the retrospective skill's prose Step 0 refuses to proceed and names the gate explicitly | Phase 2 | Phase 2 | planned |
| T10 | `apps/indusk-docs/src/guide/falsification-ritual.md` exists and contains sections for: the ritual (bounty-hunting), the principle (bullshit detector), the three outcomes, a worked example, the bookend symmetry with Test Trajectory | Phase 3 | Phase 3 | planned |
| T11 | VitePress sidebar at `apps/indusk-docs/src/.vitepress/config.ts` has an entry linking to `/guide/falsification-ritual` | Phase 3 | Phase 3 | planned |
| T12 | `.claude/lessons/verification-gates-need-adversarial-framing.md` cross-links the user-facing guide (grep for the guide path in the lesson file) | Phase 3 | Phase 3 | planned |
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

- [ ] Create `apps/indusk-mcp/src/lib/falsification/log.ts`:
  - Types: `HypothesisOutcome = "fix-in-scope" | "spawn-plan" | "accept-finding"`; `LogEntry = { kind: "hypothesis"; hypothesis: string; testPath: string | null; outcome: HypothesisOutcome; note?: string; timestamp: string } | { kind: "terminator"; reason: string; timestamp: string }`
  - `appendHypothesis(planRoot: string, entry: Omit<LogEntry & {kind: "hypothesis"}, "timestamp">): void` — appends a structured entry to `{planRoot}/falsification.md`. Creates the file if missing with a header. Format: each entry is a markdown H3 heading + body.
  - `markTerminated(planRoot: string, reason: string): void` — appends a terminator entry. Subsequent calls to `appendHypothesis` throw (terminated).
  - `readFalsificationLog(planRoot: string): LogEntry[]` — parses the log into ordered entries. Returns `[]` if missing. Handles malformed entries by skipping them (logs a warning via `onMalformed` callback, matching the semantic-graph log's pattern).
  - `isFalsificationComplete(planRoot: string): boolean` — true iff the log exists and its last entry is a terminator.
- [ ] Create `apps/indusk-mcp/src/lib/falsification/skip.ts`:
  - `isFalsificationSkipped(implBody: string): { skipped: boolean; reason: string | null }` — parses the impl's frontmatter, returns `{ skipped: true, reason }` when `falsification: skipped — reason: {non-empty}` is present. Returns `{ skipped: false, reason: null }` otherwise (missing, empty reason, malformed).
- [ ] Write Vitest tests for T1–T6 using fixture plan dirs under `apps/indusk-mcp/src/lib/falsification/__tests__/fixtures/`.

#### Phase 1 Verification

- [ ] T1 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- falsification`)
- [ ] T2 passes (same command)
- [ ] T3 passes (same command)
- [ ] T4 passes (same command)
- [ ] T5 passes (same command)
- [ ] T6 passes (same command)
- [ ] `pnpm check` passes on Phase 1 deliverables (biome clean on `apps/indusk-mcp/src/lib/falsification/`)

#### Phase 1 Context

- [ ] Add to CLAUDE.md Conventions: "Every plan that completes impl runs `/falsify {plan}` before `/retrospective`. The ritual writes a structured log at `.indusk/planning/{plan}/falsification.md` via `apps/indusk-mcp/src/lib/falsification/log.ts`. Skipping requires an explicit `falsification: skipped — reason: {text}` in the impl frontmatter."

#### Phase 1 Document

- [ ] Write reference page at `apps/indusk-docs/src/reference/falsification/log.md` documenting the log format, the `LogEntry` types, the five library functions, and the skip-reason frontmatter. User-facing guide is Phase 3.

### Phase 2: Retrospective Gate and Work Handoff

**Goal:** The retrospective skill refuses to run until falsification is complete or explicitly skipped. The work skill, at impl completion, directs the user to run `/falsify` before declaring the plan ready for retrospective.

#### Implementation

- [ ] Update `apps/indusk-mcp/skills/retrospective.md`:
  - Add a new "Step 0: Falsification Gate" at the top of the Audit Checklist (before Step 1). Pseudo-code:
    ```
    import { isFalsificationComplete } from "apps/indusk-mcp/src/lib/falsification/log.js";
    import { isFalsificationSkipped } from "apps/indusk-mcp/src/lib/falsification/skip.js";
    const ok = isFalsificationComplete(planRoot) || isFalsificationSkipped(implBody).skipped;
    if (!ok) refuse with: "Run `/falsify {plan}` first. To skip intentionally, add `falsification: skipped — reason: {text}` to impl frontmatter."
    ```
  - Write it as skill prose (agent instructions), not executable code — the agent runs the check by invoking the helpers via tsx/MCP, as elsewhere in the skills.
- [ ] Update `apps/indusk-mcp/skills/work.md`:
  - In Step 15 (Completion), add: "Before updating impl status to `completed`, run `/falsify {plan}` to exercise the falsification ritual. The ritual may surface gaps that reopen the plan (`status: in-progress` again). Only after `/falsify` terminates cleanly — or is explicitly skipped via `falsification: skipped — reason: {text}` in the frontmatter — mark the plan `completed` and let the user know it's ready for `/retrospective`."
- [ ] Write integration tests for T7, T8, T9 — grep-style markdown assertions on the skill files plus a mock-fixture retrospective dry-run.

#### Phase 2 Verification

- [ ] T7 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- retrospective-gate`)
- [ ] T8 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- work-handoff`)
- [ ] T9 passes — integration test using a fixture plan with `completed` impl but no falsification record; retrospective skill prose surfaces the gate refusal message

#### Phase 2 Context

- [ ] Update CLAUDE.md Conventions: "Retrospective hard-blocks without falsification. The gate check runs first in `/retrospective` via `isFalsificationComplete(planRoot) || isFalsificationSkipped(implBody)`. Skipping requires frontmatter opt-out with a recorded reason."

#### Phase 2 Document

- [ ] Update `apps/indusk-docs/src/reference/skills/retrospective.md` — add Step 0 Falsification Gate with the refusal message, the two satisfying conditions, and a pointer to the guide (which will be written in Phase 3).
- [ ] Update `apps/indusk-docs/src/reference/skills/work.md` — note the completion handoff to `/falsify` in the completion section.

### Phase 3: User-Facing Guide and Cross-Links

**Goal:** Ship the user-facing guide for the falsification ritual, link it from the sidebar, and cross-reference the origin lesson so future readers find the lineage.

#### Implementation

- [ ] Write `apps/indusk-docs/src/guide/falsification-ritual.md`:
  - **Motivation** — Test Trajectory fixed universal deferral; authors still ship blind spots because they only write tests they can think of; the "I don't know what I don't know" problem
  - **The principle** — bullshit detector; same agent, flipped goal; bounty hunting over candidate generation
  - **The ritual** — investigate → hypothesize → write test → run → outcome (fix-in-scope, spawn-plan, accept-finding)
  - **Bookend symmetry** — Trajectory writes failing tests at start that pass on success; `/falsify` hunts failing tests at close that shouldn't be producible if success is real
  - **The three outcomes** with when to pick each
  - **Hybrid exit criterion** — agent proposes, user confirms
  - **Worked example** — a small plan that attested to "all user actions are audit-logged" and `/falsify` surfaces a specific concurrent-write path that writes to DB but skips the audit queue
  - **Relation to complementary-personas** — personas are a richer future instantiator; the baseline ritual works today with whatever agent
  - **Operational details** — where the log lives, the skip-reason escape hatch, the hard-block on retrospective
- [ ] Add sidebar entry to `apps/indusk-docs/src/.vitepress/config.ts` — under the Guide section, after "Test Trajectory."
- [ ] Update `.claude/lessons/verification-gates-need-adversarial-framing.md` — append a "See Also" section pointing to the guide and noting that the lesson is the intellectual origin of the `/falsify` ritual.

#### Phase 3 Verification

- [ ] T10 passes — guide file exists with all six required section headings (motivation, principle, ritual, bookend, outcomes, worked example)
- [ ] T11 passes — sidebar config has a `/guide/falsification-ritual` entry
- [ ] T12 passes — the community lesson contains a reference to the guide path

#### Phase 3 Context

- [ ] Update CLAUDE.md Key Decisions: add a bullet linking to `.indusk/planning/falsification-ritual/adr.md`

#### Phase 3 Document

- [ ] Add changelog entry at `apps/indusk-docs/src/changelog.md` under Added: "`/falsify {plan}` — a bounty-hunting ritual between `/work` and `/retrospective` that drives the agent through goal-flipped failure-finding. Hard-blocks retrospective without a clean termination or explicit skip-reason."

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
