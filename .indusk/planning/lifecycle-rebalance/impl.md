---
title: "Lifecycle Rebalance — the Shape check"
date: 2026-08-08
status: completed
trajectory: required
rationale: required
gate_policy: ask
---

# Lifecycle Rebalance — the Shape check

## Goal

Ship a `Shape` check at the phase boundary in the Claude Code lane: after a phase's verification is green, the executing agent reviews the code that phase wrote against the enabled domain extensions' craft rules, and any finding becomes a checklist item in that same phase.

Craft feedback arrives in the phase that wrote the code instead of at plan close. No new gate type, no validator change, nothing to retrofit into the 51 existing impls.

## Scope

### In Scope
- A `lib/shape/` library supplying the deterministic inputs: what this phase changed, what rules apply, how a finding becomes an item.
- A generic phase-boundary record (`{plan, phase, sha, at}`) that future boundary checks share.
- A `Shape` step in `/work`'s per-phase completion order, after Verification, before Context.
- Recording "reviewed, nothing found" and "no code surface" as explicit outcomes.
- Docs: a Shape guide, a narrowed Cleanup scope, the updated `/work` order.

### Out of Scope
- **The thin lane** (`atdawn run`) — a later plan ports it, and pays the real model-call cost there.
- **Challenge / Tier-2** — separate judgment capability, separate plan.
- **Documentation restructure** and **wiring `atdawn verify` into `runLoop`** — the rebalance's other slices.
- Changing `/cleanup`'s behavior beyond narrowing its documented scope.
- New gate types, validator rules, or edits to existing impls.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `lib/shape/boundary.ts` (append/read the phase-boundary record); `lib/shape/changed.ts` (files this phase changed) | `verify/git.ts` change-listing precedent; `cleanup/oversized.ts` merge-base chain |
| Phase 2 | `lib/shape/rules.ts` (craft rules from enabled extensions, with the intra-unit scope declaration); `lib/shape/findings.ts` (append a finding as a checklist item to a named phase) | Phase 1's changed-file scope; `impl-parser.ts`; extension manifests |
| Phase 3 | `lib/shape/shape.ts` — the surface the skill calls: review inputs in, outcome recorded out; the `/work` skill step + synced installed copy | Phases 1–2; `skills/work.md` |
| Phase 4 | The Shape/Cleanup boundary pinned from both sides; docs (guide, cleanup narrowing, work reference, changelog) | Phases 1–3; `cleanup/oversized.ts` |

## Test Trajectory

| ID | Asserts | Test | Writable at | Passes at | State |
|----|---------|------|-------------|-----------|-------|
| A1 | A phase that writes a unit violating a craft rule gains a checklist item naming both the change to make and the rule it came from | `apps/indusk-mcp/src/lib/shape/findings.test.ts` | Phase 1 | Phase 2 | passing |
| A2 | The item lands in the phase that produced the code — not a new phase, not at plan close | `apps/indusk-mcp/src/lib/shape/findings.test.ts` | Phase 1 | Phase 2 | passing |
| A3 | A phase whose Shape items are unchecked cannot be closed | `apps/indusk-mcp/src/lib/shape/gate-interaction.test.ts` | Phase 0 | Phase 2 | passing |
| A4 | When the code a phase wrote is well-shaped, no items are added and the phase records that the review ran and found nothing | `apps/indusk-mcp/src/lib/shape/shape.test.ts` | Phase 1 | Phase 3 | passing |
| A5 | Shape reviews only files the current phase changed — earlier phases' code is not re-flagged | `apps/indusk-mcp/src/lib/shape/changed.test.ts` | Phase 1 | Phase 1 | passing |
| A6 | A phase that changed no code files is recorded as skipped with the reason, never silently passed over | `apps/indusk-mcp/src/lib/shape/shape.test.ts` | Phase 1 | Phase 3 | passing |
| A7 | A file reviewed and deliberately left alone records the decision and its reason, distinct from not reviewing it | `apps/indusk-mcp/src/lib/shape/shape.test.ts` | Phase 1 | Phase 3 | passing |
| A8 | The rule set handed to the reviewing agent scopes to intra-unit craft and declares cross-file duplication out of scope | `apps/indusk-mcp/src/lib/shape/rules.test.ts` | Phase 1 | Phase 2 | passing |
| A9 | `/cleanup`'s changed-file scan at close still returns files Shape already reviewed — having run Shape narrows nothing | `apps/indusk-mcp/src/lib/shape/gate-interaction.test.ts` | Phase 0 | Phase 4 | passing |
| A10 | Shape refuses to run for a phase whose verification is not green, naming that as the reason | `apps/indusk-mcp/src/lib/shape/shape.test.ts` | Phase 1 | Phase 3 | passing |
| A11 | Turning off a domain extension changes the rule set Shape produces — no craft rule is hardcoded in core | `apps/indusk-mcp/src/lib/shape/rules.test.ts` | Phase 1 | Phase 2 | passing |
| A12 | The phase-boundary record is excluded from the changed-file scope, so it never counts as work a phase did | `apps/indusk-mcp/src/lib/shape/changed.test.ts` | Phase 1 | Phase 1 | passing |
| T13 | A phase opened twice (resumed in a later session) still scopes from where it FIRST began — work done before the resume is reviewed, not silently dropped | `apps/indusk-mcp/src/lib/shape/boundary.test.ts` | Phase 0 | Phase 5 | passing |
| T14 | A verification gate whose only unchecked item is nested under another item counts as NOT green — Shape refuses to review code whose correctness is unproven | `apps/indusk-mcp/src/lib/shape/shape.test.ts` | Phase 0 | Phase 5 | passing |
| T15 | A file the phase deleted is not offered for review, and a phase that only deleted files is recorded as having no code surface | `apps/indusk-mcp/src/lib/shape/changed.test.ts` | Phase 0 | Phase 5 | passing |
| T16 | An untracked file written by an EARLIER phase is not attributed to this phase | `apps/indusk-mcp/src/lib/shape/changed.test.ts` | Phase 0 | Phase 5 | passing |
| T17 | An enabled extension that declares a skill but whose prose cannot be read is reported as unreadable, never silently omitted from the rule set | `apps/indusk-mcp/src/lib/shape/rules.test.ts` | Phase 0 | Phase 5 | passing |
| A18 | The `git()` runner has exactly one definition in `src/lib` outside test-support — shape does not carry a private copy of verify's | `apps/indusk-mcp/src/lib/shape/shared-definitions.test.ts` | Phase 0 | Phase 6 | passing |
| A19 | The phase-block scan (heading match + block bounds) has exactly one definition — `findings.ts` and `shape.ts` do not each carry one | `apps/indusk-mcp/src/lib/shape/shared-definitions.test.ts` | Phase 0 | Phase 6 | passing |
| A20 | Shape's review surface is reachable from a consumer install — every entry point the `/work` skill names is declared in package exports and resolves to a built file | `apps/indusk-mcp/src/__tests__/shape-consumer-reachability.test.ts` | Phase 0 | Phase 7 | passing |
| A21 | Shape runs end-to-end against **this repository**, not a fixture — a real boundary record, a real review of real changed files, a real recorded outcome | `apps/indusk-mcp/src/lib/shape/dogfood.test.ts` | Phase 0 | Phase 7 | passing |
| T22 | Phantom detection still fires when a phase's only non-`impl.md` change is the phase-boundary record — the record must not read as work | `apps/indusk-mcp/src/lib/verify/phantom.test.ts` | Phase 0 | Phase 8 | passing |
| T23 | The dogfood assertion stays green while a phase is open — a recorded boundary with no outcome yet is the normal mid-phase state, not a failure | `apps/indusk-mcp/src/lib/shape/dogfood.test.ts` | Phase 0 | Phase 8 | passing |
| T24 | Two branches that each open a phase both survive a merge of the boundary record, with neither append lost | `apps/indusk-mcp/src/lib/shape/boundary.test.ts` | Phase 0 | Phase 8 | passing |
| T25 | A Shape surface named by the `/work` skill but missing from package exports fails the reachability check — the list is derived from the skill, not hardcoded beside it | `apps/indusk-mcp/src/__tests__/shape-consumer-reachability.test.ts` | Phase 0 | Phase 8 | passing |
| T26 | The reachability check passes on a fresh checkout with no build — it must not depend on gitignored `dist/` output | `apps/indusk-mcp/src/__tests__/shape-consumer-reachability.test.ts` | Phase 0 | Phase 8 | passing |

