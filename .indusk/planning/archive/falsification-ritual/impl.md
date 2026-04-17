---
title: "Falsification Ritual — Implementation"
date: 2026-04-17
status: completed
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
| T13 | `apps/indusk-mcp/skills/falsify.md` exists and contains the bounty-hunting loop prose (investigate → hypothesize → write test → run → outcome), the three-outcome handling, and the hybrid exit criterion (agent proposes, user confirms) | Phase 4 | Phase 4 | passing |
| T14 | Dogfood: running `/falsify falsification-ritual` against this plan's own `completed` impl produces at least one targeted hypothesis (fails against the attested state or confirms no in-scope hypothesis remained). `falsification.md` is written with the session record. | Phase 4 | Phase 4 | passing |
| T15 | Log library rejects multiline content in `hypothesis`, `note`, or `reason` fields (including CR, LS, PS) with a specific error rather than silently truncating during round-trip. Discovered by falsify-ritual dogfood in Phase 4. | Phase 5 | Phase 5 | passing |

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

- [x] Wrote `apps/indusk-mcp/skills/falsify.md` — frontmatter declares name + argument-hint; body covers the bounty-hunting loop (explicitly named; anti-pattern "hopeful candidates" warning), "How to hunt" sub-section with 7 concrete self-prompts, the three outcomes with decision criteria, the hybrid exit criterion, the skip-via-frontmatter escape hatch, same-agent-no-persona assertion, and library function references (appendHypothesis / markTerminated).
- [x] Verified skill sync — update.ts Phase 1.15.1 fix already uses `glob("*.js"...)` for hooks but hardcoded enumeration for skills. Skills are synced via `globSync("*.md", { cwd: skillsSource })` already — so `falsify.md` sync-discovers on update with no code changes. Confirmed by reading update.ts step 2.
- [x] **Dogfood: ran `/falsify falsification-ritual` against this plan's own impl.** Session produced 2 confirmed hypotheses + 1 terminator in `.indusk/planning/falsification-ritual/falsification.md`:
  - **H1 (confirmed, fix-in-scope)**: log parser silently truncated multiline content at LF — regex is /m single-line. Fixed via `assertSingleLine` in `log.ts` that rejects LF at the library boundary.
  - **H2 (confirmed, fix-in-scope)**: JS /m mode treats CR, LS (U+2028), PS (U+2029) as line terminators too — same class of bug. Fixed via extending `assertSingleLine`'s regex from `/\n/` to `/[\n\r\u2028\u2029]/`.
  - **Terminator**: investigated 14 hypotheses total across log parser, skip detection, retrospective gate, and filesystem edges. Remaining surfaces are either out-of-scope (agent protocol compliance → eval judge territory) or correctly handled (fs errors propagate cleanly). No further in-scope hypothesis remained.
  - Plan did NOT reopen to in-progress — the fix-in-scope work happened during the same Phase 4 window by adding Phase 5 to the impl. Trajectory T15 added and passing.
- [x] Bumped `apps/indusk-mcp/package.json` version: `1.15.1 → 1.16.0` (minor — additive feature, no breaking changes to existing impls without `/falsify`).

#### Phase 4 Verification

- [x] T13 passes — integration.test.ts T13 block (8 assertions: file exists, frontmatter has name + argument-hint, bounty-hunting loop keywords present, candidate-generation anti-pattern called out, three outcomes slugs, hybrid exit language, same-agent assertion, library function references)
- [x] T14 passes — `.indusk/planning/falsification-ritual/falsification.md` exists with 2 hypothesis entries + 1 terminator; `isFalsificationComplete(planRoot)` returns `true` (verified via tsx eval)
- [x] `pnpm check` passes on Phase 4 + Phase 5 deliverables (biome clean on all modified files)
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` — full suite green at **259/259** (67 trajectory + 51 falsification core + existing)
- [x] Manual sanity: the retrospective gate check (`isFalsificationComplete(planRoot) || isFalsificationSkipped(impl).skipped`) returns `true` for this plan — gate would pass cleanly into Step 1

#### Phase 4 Context

- [x] Updated CLAUDE.md Current State — added "Falsification Ritual live" sentence covering the skill, the retrospective hard-block, version 1.16.0, and a note that the falsification-ritual plan dogfooded itself (2 real gaps found and fixed via Phase 5).
- [x] Added CLAUDE.md Known Gotchas: "Falsification log fields must be single-line" — covers the line-separator rejection (LF/CR/LS/PS), the dogfood origin, and the round-trip rationale.

#### Phase 4 Document

- [x] Guide page at `apps/indusk-docs/src/guide/falsification-ritual.md` ready for publish (docs build runs on merge). Updated `falsification/log.md` reference with "Content constraints" section covering the line-separator rejection.
- [x] Changelog entry at `apps/indusk-docs/src/changelog.md` written in Phase 3 reflects 1.16.0 (package.json now matches).

### Phase 5: Multiline Content Rejection (fix-in-scope from /falsify dogfood)

**Goal:** The Phase 4 dogfood surfaced that `hypothesis`, `note`, and `reason` fields silently truncate at the first newline during round-trip — the parser is line-oriented. The fix: reject multiline content at the library boundary with a specific error, so callers either sanitize before passing or fail loudly rather than losing data. Same format on disk, stronger contract at the library.

#### Implementation

- [ ] Update `apps/indusk-mcp/src/lib/falsification/log.ts`:
  - `appendHypothesis(planRoot, entry)`: throw a specific error if `entry.hypothesis` or `entry.note` contains a newline character. Error message names the offending field and suggests the fix (single-line, or split across multiple entries).
  - `markTerminated(planRoot, reason)`: throw similarly if `reason` contains a newline.
  - Existing single-line behavior unchanged; no on-disk format change.
- [ ] Update `apps/indusk-mcp/src/lib/falsification/multiline.falsify.test.ts`:
  - Tests currently assert round-trip fidelity and fail (confirming the gap). Rewrite to assert that multiline content throws with a clear error. Include a sanity test that single-line content still round-trips correctly.

#### Phase 5 Verification

- [x] T15 passes (multiline.falsify.test.ts — 8 cases total: LF hypothesis throws, LF note throws, LF reason throws, single-line round-trips, error message sanitization hint, CR throws, CRLF throws, Unicode LS + PS throw)
- [x] Full suite green: `pnpm turbo test --filter=@infinitedusky/indusk-mcp` → 259/259 passing

#### Phase 5 Context

- [x] Added CLAUDE.md Known Gotchas: "Falsification log fields (hypothesis, note, reason) must be single-line" — covers LF/CR/LS/PS rejection, dogfood origin, round-trip rationale, and link to the log at `.indusk/planning/falsification-ritual/falsification.md`.

#### Phase 5 Document

- [x] Updated `apps/indusk-docs/src/reference/falsification/log.md` — added a "Content constraints" section explaining the line-oriented parser, the four rejected line-separator characters (LF/CR/LS/PS), the throws on each API method, and a pointer to the falsification log where the two confirmed hypotheses are recorded as the origin story.
