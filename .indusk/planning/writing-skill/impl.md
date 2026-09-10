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
| A1 | A plan folder whose documents all carry `kind: paper` reports stage `paper` with a status derived from those papers, never `unknown`, and a next step that is never "Create a brief" | Test Phase 1 | Build Phase 1 | written | unit | `apps/indusk-mcp/src/lib/plan-parser.papers.test.ts` |
| A2 | A plan folder with lifecycle documents and papers keeps its lifecycle stage and lists the papers beside it with their own statuses | Build Phase 1 | Build Phase 1 | written | unit | `apps/indusk-mcp/src/lib/plan-parser.papers.test.ts` |
| A3 | A paper's status is one of `draft`, `accepted`, `published`; any other value reports `malformed`, never a silent draft | Test Phase 1 | Build Phase 1 | written | unit | `apps/indusk-mcp/src/lib/plan-parser.papers.test.ts` |
| A4 | `indusk-v4-day`, once its documents declare `kind: paper`, reports a real stage in `list_plans` and the admin UI | Test Phase 1 | Build Phase 6 | written | manual | `manual:` `.indusk/planning/writing-skill/dogfood.md` |
| A5 | The admin UI renders a paper under its plan with title and status, and a papers-only plan renders without error | Test Phase 1 | Build Phase 4 | written | browser | `apps/indusk-admin/src/components/PlanDetail.papers.test.tsx` |
| A6 | After `update`, a project with no `papers` block has `papers.destinations: []`; a project with destinations keeps them byte-for-byte | Build Phase 2 | Build Phase 2 | planned | unit | `apps/indusk-mcp/src/lib/papers/config.test.ts` |
| A7 | Publishing puts the rendered page in the destination directory with mapped frontmatter, regenerates the index between its markers, and commits on the destination's current branch with no push | Test Phase 1 | Build Phase 3 | written | integration | `apps/indusk-mcp/src/__tests__/papers-publish.test.ts` |
| A8 | After a publish the paper's frontmatter records destination, path, destination commit, source commit, and hash, and status reads `published` | Test Phase 1 | Build Phase 3 | written | integration | `apps/indusk-mcp/src/__tests__/papers-publish.test.ts` |
| A9 | Editing the plan copy after a publish reports `published (stale)`; publishing again clears it; publishing an unchanged paper twice is a no-op with no new commit | Test Phase 1 | Build Phase 3 | written | integration | `apps/indusk-mcp/src/__tests__/papers-publish.test.ts` |
| A10 | Publishing with no destination configured refuses naming `papers.destinations` and writes nothing | Test Phase 1 | Build Phase 3 | written | integration | `apps/indusk-mcp/src/__tests__/papers-publish-refusals.test.ts` |
| A11 | A missing path, a non-git destination, or a dirty target page each refuse with the reason and write nothing; a committed hand edit is overwritten and the commit message says the page had diverged | Test Phase 1 | Build Phase 3 | written | integration | `apps/indusk-mcp/src/__tests__/papers-publish-refusals.test.ts` |
| A12 | Inside a workbench a `repo` destination resolves through the declared repos; outside one it refuses saying only paths are accepted | Test Phase 1 | Build Phase 3 | written | integration | `apps/indusk-mcp/src/__tests__/papers-publish-refusals.test.ts` |
| A13 | The publish command documented in the skill, run verbatim, publishes paper 1 to `~/code/site` and performs A7 and A8 there | Test Phase 1 | Build Phase 6 | written | manual | `manual:` `.indusk/planning/writing-skill/dogfood.md` |
| A14 | The `write` skill is installed byte-identical to the package source and carries `name` and `description` | Test Phase 1 | Test Phase 1 | passing | unit | `apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts` |
| A15 | The skill's description names drafting, outlining, revising, and publishing a paper, thesis, or essay | Test Phase 1 | Build Phase 5 | written | unit | `apps/indusk-mcp/src/__tests__/write-skill-pins.test.ts` |
| A16 | The skill's instructions say to register presence, load the plan folder's prose documents, and skip lessons, health, and extensions | Test Phase 1 | Build Phase 5 | written | unit | `apps/indusk-mcp/src/__tests__/write-skill-pins.test.ts` |
| A17 | The skill carries Voice, Outline, Read as the reader, and Falsify the argument as named sections | Test Phase 1 | Build Phase 5 | written | unit | `apps/indusk-mcp/src/__tests__/write-skill-pins.test.ts` |
| A18 | "Let's work on the grift paper" in a fresh session invokes the skill without the slash command | Test Phase 1 | Build Phase 6 | written | manual | `manual:` `.indusk/planning/writing-skill/dogfood.md` |
| A19 | Running the skill on `indusk-v4-day` loads the thesis, outline, shape, and three papers, prints nothing from lessons or health, and leaves a read-as-reader pass and a falsify pass per paper in the plan folder | Test Phase 1 | Build Phase 6 | written | manual | `manual:` `.indusk/planning/writing-skill/dogfood.md` |
| A20 | The docs sidebar links `reference/skills/write` and `reference/cli/papers` | Test Phase 1 | Build Phase 5 | written | unit | `apps/indusk-mcp/src/__tests__/write-skill-pins.test.ts` |
| A21 | Publishing refuses while the plan copy has uncommitted changes, and a successful publish's destination commit message carries the source commit hash | Test Phase 1 | Build Phase 3 | written | integration | `apps/indusk-mcp/src/__tests__/papers-publish.test.ts` |

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
- [x] Add to Conventions: `kind: paper` is declared in frontmatter, never inferred; a `paper` stage exists beside the lifecycle stages and never enters `STAGE_ORDER`; staleness is derived from `paperContentHash`, never stored as a status — pointer to `.indusk/planning/writing-skill/adr.md`. Added after the "Plans live in" line through the budget hook; CLAUDE.md 46,0xx / 61,440 bytes