### Deferred Verification

- **U1 — Shape flags what a thoughtful reviewer would flag, and not much else**
  - reason: judgment quality has no oracle. Whether a unit "should have been extracted" depends on the codebase, the domain, and taste the extensions encode only partially. A fixture proves the mechanism fires; it can never prove it fired wisely.
  - would require: a labelled corpus of craft violations and non-violations drawn from real plans, which does not exist and cannot be manufactured inside this plan without inventing the very judgments under test.
  - mitigation: **every plan run with Shape records its finding count and false-positive count in the retrospective's Quality Ratchet section**, starting with the first three plans after this ships as the calibration sample. **Trigger: two consecutive plans reporting findings a human judged wrong reopens calibration as a falsification hypothesis against this plan.** Recorded in the Shape guide so the obligation is visible to whoever runs the next plan, not buried here.

- **U2 — Shape reduces the work `/cleanup` finds at plan close**
  - reason: longitudinal and confounded. It needs several comparable plans before and after, and plans differ in size and kind; a single before/after is anecdote.
  - would require: three or more post-Shape plans of comparable scope, with cleanup finding counts recorded on both sides of the change.
  - mitigation: recorded as a **metric, not a claim** — each retrospective notes cleanup's finding count, and the comparison is made after three post-Shape plans rather than asserted now. No decision depends on the answer in the meantime.

### Trajectory Rationale

Two rows are genuinely writable today. **A3** asserts existing `check-gates` behavior (a phase with unchecked items cannot close) and needs only a fixture. **A9** asserts that `cleanup/oversized.ts`'s changed-file scan is unaffected by Shape — testable against today's library, where the answer is trivially true and must *stay* true.

Every other row imports `lib/shape/*`, which does not exist until Phase 1, so its import line is a compile error today. That is the "subject is a symbol introduced in that phase" case. Once Phase 1 lands, all twelve rows are authorable, and the nine that pass in Phases 2–4 stay red across intermediate phases as live tripwires.

- **A1** `Writable at: Phase 1` — imports `lib/shape/findings.js`; the import does not resolve today.
- **A2** `Writable at: Phase 1` — same import.
- **A4** `Writable at: Phase 1` — imports `lib/shape/shape.js`, the Phase 3 orchestration surface, whose module path is created in Phase 1's scaffold.
- **A5** `Writable at: Phase 1` — imports `lib/shape/changed.js`.
- **A6** `Writable at: Phase 1` — same import as A4.
- **A7** `Writable at: Phase 1` — same import as A4.
- **A8** `Writable at: Phase 1` — imports `lib/shape/rules.js`.
- **A10** `Writable at: Phase 1` — same import as A4.
- **A11** `Writable at: Phase 1` — same import as A8.
- **A12** `Writable at: Phase 1` — imports `lib/shape/changed.js`.

## Checklist

### Phase 1: The phase boundary and what a phase changed

- [x] Create/confirm this plan's worktree (`indusk worktree create lifecycle-rebalance`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
  - note: `indusk worktree create` still requires workbench mode; used `git worktree add -b plan/lifecycle-rebalance`. Brought to test-env parity with `pnpm install` + mcp build + admin build + `bundle-admin.js` (the gitignored-artifact lesson).
