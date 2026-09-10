---
title: "Writing skill — papers as first-class plan documents"
date: 2026-09-09
status: in-progress
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Writing skill — papers as first-class plan documents

## Goal

Make a paper in a plan folder a recognized document (`kind: paper`, a `paper` stage, honest status and staleness), give writing sessions a prose-only `/write` skill, and ship `indusk papers publish` so a paper reaches the blog with the discipline of code: source in the plan, destination a build artifact, every publish traceable to a commit. The plan's own acceptance test is the dogfood run: the Day papers get a real stage, paper 1 publishes to `~/code/site` with the documented command, and a plain-language request invokes the skill.

## Scope

### In Scope
- `kind: paper` in the plan parser: `PaperSummary`, the `paper` stage, status vocabulary with `malformed`, staleness derived from a content hash.
- `papers.destinations` config block, ensured on `update`; destination resolution by path or by declared repo name.
- `lib/papers/` publish library and the `indusk papers publish` command, with every refusal path tested against a temporary destination repo.
- Admin UI Papers section with status badges.
- The `write` skill, its docs page, the CLI reference page, sidebar entries, changelog.
- Dogfood on `indusk-v4-day`, including the first publish to the blog.

### Out of Scope
- Hooks or gates for prose.
- A prose rubric for the eval agent.
- Stages for `master.md`-only plans.
- Pushing; `--push` exists but the dogfood does not use it.
- Editing the destination's VitePress config; the nav change is manual, once.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | Every authorable test, red; the deferral register; the manual procedures for A4, A13, A18, A19 written into the plan folder | `parsePlan`, the CLI runner helper, the admin test harness, today's `skills/` directory |
| Build Phase 1 | `PaperSummary`, `PlanStage` gains `paper`, `papers` on `PlanSummary`, `paperContentHash`, `list_plans` passthrough | `lib/plan-parser.ts`, `gray-matter` |
| Build Phase 2 | `PapersConfig`, `ensurePapersConfig`, `resolveDestination` (path or repo) | `lib/config.ts`, `lib/worktree/repos.ts` |
| Build Phase 3 | `lib/papers/publish.ts`, `renderForDestination`, `regenerateIndex`, `writeProvenance`, `indusk papers publish` | Build Phases 1 and 2, `lib/git.ts` |
| Build Phase 4 | Papers section in `PlanDetail`, badge variants | Build Phase 1 via the admin's shared parser import |
| Build Phase 5 | `skills/write.md`, `reference/skills/write.md`, `reference/cli/papers.md`, sidebar, changelog | Build Phase 3's command, verbatim |
| Build Phase 6 | `kind: paper` on five Day documents, the `blog` destination in dusk's config, the first publish, the recorded review passes | Everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Scope | Test |
|----|---------|-------------|-----------|-------|-------|------|
| A1 | A plan folder whose documents all carry `kind: paper` reports stage `paper` with a status derived from those papers, never `unknown`, and a next step that is never "Create a brief" | Test Phase 1 | Build Phase 1 | passing | unit | `apps/indusk-mcp/src/lib/plan-parser.papers.test.ts` |
| A2 | A plan folder with lifecycle documents and papers keeps its lifecycle stage and lists the papers beside it with their own statuses | Build Phase 1 | Build Phase 1 | passing | unit | `apps/indusk-mcp/src/lib/plan-parser.papers.test.ts` |
| A3 | A paper's status is one of `draft`, `accepted`, `published`; any other value reports `malformed`, never a silent draft | Test Phase 1 | Build Phase 1 | passing | unit | `apps/indusk-mcp/src/lib/plan-parser.papers.test.ts` |
| A4 | `indusk-v4-day`, once its documents declare `kind: paper`, reports a real stage in `list_plans` and the admin UI | Test Phase 1 | Build Phase 6 | passing | manual | `manual:` `.indusk/planning/writing-skill/dogfood.md` |
| A5 | The admin UI renders a paper under its plan with title and status, and a papers-only plan renders without error | Test Phase 1 | Build Phase 4 | passing | browser | `apps/indusk-admin/src/components/PlanDetail.papers.test.tsx` |
| A6 | After `update`, a project with no `papers` block has `papers.destinations: []`; a project with destinations keeps them byte-for-byte | Build Phase 2 | Build Phase 2 | passing | unit | `apps/indusk-mcp/src/lib/papers/config.test.ts` |
| A7 | Publishing puts the rendered page in the destination directory with mapped frontmatter, regenerates the index between its markers, and commits on the destination's current branch with no push | Test Phase 1 | Build Phase 3 | passing | integration | `apps/indusk-mcp/src/__tests__/papers-publish.test.ts` |
| A8 | After a publish the paper's frontmatter records destination, path, destination commit, source commit, and hash, and status reads `published` | Test Phase 1 | Build Phase 3 | passing | integration | `apps/indusk-mcp/src/__tests__/papers-publish.test.ts` |
| A9 | Editing the plan copy after a publish reports `published (stale)`; publishing again clears it; publishing an unchanged paper twice is a no-op with no new commit | Test Phase 1 | Build Phase 3 | passing | integration | `apps/indusk-mcp/src/__tests__/papers-publish.test.ts` |
| A10 | Publishing with no destination configured refuses naming `papers.destinations` and writes nothing | Test Phase 1 | Build Phase 3 | passing | integration | `apps/indusk-mcp/src/__tests__/papers-publish-refusals.test.ts` |
| A11 | A missing path, a non-git destination, or a dirty target page each refuse with the reason and write nothing; a committed hand edit is overwritten and the commit message says the page had diverged | Test Phase 1 | Build Phase 3 | passing | integration | `apps/indusk-mcp/src/__tests__/papers-publish-refusals.test.ts` |
| A12 | Inside a workbench a `repo` destination resolves through the declared repos; outside one it refuses saying only paths are accepted | Test Phase 1 | Build Phase 3 | passing | integration | `apps/indusk-mcp/src/__tests__/papers-publish-refusals.test.ts` |
| A13 | The publish command documented in the skill, run verbatim, publishes paper 1 to `~/code/site` and performs A7 and A8 there | Test Phase 1 | Build Phase 6 | passing | manual | `manual:` `.indusk/planning/writing-skill/dogfood.md` |
| A14 | The `write` skill is installed byte-identical to the package source and carries `name` and `description` | Test Phase 1 | Test Phase 1 | passing | unit | `apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts` |
| A15 | The skill's description names drafting, outlining, revising, and publishing a paper, thesis, or essay | Test Phase 1 | Build Phase 5 | passing | unit | `apps/indusk-mcp/src/__tests__/write-skill-pins.test.ts` |
| A16 | The skill's instructions say to register presence, load the plan folder's prose documents, and skip lessons, health, and extensions | Test Phase 1 | Build Phase 5 | passing | unit | `apps/indusk-mcp/src/__tests__/write-skill-pins.test.ts` |
| A17 | The skill carries Voice, Outline, Read as the reader, and Falsify the argument as named sections | Test Phase 1 | Build Phase 5 | passing | unit | `apps/indusk-mcp/src/__tests__/write-skill-pins.test.ts` |
| A18 | "Let's work on the grift paper" in a fresh session invokes the skill without the slash command | Test Phase 1 | Build Phase 6 | skipped | manual | `manual:` `.indusk/planning/writing-skill/dogfood.md` (skipped: skill discovery is per project and the skill is not on the trunk until merge; re-run in a fresh trunk session after merge, see dogfood.md) |
| A19 | Running the skill on `indusk-v4-day` loads the thesis, outline, shape, and three papers, prints nothing from lessons or health, and leaves a read-as-reader pass and a falsify pass per paper in the plan folder | Test Phase 1 | Build Phase 6 | passing | manual | `manual:` `.indusk/planning/writing-skill/dogfood.md` |
| A20 | The docs sidebar links `reference/skills/write` and `reference/cli/papers` | Test Phase 1 | Build Phase 5 | passing | unit | `apps/indusk-mcp/src/__tests__/write-skill-pins.test.ts` |
| A21 | Publishing refuses while the plan copy has uncommitted changes, and a successful publish's destination commit message carries the source commit hash | Test Phase 1 | Build Phase 3 | passing | integration | `apps/indusk-mcp/src/__tests__/papers-publish.test.ts` |
| A22 | After a sibling paper publishes, every published paper whose page links to it is reported as behind, naming the command that republishes it; today the earlier page keeps the dead plan-file link and its paper reads `published`, not stale | Phase 0 | Build Phase 7 | planned | integration | `apps/indusk-mcp/src/__tests__/papers-publish-falsification.test.ts` |
| A23 | Two papers whose titles slug to the same destination filename cannot publish over each other: the second refuses naming the first, and the first's page and the index are untouched | Phase 0 | Build Phase 7 | planned | integration | `apps/indusk-mcp/src/__tests__/papers-publish-falsification.test.ts` |
| A24 | A paper whose status was hand-set back to `accepted` after a publish, content unchanged, is republished (provenance rewritten, status `published`) rather than reported up to date; with the page byte-identical no destination commit is made and no "nothing to commit" error escapes | Phase 0 | Build Phase 7 | planned | integration | `apps/indusk-mcp/src/__tests__/papers-publish-falsification.test.ts` |
| A25 | The index orders pages by first publish, so a hotfix republish of an older page does not move it above pages published later | Phase 0 | Build Phase 7 | planned | integration | `apps/indusk-mcp/src/__tests__/papers-publish-falsification.test.ts` |
| A26 | A `--push` that fails after the destination commit still writes provenance and commits it in the source, reports the push failure as a warning with exit 0, and a second publish reports up to date rather than overwriting a "diverged" page | Phase 0 | Build Phase 7 | planned | integration | `apps/indusk-mcp/src/__tests__/papers-publish-falsification.test.ts` |
| A27 | Republishing a retitled paper moves its page to the new slug: the old page is gone from the destination and from the index, which lists the new one once | Phase 0 | Build Phase 7 | planned | integration | `apps/indusk-mcp/src/__tests__/papers-publish-falsification.test.ts` |
| A28 | A destination commit that fails (no git identity) leaves the destination tree clean and refuses with git's reason, never a stack trace; a source commit that fails refuses naming the destination commit that exists and leaves the provenance written for a hand commit | Phase 0 | Build Phase 7 | planned | integration | `apps/indusk-mcp/src/__tests__/papers-publish-falsification.test.ts` |
| A29 | `indusk plans archive-dead` never moves a plan that carries a published paper, regardless of its age or its other documents' statuses | Phase 0 | Build Phase 7 | planned | unit | `apps/indusk-mcp/src/lib/planning/archive-dead-papers.test.ts` |