#### Build Phase 1 Document
- [x] Update `reference/cli/plans.md`: the `paper` stage, the `papers` field, the status vocabulary, and what "Publish n paper(s)" means. New "Papers (`kind: paper`)" section at the end of the page; names `indusk papers publish` without linking it, since `/reference/cli/papers` does not exist until Build Phase 5 and a dead link fails the VitePress build

### Build Phase 2: Destinations in config

- [ ] Add `papers?: { destinations: PaperDestination[] }` to `InduskConfig` in `lib/config.ts`
  ```ts
  export interface PaperDestination { name: string; path?: string; repo?: string; dir: string; index: string; frontmatter?: Record<string, string> }
  ```
- [ ] `ensurePapersConfig(projectRoot)` in `lib/papers/config.ts`, keyed on block presence, same contract as `ensureCleanupConfig` (`"added" | "already-set" | "no-config"`); call it from `update.ts` beside `ensureCleanupConfig`
- [ ] `resolveDestination(projectRoot, name?)` in `lib/papers/destination.ts`: `path` expands `~` and resolves relative to the project root; `repo` goes through `readWorkbenchRepos` + `repoDir` and refuses outside a workbench (`isWorkbench` false) with "only paths are accepted here"; no name with more than one destination refuses listing them; zero destinations refuses naming `papers.destinations`

#### Build Phase 2 Verification
- [ ] A6 passes (`pnpm exec vitest run src/lib/papers/config.test.ts`)
- [ ] A10 and A12 still red on the absent command, not on resolution; resolution is unit-covered here so Build Phase 3 can fail only on publish logic
- [ ] `indusk update` on the scratch project prints the `papers` block added and a second run prints current

#### Build Phase 2 Context
- [ ] Add to Conventions: `papers.destinations[]` is ensured on update and keyed on block presence; a `repo` destination is a workbench declaration, refused elsewhere — pointer to the ADR

#### Build Phase 2 Document
- [ ] Write the config block section of `reference/cli/papers.md` (every field, the `path` vs `repo` rule, the ensure behavior)

### Build Phase 3: The publish step

- [ ] `lib/papers/publish.ts`: `publishPaper({ projectRoot, plan, file, destination, push })` running the eight steps of the ADR in order, each refusal a thrown `PublishRefusal` with the reason; imports `git` from `lib/git.ts`, never a local runner
- [ ] `renderForDestination(raw, dest)`: frontmatter mapped through `dest.frontmatter` (default `title`, `description`); `kind`, `status`, `published`, `date` dropped; body verbatim; relative links to sibling documents rewritten when the sibling is published, else left with a warning on stderr
- [ ] `regenerateIndex(indexPath, pages)`: rewrite only between `INDEX_MARKERS`, newest first by destination commit date; refuse when the markers are absent, printing the pair to add
- [ ] `writeProvenance(paperPath, record)`: gray-matter round-trip, hash computed on the pre-write content, `status: published`
- [ ] Destination commit: `git add` page and index, `publish: {title} (source {short})`, plus "destination page had diverged from the last publish" when the committed target differed from the recorded hash; `--push` runs `git push` and nothing else does
- [ ] Source commit: `chore(papers): publish {file} to {name} ({short dest})`, staging only the paper
- [ ] `indusk papers publish <plan>/<file> [--to <name>] [--push]` in `bin/commands/papers.ts`, registered in `cli.ts`; exit 1 with the refusal on stderr, exit 0 with destination and commit on stdout

#### Build Phase 3 Verification
- [ ] A7, A8, A9, A21 pass (`pnpm exec vitest run src/__tests__/papers-publish.test.ts`)
- [ ] A10, A11, A12 pass (`pnpm exec vitest run src/__tests__/papers-publish-refusals.test.ts`); each refusal asserted on its message, and the destination's `git status` and tree are byte-identical before and after
- [ ] A9's no-op: publishing an unchanged paper twice yields one destination commit and one source commit total
- [ ] The documented command run verbatim from a clean checkout against the scratch destination, output read, not just exit code