- [x] Add `src/lib/shape/boundary.ts` — a **generic** phase-boundary record, not a Shape-specific one
  ```typescript
  export interface PhaseBoundaryRecord {
    plan: string; phase: number; sha: string; at: string;
  }
  /** Where phase N began. Null when the phase has not been opened. */
  export function findPhaseStart(records: PhaseBoundaryRecord[], plan: string, phase: number): PhaseBoundaryRecord | null
  export async function recordPhaseStart(root: string, record: PhaseBoundaryRecord): Promise<void>
  export async function readBoundaries(root: string): Promise<PhaseBoundaryRecord[]>
  ```
  Future boundary checks (`verify` when it wires into this lane, `Challenge` when it lands) read this same artifact — the point is to avoid a family of near-identical single-consumer ledgers.
- [x] Make `readBoundaries` refuse loudly on a malformed line rather than skipping it — a skipped line silently widens the review scope to include earlier phases' code, which looks like Shape working
- [x] Add `src/lib/shape/changed.ts` — files changed since the phase's recorded start, including untracked (the `dawn-verify` A19 lesson: unstaged work is still work)
- [x] **Exclude InDusk machine state** (`.indusk/`) from the changed-file scope, the boundary record above all — a record written at phase start must never count as work the phase did
- [x] Scaffold `src/lib/shape/rules.ts`, `findings.ts`, and `shape.ts` with their exported signatures so the Phase 2–3 tests have import targets

#### Phase 1 Verification
- [x] A5, A12 pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [x] A1–A4, A6–A8, A10, A11 authored and committed RED against the Phase 1 scaffold; A3 and A9 authored RED against today's behavior; States set to `written`
  - measured: 902 passed / 21 failed = 18 intended Shape reds + the 3 known pre-existing. Every red fails on its scaffold's explicit throw naming the phase that implements it, not an import error — live tripwires rather than absent code.

#### Phase 1 Context
- [x] Add to Known Gotchas: the phase-boundary record is generic and machine state — every changed-file scope must exclude `.indusk/`, or the record a phase writes at its start counts as work that phase did

#### Phase 1 Document
- [x] Create `apps/docs/src/guide/shape.md` with the per-phase order Mermaid (implementation → verification → **shape** → context → document) and the phase-boundary record's shape

### Phase 2: Rules from extensions, findings into the phase

- [x] **Discovered in Phase 2** — give the shape suite's real-git tests a 30s timeout (dawn-hook-parity precedent, `run/swap.test.ts:222`): A5's `excludes files an earlier phase changed` intermittently times out on vitest's 5s default because it spawns ~10 `git` subprocesses. A tripwire that flakes is worse than no tripwire — it trains the reader to ignore it. Not an assertion change; the goalposts stay where Phase 1 set them.
- [x] Add `src/lib/shape/rules.ts` — collect craft rules from **enabled domain extensions**, hardcoding none
- [x] Include an explicit **scope declaration** in the produced rule set: intra-unit craft is in scope; cross-file duplication and module-boundary decomposition are `/cleanup`'s at close
- [x] Fall back to the general move (extract a function or module) when no domain extension is enabled — a library/CLI project still gets a standard
  - note: no filtering by "domain vs tool" extension — the manifest carries no such taxonomy, and inventing one in core is exactly the hardcoded judgment A11 exists to prevent. Every enabled extension that `provides.skill` and has readable prose contributes; the reviewing agent reads prose and can tell what bears on craft. Cost is ~48 KB of prose across dusk's 9 enabled extensions — the per-phase token cost the ADR already accepted under Consequences.
- [x] Add `src/lib/shape/findings.ts` — append a finding as an unchecked checklist item to a **named phase** in impl.md
  ```typescript
  export interface ShapeFinding { file: string; change: string; rule: string; }
  /** Returns the edited impl body; never writes. The caller owns the write. */
  export function appendFindingToPhase(implBody: string, phase: number, finding: ShapeFinding): string
  ```
  Return-a-string rather than write-a-file so the caller's edit flows through the PreToolUse gate chain like any other impl edit
- [x] Ensure each appended item names both the change and the originating rule — a finding without its basis is unreviewable
  - note: fields are rejected if they carry a line separator (LF, CR, U+2028, U+2029) — a checklist item is one line, so a multi-line field would split into an item plus orphaned prose. Compared by code point, not a regex literal: U+2028/U+2029 written literally terminate a line in the *source* and stop the file parsing (found the hard way here).

#### Phase 2 Verification
- [x] A1, A2, A3, A8, A11 pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
  - measured: 136 files passed / 2 failed. The 2 are `shape.test.ts` (the 7 intended Phase 3 reds) and `daemon-identity.test.ts` T22/T23 (the known port-sensitive known-red-on-main named in the `http-suite-5s-timeout` lesson). No other regression.
- [x] A4, A6, A7, A10 still red (Phase 3), A9 still red (Phase 4) — confirm each fails on its own assertion, not an import error
  - A4/A6/A7/A10: red, and each fails on its scaffold's own `throw` naming the implementing phase (3× `prepareShapeReview`, 2× `recordReviewedNothingFound`, 2× `recordLeftAsIs`) — live tripwires, not import errors.
  - **A9 is green, and the "still red" half of this item was never achievable.** A9 asserts `listOversizedChangedFiles` still returns the files Shape reviewed — pre-existing `cleanup/oversized.ts` behavior that Shape never touches, so it passed the moment it was authored. Same for A3. Phase 1's note ("A3 and A9 authored RED against today's behavior") is therefore wrong on both. Marked `passing`; a row that guards existing behavior against future regression is legitimate, it just cannot have a red phase. See the Phase 2 note below.

#### Phase 2 Context
- [x] Add to Conventions: Shape's craft rules come from enabled domain extensions and hardcode nothing; the rule set carries an explicit intra-unit scope declaration that keeps cross-file work with `/cleanup`

