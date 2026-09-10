---
title: "Writing skill — papers as first-class plan documents"
date: 2026-09-09
status: accepted
---

# Writing skill — papers as first-class plan documents

## Goal

**A paper written inside a plan folder is recognized by the lifecycle, drafted and reviewed under a skill built for prose, and published to a blog outside the repo with the same discipline as code: source in the plan, destination a build artifact, every publish traceable to a commit.**

Today `list_plans` reports the Day plan, nine prose documents including three finished papers, as stage `unknown` with next step "Create a brief". The blog at `~/code/site` carries a hand-copied thesis that is already behind the plan copy, and nothing can tell. A writing session pays for a code catchup and gets nothing from it. When this ships, the Day plan reports a real stage, `/write` loads the papers and nothing else, and publishing paper 1 is one documented command that commits in the site repo and records where it went.

## Y-Statement

**In the context of:**
Writing long-form papers inside InDusk plan folders, where they are the "why" that sub-plans assume and link to, and publishing them to a VitePress blog that lives in a separate git repo and deploys to GitHub Pages on push.

**Facing:**
A lifecycle that recognizes five document kinds and reports everything else as unknown; close-out rituals and a catchup that assume a diff; and a destination outside the repo where a hand copy has already drifted from its source with no record that the copy exists.

**We decided for:**
A frontmatter-declared `kind: paper` document kind that the plan parser, `list_plans`, and the admin UI recognize; a thin `/write` process skill that is prose instructions only; and a `papers` publish library with a CLI entry point that copies a paper to a configured destination, regenerates an index page between markers, commits in the destination without pushing, and writes provenance (destination, commit, source commit, content hash) back into the paper's frontmatter so staleness is derived rather than asserted.

**And against:**
Inferring papers from filenames; a `papers/` subfolder; a hook-and-gate "writing mode"; editing the destination's VitePress config to add nav entries; a separate provenance ledger; auto-pushing; accommodating hand edits at the destination by merging.

**To achieve:**
Papers that are visible to every surface plans are visible to, a writing session that loads only what it needs, and a publish step that is traceable, idempotent, and refuses rather than overwrites when its preconditions do not hold.

**Accepting:**
Declaring `kind: paper` by hand in existing documents; one manual change to the site's nav on first use so it points at the generated index; a provenance commit in the source repo on every publish; and that the skill's effect on prose quality is not mechanically testable.

**Because:**
Declaration over inference is the codebase's rule for everything InDusk reads from disk; a build-artifact destination is the only model under which "nobody hand-edits the site" can be enforced; and a skill is the smallest thing that packages the two ingredients that made yesterday's session work, the plan folder as a corpus and the conduct rules.

## Context

The brief records the four ways InDusk is tuned for code and the ground truth behind each. The test plan lists twenty-one assertions in four groups: the document kind (unit), the publish step (integration against a temporary git repo), the skill (pinned instruction text), and a dogfood run on the Day papers. This ADR decides the architecture that makes all of them true.

Relevant code, read for this decision:

- `lib/plan-parser.ts`: `determineStage` walks `STAGE_ORDER` in reverse looking for `{stage}.md`; anything else is `unknown`, and `determineNextStep` turns unknown into "Create a brief". `PlanSummary` carries `documents: string[]` as bare filenames.
- `lib/config.ts`: `ensureCleanupConfig` and `ensureDecayConfig` are the ensure pattern, keyed on block presence so a user's block is never clobbered.
- `lib/git.ts`: the shared async `git(root, ...args)` runner. A git primitive kept inside a domain folder gets copied by the next domain; the publish library imports this one.
- `lib/worktree/repos.ts`: `readWorkbenchRepos`, `isWorkbench`, `repoDir`, the only readers of declared topology.
- `apps/indusk-admin/src/lib/planning-reader.ts` and `components/PlanDetail.tsx`: a `Plan` with typed per-document data; missing documents do not render their section; a `raw-documents-section` already exists.
- `~/code/site`: VitePress with `cleanUrls`, one page under `writing/`, a nav entry linking directly to that page, and `deploy.yml` on push.

## Decision

### 1. The document kind

A document declares itself with `kind: paper` in frontmatter. Nothing is inferred from filenames. `PlanStage` gains `"paper"`. `determineStage` runs unchanged first; if it lands on `unknown`, it scans the folder's documents for `kind: paper`, and if any exist the stage is `paper`. `STAGE_ORDER` is untouched, since papers are not a step in the research-to-retrospective sequence. A plan with lifecycle documents keeps its lifecycle stage; its papers are listed alongside in a new `papers` field either way.

```typescript
export interface PaperSummary {
	file: string;
	title: string;
	status: "draft" | "accepted" | "published" | "malformed";
	stale: boolean; // derived: published && hash(content) !== published.hash
}
export interface PlanSummary {
	// ...existing
	papers?: PaperSummary[];
}
```