#### Build Phase 3 Context
- [ ] Add to Conventions: `indusk papers publish` commits in the destination and never pushes by default; a dirty target refuses, a committed hand edit is overwritten and named; the source repo gets one provenance commit per publish — pointer to the ADR

#### Build Phase 3 Document
- [ ] Write `reference/cli/papers.md`: the command, the eight steps as a Mermaid sequence, every refusal and its message, the index markers

### Build Phase 4: Papers in the admin UI

- [ ] `Plan` gains `papers?: PaperSummary[]` in `planning-reader.ts`, read from the shared parser; no admin-side re-parse
- [ ] `PlanDetail` renders a `papers-section` after the lifecycle sections: one `CollapsibleSection` per paper with a `<Markdown>` render and a status badge; absent when there are no papers
- [ ] Badge variants for `draft`, `accepted`, `published`, `published (stale)`, `malformed` in `ui/badge-variant.ts`

#### Build Phase 4 Verification
- [ ] A5 passes (`pnpm turbo test --filter=indusk-admin`)
- [ ] A plan with no papers renders no `papers-section` and the existing PlanDetail suite is unchanged

#### Build Phase 4 Context
- [ ] Add to Known Gotchas: the Papers section renders from the shared parser's `papers` field; the stale badge is derived, so a paper edited after publish shows stale with no write anywhere — pointer to `/reference/admin-ui/overview`

#### Build Phase 4 Document
- [ ] Update `reference/admin-ui/overview.md` with the Papers section and its badges

### Build Phase 5: The skill and its documentation

- [ ] Write `apps/indusk-mcp/skills/write.md` with frontmatter `name: write`, the ADR's description, and the named sections: Load, Voice, Outline, Stance, Read as the reader, Falsify the argument, Publish (the command verbatim, the config block to write when none exists, the hotfix path), What this skill does not do
- [ ] Sync the installed copy to `.claude/skills/write/SKILL.md` (the parity test pins byte-equality)
- [ ] Write `reference/skills/write.md`; add `reference/skills/write` and `reference/cli/papers` to the sidebar in `apps/docs/src/.vitepress/config.ts` (the live config, not the root scaffold)
- [ ] Changelog entry under Unreleased

#### Build Phase 5 Verification
- [ ] A15, A16, A17, A20 pass (`pnpm exec vitest run src/__tests__/write-skill-pins.test.ts`)
- [ ] A14 still passes with the new file present (`pnpm exec vitest run src/__tests__/skill-sync-parity.test.ts`)
- [ ] `get_skill_summaries` lists `write` with its description

#### Build Phase 5 Context
- [ ] Add `write` to the Skills line in Architecture; add to Conventions that the skill's description is the routing key and any change to it re-runs the manual invocation check — pointer to `/reference/skills/write`

#### Build Phase 5 Document
- [ ] `reference/skills/write.md` written and in the sidebar; changelog entry present

### Build Phase 6: Dogfood on the Day papers

- [ ] Declare `kind: paper` on `thesis.md`, `obsolescence.md`, `paper-1-the-grift.md`, `paper-2-the-landscape.md`, `paper-3-the-right-way.md` in `indusk-v4-day`; set paper 1 to `accepted`
- [ ] Add the `blog` destination to dusk's `.indusk/config.json`: `path: ~/code/site`, `dir: writing`, `index: writing/index.md`
- [ ] In `~/code/site`: add the marker pair to a new `writing/index.md`, change the nav link to `/writing/`, commit by hand once
- [ ] Run the documented publish command verbatim for paper 1; read the destination commit and the provenance block
- [ ] Run the skill on `indusk-v4-day` in a fresh session; record the read-as-reader and falsify passes per paper in the plan folder
- [ ] In a second fresh session, say "let's work on the grift paper" and record whether the skill was invoked

#### Build Phase 6 Verification
- [ ] A4 observed: `list_plans` reports `indusk-v4-day` as stage `paper`, and the admin UI shows five papers with badges
- [ ] A13 observed: `~/code/site` has one new commit with the page and the regenerated index, `git status` clean, `git log origin/main..main` shows it unpushed; paper 1's frontmatter carries the provenance block
- [ ] A18 observed and recorded in `dogfood.md` with the exact phrasing used and the outcome
- [ ] A19 observed: the session's load output lists the seven Day documents and nothing from lessons or health; both passes exist per paper

#### Build Phase 6 Context
- [ ] Update Current State: the Day papers are `kind: paper`; paper 1 is published to the blog; the site's pre-split thesis page stays until an editorial call — pointer to `.indusk/planning/writing-skill/dogfood.md`

#### Build Phase 6 Document
- [ ] Write `dogfood.md` results; add the "first publish to a destination" walkthrough (markers, nav, first command) to `reference/cli/papers.md`

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
