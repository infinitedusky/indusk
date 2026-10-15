---
title: "skip-reason-why"
date: 2026-10-14
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
approved_brief: "bb479ce04846624384d4e5a0000ef917603739b820856b6cc8e94f37d638f2fd"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-14T23:26:28.794Z"
---

# skip-reason-why

## Goal

A skipped close-out step reads "skipped" with a "why?" that opens its reason, and a skip's reason is held to one short sentence (at most 120 characters) by the retrospective's readiness check.

## Scope

### In Scope
- `checkRetrospectiveReadiness` (`apps/indusk-mcp/src/lib/cleanup/gate.ts`) refuses a falsification, cleanup or audit skipped with a reason over 120 characters; the plan's status (`lib/lifecycle.ts`) says the reason is too long.
- The skip examples in `skills/cleanup.md`, `skills/falsify.md`, `skills/audit.md` rewritten to one sentence each, with the limit stated.
- `Step` (`apps/indusk-admin/src/components/ui/Step.tsx`) takes a `reason`: status "skipped", a "why?" button, the reason beneath the row when open. Two stories, `step.skipped` and `step.skipped-open`. `PlanWorkflows` passes the reason instead of joining it into the status.

### Out of Scope
- Rewriting reasons in archived plans.
- Any check on what a reason says, beyond its length.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1–A9 authored | the `skipped-ritual` cockpit fixture; `checkRetrospectiveReadiness`; the skill files |
| Build Phase 1 | `SKIP_REASON_MAX = 120` and `longSkipReasons` on `RetrospectiveReadiness`; the lifecycle wording; the three skills' examples | `isRitualSkipped`'s `reason` |
| Build Phase 2 | `Step`'s `reason` / `open` props, its two stories, `PlanWorkflows` passing `step.reason` | `PlanStep.reason` from `plans/steps` (unchanged) |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A skipped Falsify step reads "skipped" with a "why?", and the reason is not on the page | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-skipped-step-shows-why-on-request | apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx |
| A2 | Opening "why?" shows the reason beneath the step; opening it again hides it | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-skipped-step-shows-why-on-request | apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx |
| A3 | A 950-character reason leaves the status exactly "skipped" until "why?" is opened | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-skipped-step-shows-why-on-request | apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx |
| A4 | A cleanup skipped with a reason over 120 characters is not ready for the retrospective, cleanup named | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-skip-reason-is-one-sentence | apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts |
| A5 | The same for a skipped falsification and a skipped audit | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-skip-reason-is-one-sentence | apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts |
| A6 | Such a plan's status says the skip reason is too long, not that it awaits the ritual | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-skip-reason-is-one-sentence | apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts |
| A7 | Each of the cleanup, falsify and audit skills states the one-sentence, 120-character limit beside a skip example within it | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-skip-reason-is-one-sentence | apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts |
| A8 | A step with no reason draws with no "why?" | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard: the four existing step looks must not change | apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx |
| A9 | A skip with a reason of 120 characters or fewer is still ready for the retrospective | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard: a short skip stays valid, and an audit skip with a reason is still accepted | apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts |
| A10 | On the page of a plan whose audit was skipped with a reason, the Audit step reads "skipped" with a "why?" that opens the reason | Phase 0 | Build Phase 3 | passing | unit | promise: a-skipped-step-shows-why-on-request | apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx |
| A11 | A cleanup skipped with a reason of three short sentences ("Done. Nothing here. Fine.", under 120 characters) is not ready for the retrospective, cleanup named | Phase 0 | Build Phase 3 | passing | unit | promise: a-skip-reason-is-one-sentence | apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts |
| A12 | A one-sentence reason containing "e.g." or a file name such as "gate.ts" is still ready for the retrospective | Phase 0 | Build Phase 3 | passing | unit | promise: a-skip-reason-is-one-sentence | apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts |

## Checklist

### Test Phase 1: Author every assertion, RED

**Tier**: med — the work step's default

**Goal**: author every test that can honestly be authored now, and record every test that cannot.

