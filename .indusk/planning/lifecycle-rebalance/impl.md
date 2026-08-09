---
title: "Lifecycle Rebalance — the Shape check"
date: 2026-08-08
status: in-progress
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
- [ ] Narrow `apps/indusk-mcp/skills/cleanup.md`'s stated scope to inter-file structural decomposition, pointing at Shape for local craft — and resync its installed copy
- [ ] Record U1's calibration obligation in `guide/shape.md`: finding + false-positive counts go in each retrospective's Quality Ratchet, and two consecutive plans of human-judged-wrong findings reopens calibration
- [ ] Add the changelog entry

#### Phase 4 Verification
- [ ] A8, A9 pass together — the intra-unit / inter-file line holds from both sides (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)
- [ ] Full suite green apart from known pre-existing failures; `pnpm check` clean on touched files

#### Phase 4 Context
- [ ] Update Current State with a one-line lifecycle-rebalance entry naming Shape as shipped and the remaining rebalance slices as follow-ons

#### Phase 4 Document
- [ ] Cross-reference Shape from the cleanup guide and the falsification guide so all three rituals state which question they answer and when

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
