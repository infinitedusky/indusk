---
title: "The nav says where a plan is"
date: 2026-10-16
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "7102d47e8bc3e64f2f3787574ccef3ad220e406f219515c1b4e506415968ea49"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-16T15:18:14.904Z"
---

# The nav says where a plan is

## Goal

A plan's row in the admin nav reads the step its page shows, and the finished
mark only once a release has shipped it. Today the row's words and mark come
from `statusToNavMark(plan.status, plan.archived)` in
`apps/indusk-admin/src/components/ui/badge-variant.ts`, which reads the impl's
`status:`; `/work` sets that to `completed` when the build checklist is done,
so a plan built but not yet falsified, cleaned, audited or released reads
*completed* with the released-style mark, while its page — `PlanWorkflows`,
over the package's `planSteps` — says *Falsify*. The real case:
`looks-check-speed`, whose impl in its worktree says `completed` while its page
says Falsify.

The fix makes the nav ask the package the same question the page and Needs you
already ask. The package's `plans/waiting` holds a private `currentStep` (the
first step in either workflow that is current or needs the person); it moves to
`plans/steps` as the exported `stepAt`, which also answers the next step
between two steps (an approved impl not yet built reads *Build*) and `null`
when every step is done. The admin's `planStage` reads: what the plan waits on,
else *Released* when a release shipped it, else `stepAt`'s step, else
*Closed* for a closed plan, else its status word for a plan whose position
could not be read. The row's mark follows the same answer: needs-you when
waiting, finished when released or closed, in-progress on a Release-workflow step,
plain otherwise. Cost: `stepAt` runs over facts the planning reader already
holds for every plan (`position`, documents, skipped rituals), so the nav gains
no file read.

## Scope