- [x] Create/confirm this plan's worktree (`indusk worktree create skip-reason-why`, which records the assignment so the admin and plan tools read the plan from it; a worktree made another way needs `indusk worktree assign skip-reason-why <path>`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] Author A1–A3 and A8 in `workflows.test.tsx` against the `skipped-ritual` fixture (give its `falsification_reason` a second fixture plan with a 950-character reason for A3), RED for A1–A3: today the status reads `skipped — <reason>` and there is no "why?"
- [x] Author A4–A7 and A9 in `apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts`, building plan folders in a temp dir as `cleanup-gate.test.ts` does; A4–A6 assert `passes === false` and the missing ritual, RED today; A7 reads the three skill files: each `*_reason:` example is at most 120 characters (true today: 92, 92, 49) and the skill names the limit `120 characters` beside it (absent today), RED on the second
- [x] Confirm each red row fails on its own assertion rather than on a missing import

#### Regression Guards

- **A8** — a step with no reason has no "why?" today and must keep none; it passes the moment it is written and guards the four approved step looks.
- **A9** — a short skip is ready for the retrospective today; the row guards that the new limit does not refuse it.

#### Test Phase 1 Verification

- [x] A1–A7 are authored, and each red one fails on its own assertion (`pnpm exec vitest run apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts "apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx"`)
- [x] A8 and A9 pass as written

#### Test Phase 1 Context

- [x] guard: `skip-reason-length.test.ts` opens with `// promise: a-skip-reason-is-one-sentence`, and the A1–A3 block with `// promise: a-skipped-step-shows-why-on-request`

### Build Phase 1: The reason is a summary

**Tier**: med — the work step's default

- [x] In `apps/indusk-mcp/src/lib/cleanup/gate.ts`: export `SKIP_REASON_MAX = 120`; in `checkRetrospectiveReadiness`, a ritual skipped with a reason longer than it is not satisfied, and is listed in a new field
  ```typescript
  /** Rituals skipped with a reason over SKIP_REASON_MAX characters (skip-reason-why). */
  longSkipReasons: Array<{ ritual: "falsification" | "cleanup" | "audit"; length: number }>;
  ```
  The ritual still lands in `missing` under its own word, so every caller that refuses on `missing` refuses on this too.