#### Phase 2 Document
- [x] Extend `guide/shape.md` with the Shape-vs-Cleanup table and worked examples of each (the inline renderer; the cross-lane duplicate)
  - also corrected the page against what Phase 2 actually ships: the finding format it showed was not the one `appendFindingToPhase` emits, and a docs page showing a format the code does not produce is worse than no page. Added the one-line/placement/never-writes constraints and the rule-set scope declaration.
  - added the sidebar entry (`community-add-to-sidebar`).
  - **corrected in Phase 3 — the Phase 2 edit had zero effect.** It went into `apps/docs/.vitepress/config.ts`, a stale 24-line scaffold. `apps/docs/package.json` runs `vitepress dev/build src`, so the live config is `apps/docs/src/.vitepress/config.ts` (280+ lines). The real entry is now added there. The "16 of 19 pages unreachable" claim in the same commit was also measured against the scaffold and is wrong — the real config registers 15 of 19, so the gap is ~3 pages. A green diff and a checked box are not evidence the change reached the thing it was aimed at.

### Phase 3: The review surface and the `/work` step

- [x] Add `src/lib/shape/shape.ts` — the surface the skill calls: given plan + phase, return the review inputs (changed files, rule set) or a recorded reason not to review
  - note: extracted `appendItemToPhase` out of `findings.ts` rather than letting the three writers (finding, nothing-found, left-as-is) each carry their own copy of the block-boundary walk. Three copies would be three chances to disagree silently about where an item belongs — and landing past the first `####` misclassifies the item into a gate block.
- [x] Refuse to review when the phase's verification is not green, naming that as the reason (same ordering `/cleanup` obeys — never restructure code whose correctness is unproven)
  - note: a phase with **no** Verification gate counts as not-green. An absent gate proves nothing, and reading absence as permission is how a check passes for the wrong reason.
- [x] Record **three distinct outcomes**, never silence: `reviewed — findings`, `reviewed — nothing found`, `skipped — no code surface`. A check that cannot distinguish "nothing to do" from "did not run" reports the shape of success without doing the work
- [x] Support a reasoned per-file "left as-is" that is recorded with its reason, distinct from a file never reviewed
- [x] Add the Shape step to `apps/indusk-mcp/skills/work.md` — after Verification, before Context — instructing the agent to review the supplied files against the supplied rules and append findings
  - also documents the **phase-start boundary record**, which the impl's Notes assign to this step. Without it `changedFilesForPhase` throws rather than guessing, so Shape could never run — essential wiring, not scope creep.