Paper status vocabulary is `draft | accepted | published`. Any other value reports `malformed`, never a silent draft. `published (stale)` is a display string derived from `status === "published" && stale`; it is never written to a file.

For a `paper`-stage plan, `stageStatus` is the least-advanced paper's status (`draft` < `accepted` < `published`), and `nextStep` is "Review paper: {file}" for a draft, "Publish {n} paper(s)" when any accepted or stale paper exists, and "Done" when all are published and current.

A `master.md`-only plan (`indusk-v2-dawn`) stays `unknown`. That is a hierarchy question and belongs to the plan-grouping work, not here.

### 2. Provenance in the paper's frontmatter

A publish writes a `published` block into the paper:

```yaml
status: published
published:
  destination: blog
  path: writing/the-pernicious-grift.md
  commit: 9f3c2a1
  source_commit: 4c7ee579
  hash: sha256:…
```

`hash` is the SHA-256 of the document with the `published` block removed, so writing the block does not change what it hashes. `source_commit` is the last commit that touched the plan copy in the source repo. Staleness is `hash(current content minus published block) !== published.hash`, computed on read by the parser.

Rejected: a separate ledger under `.indusk/papers/`. Provenance belongs with the document it describes; a ledger separates the fact from the thing and adds an artifact every "what changed" detector and `.gitattributes` would have to learn.

### 3. The publish step

A library, `lib/papers/`, with one CLI entry point so the skill's documented command can be run verbatim:

```
indusk papers publish <plan>/<file> [--to <destination>] [--push]
```

`--to` is required when more than one destination is configured. Steps, in order, each refusing loudly on failure with nothing written:

1. **Read and validate the paper.** `kind: paper` present; status `accepted` or `published`; a draft refuses.
2. **Source is committed.** `git status --porcelain -- <file>` in the plan repo is empty.
3. **Resolve the destination** from `config.json` (below). The resolved directory exists and is a git repo.
4. **Target page is not dirty.** `git status --porcelain -- <target>` in the destination is empty. A committed hand edit is not a refusal: it is overwritten, and the destination commit message says the page had diverged.
5. **Render.** Frontmatter maps to the destination's shape: `title` and `description` pass through; `kind`, `status`, `published`, and `date` are dropped unless the destination's `frontmatter` map keeps them. The body is copied verbatim; relative links to other plan documents are rewritten to their published paths when those are published, and left as-is with a warning otherwise.
6. **Regenerate the index.** The destination's index page carries a marker pair; the block between them is rewritten from the pages present, newest first. Nothing outside the markers is touched.
7. **Commit in the destination.** `git add` the page and the index, commit with `publish: {title} (source {short source_commit})`, on the current branch. No push unless `--push`.
8. **Write provenance back** to the paper's frontmatter and commit it in the source repo as `chore(papers): publish {file} to {destination} ({short dest commit})`. Without this commit, step 2 would fail on the very next publish.

Rejected: editing the site's `.vitepress/config.mts` to add a nav entry. It is TypeScript, not data; a regex insert is the fragile write this codebase refuses elsewhere. The index page between markers is data the step owns entirely, and the nav needs one static link to it, made once by hand on first use.

Rejected: merging a hand-edited destination page. The destination is a build artifact under the like-code policy; a merge would make it a second source.

### 4. Destination configuration

```jsonc
"papers": {
	"destinations": [
		{
			"name": "blog",
			"path": "~/code/site",          // or "repo": "site" inside a workbench
			"dir": "writing",
			"index": "writing/index.md",
			"frontmatter": { "title": "title", "description": "description" }
		}
	]
}
```

`path` is expanded (`~`) and may be absolute or relative to the project root. `repo` is a name from `worktree.repos[]`, resolved through `readWorkbenchRepos` and `repoDir`; outside a workbench (`isWorkbench` false) a `repo` entry refuses with "only paths are accepted here". `ensurePapersConfig` runs from `update` and writes `{ "destinations": [] }` when the block is absent, keyed on block presence like `ensureCleanupConfig`. With no destinations configured, publish refuses naming the block, and the skill's instructions say to ask for one and write it into `config.json` itself.

### 5. The skill

`apps/indusk-mcp/skills/write.md`, name `write`, package-owned and synced like every skill. Prose only; no hooks, no gates. Its description names its triggers so plain-language requests route to it:

> Draft, outline, revise, review, or publish a paper, thesis, or essay that lives in a plan folder. Loads the plan's prose documents and nothing else. Use when the work is writing rather than code.