- [x] In `apps/indusk-mcp/src/lib/lifecycle.ts`, before the per-ritual "awaiting /…" branches: a non-empty `longSkipReasons` reads `"<ritual> skip reason is <n> characters — one sentence, at most 120"` at that ritual's position
- [x] Rewrite the skip example and its sentence in `skills/cleanup.md`, `skills/falsify.md`, `skills/audit.md`: one sentence, at most 120 characters, the detail in the impl body or the retrospective; name the limit and `promise: a-skip-reason-is-one-sentence`. Same sentence in `skills/retrospective.md` Step 0, beside the readiness refusal. Then `indusk update` to sync `.claude/skills/` (not run from the worktree: the installed `indusk` copies its own package's skills, not this worktree's, and touched unrelated files; the sync happens at landing's `pnpm install:local`)
- [x] The retrospective skill's refusal message names the long reason's ritual and length when `longSkipReasons` is non-empty

#### Build Phase 1 Verification

- [x] A4–A7 go green and A9 stays green (`pnpm exec vitest run apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts && pnpm exec vitest related apps/indusk-mcp/src/lib/cleanup/gate.ts apps/indusk-mcp/src/lib/lifecycle.ts`)
- [x] `pnpm check` passes
  - note: Biome is clean on every file this phase touched; repo-wide `pnpm check` reports errors in files this phase did not touch (`biome.json`, `apps/indusk-admin/biome.json`, `.indusk/mockups/admin/components/*.css`, `examples/seat-holds`). Also: `lifecycle-parity.snapshot.json` re-baselined by hand for `archive/cleanup-ritual` (its cleanup skip reason is over 120 characters, so it now lists `cleanup` as missing — the intended change; archived reasons are not rewritten). `plan-worktrees-cli.test.ts` A13 fails on an untracked `.mcp.json` in this worktree, unrelated.

- [x] Shape (craft review of `gate.ts`, `lifecycle.ts`, the skills): hoisted the skip-length closures out of `checkRetrospectiveReadiness` into module-level `skipIsOneSentence` and `noteLongSkip`; the lifecycle wording and skills left as is

#### Build Phase 1 Context

- [x] guard: the readiness refusal and the lifecycle wording name `promise: a-skip-reason-is-one-sentence`, so the rule reaches an agent from its enforcer, not from a `CLAUDE.md`
  - note: the token is in the code comments on `SKIP_REASON_MAX`, `longSkipReasons` and the lifecycle `longReason` helper, and in the retrospective skill's Step 0 text

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/skills/retrospective.md` and `audit.md`: the Step 0 readiness check now refuses a skip reason over 120 characters

### Build Phase 2: Skipped, and why on request

**Tier**: med — the work step's default

- [x] `Step.tsx`: optional `reason?: string` and `open?: boolean` (initial state, for a story). With a reason, the root is a `div` (never a link — a skipped step has no document), its status the given words followed by a `why?` button (`aria-expanded`, `aria-controls`), and when open the reason in a `p` spanning the name and status columns beneath the row. No reason: exactly today's markup
- [x] `Step.stories.tsx`: `Skipped` (`state: "waiting"`, `status: "skipped"`, a one-sentence reason) and `SkippedOpen` (the same, `open: true`)
- [x] `PlanWorkflows.tsx:124`: pass `status={LABEL[step.state]}` and `reason={step.reason}`; the reason is never joined into the status again
- [x] `indusk looks stories admin` to regenerate `components.json` and `components/step.css`; `indusk looks lint admin` clean; the person approves the `step.skipped` and `step.skipped-open` stories against their mockups in the cockpit

  - note: regenerated and lint clean; the story approvals in the cockpit await the person. Discovered while verifying: Build Phase 1's value import of `SKIP_REASON_MAX` from `cleanup/gate.ts` into `lifecycle.ts` pulled `node:fs` into the admin's browser bundle, so the constant now lives in `lifecycle.ts` and `gate.ts` re-exports it. The test's `span:last-of-type` read needs the "why?" outside the status span, so a reasoned step uses a four-column `cols-step-reason` grid, and the toggle uses `flushSync` because the test reads the DOM right after `click()`.

#### Build Phase 2 Verification

- [x] A1–A3 go green and A8 stays green (`pnpm exec vitest run "apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx" && pnpm exec vitest related apps/indusk-admin/src/components/ui/Step.tsx apps/indusk-admin/src/components/PlanWorkflows.tsx`)
- [x] `indusk looks lint admin` and `indusk looks coverage admin` report nothing new
  - note: lint clean; coverage lists the six step stories as uncovered (no mockup approved against them in this worktree, step.done etc. included) — the two new ones await the person

- [x] Shape (craft review of `Step.tsx`): reviewed nothing found beyond the reason branch sharing the root shape with the plain branch, left as is — it is one component with two roots, and splitting it would change the approved markup of the four existing stories

#### Build Phase 2 Context

- [x] admin (`apps/indusk-admin/CLAUDE.md`): a step's reason is `Step`'s `reason` prop, opened by its "why?", never joined into its status — one line, beside the `PlanSummary` entry

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: a skipped step reads "skipped" with a "why?" that opens its reason

### Build Phase 3: Falsification — the audit step, and a reason that is short but not one sentence

**Tier**: med — the work step's default

**Goal**: verify whether the attested state holds for the third skippable ritual and for the "one sentence" half of the promise. Each row captures one hypothesis found by reading the built code (nothing was run):

- **An audit skipped with a reason never reads "skipped"** (A10). The brief's promise covers falsification, cleanup and audit, but `releaseStep` in `apps/indusk-mcp/src/lib/plans/steps.ts` maps only Falsify and Cleanup to a ritual, and `apps/indusk-admin/src/lib/planning-reader.ts:354-366` builds `skippedRituals` from falsification and cleanup only. An audit skip satisfies readiness, so the Audit step reads its segment state (done) with no "skipped" and no "why?" — its reason is never shown at all.
- **The check measures length, not sentences** (A11, A12). `skipIsOneSentence` in `cleanup/gate.ts` tests only `reason.length <= 120`; "Done. Nothing here. Fine." passes, though the promise says one sentence. A sentence-end count must not refuse "e.g." or "gate.ts" (A12), which is why a dot alone cannot be the rule.

- [x] `steps.ts`: the Audit step reads `skipped` with its reason when the plan's skipped rituals include the audit; `PlanSnapshot.skippedRituals` takes `"audit"` beside the two `RitualWord`s (a local union — `RITUAL_ORDER` stays the two rituals that have phases)
- [x] `planning-reader.ts`: add `{ ritual: "audit", check: isAuditSkipped(implRaw) }` to `skippedRituals` (import from `@infinitedusky/indusk-mcp/cleanup/gate`, as `isCleanupSkipped` is); give the cockpit fixture a plan with `audit: skipped` + a one-sentence `audit_reason`
- [x] `cleanup/gate.ts` `skipIsOneSentence`: also refuse a reason with more than one sentence end, where a sentence end is `.`, `!` or `?` followed by whitespace and an uppercase letter; the one rule lives in `lifecycle.ts` beside `SKIP_REASON_MAX` (browser-reachable, as Build Phase 2 found) and `longSkipReasons` keeps its name, its entries gaining `sentences: number`; the lifecycle wording says "one sentence" when that is the cause
- [x] The three skills' limit sentence already says one sentence; confirm it reads as the rule the code applies (no edit if it does)
  - note: confirmed, no edit — each skill already reads "one sentence of at most 120 characters" beside `promise: a-skip-reason-is-one-sentence`

#### Build Phase 3 Verification

- [x] A10 goes green (`cd apps/indusk-admin && pnpm exec vitest run "src/app/p/[project]/plan/[name]/workflows.test.tsx"`), and A1–A3, A8 stay green
- [x] A11 and A12 go green and A4–A7, A9 stay green (`pnpm exec vitest run apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts && pnpm exec vitest related apps/indusk-mcp/src/lib/cleanup/gate.ts apps/indusk-mcp/src/lib/plans/steps.ts apps/indusk-mcp/src/lib/lifecycle.ts --run`)

- [x] Shape (craft review of `lifecycle.ts` `sentenceCount`, `gate.ts` `skipIsOneSentence`/`noteLongSkip`, `steps.ts`): reviewed, nothing found — one pure rule with one definition beside `SKIP_REASON_MAX`, the two gate helpers read it, the ritual union is local to `steps.ts`
  - note: the cockpit fixture hands `Plan.skippedRituals` to the page directly, so A10 exercises `steps.ts` and the widened `Plan` type but not `planning-reader.ts`'s new `isAuditSkipped` entry (typechecked, same shape as the cleanup entry; `build/review.ts` already reads the audit skip the same way)

#### Build Phase 3 Context

- [x] guard: the sentence rule's code comment names `promise: a-skip-reason-is-one-sentence`, so the rule reaches an agent from its enforcer

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/skills/retrospective.md`: the Step 0 check refuses a reason of more than one sentence as well as one over 120 characters; `apps/docs/src/reference/admin-ui/overview.md`: the Audit step reads "skipped" too

#### Build Phase 3 Hunt record

Searched without finding an attack vector: the readiness gate's other satisfiers (a complete log, a terminal falsification phase, `audit.md` — a long skip beside them is ignored, by design and A9); every JS hook (none reads a skip reason); the lifecycle ordering (a long reason holds the plan at its ritual's position, so it never reaches review, where `ReviewPanel` prints reasons whole); the `Step` component with no reason (A8). Not investigated: the build runner's response to a plan held at "cleanup skip reason is too long" — it re-runs `/cleanup`, whose skill now states the limit; whether that session rewrites an existing skip is a skill-following question, not this code's.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/cleanup/gate.ts` | `SKIP_REASON_MAX`, `longSkipReasons`, refusal |
| `apps/indusk-mcp/src/lib/lifecycle.ts` | "skip reason too long" wording |
| `apps/indusk-mcp/skills/{cleanup,falsify,audit,retrospective}.md` | one-sentence examples, the limit |
| `apps/indusk-admin/src/components/ui/Step.tsx`, `Step.stories.tsx` | `reason`, `open`, two stories |
| `apps/indusk-admin/src/components/PlanWorkflows.tsx` | pass the reason as a prop |
| `.indusk/mockups/admin/components.json`, `components/step.css` | regenerated |
| `apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts` | new |
| `apps/indusk-admin/src/app/p/[project]/plan/[name]/workflows.test.tsx` | A1–A3, A8 |

## Dependencies
- The `step.skipped` and `step.skipped-open` mockups approved in the cockpit before `plans approve`.

## Notes
- An in-flight plan already skipped with a long reason will be refused at its retrospective once this lands; the fix is a one-line edit of its reason.