### In Scope
- `stepAt` exported from the package's `plans/steps`; `plans/waiting` asks it.
- The admin's `planStage` and the nav row's mark read it; `statusToNavMark` is removed.
- Tests that held the old words (*Building*, an archived plan's *completed*) read the new ones.

### Out of Scope
- The row's layout — the `nav-row-legible` plan's look.
- Keeping the impl's `status:` field accurate; `/work` still writes it.
- How a release is placed for a plan (`planDates` in `promises/display`); a plan it cannot place reads *Closed*.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | red cases in `plan-stage.test.ts`, `PlanList.test.tsx`, `master-story.test.ts`, `cockpit-single-definition.test.ts`; the two guards | `derivePlanPosition` (`@infinitedusky/indusk-mcp/lifecycle`), `planSteps`, `snapshotOf` |
| Build Phase 1 | `stepAt` in `plans/steps.ts`; `planStage` and `navMarkOf` in `lib/plan-stage.ts`; `PlanItem` reading them; `statusToNavMark` removed | Test Phase 1's tests |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | At every position before release, the nav stage is the step the page shows as worked or waiting, or the next one between steps; a built, unfalsified plan reads Falsify | Test Phase 1 | Build Phase 1 | written | unit | promise: the-nav-says-where-a-plan-is | apps/indusk-admin/src/lib/plan-stage.test.ts |
| A2 | A plan no release shipped never reads Released: a built plan carries the in-progress mark and names its step, an archived plan with no release found reads Closed with the finished mark | Test Phase 1 | Build Phase 1 | planned | unit | promise: the-nav-says-where-a-plan-is | apps/indusk-admin/src/components/PlanList.test.tsx, apps/indusk-admin/src/components/PlanList.falsify.test.tsx |
| A3 | The step a plan is at is defined once, in the package's steps module; the admin defines no rule of its own | Test Phase 1 | Build Phase 1 | planned | unit | promise: the-nav-says-where-a-plan-is | apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts |
| A4 | A plan waiting on the person reads the step it waits at with the needs-you mark, ahead of its step and of Released | Test Phase 1 | Test Phase 1 | planned | unit | promise: decisions-wait-in-one-place, promise: the-nav-says-where-a-plan-is | apps/indusk-admin/src/lib/plan-stage.test.ts, apps/indusk-admin/src/components/PlanList.test.tsx |
| A5 | A master plan's page reads each plan at the nav row's stage: Falsify for a built, unfalsified plan, Released for a released one | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-master-plan-tells-its-story | apps/indusk-admin/src/lib/master-story.test.ts |
| A6 | A released plan reads Released with the finished mark, archived or not, and each Path's released count is unchanged | Test Phase 1 | Test Phase 1 | planned | unit | promise: the-nav-says-where-a-plan-is, promise: paths-keep-their-order | apps/indusk-admin/src/lib/plan-stage.test.ts, apps/indusk-admin/src/components/PlanList.test.tsx, apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx |

## Checklist

### Test Phase 1: Write the nav's tests first, failing where it reads the impl's status

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

Before anything changes, this phase writes down what the nav row must read and proves today's row gets it wrong. A plan is built at each point of its life, using the same position reader the plan page uses, and the row's words are compared with the step the page shows; a plan whose build is done but which has not been falsified must read Falsify, and today reads completed. A built plan and a closed plan that no release has shipped must not carry the finished mark, and today both do. A master plan's page lists its plans through the same words, so it is tested the same way. The rule for which step a plan is at must live once, in the package, which the test that guards every fact the admin shows is extended to say. Two guards pass today and must keep passing: a released plan reads Released, and a plan waiting on the person reads what it waits at ahead of everything else. The next phase makes the red tests pass.

- [x] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  `indusk worktree create nav-stage-matches-plan-page`, or `indusk worktree assign nav-stage-matches-plan-page /Users/the_dusky/code/sandbox/dusk-worktrees/nav-stage-matches-plan-page` for the one `plans start` made — worktree-per-plan default.

  </details>
- [x] Write the test that a plan's nav words name the step its page shows at every point of its life, failing today for a built plan.
  <details><summary>Technical</summary>

  A1, `apps/indusk-admin/src/lib/plan-stage.test.ts` (add `// promise: the-nav-says-where-a-plan-is` beside the existing token). Build each plan's `position` with the real `derivePlanPosition` from `@infinitedusky/indusk-mcp/lifecycle`, on `apps/indusk-mcp/src/lib/plans/steps.test.ts`'s `positionOf` shape: an accepted brief, a proposed test plan, a draft impl, an approved impl, an in-progress impl, and a completed impl with readiness `missing` of `["falsification","cleanup","audit"]`, `["cleanup","audit"]`, `["audit"]`, `[]`, and `[]` with `impl.accepted`. Give each plan the matching `impl.frontmatter.status` / `status` and documents so `snapshotOf(plan)` is the page's snapshot. For each, expect `planStage(plan, false, {})` to equal the name of the first step in `planSteps(snapshotOf(plan))` (planning then release) whose state is `current` or `needs-you`, else the first `not-yet`. Name the real case: the completed impl missing falsification reads `"Falsify"`, `.not.toBe("completed")`. Red today: every completed impl reads `"completed"`, the in-progress one `"Building"`. Replace the old "reads each status as the nav mark says it" case, which pins the bug.

  </details>
- [ ] Write the test that a plan no release has shipped never shows the finished mark in the nav, failing today.
  <details><summary>Technical</summary>

  A2, `apps/indusk-admin/src/components/PlanList.test.tsx` (token `promise: the-nav-says-where-a-plan-is`): render `PlanList` with one active plan whose impl is `completed` and whose position is falsify, and one archived plan (`archived: true`, `status: "completed"`, position archived) with no `dates` entry. Read each row's mark, `[data-component="plan-row"] [data-component="badge"]`, by its `data-state`: the first is `working` and its row reads `Falsify`; the second is `released` and its row reads `Closed`, not `completed`. Red today: the first is `released` and the second reads `completed`. In `PlanList.falsify.test.tsx`, T11's `expect(link?.textContent).toContain("completed")` pins the old reading; change it to `"Closed"` and add the token (the test's own point, that an archived child is a link and not a placeholder, is unchanged).

  </details>
- [ ] Write the test that the step a plan is at is defined once, in the package, failing today.
  <details><summary>Technical</summary>

  A3, `apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts`: add `["./plans/steps", "src/lib/plans/steps.ts", "stepAt"]` to `MODULES` and `"stepAt"` and `"currentStep"` to `PACKAGE_ONLY`; add `promise: the-nav-says-where-a-plan-is` to the docblock. Red today: `steps.ts` exports no `stepAt` (the rule is a private `currentStep` in `waiting.ts`).

  </details>
- [ ] Write the test that a master plan's page reads a built plan's step the way the nav does, failing today.
  <details><summary>Technical</summary>

  A5, `apps/indusk-admin/src/lib/master-story.test.ts`: give subplan `two` a completed impl at the falsify position; its row reads `stage: "Falsify"` and equals `planStage` for the same plan; the released row still reads `"Released"`. Red today: `"completed"`.

  </details>
- [ ] Write the two guards that already pass: a released plan reads Released, and a plan waiting on the person reads what it waits at first.
  <details><summary>Technical</summary>

  A4, A6 in `plan-stage.test.ts` and `PlanList.test.tsx`: a plan waiting `{ p: "Review" }` reads `"Review"` with `data-state="needs"`, also when released; a released plan reads `"Released"` with `data-state="released"`, archived or not. A6's Path count is the existing `cockpit-nav.test.tsx` A4 case (`released/total`), run unchanged; add `promise: the-nav-says-where-a-plan-is` to that file's tokens only if the row's promise check asks for it.

  </details>
- [ ] Confirm no new test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  Every case imports existing symbols (`planStage`, `planSteps`, `snapshotOf`, `derivePlanPosition`, `PlanList`, `masterStory`); A3 reads `steps.ts` as text. Each red row fails on its own assertion.

  </details>

#### Regression Guards

- **A4** — what a plan waits on already wins over every other reading in `planStage` and the row's mark; the row holds that the new step reading is placed after it, never before.
- **A6** — a released plan already reads Released with the finished mark, and the Path counts come from release dates the fix does not touch; the row holds both while the finished mark stops coming from the impl's status.

#### Test Phase 1 Verification

- [ ] The new tests exist; the ones for the step, the finished mark, the master page and the single definition fail on their own assertions, and the two guards pass.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/nav-stage-matches-plan-page/apps/indusk-admin && pnpm exec vitest run src/lib/plan-stage.test.ts src/lib/master-story.test.ts src/components/PlanList.test.tsx src/components/PlanList.falsify.test.tsx 'src/app/p/[project]/cockpit-nav.test.tsx'` — A1, A2, A5 red on their assertions; A4, A6 green. `cd /Users/the_dusky/code/sandbox/dusk-worktrees/nav-stage-matches-plan-page/apps/indusk-mcp && pnpm exec vitest run src/__tests__/cockpit-single-definition.test.ts` — A3 red naming `stepAt`.

  </details>

### Build Phase 1: The nav asks the package which step a plan is at

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase moves the rule for which step a plan is at into the package's module that lists a plan's steps, where the plan page already gets them, and makes the nav, the master plan's page and the Needs you list all ask it. Between two steps, such as an approved plan not yet built, the rule answers the next step; when every step is done it answers none. The nav row then reads what the plan waits on, else Released once a release shipped it, else the step the rule gives, else Closed for a closed plan. Its mark follows the same answer: needing you when it waits, finished when released or closed, in progress during the build and the steps after it, plain otherwise. The old mapping from the impl's status word is deleted. Nothing new is read from disk, since every plan in the nav already carries where it stands.

- [ ] Make the package answer which step a plan is at, and make the Needs you list ask it.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/steps.ts`:

  ```typescript
  /** The step a plan is at: the first step, Planning then Release, that is current or needs the person; else the first not yet begun; null when none is left. */
  export function stepAt(plan: PlanSnapshot): (PlanStep<string> & { workflow: "planning" | "release" }) | null
  ```

  `apps/indusk-mcp/src/lib/plans/waiting.ts`: delete the private `currentStep`; `askedOf` uses `stepAt(plan)?.name ?? "Planning"`. A3 green.

  </details>
- [ ] Make the nav row's words and mark come from that answer, and delete the mapping from the impl's status word.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/plan-stage.ts`: `navMarkOf(plan, released, waiting): NavMark` — waiting → `{ state: "needs", stage: waiting }`; released → `{ "released", "Released" }`; `stepAt(snapshotOf(plan))` → `{ state: step.workflow === "release" ? "working" : "idle", stage: step.name }`; archived → `{ "released", "Closed" }`; no position → `{ "idle", plan.status }`. `planStage` returns `navMarkOf(...).stage` (the master page keeps calling it). Move `NavMark` here. `PlanList.tsx` `PlanItem`: `const mark = navMarkOf(plan, released, waiting)`, `state={mark.state}`, `{mark.stage}`. Delete `statusToNavMark` and `NavMark` from `components/ui/badge-variant.ts`. Update `src/app/p/[project]/plan/[name]/page.test.tsx` (T11) and `master.test.tsx` (A3), which expect `"Building"`, to the page's word `"Build"`. A1, A2, A5 green; A4, A6 still green.

  </details>
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules.
  <details><summary>Technical</summary>

  `steps.ts`, `waiting.ts`, `plan-stage.ts`, `PlanList.tsx`, `badge-variant.ts`.

  </details>

#### Build Phase 1 Verification

- [ ] The nav, the master page and the package's steps agree at every point of a plan's life, the finished mark appears only for released plans, and the two guards still pass.
  <details><summary>Technical</summary>

  `cd /Users/the_dusky/code/sandbox/dusk-worktrees/nav-stage-matches-plan-page/apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/cockpit-single-definition.test.ts src/lib/plans/steps.test.ts src/lib/plans/waiting.test.ts` — A3 green, steps and waiting unchanged. `cd /Users/the_dusky/code/sandbox/dusk-worktrees/nav-stage-matches-plan-page/apps/indusk-admin && pnpm exec vitest run src/lib/plan-stage.test.ts src/lib/master-story.test.ts src/components/PlanList.test.tsx src/components/PlanList.falsify.test.tsx 'src/app/p/[project]/cockpit-nav.test.tsx' 'src/app/p/[project]/plan/[name]/page.test.tsx' 'src/app/p/[project]/plan/[name]/master.test.tsx' && pnpm exec vitest related src/lib/plan-stage.ts src/components/PlanList.tsx src/components/ui/badge-variant.ts` — A1, A2, A4, A5, A6 green.

  </details>
- [ ] Types and lint are clean, and the brief and the promise registry still agree.
  <details><summary>Technical</summary>

  From the worktree root: `pnpm exec tsc --noEmit -p apps/indusk-mcp`, `pnpm exec tsc --noEmit -p apps/indusk-admin`, `pnpm check` and `pnpm promises:check` exit 0.

  </details>

#### Build Phase 1 Context

- [ ] The admin's own context file says the nav's stage and mark come from the package's step rule, never from the impl's status word.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md` (area), in the "One home per piece" entry, replace "its stage is `planStage`" with: "its stage and mark are `planStage`/`navMarkOf` in `lib/plan-stage.ts`: waiting, else Released from a release's date, else the package's `stepAt` (`plans/steps`), else Closed — never the impl's `status:`, which `/work` sets `completed` before the rituals. Guarded by `plan-stage.test.ts` and `cockpit-single-definition.test.ts` (`promise: the-nav-says-where-a-plan-is`)".

  </details>

#### Build Phase 1 Document

- [ ] The admin reference says what a plan's row in the nav reads.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/overview.md`, the `PlanRow` sentence in the nav paragraph: the step it is at is the step its page shows (*Brief*, *Build*, *Falsify*, … *Release*), *Released* once a release shipped it, *Closed* for a closed plan no release has shipped yet, or the step a plan waiting on you waits at; the finished mark for a released or closed plan. One line in `apps/docs/src/changelog.md` under Unreleased.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plans/steps.ts` | `stepAt` exported |
| `apps/indusk-mcp/src/lib/plans/waiting.ts` | private `currentStep` removed; asks `stepAt` |
| `apps/indusk-admin/src/lib/plan-stage.ts` | `navMarkOf`, `NavMark`; `planStage` reads it |
| `apps/indusk-admin/src/components/PlanList.tsx` | `PlanItem` reads `navMarkOf` |
| `apps/indusk-admin/src/components/ui/badge-variant.ts` | `statusToNavMark` and `NavMark` removed |
| tests: `apps/indusk-admin/src/lib/plan-stage.test.ts`, `src/lib/master-story.test.ts`, `src/components/PlanList.test.tsx`, `src/components/PlanList.falsify.test.tsx`, `src/app/p/[project]/plan/[name]/page.test.tsx`, `src/app/p/[project]/plan/[name]/master.test.tsx`; `apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts` | the trajectory, and the old words updated |
| `apps/indusk-admin/CLAUDE.md` | the stage entry |
| `apps/docs/src/reference/admin-ui/overview.md`, `apps/docs/src/changelog.md` | docs |

## Dependencies

- None. `nav-row-legible` touches the same row's layout; whichever lands second merges over the other.

## Notes

- Needs you's step for a question asked between two steps changes from *Planning* to the next step's name (for example *Build* for an approved plan not yet built), because it now asks `stepAt`. No test reads the old *Planning* fallback; it remains for a plan with no step left.
- 45 of this project's 140 archived plans have no release the release-date reader can place (counted 2026-10-16); they read *Closed* with the finished mark after this plan, their status word with the finished mark before (Sandy, 2026-10-16: Released is a release record; Closed is a plan done without one).
- Planning steps (*Brief*, *Test plan*, *Impl*, …) read with the plain mark, as *Draft* did; the build and the steps after it read in progress, as *Building* and *Approved* did.