- [x] Resync the installed copy at `.claude/skills/work.md` (`skill-sync-parity` pins byte-equality; dusk has no global `indusk update`)
  - correction: the installed path is `.claude/skills/work/SKILL.md`, not `.claude/skills/work.md` — the item named a path that does not exist (the `SKILL.md`-in-a-directory convention in CLAUDE.md's gotchas). Copying to the path as written produced a stray file and left the real copy stale; `skill-sync-parity` caught it.

#### Phase 3 Verification
- [x] A4, A6, A7, A10 pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
  - measured: 137 files passed / 1 failed. The 1 is `daemon-identity` T22/T23, the known port-sensitive known-red-on-main. All 5 shape files green (25/25) — every trajectory row is now terminal.
- [x] `skill-sync-parity` passes, proving the installed skill copy matches the package copy

#### Phase 3 Context
- [x] Add to Architecture: `/work`'s per-phase order gains Shape between Verification and Context; the judgment is performed by the executing agent (already a model — no extra call), with `lib/shape/` supplying only facts

#### Phase 3 Document
- [x] Update `apps/docs/src/reference/skills/work.md` with the new per-phase completion order and what Shape does at that step
  - the gate Mermaid now shows Shape between Verification and Context with its findings arrow looping back to implementation; the "four gates" framing is kept deliberately (Shape is not a fifth gate) with the silent-misclassification reason stated. Also inserted the step into the worked walkthrough, which otherwise stepped straight from verification to context and would have contradicted the diagram above it.

### Phase 4: The boundary against Cleanup, and the docs

- [x] Add a test fixture with the same logic duplicated across two files, and confirm Shape's rule set does not put it in scope while `/cleanup`'s changed-file scan still returns those files
  - note: deliberately **one** fixture asserting both halves. A8 and A9 hold each half separately, but separately they cannot see the gap they actually guard — Shape declining a duplicate is only safe *because* cleanup still reports it. Each copy is small and unremarkable alone; the defect is a fact about the pair, which is exactly what a phase-scoped review structurally cannot see.
  - no new trajectory row: A8 and A9 are the assertions; this is where they meet.
- [x] Narrow `apps/indusk-mcp/skills/cleanup.md`'s stated scope to inter-file structural decomposition, pointing at Shape for local craft — and resync its installed copy
  - narrowed the frontmatter `description` too, not just the body: the description is what `get_skill_summaries` surfaces, so a body-only narrowing would leave every skill listing still advertising the old scope.
  - states both consequences explicitly — don't re-litigate craft already recorded as left-as-is, and cleanup's scan is deliberately **unchanged**, so "Shape looked at it" can never come to mean nobody looks again.
- [x] Record U1's calibration obligation in `guide/shape.md`: finding + false-positive counts go in each retrospective's Quality Ratchet, and two consecutive plans of human-judged-wrong findings reopens calibration
  - **also wired the destination**, which the item did not ask for but the mitigation requires: `/retrospective`'s Quality Audit step now asks for both counts by name and for the two-in-a-row streak, and `planner.md`'s retrospective template carries a slot. Recorded only in the guide, the obligation was a promise nobody is ever prompted to keep — the calibration sample would never be collected and U1's trigger could never fire.
  - both counts are required **even when zero**: an absent number cannot be told apart from a plan that never ran Shape. That is Shape's own three-outcomes rule applied to Shape itself.
- [x] Add the changelog entry

#### Phase 4 Verification
- [x] A8, A9 pass together — the intra-unit / inter-file line holds from both sides (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
  - both green, and now on one fixture as well as separately: `gate-interaction.test.ts` is 4 tests (was 3).
- [x] Full suite green apart from known pre-existing failures; `pnpm check` clean on touched files
  - measured: 137 files passed / 1 failed — `daemon-identity` T22/T23, the known port-sensitive known-red-on-main. All 5 shape files green (26/26).
  - `pnpm check` clean (exit 0). It first warned `noTemplateCurlyInString` on the duplication fixture's source text — a false positive on generated code, resolved by writing the fixture with concatenation rather than by silencing the rule.
  - `pnpm --filter docs build` completes, so the new guide page and sidebar entry render.

#### Phase 4 Context
- [x] Update Current State with a one-line lifecycle-rebalance entry naming Shape as shipped and the remaining rebalance slices as follow-ons

#### Phase 4 Document
- [x] Cross-reference Shape from the cleanup guide and the falsification guide so all three rituals state which question they answer and when
  - the same "which check answers which question" table now appears on all three pages, each marking itself — whichever page a reader lands on first, they get the whole map rather than a pointer elsewhere.
  - the falsification page states explicitly why it did **not** move to the phase boundary (two of `dawn-verify`'s seven defects were structurally impossible to find before Phase 4), so this plan's decision does not read as an argument for moving everything.
  - `pnpm --filter docs build` passes, which is also the dead-link check.

### Phase 5: Falsification — the review scope lies in four directions, and one silence

**Goal**: verify whether the attested state holds against the ways `changedFilesForPhase` and `verificationIsGreen` can be wrong. Shape's entire value rests on two claims — *these are the files this phase wrote* (A5, A12) and *this code's correctness is proven* (A10) — and every hypothesis below attacks one of them with a specific input. Four of the five make Shape review the wrong set silently; the fifth makes an enabled craft standard vanish without a word.

The common shape: each failure looks exactly like Shape working. That is what makes them worth hunting rather than the crash-on-bad-input class, which announces itself.

- [x] **A phase start is where it FIRST opened (T13).** `findPhaseStart` deliberately returns the *last* matching record ("a phase re-opened after a stop starts from where it actually resumed"). That rationalization silently under-scopes: `/work` records phase start, commits items 1–3, the session ends; the next session runs `/work` again, appends a second record at the *current* HEAD, and items 1–3 become invisible to Shape. Return the earliest record instead, and make `recordPhaseStart` a no-op when a record for that plan+phase already exists. The safe direction for a review scope is wider, never narrower — a phase's beginning happens once.
- [x] **Make `verificationIsGreen` see nested unchecked items (T14).** `parseChecklistItems` is anchored at column 0 (`/^-\s+\[([ x])\]/`), so an indented `  - [ ] still failing` inside a Verification gate is invisible and the gate reads as green. Shape then reviews code whose correctness is unproven — exactly what A10 forbids — and `/cleanup` already treats nested unchecked items as blocking, so the two rituals currently disagree about what "done" means. Decide during `/work` whether to fix this in `impl-parser` (both enforcement lanes benefit, higher blast radius) or with a nesting-aware check local to `shape.ts` (contained, but a second definition of gate-completeness — weigh against the one-resolution-function rule).
- [x] **Drop deleted paths from the changed-file scope (T15).** `git diff --name-only <sha> HEAD` reports deletions, and nothing filters them, so Shape hands the agent paths that no longer exist and a deletion-only phase reports a code surface it does not have. `cleanup/oversized.ts` already filters "to files that still exist on disk" — the precedent exists in the sibling library and this omitted it.
- [x] **Scope untracked files to this phase (T16).** `git ls-files --others --exclude-standard` is repo-wide with no phase filter, so an uncommitted file written during Phase 1 is attributed to Phase 2, 3, and every phase after — A5's exact claim, failing on the path A5 does not test (its fixture commits the earlier phase's work). Filter untracked files by mtime against the boundary record's `timestamp`, which is recorded today and currently has no consumer.
- [x] **Report an unreadable extension instead of dropping it (T17).** `collectCraftRules` skips any enabled extension whose prose it cannot find, so an extension declaring `provides.skill: true` with a missing or unreadable skill file contributes nothing and says nothing. The project believes its craft standard is in force; it is not. This is "could not check" reported as "nothing to say" — carry the unreadable names on the rule set so the skill can surface them.

#### Phase 5 Verification
- [x] T13: a second `recordPhaseStart` for the same plan+phase does not move the scope forward — work committed before the resume is still returned
- [x] T14: a Verification gate whose only unchecked item is nested reads as not-green, and `prepareShapeReview` skips with the verification reason
- [x] T15: a path deleted during the phase is absent from the review set, and a deletion-only phase is skipped as having no code surface
- [x] T16: an untracked file written before the phase-start record is not returned for that phase
- [x] T17: an enabled extension with a declared-but-unreadable skill is reported as unreadable rather than silently absent
- [x] Full suite green apart from the known-red-on-main `daemon-identity` PID-reuse cases; `pnpm check` clean on touched files
  - measured: 138 files passed / 1 failed (the two known PID-reuse cases). Shape suite 37/37. `pnpm check` exit 0.
  - two of the nine new assertions were green from the start by design — they are the control cases (a nested *checked* item must still proceed; each phase keeps its own first opening), and they exist so the fixes cannot be over-applied.

#### Phase 5 Context
- [x] Add to Known Gotchas: a phase-boundary scope is only as honest as its widest failure — `findPhaseStart` takes the earliest record (a resume is not a new start), deleted paths are dropped, and untracked files are filtered by mtime against the record's timestamp. Every one of these fails by *under*-reporting, which looks identical to Shape working.

#### Phase 5 Document
- [x] Update `guide/shape.md` with what the review scope does and does not include (resumed phases, deletions, pre-existing untracked files) and what an unreadable extension looks like — the scope's edges are the part a reader has to trust

### Phase 6: Cleanup — one definition for the things two files now know

**Goal**: remove the inter-file duplication this plan created, and pin each removal with a structural single-definition test rather than a behavioral one. Every item is a fact **about two files**, which is why none of it was visible to Shape at any phase boundary — the second copy of a thing is not a property of the phase that wrote it.

Two of the three duplications were introduced across *different* phases (Phase 1 vs the pre-existing `verify/`, Phase 3 vs Phase 5), which is the shape the intra-unit/inter-file line predicts: the duplication did not exist until the later copy landed.

- [x] **Reuse `verify/git.ts`'s `git()` instead of `changed.ts`'s private copy.**
  - resolved as a new `lib/git.ts` rather than importing from `verify/`. Having seen it: `verify/git.ts` is a *domain* module (its `assertGitRepo` refuses in verify's words, `resolveBootstrapBaseline` encodes verify's baseline policy), and the bare runner is a primitive. A primitive kept in one domain's folder gets **copied** by the next domain instead of imported — which is precisely how this duplication happened. `verify/git.ts` re-exports it so its own callers are untouched. They are identical down to the 32 MB `maxBuffer`. The Boundary Map said Phase 1 consumes "`verify/git.ts` change-listing precedent" and what actually happened was the precedent got copied rather than the function reused. Move the runner to a module both can import (`lib/git.ts`, or export verify's if that reads better once seen) — the direction is one definition, not a particular file name.
- [x] **Decide the `changedPathsSince` overlap deliberately, and record the decision.**
  - **Decision: partition underneath, union on top.** `changedPathsPartitioned` in `lib/git.ts` runs the three commands once and keeps tracked/untracked apart; `changedPathsSince` is now its union (phantom detection only asks "did anything change"), and shape reads the partition (it must date untracked work by mtime). One set of git commands, two shapes of answer — neither copy nor an awkward merge of two different questions. `verify/git.ts` already exports the exact committed+unstaged+untracked union `changedFilesForPhase` re-implements — same three commands, same dedup/trim chain, same rationale in its doc comment. It is not a straight swap: Phase 5 made shape need the *partition* (untracked filtered by mtime, tracked not), which the union has already discarded. Either give the shared helper a partition-returning variant that the union builds on, or keep them separate **with a comment at both sites naming the other**. What is not acceptable is leaving two copies that neither share nor acknowledge each other — a fix to one silently skips the other, and the untracked half of that function is already a hard-won lesson.
- [x] **Extract the phase-block scan used by both `findings.ts` and `shape.ts`.**
  - `lib/shape/impl-blocks.ts` holds the heading vocabulary (`phaseHeading`, `gateHeading`) and the block walk (`blockEnd`, `blockLines`). The two callers now differ only in which heading they start at, which is what they always differed in — the copies just made that hard to see. `findings.ts` has `findPhaseHeading` + `isImplementationBlockEnd`; Phase 5 added `verificationGateLines` to `shape.ts`, which re-implements the same walk with its own `/^#{2,4}\s/`. Both encode "how markdown headings delimit a phase's blocks". One definition, taking the heading to scan from — the two callers differ only in which heading they start at.
- [x] **Lift the test-fixture boilerplate into `shape.test-support.ts`.**
  - `trackedRoots()` registers the `afterEach` itself and returns the array, so all five files became one line each. `repoWithPhaseOpen` replaced `shape.test.ts`'s local `repoAtPhase`.
  - **partly left as-is, and the cleanup phase over-claimed here:** the "repo with a phase open" pattern only unified cleanly in one of the three places. In `changed.test.ts` and `boundary.test.ts` the phase opens *after* some commits, and exactly when it opens relative to the work is the variable under test — routing those through a helper would hide the thing the test exists to vary. The `const roots: string[] = []` + `afterEach(rm …)` block is verbatim in five test files, and "make a repo with a phase already opened" is now in three (`repoAtPhase` in `shape.test.ts`, open-coded in `changed.test.ts` and `boundary.test.ts`). Rule of three, twice over, in the file that exists to hold exactly this.
- [x] (reviewed `apps/indusk-mcp/skills/work.md` (442 LOC, flagged) — left as-is: a skill file is loaded whole by the agent, so splitting it across files would break the single-file skill contract that `skill-sync-parity` pins. Length is inherent to the artifact, not accretion.)
- [x] (reviewed `apps/docs/src/changelog.md` (448 LOC, flagged) — left as-is: an append-only log grows without bound by design. Splitting by release is a docs-restructure decision that belongs to the rebalance's documentation slice, not to this plan.)
- [x] (reviewed `apps/indusk-mcp/skills/planner.md` (570 LOC, flagged) — left as-is: this plan added three lines to it. Decomposing a 570-line skill on the strength of a three-line touch would be exactly the extraction-for-its-own-sake the ritual warns against.)
- [x] (reviewed every `lib/shape/*.ts` file — left as-is: the largest is 147 LOC against a 400 cap, and each module owns one question — where a phase began, what it changed, what the rules are, how a finding becomes an item, what the review surface returns. The decomposition is already right; the duplication above is between them, not inside them.)

#### Phase 6 Verification
- [x] A18, A19 pass — each shared rule has exactly one definition (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [x] Full shape suite still 41/41 green — the extractions are structure-preserving, so any behavioral change is a defect
- [x] `pnpm check` clean on touched files

#### Phase 6 Context
- [x] Add to Known Gotchas: `git()` and the phase-block scan join `resolveImplPath`/`TERMINAL_STATES` as single-definition-on-purpose, pinned by a structural test — a behavioral test cannot catch a divergence that has not happened yet

#### Phase 6 Document
- [x] (none needed — asked: "Phase 6 is pure inter-file decomposition — a shared git helper, a shared phase-block scan, and test fixtures moved into test-support. No public surface, documented behavior, or skill/CLI contract changes. Can I skip the Document gate?" — user: "Yes, skip it")

### Phase 7: Reachability and dogfood — nobody can currently run Shape, including us

**Goal**: make the thing runnable, then run it. Six phases shipped a per-phase craft review that has **never been executed once**, in a package where the library it lives in is **not reachable from a consumer install**. Both facts were invisible to every gate because the gates check the code, and the code is fine — what is missing is the path from a user to the code.

Three independent breakages, each sufficient on its own to make the feature inert:

- `lib/shape/` is absent from `package.json` `exports`. `cleanup/oversized`, `cleanup/gate`, `trajectory/parser` and three others are declared; Shape is not. A consumer following the `/work` skill has no import path — the `consumer-reachability-before-publish` lesson, verbatim.
- The `/work` skill's phase-start snippet invokes a bare `tsx`, which is **not on PATH in this repo** — an agent following the Shape step hits `command not found` on its first instruction. Shipped-broken, and I wrote it.
- `.indusk/phase-boundary.jsonl` does not exist. No boundary was ever recorded for this plan, so `prepareShapeReview` has never been called outside a test fixture, and U1's calibration sample has no first data point despite this plan being the one that created the obligation.

This is `point-the-tool-at-itself-before-calling-it-done` — fixtures share the author's blind spots by construction, and every fixture here passed while the feature was unusable.

- [x] **Declare Shape's entry points in `package.json` `exports`** — the surfaces the `/work` skill actually names (`shape/shape`, `shape/boundary`, `shape/findings`, `shape/rules`), each mapping to its `dist` build with types, mirroring the `cleanup/oversized` + `cleanup/gate` precedent.
- [x] **Fix the phase-start invocation in `skills/work.md` and resync.** Name both paths the way `cleanup.md` does — the consumer import (`@infinitedusky/indusk-mcp/shape/boundary`) and the monorepo source path — and stop promising a bare `tsx` that does not resolve. Verify the replacement command actually runs before writing it down.
- [x] **Open Phase 7's boundary for real** — the first genuine write of `.indusk/phase-boundary.jsonl`, using the command exactly as the skill now documents it. If the documented command does not work here, it does not work anywhere.
- [x] **Discovered by the first real run — add `recordSkipped(implBody, phase, reason)`.** The design promises "three outcomes, never silence" and ships recorders for two: `recordReviewedNothingFound` and `recordLeftAsIs`. The skill says "if it returns `skipped`, record the reason and move on" with no function to do it, so the agent hand-writes the line and the one outcome most likely to be quietly dropped is the one with no support. Found by running it, not by reading it.
- [x] **Discovered by the first real run — a row asserting "Shape ran" cannot live in the same phase's Verification gate.** Shape refuses until verification is green; A21 sits *inside* Phase 7's verification; so A21 cannot pass until verification is green, which cannot happen until A21 passes. Resolve it here by recording the refusal outcome (a real, correct first invocation) and re-running after the gate closes; note in the guide that dogfood evidence belongs in the *next* phase, not the one being verified.
- [x] **Run Shape against Phase 7 and act on the result.** Findings become items in this phase; nothing found gets `recordReviewedNothingFound`; no code surface gets the skipped reason. Whatever it returns is the answer — do not steer it toward a tidy one.
- [x] **Review the five phases Shape never saw, as one catch-up pass**, and record it honestly as a whole-plan review rather than a per-phase one. The per-phase records cannot be reconstructed and back-dating a boundary would be a lie about when the code was looked at.
- [x] **Record U1's first calibration data point** in the plan
  - **Findings raised: 2. Judged wrong by a human: 0.** One from the live Phase 7 review (`dogfood.test.ts`'s five-level `..`), one from the catch-up pass over the phases Shape never saw (`changed.ts`'s unnamed dating rule). Both were accepted and fixed.
  - **This is a weak first sample and should be recorded as such.** I was author, reviewer, and judge, on diffs I had written minutes earlier — the author-bias risk the ADR explicitly accepts, showing up on the very first data point. A 0% false-positive rate from a reviewer grading their own work an hour old is not evidence the judgment is calibrated; it is barely evidence the mechanism fires. The first *useful* numbers come from the next two plans, where the code will not be mine-from-this-morning.
  - Only one of the two came from a live per-phase run. The other came from a whole-plan catch-up, which is the mode this plan exists to make unnecessary — worth noting so the sample is not read as "two per-phase reviews." — findings raised, and how many a human judged wrong — so the retrospective's Quality Ratchet has real numbers instead of the obligation this plan invented and then skipped.
- [x] Shape — skipped: Phase 7's verification is not green. Shape does not review code whose correctness is unproven — finish the Verification gate first.
- [x] Shape (`apps/indusk-mcp/src/lib/shape/dogfood.test.ts`) — Derive the repo root instead of counting five levels of `..` — give it a name and a reason, or resolve it with `git rev-parse --show-toplevel`. Rule: typescript/clarity — an unexplained magic path in the one file whose job is asserting on real repo state fails silently if the file ever moves
- [x] Shape (`apps/indusk-mcp/src/lib/shape/changed.ts`) — Extract the untracked-dating block into a named `untrackedDuringPhase(root, untracked, openedAt)` — it is the one step with a rule of its own and no name. Rule: typescript/one-reason-to-change — changedFilesForPhase grew to four inline steps across Phase 1 and Phase 5; the dating rule is the one a reader has to reconstruct

#### Phase 7 Verification
- [x] A20 passes — every entry point the skill names resolves from the package's declared exports
- [x] A21 passes — Shape produces a recorded outcome against this repository, not a fixture
- [x] The documented phase-start command runs successfully when pasted verbatim (paste it; do not paraphrase it)
- [x] Full suite green apart from the known-red-on-main `daemon-identity` PID-reuse cases; `pnpm check` clean on touched files

#### Phase 7 Context
- [x] Add to Known Gotchas: a library the skills call is not shipped until it is in `package.json` `exports` **and** the documented invocation has been run verbatim — `lib/shape/` passed every test in this repo while being unreachable from a consumer and unrunnable from its own instructions

#### Phase 7 Document
- [x] Update `guide/shape.md` with how Shape is actually invoked (consumer import path and monorepo path), and record the first calibration numbers alongside the obligation that asks for them

### Phase 8: Falsification — the new artifact is tracked, and nothing else was told

**Goal**: verify whether Phase 7's additions hold once they meet the rest of the system. Phase 7 committed a **new tracked file** (`.indusk/phase-boundary.jsonl`) and two tests that assert on real repository state — three surfaces whose failure modes live *outside* the code that created them, which is why every Phase 7 gate passed.

The theme: an artifact is not finished when it is written correctly. It is finished when every other subsystem that reasons about "what changed" has been told it exists.

- [x] **T22 — exclude the boundary record from phantom detection, and stop the exclusion list from being copied a third time.** `verify/phantom.ts` excludes exactly `.indusk/verify/` and `.indusk/eval/`. The boundary record is now tracked and committed, so it appears in every later diff, and phantom fires only when the diff touches *nothing but* `impl.md` — meaning an agent that checks off items and writes a boundary record now looks productive. **This is the verify-ledger trap verbatim**, documented in this repo's own Known Gotchas, repeated with a new file, in the plan that quotes the warning. Fix the exclusion, and decide whether phantom's predicate and `shape/changed.ts`'s `isNotCode` should become one definition — they answer the same question, and this is the second time answering it separately has cost something.
- [x] **T23 — the dogfood test goes red for the entire duration of any open phase.** Its second assertion takes the newest boundary record and requires that plan's `impl.md` to already carry a Shape outcome. But the outcome is written at the *end* of a phase: between opening a phase and closing it, every `pnpm test` run fails. It passes right now only because Phase 7 happens to be closed. The next phase anyone opens breaks the suite, for doing exactly what the workflow prescribes. Decouple the two assertions — evidence that Shape has run is not the same claim as "the most recent phase has finished."
- [x] **T24 — declare `merge=union` for the boundary record in `.gitattributes`.** Its sibling the verify ledger has it, with a comment explaining that append-only evidence on concurrent branches must not clobber. The boundary record is the same shape of artifact with the same concurrency story — worktree-per-plan is the *default* here, so two plans opening phases on two branches is the expected case, not an exotic one — and it was committed without the declaration.
- [x] **T25 — derive the reachability list from the skill instead of hardcoding it beside the skill.** A20's row claims "every entry point the `/work` skill names", and the test asserts a fixed four-element array. Add a fifth surface to the skill and the test still passes, which is the failure the row was written to prevent. Read the subpaths out of `skills/work.md`.
- [x] **T26 — stop the reachability check depending on gitignored build output.** It asserts `existsSync` against `dist/`, which is gitignored and absent on a fresh clone, so `pnpm test` without a prior build fails for environmental reasons — the `worktree-test-env-parity-gitignored-artifacts` lesson. Assert the mapping against the source that produces the artifact, and leave build-output checks to whatever actually builds.

#### Phase 8 Verification
- [x] T22: a phase whose only non-`impl.md` change is the boundary record is still reported as phantom work
- [x] T23: with a boundary record and no outcome recorded for it, the dogfood assertions stay green
- [x] T24: a merge of two branches that each opened a phase retains both records
- [x] T25: a Shape subpath named in `skills/work.md` but absent from `exports` fails the check
- [x] T26: the reachability check passes with `dist/` absent
- [x] Full suite green apart from the known-red-on-main `daemon-identity` PID-reuse cases; `pnpm check` clean on touched files

#### Phase 8 Context
- [x] Update the Known Gotchas entry on machine-state exclusion to name `.indusk/phase-boundary.jsonl` explicitly alongside `verify/` and `eval/`, and record the general rule the second occurrence proves: a newly tracked InDusk artifact must be registered with every "what changed" detector **and** given a merge strategy, in the same commit that first writes it

#### Phase 8 Document
- [x] Update `guide/shape.md`'s scope section to state that the boundary record is tracked, why (so a resumed phase survives a fresh clone), and what that obliges — the exclusion registration and the merge strategy

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/shape/boundary.ts` | New — generic phase-boundary record |
| `apps/indusk-mcp/src/lib/shape/changed.ts` | New — files this phase changed, machine state excluded |
| `apps/indusk-mcp/src/lib/shape/rules.ts` | New — extension-sourced craft rules + scope declaration |
| `apps/indusk-mcp/src/lib/shape/findings.ts` | New — append a finding to a named phase |
| `apps/indusk-mcp/src/lib/shape/shape.ts` | New — the review surface the skill calls |
| `apps/indusk-mcp/skills/work.md` + installed copy | Shape step in the per-phase order |
| `apps/indusk-mcp/skills/cleanup.md` + installed copy | Scope narrowed to inter-file |
| `apps/docs/src/guide/shape.md` | New guide + Mermaid + U1 obligation |
| `apps/docs/src/reference/skills/work.md` | Updated per-phase order |
| `apps/docs/src/changelog.md` | Entry |
| `CLAUDE.md` | Architecture, Conventions, Known Gotchas, Current State |

## Dependencies

- `cleanup/oversized.ts`'s merge-base chain and `verify/git.ts`'s change-listing, both shipped.
- Enabled domain extensions expose their skills readably (`extensions_status` / `get_skill_summaries`).

## Notes

- **A1's fixture must be a violation a line-count heuristic would miss.** The reference case is `dawn-verify`'s inline renderer: ~15 lines, not oversized, wrong because it should have had a name and a test. If A1 can be satisfied by counting lines, the assertion is weaker than the feature.
- The judgment layer is prose in a skill and cannot be unit-tested; every deterministic decision lives in `lib/shape/` and is tested there. That split is the same one `/cleanup` already uses with `lib/cleanup/oversized.ts`.
- The phase-boundary record is written by `/work` at phase start — that write is itself a `/work` responsibility and lands in Phase 3's skill step, while Phases 1–2 build and test the library that consumes it.