### Deferred Verification

- **Prose drafted under the skill is in the thesis's voice**
  - reason: LLM output quality has no oracle; a test could only assert that the voice sheet was loaded, which A17 already pins.
  - would require: a rubric-scored evaluation lane for prose, which is the eval-agent prose rubric the brief scopes out.
  - mitigation: the read-as-the-reader pass (A19) is recorded per paper, and the user reads before a paper moves to `accepted`; the voice sheet's presence is pinned so the instruction cannot silently vanish.
- **Model invocation without the slash command is reliable, not once**
  - reason: routing is probabilistic; one manual pass (A18) proves it can happen, not that it will.
  - would require: a repeated-trial harness over fresh sessions, which nothing in this repo can drive today.
  - mitigation: the description is the routing key and its trigger words are pinned (A15); any change to the description re-runs A18, and a routing failure in use is fixed in the description text.

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: author every test that can honestly be authored today against the current code, and confirm each fails for its own reason. Two rows need symbols that do not exist yet and are deferred with bodies below. The six publish rows go through the CLI and are red on an unknown command, the same shape the versioned-workbench plan used.

- [x] Create/confirm this plan's worktree — worktree-per-plan default; skip only if `worktree: none` in frontmatter. dusk is not a workbench, so the trunk-repo form is `git worktree add ~/code/sandbox/dusk-worktrees/writing-skill -b plan/writing-skill`. **Done**: worktree on `plan/writing-skill` from `6721eaee`; plan docs committed on main first so the worktree carries them; `pnpm install` and `pnpm -C apps/indusk-mcp build` clean (the CLI tests run `dist/`, and `SHOULD_SKIP` would have turned an unbuilt worktree into a silently green suite). Shape boundary for phase 1 recorded at `6721eaee`; Shape keys by plain phase number, so Build Phase 1 will share this start and review the test files too — over-reporting, the direction the design prefers
- [x] Build the fixture: a temporary plan folder builder that writes documents with arbitrary frontmatter, and a temporary destination builder that `git init`s a directory with a `writing/index.md` carrying the marker pair. Shipped with two additions the publish tests needed: `paperProject` (a git-initialized project with a config and a committed plan folder, because the publish step's first precondition is a committed source) and `destinationRepo({ at })` so A12 can place the destination at a workbench's declared repo path
  ```ts
  // apps/indusk-mcp/src/__tests__/helpers/papers-fixture.ts
  export function planFolder(docs: Record<string, { frontmatter: Record<string, unknown>; body: string }>): string
  export function destinationRepo(opts?: { withMarkers?: boolean; git?: boolean }): { root: string; index: string }
  export const INDEX_MARKERS = ["<!-- papers:start -->", "<!-- papers:end -->"] as const
  ```
- [x] Author A1, A3 in `plan-parser.papers.test.ts` against `parsePlan` on a papers-only folder, RED (today: stage `unknown`, next step "Create a brief"; a bad status is not reported). Observed: both fail on `expected 'unknown' to be 'paper'`
- [x] Author A5 in `PlanDetail.papers.test.tsx` with a plan fixture carrying `papers`, asserting a `papers-section` test id and one badge per paper, RED (no such section renders). The fixture is cast through `unknown` because `Plan` has no `papers` field yet; the cast leaves with Build Phase 4. Observed: two of three red on `expected null not to be null`; the third (no papers, no section) is green today by construction and stays as the negative guard
- [x] Author A7, A8, A9, A21 in `papers-publish.test.ts` invoking `indusk papers publish <plan>/<file>` through the CLI runner against the destination fixture, RED on unknown command. Observed: all four fail on `error: unknown command 'papers'`, exit 1
- [x] Author A10, A11, A12 in `papers-publish-refusals.test.ts` the same way, one `it` per refusal, RED on unknown command. Seven `it`s (A11 has four cases, A12 two); all fail on the unknown command
- [x] Author A15, A16, A17, A20 in `write-skill-pins.test.ts`: read `apps/indusk-mcp/skills/write.md` and the live sidebar config `apps/docs/src/.vitepress/config.ts`, RED (the skill file does not exist; the sidebar has no entry). Reads fall back to `""` so each pin fails on its own regex, not on ENOENT; observed twelve red, each on its regex
- [x] Write the manual procedures for A4, A13, A18, A19 into `.indusk/planning/writing-skill/dogfood.md`, each with its expected observation
- [x] Give every real-git test an explicit 30s timeout. Applied inline as the third argument to each `it` that commits or publishes (eight tests); the parser and pin tests stay on the default

- [x] **Shape — reviewed, nothing found** (six files: the fixture, four package test files, one admin test) against the testing and typescript rules; every enabled extension's rules were readable. **The library could not run this review**: `prepareShapeReview` keys by phase number and `verificationIsGreen(body, 1)` reads Build Phase 1's gate, so it reports Test Phase 1 as "not green" after the gate is closed. The inputs were gathered by hand from the same sources (`git diff --name-only` since the phase 1 boundary, `collectCraftRules`); the writers were not used because they would file under Build Phase 1. Shape predates test phases; recorded as a gap, not a skip
- [x] **Shape — considered, left as is**: `PUBLISH` (the argv builder) is repeated in both publish test files, `frontmatter()` in the pins test repeats the parity test's regex, and the `next/link` mock is the copy every admin browser test carries. All three are cross-file duplication, which the rule set scopes to `/cleanup` at close. `A9` bundles four behaviours in one `it` because it is one trajectory row; the row, not the `it`, is the unit here. The admin fixture's `as unknown as Plan` is a cast around a field that does not exist yet and leaves with Build Phase 4

#### Deferred to Build Phase 1

- **A2** — asserts on `summary.papers`, a field `PlanSummary` does not have; the test would not type-check today. Body reviewed:

  ```ts
  it("A2: a plan with lifecycle docs and papers keeps its stage and lists the papers", () => {
  	const dir = planFolder({
  		"brief.md": { frontmatter: { title: "x", date: "2026-09-09", status: "accepted" }, body: "" },
  		"paper-1.md": { frontmatter: { title: "One", date: "2026-09-09", status: "draft", kind: "paper" }, body: "# One" },
  	});
  	const s = parsePlan(dir);
  	expect(s.stage).toBe("brief");
  	expect(s.papers).toEqual([{ file: "paper-1.md", title: "One", status: "draft", stale: false }]);
  });
  ```

#### Deferred to Build Phase 2

- **A6** — imports `ensurePapersConfig`, which does not exist; the file would fail to load rather than fail an assertion. Body reviewed (first draft called a `tmpProject` helper that does not exist, which is exactly the load error this review exists to catch; corrected to the fixture that does):

  ```ts
  it("A6: ensurePapersConfig adds an empty destinations list once and never clobbers one", () => {
  	const { root } = paperProject({ docs: {} });
  	expect(ensurePapersConfig(root)).toBe("added");
  	expect(readConfig(root)?.papers).toEqual({ destinations: [] });
  	writeConfig(root, { ...readConfig(root)!, papers: { destinations: [{ name: "blog", path: "/x", dir: "w", index: "w/index.md" }] } });
  	const before = readFileSync(join(root, ".indusk/config.json"), "utf-8");
  	expect(ensurePapersConfig(root)).toBe("already-set");
  	expect(readFileSync(join(root, ".indusk/config.json"), "utf-8")).toBe(before);
  });
  ```

#### Regression Guards

- **A14** — the skill-sync parity test already exists and globs every `skills/*.md`, so it covers `write.md` the moment the file exists and cannot be red before then: with no file there is nothing to compare. It is listed so the guarantee is on the trajectory, not assumed.

#### Test Phase 1 Verification

- [x] Every authored row (A1, A3, A5, A7, A8, A9, A10, A11, A12, A15, A16, A17, A20, A21) exists and fails (`pnpm turbo test --filter=@infinitedusky/indusk-mcp` and `pnpm turbo test --filter=indusk-admin`). **Run 2026-09-09**: indusk-mcp 34 failed in 7 files = these 25 in 4 files + the 9 pre-existing admin-daemon failures in 3 files that fail identically on a HEAD baseline; indusk-admin 2 failed in 1 file (a third failure in the turbo run did not reproduce on a direct rerun: 2 failed, 152 passed, the known flaky server-boot class)
- [x] Each red row fails on its own assertion or on the genuinely-absent `papers` command, classified per row, not as an aggregate count; none fails on a missing import. **Per row**: A1, A3 on `expected 'unknown' to be 'paper'`; A5 on `expected null not to be null` (no `papers-section`); A7, A8, A9, A21, A10, A11a–d, A12a–b on `error: unknown command 'papers'` (exit 1 where 0 expected, or the message where a refusal message was expected); A15–A17 and the existence check on their own regex against `""`; A20 on the sidebar text lacking both links. Zero `ReferenceError` / `Cannot find module` in either suite's output
- [x] Both deferred bodies reviewed against both questions: will it compile at the phase it names, and does it assert what it claims. A2: uses `planFolder` and `parsePlan` (exist) and `s.papers` (exists after Build Phase 1), asserts stage kept and the papers list — yes on both. A6: the first draft called `tmpProject`, which does not exist anywhere, so it would have failed to load at Build Phase 2 — corrected to `paperProject({ docs: {} })`; it asserts add-once and never-clobber — yes on both after the correction
- [x] Trajectory State column updated to `written` for every authored row (eighteen rows; A14 to `passing` since the parity guard runs green today; A2 and A6 stay `planned` as deferred)

### Build Phase 1: The document kind

- [x] Add `"paper"` to `PlanStage`; add `PaperSummary` and `papers?: PaperSummary[]` to `PlanSummary` in `lib/plan-parser.ts`. `PAPER_STATUSES` is the exported vocabulary and `PaperStatus` derives from it plus `malformed`
  ```ts
  export interface PaperSummary { file: string; title: string; status: "draft" | "accepted" | "published" | "malformed"; stale: boolean }
  ```
- [x] Read `kind` in `parseFrontmatter` (currently drops everything but title, date, status); collect papers in `parsePlan` from documents whose `kind` is `paper`, in filename order. Done as a separate `readPaper` reader rather than widening `parseFrontmatter`: the lifecycle reader's parse-error contract (report the file, mark the plan malformed) is the wrong contract for a document that cannot even declare its kind, so an unparseable file is simply not a paper and the lifecycle walk keeps reporting it
- [x] `determineStage` unchanged on the lifecycle walk; when it returns `unknown` and papers exist, stage is `paper` with `stageStatus` the least-advanced paper status; `determineNextStep` for `paper`: "Review paper: {file}" (any draft), "Publish {n} paper(s)" (any accepted or stale), "Done". Plus "Fix paper status in {file} (expected draft | accepted | published)" when any paper is malformed, which outranks the rest
- [x] `paperContentHash(raw)`: SHA-256 over the document with the `published` frontmatter block removed, via gray-matter round-trip; `stale = status === "published" && hash !== published.hash`. **The hash also drops `status`**: a publish flips `accepted` to `published` in the same write-back, so a hash that included it would read stale the instant it was written. A `published` paper with no recorded hash reads stale (cannot be confirmed current), which is the site's hand-copied thesis today. Covered by a staleness unit added beside A2
- [x] `list_plans` passes `papers` through unchanged; `active: true` counts a `paper`-stage plan with any draft or accepted paper as active. The tool returns `PlanSummary` whole, so the field needed no change; the active rule is `isActivePlan` in `plan-tools.ts`, with five cases added to the existing `plan-tools-active.test.ts` (15/15)

- [x] **Shape** — `lib/plan-parser.ts`: extract the staleness derivation out of `readPaper` into a named `paperIsStale(raw, data, status)`. Done, exported; 26/26 across the parser and active-filter files after both extractions. It is the one policy Build Phase 3's publish step must agree with (what the recorded hash is compared against, and that a missing record reads stale), and it currently has no name and no seam; the staleness unit reaches it only through `parsePlan`. Rule: *typescript / testing — a block with one reason to change and a nameable purpose is a named function with a seam a test can reach.*
- [x] **Shape** — `lib/plan-parser.ts` (done, `resolvePlanStage` returns the triple; the orphaned comment above the old block was folded into its docblock): the paper-stage override in `parsePlan` is three ternaries on one condition (`paperStage ? … : …` for stage, status, next step). One rule, three fields: fold into `resolvePlanStage(walked, papers)` returning the triple, so the "lifecycle document wins, papers only when nothing else" decision is one unit. Rule: *typescript — a decision spread across parallel conditionals wants to be one named function.*
- [x] **Shape — considered, left as is**: `paperContentHash` re-parses `raw` although `readPaper` already has `data`; the duplication is one `matter()` call per paper and buys a hash function with a single-string contract that the publish step can call on a file it has not otherwise parsed. `isActivePlan` in `plan-tools.ts` is two branches with a comment each and stays. The review scope also listed CLAUDE.md, the docs page, and an eval-materialized lesson file, none of which are code; and Shape's phase-1 scope includes the Test Phase 1 files because both phases share the number, as recorded above

#### Build Phase 1 Verification
- [x] A1, A2, A3 pass (`pnpm exec vitest run src/lib/plan-parser.papers.test.ts`) — 4/4 in the file (A1, A2, A3, staleness), and the pre-existing `plan-parser.test.ts` 7/7 beside it
- [x] Every other row still red for its own reason; per-row classification, none flipped green as a side effect — publish + refusals + pins: 23 failed, 0 passed; admin A5: 2 failed, 1 passed (the negative guard, green by construction since Test Phase 1). `tsc --noEmit` clean
- [x] `indusk-v4-day` still reports `unknown` (no document declares `kind` yet), and every existing plan in `list_plans` reports the same stage as before this phase — `parseAllPlans` captured before the change and compared after: 20 plans, 0 differences in stage, status, or next step, no plan gained a `papers` field; `archive` and `indusk-v2-dawn` still `unknown`. (`indusk-v4-day` is untracked on main and so absent from this worktree; it joins at Build Phase 6)

#### Build Phase 1 Context
- [x] Add to Conventions: `kind: paper` is declared in frontmatter, never inferred; a `paper` stage exists beside the lifecycle stages and never enters `STAGE_ORDER`; staleness is derived from `paperContentHash`, never stored as a status — pointer to `.indusk/planning/writing-skill/adr.md`. Added after the "Plans live in" line through the budget hook; CLAUDE.md 45,889 / 61,440 bytes (75%) after it

#### Build Phase 1 Document
- [x] Update `reference/cli/plans.md`: the `paper` stage, the `papers` field, the status vocabulary, and what "Publish n paper(s)" means. New "Papers (`kind: paper`)" section at the end of the page; names `indusk papers publish` without linking it, since `/reference/cli/papers` does not exist until Build Phase 5 and a dead link fails the VitePress build

### Build Phase 2: Destinations in config

- [x] Add `papers?: { destinations: PaperDestination[] }` to `InduskConfig` in `lib/config.ts`
  ```ts
  export interface PaperDestination { name: string; path?: string; repo?: string; dir: string; index: string; frontmatter?: Record<string, string> }
  ```
- [x] `ensurePapersConfig(projectRoot)` in `lib/papers/config.ts`, keyed on block presence, same contract as `ensureCleanupConfig` (`"added" | "already-set" | "no-config"`); call it from `update.ts` beside `ensureCleanupConfig`. A6 authored at phase start as a load error (its subject did not exist), then green; two more cases: a present-but-empty block is already-set, and a missing config is no-config
- [x] `resolveDestination(projectRoot, name?)` in `lib/papers/destination.ts`: `path` expands `~` and resolves relative to the project root; `repo` goes through `readWorkbenchRepos` + `repoDir` and refuses outside a workbench (`isWorkbench` false) with "only paths are accepted here"; no name with more than one destination refuses listing them; zero destinations refuses naming `papers.destinations`. Pure (touches nothing on disk; existence and git-ness are the publish step's checks); an undeclared `repo` inside a workbench refuses listing what is declared; refusals are a `DestinationError` the command prints and exits on. Seven resolver cases in `destination.test.ts`

- [x] **Shape — reviewed, nothing found** (boundary recorded at `d0a6afc5`; scope was exactly this phase's six code files plus CLAUDE.md and the new docs page; every extension's rules readable). `resolveDestination` selects and `destinationRoot` locates, one reason to change each, refusal messages beside the branch that raises them; the tests are one `it` per rule
- [x] **Shape — considered, left as is**: `ensurePapersConfig` mirrors `ensureCleanupConfig` line for line, and `update.ts` now carries a third near-identical ensure-and-print block (cleanup, decay, papers). That is the rule of three across files, which the rule set scopes to `/cleanup` at close; extracting an `ensureBlock(key, defaults)` now would settle a shape while a fourth caller is still plausible

#### Build Phase 2 Verification
- [x] A6 passes (`pnpm exec vitest run src/lib/papers/config.test.ts`) — 3/3 in the file, 10/10 across `src/lib/papers`, `tsc --noEmit` clean
- [x] A10 and A12 still red on the absent command, not on resolution; resolution is unit-covered here so Build Phase 3 can fail only on publish logic — refusals file 7 failed / 0 passed, every failure `error: unknown command 'papers'`
- [x] `indusk update` on the scratch project prints the `papers` block added and a second run prints current — rebuilt dist, fresh scratch project: run 1 `add: papers.destinations: [] to .indusk/config.json`, run 2 `ok: papers.destinations (already set)`, config reads `{"destinations":[]}`

#### Build Phase 2 Context
- [x] Add to Conventions: `papers.destinations[]` is ensured on update and keyed on block presence; a `repo` destination is a workbench declaration, refused elsewhere — pointer to the ADR. Added beneath the papers line, pointing at `/reference/cli/papers`, which now exists

#### Build Phase 2 Document
- [x] Write the config block section of `reference/cli/papers.md` (every field, the `path` vs `repo` rule, the ensure behavior). Page created with the configuration section, the field table, the refusal list, and the first-destination note; the command section and the sidebar entry follow in Build Phases 3 and 5

### Build Phase 3: The publish step

- [x] `lib/papers/publish.ts`: `publishPaper({ projectRoot, plan, file, destination, push })` running the eight steps of the ADR in order, each refusal a thrown `PublishRefusal` with the reason; imports `git` from `lib/git.ts`, never a local runner. An index refusal at step 6 undoes the page write, so a refusal never half-applies
- [x] `renderForDestination(raw, dest)`: frontmatter mapped through `dest.frontmatter` (default `title`, `description`); `kind`, `status`, `published`, `date` dropped; body verbatim; relative links to sibling documents rewritten when the sibling is published, else left with a warning on stderr. `slugForTitle` gives the destination filename (kebab-case ASCII, never empty)
- [x] `regenerateIndex(indexPath, pages)`: rewrite only between `INDEX_MARKERS`, newest first by destination commit date; refuse when the markers are absent, printing the pair to add. Lives in `index-page.ts` (not `index.ts`, which reads as a barrel); `collectIndexEntries` dates each page by its last destination commit and an uncommitted page by now, so the one being published sorts first. The fixture's `INDEX_MARKERS` now re-exports this one definition
- [x] `writeProvenance(paperPath, record)`: gray-matter round-trip, hash computed on the pre-write content, `status: published`. **Not a gray-matter round trip after all**: checked before writing it, js-yaml re-dumps `date: 2026-09-09` as an ISO timestamp and strips quotes it deems unnecessary, so every publish would rewrite lines it has no business touching. `withProvenance` in `provenance.ts` is a text edit that replaces only the top-level `status` line and the `published` block; the verbatim run below shows the title's quotes and the date line surviving byte-for-byte. Commits are quoted so an all-digit short sha cannot read as a number
- [x] Destination commit: `git add` page and index, `publish: {title} (source {short})`, plus "destination page had diverged from the last publish" when the committed target differed from the recorded hash; `--push` runs `git push` and nothing else does. Divergence is detected as the target's last destination commit not being the one the paper recorded (a hand copy with no record counts as diverged too), which needs no extra provenance key
- [x] Source commit: `chore(papers): publish {file} to {name} ({short dest})`, staging only the paper
- [x] `indusk papers publish <plan>/<file> [--to <name>] [--push]` in `bin/commands/papers.ts`, registered in `cli.ts`; exit 1 with the refusal on stderr, exit 0 with destination and commit on stdout. Up to date is exit 0 and says "no changes"

- [x] **Shape** — `lib/papers/publish.ts` (done: `pageDiverged(destRoot, pageRel, recordedCommit)` exported with its docblock; rebuilt, 11/11): name the divergence rule. "The target page's last destination commit is not the one the paper recorded, or nothing was recorded" is a policy of the same standing as staleness (`paperIsStale`), and it sits inline in step 5 as four lines around `sameCommit`. Extract `pageDiverged(destRoot, pageRel, recordedCommit)` so the rule has a name, a docblock, and a seam. Rule: *typescript / testing — a block with one reason to change and a nameable purpose is a named function with a seam a test can reach.*
- [x] **Shape — considered, left as is**: `publishPaper` is one 120-line procedure of eight numbered steps. Each step is guard clauses or one call, the order IS the contract the ADR states, and splitting it into eight functions would move the sequence into a call chain a reader has to reassemble. `regenerateIndex` both locates the markers and formats the block; the formatting is three lines and has no second caller. `commands/papers.ts` parses `<plan>/<file>` inline, six lines, one caller
- [x] **Shape — reviewed**: boundary recorded at `ce0040e9`; scope was exactly this phase's seven code files plus CLAUDE.md and the docs page; every extension's rules readable

#### Build Phase 3 Verification
- [x] A7, A8, A9, A21 pass (`pnpm exec vitest run src/__tests__/papers-publish.test.ts`) — 4/4 on the first run after the build
- [x] A10, A11, A12 pass (`pnpm exec vitest run src/__tests__/papers-publish-refusals.test.ts`); each refusal asserted on its message, and the destination's `git status` and tree are byte-identical before and after — 7/7; the wider run (`src/lib/papers`, both parser files, `src/tools`, parity, shared-resolution) is 77 passed with only the twelve skill pins red, as they should be until Build Phase 5
- [x] A9's no-op: publishing an unchanged paper twice yields one destination commit and one source commit total — asserted inside A9 (third publish: destination and source counts unchanged, stdout says up to date)
- [x] The documented command run verbatim from a clean checkout against the scratch destination, output read, not just exit code — `indusk papers publish essays/paper-1.md --to blog` on a scratch project and destination: page `writing/the-pernicious-grift.md` with title and description only, index block regenerated with the one entry, destination commit `publish: The Pernicious Grift (source e007d395)`, provenance block written with the date line and quoted title untouched, source commit `chore(papers): publish paper-1.md to blog (3abf7df)`, second run "up to date … no changes" exit 0

#### Build Phase 3 Context
- [x] Add to Conventions: `indusk papers publish` commits in the destination and never pushes by default; a dirty target refuses, a committed hand edit is overwritten and named; the source repo gets one provenance commit per publish — pointer to the ADR. Added beneath the destinations line, including that provenance is a text edit and why

#### Build Phase 3 Document
- [x] Write `reference/cli/papers.md`: the command, the eight steps as a Mermaid sequence, every refusal and its message, the index markers. Command section written above the configuration section: usage, the sequence diagram, what lands in each repo, up-to-date and divergence semantics, the refusal table, the marker pair

### Build Phase 4: Papers in the admin UI

- [x] `Plan` gains `papers?: PaperSummary[]` in `planning-reader.ts`, read from the shared parser; no admin-side re-parse. As `PaperEntry extends PaperSummary { content }`: the summary is the parser's, the reader adds only the body it needs to render. A papers-only plan's header status is the parser's paper-stage status rather than `unknown`
- [x] `PlanDetail` renders a `papers-section` after the lifecycle sections: one `CollapsibleSection` per paper with a `<Markdown>` render and a status badge; absent when there are no papers. Placed after the ADR section, before the phases; kept out of `hasAnyDocument` so a papers-only plan renders no Falsification section
- [x] Badge variants for `draft`, `accepted`, `published`, `published (stale)`, `malformed` in `ui/badge-variant.ts`. `paperStatusToBadge` (draft→planned, accepted→writable, published→passing, stale→written, malformed→blocked) and `paperStatusLabel`, so the derived label is produced in one place. The A5 fixture's `as unknown as Plan` cast is gone with the field, as its comment promised. **The gate caught a miss on the way in**: A1–A3 had passed at Build Phase 1 but their rows still read `written`; corrected before this checkoff could land (the table-lags-the-checklist lesson, again)

- [x] **Shape** — `lib/planning-reader.ts` (done: `readPapers(planDir, summaries)`; 52/52 across the A5 file and `src/lib`): "read each paper's body" is an inline `Promise.all(map)` inside `readPlanFolder`, a function that already reads every lifecycle document. Extract `readPapers(planDir, summaries)` so the job has a name and a seam. Rule: *typescript — a block with one reason to change and a nameable purpose is a named function.*
- [x] **Shape — considered, left as is**: `PapersSection` renders each paper's badge row and collapsible inline in its map; twenty lines, one reason to change, and a `PaperCard` split would give a second component nothing else uses. `paperStatusToBadge` and `paperStatusLabel` are two functions rather than one returning a pair, so the label can be tested without the variant. The scope also listed `reference/cli/papers.md` because its phase 3 commit landed after this phase's boundary; not code
- [x] **Shape — reviewed**: boundary recorded at `e20d83e7`; every extension's rules readable

#### Build Phase 4 Verification
- [x] A5 passes (`pnpm turbo test --filter=indusk-admin`) — 154 passed, 27 files
- [x] A plan with no papers renders no `papers-section` and the existing PlanDetail suite is unchanged — the negative case in the A5 file, and `PlanDetail.test.tsx` + `PlanDetail.parent.test.tsx` 31/31 alongside it

#### Build Phase 4 Context
- [x] Add to Known Gotchas: the Papers section renders from the shared parser's `papers` field; the stale badge is derived, so a paper edited after publish shows stale with no write anywhere — pointer to `/reference/admin-ui/overview`. Added above the `next/link` gotcha, naming the badge helpers and the papers-only header status

#### Build Phase 4 Document
- [x] Update `reference/admin-ui/overview.md` with the Papers section and its badges. A `Papers` row in the plan-detail sections table, before `Phases`, linking `/reference/cli/papers`

### Build Phase 5: The skill and its documentation

- [x] Write `apps/indusk-mcp/skills/write.md` with frontmatter `name: write`, the ADR's description, and the named sections: Load, Voice, Outline, Stance, Read as the reader, Falsify the argument, Publish (the command verbatim, the config block to write when none exists, the hotfix path), What this skill does not do. Plus an Invocation section. The Publish section carries the generic form and the concrete line the dogfood runs verbatim (`indusk papers publish indusk-v4-day/paper-1-the-grift.md --to blog`), since a placeholder cannot be run unchanged. The review passes are recorded as `<paper-stem>.review.md` in the plan folder, which is what A19 looks for
- [x] Sync the installed copy to `.claude/skills/write/SKILL.md` (the parity test pins byte-equality)
- [x] Write `reference/skills/write.md`; add `reference/skills/write` and `reference/cli/papers` to the sidebar in `apps/docs/src/.vitepress/config.ts` (the live config, not the root scaffold). Write after Catchup in the skills block; papers after plans in the CLI block
- [x] Changelog entry under Unreleased — three entries: the document kind, the skill, the command

- [x] **Shape — reviewed, nothing found** (boundary recorded at `4f856cd3`; scope was the skill and its installed copy, the reference page, the changelog, CLAUDE.md, and the sidebar config; every extension's rules readable). The only code this phase touched is two data lines in the VitePress sidebar; the rest is prose, which the craft rules do not address. Nothing considered and left, because there was nothing to consider

#### Build Phase 5 Verification
- [x] A15, A16, A17, A20 pass (`pnpm exec vitest run src/__tests__/write-skill-pins.test.ts`) — 13/13 in the file (the existence check plus the twelve pins)
- [x] A14 still passes with the new file present (`pnpm exec vitest run src/__tests__/skill-sync-parity.test.ts`) — 34/34 across pins + parity together
- [x] `get_skill_summaries` lists `write` with its description — verified on the real path, not a re-implementation: an MCP client over stdio against the worktree's built CLI (`node dist/bin/cli.js serve`, `PROJECT_ROOT` set, which is what `.mcp.json` registers) returned total 27 and `{"name":"write","description":"Draft, outline, revise, review, or publish a paper, thesis, or essay …","type":"process","slash":"/write"}`. Two things bit on the way, both already in the work skill's warnings: top-level `await` does not run under `tsx -e`, and `dist/server/index.js` alone closes the connection; the registered entry point is `indusk serve`

#### Build Phase 5 Context
- [x] Add `write` to the Skills line in Architecture; add to Conventions that the skill's description is the routing key and any change to it re-runs the manual invocation check — pointer to `/reference/skills/write`. Both added; the Conventions line sits above the publish invariants

#### Build Phase 5 Document
- [x] `reference/skills/write.md` written and in the sidebar; changelog entry present. Written, linked from the skills block; three Unreleased entries

### Build Phase 6: Dogfood on the Day papers

- [x] Declare `kind: paper` on `thesis.md`, `obsolescence.md`, `paper-1-the-grift.md`, `paper-2-the-landscape.md`, `paper-3-the-right-way.md` in `indusk-v4-day`; set paper 1 to `accepted`. The Day folder was untracked on the trunk, so it was copied into the worktree and committed on this branch (`1ad363e1`); **at merge the trunk's untracked copy must be moved aside first or git will refuse to overwrite it**
- [x] Add the `blog` destination to dusk's `.indusk/config.json`: `path: ~/code/site`, `dir: writing`, `index: writing/index.md`
- [x] In `~/code/site`: add the marker pair to a new `writing/index.md`, change the nav link to `/writing/`, commit by hand once — `d995ddc`, on `main`, clean before and after
- [x] Run the documented publish command verbatim for paper 1; read the destination commit and the provenance block — exit 0; site commit `c12faa3 publish: The pernicious grift (source 1ad363e1)`; provenance block written with the date line and quoted title untouched; source commit `86646e85`; five sibling-link warnings, correct and recorded (`indusk` here is the worktree's built CLI, since the global one is the published 1.43.0 without `papers`)
- [x] Run the skill on `indusk-v4-day` in a fresh session; record the read-as-reader and falsify passes per paper in the plan folder — a fresh context followed the skill file verbatim (the Skill tool refused `write`: not registered on the trunk until merge); three `<stem>.review.md` files written with both passes, substantive findings recorded in `dogfood.md`
- [x] In a second fresh session, say "let's work on the grift paper" and record whether the skill was invoked — recorded: not observable from the worktree (per-project skill discovery); the phrasing led the fresh context to find and choose the `write` skill by search; A18 is `skipped` with the reason and re-runs on the trunk after merge

#### Build Phase 6 Verification
- [x] A4 observed: `list_plans` reports `indusk-v4-day` as stage `paper`, and the admin UI shows five papers with badges — over stdio against the worktree's `indusk serve`: stage `paper`, status `draft`, next step "Review paper: obsolescence.md", five papers, paper 1 `published` and not stale; the admin reader reports the same five; the live daemon serves the published bundle and was not consulted (A5 proves the rendering of this shape)
- [x] A13 observed: `~/code/site` has one new commit with the page and the regenerated index, `git status` clean, `git log origin/main..main` shows it unpushed; paper 1's frontmatter carries the provenance block — all observed; the index lists the new page first and the pre-split thesis page second with its description
- [x] A18 observed and recorded in `dogfood.md` with the exact phrasing used and the outcome — recorded as not observable here, with the reason and the re-run instruction; row `skipped`
- [x] A19 observed: the session's load output lists the seven Day documents and nothing from lessons or health; both passes exist per paper — nine documents listed (the folder has nine; the item's seven predates the outline and review files), nothing from lessons or health, three review files with both passes

- [x] **Shape — reviewed, nothing found** (boundary recorded at `a134e88e`; scope was CLAUDE.md and `reference/cli/papers.md`; the Day documents, the config, and the review files live under `.indusk/` and are excluded from Shape's scope by design; every extension's rules readable). No code changed in this phase

#### Build Phase 6 Context
- [x] Update Current State: the Day papers are `kind: paper`; paper 1 is published to the blog; the site's pre-split thesis page stays until an editorial call — pointer to `.indusk/planning/writing-skill/dogfood.md`. Added as an In-flight entry, including that A18 re-runs on the trunk after merge

#### Build Phase 6 Document
- [x] Write `dogfood.md` results; add the "first publish to a destination" walkthrough (markers, nav, first command) to `reference/cli/papers.md`. All four procedures carry results; the walkthrough sits above "The first destination" on the papers page

### Phase 7: Falsification — what the publish step leaves behind

**Goal**: verify whether the attested state holds against the things a publish leaves behind it: pages of *other* papers, a second paper with the same slug, a page under its old title, a half-applied run after a failed push or commit, an index whose order depends on when a page was last touched, and a status word this plan invented that no status-keyed detector was told about. Each trajectory row captures one hypothesis about what is broken; each checklist item captures the fix the code needs when the hypothesis confirms. Every hypothesis was formed by reading the code against the ADR's claims; none is a hopeful guess.

- [ ] `lib/papers/publish.ts`, a ninth step after the source commit: for every sibling document recorded as published at the same destination, render it with the current sibling map and compare to its destination page; for each that differs, print `warning: <file> links to this paper and is now behind; run: indusk papers publish <plan>/<file>`. The ADR's link-rewriting only sees siblings published *before* the paper being published, and staleness cannot see it at all because the earlier paper's content did not change (A22)
- [ ] Slug-collision guard before the target-page check: scan every `.md` under `.indusk/planning/**` (active and archive) for a `published.path` equal to the target page at the same destination name from a *different* file; refuse naming that paper. Two titles can slug identically, and a title in a script `slugForTitle` reduces to nothing slugs to `paper`; today the second publish reads the first's page as "diverged" and overwrites it (A23)
- [ ] Up to date requires `data.status === "published"`, not only a matching hash and an identical page; an `accepted` paper with both is republished so provenance and status are rewritten. When the written page and index are byte-identical to HEAD (`git status --porcelain` on both empty after writing), skip the destination commit and record the page's last commit as `destinationCommit` instead of letting `git commit` fail with "nothing to commit" (A24)
- [ ] `collectIndexEntries` dates a page by the commit that **added** it (`git log --diff-filter=A --format=%ct -- <rel>`, last line), now for an untracked page; today it uses the last commit touching the page, so a hotfix republish jumps an old page to the top (A25)
- [ ] Move `--push` after the source commit and make its failure a reported warning with exit 0: the publish is complete without the push. Today a failed push (no remote, rejected) throws out of step 7 after the destination commit and before provenance, and the next run reads the page as a hand divergence and commits it a second time (A26)
- [ ] When the paper records a `published.path` that differs from the new page path (retitled), `git mv` the old page to the new one before writing, so the old page leaves the destination and the regenerated index; today both pages exist and both are listed (A27)
- [ ] Wrap steps 6 through 8 so no git failure escapes as a stack trace: a destination commit failure restores the page and index (`git checkout --` for tracked, `rm` for untracked) and refuses with git's message; a source commit failure refuses naming the destination commit that now exists and says the provenance is written and needs a hand commit. Today a missing git identity leaves the destination dirty, and the next publish refuses on "uncommitted changes" it caused itself (A28)
- [ ] `lib/planning/archive-dead.ts`: add `published` to `BLOCKING_STATUSES`. A plan with a published paper is not a dead draft; archiving it moves the source the hotfix path publishes from. The status word was introduced in Build Phase 1 and never registered with the one detector keyed on status words (A29)

#### Phase 7 Verification
- [ ] A22 through A29 authored red at phase start, each failing on its own assertion against today's code, then green after the fixes (`pnpm exec vitest run src/__tests__/papers-publish-falsification.test.ts src/lib/planning/archive-dead-papers.test.ts`)
- [ ] A7 through A12 and A21 still green after the changes to `publish.ts` and `index-page.ts` (`pnpm exec vitest run src/__tests__/papers-publish.test.ts src/__tests__/papers-publish-refusals.test.ts`), and the existing archive-dead suite unchanged
- [ ] The documented command re-run verbatim against the scratch destination twice after the fixes: the first run publishes, the second reports up to date and makes no commit in either repo; then `--push` against a destination with no remote exits 0 with the push failure as a warning and provenance committed

#### Phase 7 Context
- [ ] Add to Known Gotchas: a new status word must be registered with every status-keyed detector in the commit that introduces it (`published` was missing from archive-dead's blocking set for six build phases); `indusk papers publish` pushes last and never lets a git failure escape past a commit it made — pointer to the ADR

#### Phase 7 Document
- [ ] Update `reference/cli/papers.md`: the behind-siblings warning, the slug-collision refusal, first-publish index order, push-last semantics, what a commit failure leaves behind, and that `archive-dead` treats a published paper as blocking

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plan-parser.ts` | `paper` stage, `PaperSummary`, `kind` read, hash and staleness |
| `apps/indusk-mcp/src/lib/config.ts` | `papers` block types |
| `apps/indusk-mcp/src/lib/papers/{config,destination,publish,render,index,provenance}.ts` | New |
| `apps/indusk-mcp/src/bin/commands/papers.ts`, `src/bin/cli.ts` | New command |
| `apps/indusk-mcp/src/bin/commands/update.ts` | `ensurePapersConfig` call |
| `apps/indusk-mcp/src/server/tools/*` (list_plans) | `papers` passthrough |
| `apps/indusk-mcp/skills/write.md`, `.claude/skills/write/SKILL.md` | New skill and installed copy |
| `apps/indusk-admin/src/lib/planning-reader.ts`, `components/PlanDetail.tsx`, `ui/badge-variant.ts` | Papers section |
| `apps/docs/src/reference/skills/write.md`, `reference/cli/papers.md`, `reference/cli/plans.md`, `reference/admin-ui/overview.md`, `.vitepress/config.ts`, `changelog.md` | Docs |
| `.indusk/planning/indusk-v4-day/*.md` (five documents), `.indusk/config.json` | Dogfood |
| `~/code/site/writing/index.md`, `.vitepress/config.mts` | Markers and nav, once, by hand |

## Dependencies
- None on other plans. `~/code/site` must be a clean checkout on `main` for Build Phase 6.

## Notes
- The list_plans tool file path is confirmed in Build Phase 1 before editing; the passthrough may be a one-line change if the tool returns `PlanSummary` whole.
- Open editorial question, not blocking: whether the site's pre-split thesis page is retired once all three papers are published.