Named sections, each pinned by a text test: **Load** (register presence; read the plan folder's prose documents; skip lessons, health, extensions; say what was loaded), **Voice** (the sheet distilled from thesis.md), **Outline** (per-paragraph purpose, updated in the same turn the draft moves), **Stance** (AGENTS.md conduct plus let the user ask), **Read as the reader**, **Falsify the argument**, **Publish** (the documented command verbatim, the config block to write when none exists, and the hotfix path: commit in the plan, publish), and **What this skill does not do** (no gates, no per-typo brief, no push).

### 6. Admin UI

`Plan` gains `papers?: PaperSummary[]` from the shared parser (never re-parsed in the admin; the reuse rule). `PlanDetail` renders a **Papers** section: one collapsible Markdown render per paper with a status badge (`draft`, `accepted`, `published`, `published (stale)`, `malformed`), added to `ui/badge-variant.ts`. A papers-only plan renders the section and no error; a plan with no papers renders no section.

### 7. Dogfood, and the site's existing page

The Day plan's five prose documents that are papers in substance (`thesis.md`, `obsolescence.md`, `paper-1`, `paper-2`, `paper-3`) declare `kind: paper`; the outline, the shape, and the master do not. dusk's `config.json` gains the `blog` destination above. Paper 1 is published with the documented command. The site's existing thesis page stays: it is already published at a URL, the index lists it beside the papers, and retiring it is a later editorial call recorded in the paper set. The nav entry changes once, by hand, from the essay's direct link to `/writing/`.

## Alternatives Considered

### Infer papers from filenames (`paper-*.md`)
The thesis and the obsolescence piece would not match, and declaration over inference is the rule for everything InDusk reads from disk. Rejected.

### A `papers/` subfolder per plan
Moves nine existing documents and breaks every relative link between them, to gain nothing the frontmatter key does not. Rejected.

### A writing mode with hooks and gates
The paper's own thesis warns about layers added on layers, and yesterday's session needed none. A skill packages the two things that worked; gates would enforce nothing anyone has asked for. Rejected for now, revisitable if the skill is not enough.

### Provenance ledger under `.indusk/papers/`
Separates the fact from the document and adds an artifact that phantom detection, Shape's scope, cleanup, and `.gitattributes` would all have to learn. Rejected.

### Edit `.vitepress/config.mts` for nav
A regex write into TypeScript. Rejected in favor of a generated index page between markers plus one static nav link.

### Publish also pushes
Push is publication to the world and deploy runs on it. The step commits and stops; `--push` is explicit. Rejected as a default.

### Merge hand edits at the destination
Makes the destination a second source. Rejected; committed hand edits are overwritten with a note, uncommitted ones refuse.

## Consequences

### Positive
- Papers appear in every surface plans appear in, with honest stages and no "Create a brief" for a folder of essays.
- One documented command publishes; every site commit points at a plan commit; staleness is computed, not remembered.
- The skill costs nothing to add and nothing to run: prose, synced like every other skill.
- No hand edit can silently diverge the site from its source without the next publish either refusing or saying so.

### Negative
- Every publish adds a bookkeeping commit to the source repo.
- Existing documents must declare `kind: paper` by hand.
- One manual nav change on first use of a destination.
- The skill's effect on prose is untestable; only its presence is pinned.

### Risks
- **Writing into another repo's working tree.** Mitigated by refusing on any dirty target, committing only the two files it wrote, never pushing, and integration tests against a temporary destination for every refusal path.
- **Frontmatter write-back corrupting a paper.** Mitigated by round-tripping through gray-matter with the hash computed on the pre-write content, and a test that publishes twice and asserts the second run is a no-op.
- **Index markers missing at the destination.** The step refuses and prints the marker pair to add; it never appends to an index it cannot locate the block in.
- **Skill not invoked without the slash.** The description is the routing key; the manual assertion is re-run after any description change.

## Documentation Plan

### Pages
- New: `reference/skills/write.md`, the skill's sections and the publish command.
- New: `reference/cli/papers.md`, `indusk papers publish`, the config block, refusal cases, the index markers.
- Update: `reference/cli/plans.md`, the `paper` stage and `papers` field in `list_plans`.
- Update: `reference/admin-ui/overview.md`, the Papers section and its badges.

### Diagrams
- Sequence of a publish (preconditions, render, index, destination commit, provenance commit) as Mermaid in `reference/cli/papers.md`.

### Changelog
- "Papers are first-class plan documents (`kind: paper`); `/write` skill; `indusk papers publish` to configured destinations with provenance and staleness."

### ADR in Docs
- Yes: `decisions/writing-skill.md`.

## References
- [brief.md](brief.md), [test-plan.md](test-plan.md)
- The Day papers: [indusk-v4-day/papers-outline.md](../indusk-v4-day/papers-outline.md)
- Lessons: tested-is-not-reachable-run-the-documented-command; quarantine-instead-of-silent-overwrite; one-resolution-function-per-shared-relationship; point-the-tool-at-itself-before-calling-it-done
- Plan-grouping precedent for declared structure: `/decisions/dawn-ui-plan-grouping`
