# `indusk plans`

A plan's lifecycle from start to landing — `start`, `approve`, `accept`, `land` (admin-plan-authoring) — and planning housekeeping, `archive-dead` (indusk-makeover).

## A plan's lifecycle

A plan is written on its own branch, in its own worktree. Its documents and declared promises reach the trunk when it is approved; its build reaches the trunk only after it is accepted. The admin, the skills and the terminal all call these same four commands.

```bash
indusk plans start <type> <name>    # its branch, its worktree, its first document
indusk plans approve <name>         # the brief check, then its documents merge to the trunk
indusk plans reapprove <name>       # a person approves an amendment; an agent's call is refused
indusk plans accept <name> [--auto] # the build may ship
indusk plans land <name>            # the build reaches the trunk; worktree and branch removed
```

Every command acts on the plan's worktree, from any checkout of the project. Each refusal names what it refused, prints `Refused: …` and exits 1, with nothing written.

### `plans start <type> <name>`

Creates `plan/<name>` from the trunk branch, its worktree at `<project>-worktrees/<name>`, and the assignment that tells every reader where the plan lives — the admin and the plan tools read it from there even though the trunk has no folder for it. Writes and commits the first document in the worktree: `brief.md`, or `research.md` for a spike, as a draft declaring `workflow: <type>`. Nothing is written on the trunk.

Refuses:

- a `<type>` that is not `feature`, `bugfix`, `refactor` or `spike`;
- a name already started, naming its worktree;
- a name with a folder on the trunk, naming the folder;
- a name whose branch `plan/<name>` already exists.

#### `plans start <type> <name> --from-draft <id>`

Makes the plan from a draft conversation (`drafts/<id>/` in the project's home, see [Briefs](/guide/briefs#starting-a-plan-a-conversation)) instead of an empty first document: the draft's `brief.md` becomes the plan's, under the front matter that declares `workflow: <type>`, and the draft is removed once the plan exists. A draft that made research alone becomes a `spike` with `research.md` and no brief, whatever type is given. `<type>` and `<name>` are the person's, over the agent's proposal in `proposal.json`. Refuses, with the draft kept:

- a draft that does not exist in this project;
- a name already taken (the same refusals as `plans start`), adding "choose another name for this draft";
- a draft that has said nothing yet.

`plans start` without the flag is unchanged. The admin's Accept button calls the same step.

#### In a workbench: `plans start <type> <name> [--repo <repo>]`

A workbench keeps its plans at the workbench root and its code in the repos it declares. There:
- **the documents** go at the workbench root, on the root's own branch, and the first one is committed there (the root's sync loop pushes it);
- **the code** gets a worktree in the repo, on `plan/<name>`. It is made through the worktree extension's setup script when the workbench configures the repo (`.indusk/worktree-configs/<repo>.json`), so the repo's overlays and env apply; otherwise it is a plain `git worktree add`;
- **`.indusk/planning/<name>/code.json`** links the two: `{ repo, branch, worktree }`, the worktree relative to the root. Every later step reads it. A code file naming a worktree that is gone is reported by name, never guessed.

`--repo` names the repo when the workbench wraps more than one. Without it, starting is refused, listing the repos. With one repo, it is that repo.

A code worktree inside the root that the root's ignore rules don't already cover gets an ignore line, committed with the plan, so sync never sweeps it into the root's history.

### `plans approve <name>`

Runs the brief check [`promises contract`](/reference/cli/promises) runs, on the worktree's copy, then refuses, naming each, any look the brief's `## Looks` makes, changes or replaces that is not drawn as a mockup, or not approved, in that worktree's record. No name is exempt: a new component is named by its own mockup, approved now, and its story is approved against it during the build. It sets the impl's `status: approved` and records what was approved, `approved_brief` (the sha256 of `brief.md`), `approved_by` and `approved_at`, and commits it on the branch; merges the branch into the trunk with a merge commit. The build then continues in the same worktree on the same branch.

Refuses:

- a brief the check refuses, with the check's message;
- a branch that already changes anything outside `.indusk/`, naming the files — it is past approval;
- uncommitted changes in the worktree;
- uncommitted changes on the trunk on any path the merge would bring in (never stashed), other than InDusk's bookkeeping.

### InDusk's bookkeeping on the trunk

InDusk commits its own notes on `main` as it writes them (`.indusk/current.md` and `.claude/lessons/`), and keeps its machine state outside every checkout, in the project's home. A note it could not commit (the trunk was off its branch or mid-merge), or a project not yet moved by `indusk update`, still leaves these in the trunk's working tree: `.indusk/current.md`, `.indusk/highlights.jsonl`, `.indusk/highlights-processed.jsonl`, `.indusk/eval/` and `.claude/lessons/`. `approve` and `land` commit whatever of these is uncommitted, in a commit of its own (`chore(indusk): bookkeeping, committed before …`), then check the trunk. Anything else uncommitted there may be someone's real work: it is refused, named, and listed by `plans review` as *uncommitted on main* so the person sorts it out before accepting.

### What counts as an amendment

What a person approved is the brief. An **amendment** is the brief's difference from it: an expectation, a promise or a look the brief says now that it did not say at approval, or says differently, and a promise the plan owns whose statement in the registry has moved to a sentence the approved brief did not state. A statement brought to what the brief's **Changes** already said (`indusk promises change` doing what was agreed) is the build keeping the contract, not an amendment. Edits to the test plan, the ADR, the impl, its notes and Shape findings are never amendments: they are the agent's to change.

What was approved is read from git, at the approval commit — `plan(<name>): impl approved` from `approve` (in a workbench, `plan(<name>): approved`) or `plan(<name>): amendment approved` from `reapprove`, whichever is newest — and held to the impl's `approved_brief`. An impl that records no `approved_brief` was approved before the record existed and has no amendments.

While an amendment waits, `check-gates` refuses to check off any build item, naming each amendment with what it was and what it is now (`lesson: a-plan-builds-only-after-approval`). The way on is the person's: Approve on the plan's page in the cockpit, or `plans reapprove` run by the person — or put the brief back as it was approved.

### `plans amendments <name> [--dir <folder>] [--json]`

Lists the amendments waiting, each as `part name: was "…" — now "…"`, or says nothing waits. `--json` prints the list (`[{part, name, was, now}]`) — what `check-gates` reads; `--dir` names the plan folder the caller means, otherwise the plan's live copy is read. Refused, exit 1, when what was approved cannot be told: no approval commit on the branch, or one whose brief is not the `approved_brief` recorded — never read as "nothing changed".

### `plans reapprove <name>`

The person approves the amendments an approved plan waits on. Refused before approval — that is `approve`'s, which also merges, and refuses a branch past approval. Runs the brief check and the looks check `approve` runs (an amendment that names a look waits for that look's approval), records the brief as the one approved (`approved_brief`, `approved_by`, `approved_at`), commits the impl, the brief and the promises the amendments changed on the plan's branch as `plan(<name>): amendment approved`, and appends each amendment to the plan's history (`.indusk/plan-history/<name>.md`, on `main`) as `amendment to the <part> <name>: was …, now …`, answered *Approve*, with who and when. Nothing waiting and the brief unchanged: nothing is written. `plans review` then shows each approved amendment, both versions, beside any still waiting.

The cockpit's Approve calls `POST /api/plans/<name>/reapprove`, which answers only the person's browser on the admin's own page (`Sec-Fetch-Site: same-origin`, as the look approval does); a script or an agent's request is refused. Run from a terminal it is the person's: an agent's command that runs `plans reapprove` (including inside a `$(…)`, backtick or `<(…)` substitution, even under `echo` or `cat`), calls the package's `reapprovePlan` through an interpreter (`node -e`, `tsx -e`), or names that route, is refused by the looks guard (`looks-approval-guard.js`, `promise: only-a-person-reapproves`), saying only a person re-approves — a tripwire on the command's text, as the look approval's is.

### `plans accept <name> [--auto]`

Writes `accepted: <time>` and `accepted_by: person` (or `auto`, with `--auto`: a workflow that accepts on its own) to the impl's frontmatter and commits it on the branch.

Refused, naming each, while the branch changed files under an app's interface and the brief lists no look, and while a new component the brief names has not ended in a story: its own mockup (`screens/<component>.<state>.html`, declaring itself in `indusk-new-components`) has no approved story of the same name, or a mockup the brief names still draws a component inline under that declaration, or composes one whose story is not approved. The way forward: approve each story on the cockpit's Looks page, place the component with `<indusk-component>` in each mockup that draws it, and have those mockups approved again.

Refused inside a build step. An unattended build runs each step (work, falsify, cleanup, audit) with `INDUSK_BUILD_STEP` set to the step, and `accept` and `land` refuse under it, naming the step: a build stops at review, and acceptance is the person's. The release session that acceptance starts is not marked, so it lands. This stops a confused session, not a determined one: a session that unsets the variable is not stopped.

### `plans model <name> --phase <ref> | --step <step>`

`--step <step>` answers a step's default tier instead of a phase's — `plan`, `work`, `falsify`, `cleanup`, `audit` or `retrospective` — with no phase override; `/audit` reads it to pick the auditor's model. `--phase` and `--step` together are refused, as is a step that has no tier, naming it.

With `--phase`, prints the tier and model a phase is built on, as `<tier> <model>` (`med sonnet`), or `session` when the project names no model for it. `<ref>` is `Build Phase 1`, `Test Phase 1`, or a bare number for a build phase. The phase's own `**Tier**:` line wins; otherwise the `work` step's default tier from the config applies. `/work` reads this before each phase and hands the phase to a subagent on that model.

### `plans audit-inputs <name> [--approved <sha>]`

What the auditor is handed, as JSON, read from the plan's worktree and branch (a workbench plan: its documents and approval at the workbench root, its diff and tree from the repo its code file names). It writes nothing. Nothing from the session is in it: no research, no `current.md`, no conversation.

| Field | What it holds |
|---|---|
| `documents` | the plan's `brief`, `testPlan` and (when there is one) `adr`, each as `{ path, text }` |
| `implAsApproved` | the impl as the approval left it, read with `git show`; its `path` is `<sha>:<file>`, the spelling `git show` reads, so it cannot be mistaken for the working file — none of the falsification or cleanup phases appended since, because git holds the impl from before them |
| `trajectoryNow` | the `## Test Trajectory` section of the impl as it stands, every row in its final state; the only field whose `path` is the working `impl.md` |
| `diff` | `git diff <merge-base>...<branch>` over the branch's paths, leaving out everything under `.indusk/`: the plan's documents are handed whole, and its folder's diff since approval is the builder's own falsification and cleanup notes |
| `stat` | `git diff --stat <merge-base>...<branch>`: the files the plan changed |
| `tree` | `git ls-tree -r --name-only <branch>` less `.indusk/`: every tracked file, including the ones the plan did not touch, for the question of what else each promise needs |
| `approvedAt` | the approval commit the impl was read at |

The approval is the first-parent merge on the trunk whose subject starts `plan(<name>): approved` — for a workbench plan, the plain commit of that subject on the workbench root's branch, since `plans approve` merges nothing there. A plan with no such commit is refused, naming the plan: an audit of an unapproved plan has no impl "as approved". When history was rewritten and the subject cannot be found, `--approved <sha>` names the merge by hand.

### `plans next-session <name>`

Prints the command to run in a new session for the plan's next piece of work, decided the way `plans next` decides it:

- the next open phase: `In a new session, run: /work <name> — next is Build Phase 2, on strong (opus)` (the tier and model appear when the config names them);
- every phase closed: `/falsify`, then `/cleanup`, then `/audit`, then `/retrospective`, in that order — `/audit` until the plan folder holds `audit.md` or the impl skips the audit with `audit: skipped` and `audit_reason`;
- a phase with a `blocker:` line, a phase waiting on a person (a manual or deferred-verification item), or a finished build with trajectory rows still open: the blocker, the item or the rows themselves, instead of a command — there is nothing to start yet.

`plans approve` ends with the same line, and `/work` prints it at each phase close, so a session ends at the plan boundary instead of compacting across plans. It reads the plan from its worktree while it has one, and falls back to `/work <name>` when the plan cannot be read.

### `plans next <name> [--json]`

What an unattended build does next, read from the plan as it stands — its worktree while it has one. It writes nothing; the build runner asks it after every step, and a person can ask it too.

| Answer | When |
|---|---|
| `work` | a phase is open — an impl phase, or a falsification or cleanup phase; names the phase |
| `falsify` | every phase is closed and no falsification phase or skip exists |
| `cleanup` | falsification is closed and no cleanup phase or skip exists |
| `audit` | the cleanup is closed and the plan folder has no `audit.md`, nor does the impl carry `audit: skipped` with an `audit_reason`. The runner runs `/audit <name>` as a step; what `audit.md` says is never read |
| `shorten-reason` | every phase is closed and a ritual (falsification, cleanup or audit) is skipped with a reason over one sentence or 120 characters. Answered before that ritual's own step, so a skip is never turned into a full run; the runner starts a session that rewrites that one `<ritual>_reason` line, changes nothing else and commits. Names the ritual, the reason's length and sentence count |
| `judgement` | the open phase's next item is one the plan declared for a person — a Deferred Verification row, a manual or visual check; names the item |
| `review` | every phase, the falsification and the cleanup are closed, and the audit written or skipped. Never `retrospective`: that waits for acceptance |
| `cannot continue` | the open phase has a `blocker:` line; or every phase is closed while a row is not terminal. The runner adds two of its own: the step's session ended in an error after its retries, or two steps in a row made no progress |

Judgement items are recognised by the same rule [`indusk run`](/reference/cli/run) pauses on. With `--json` it prints `{"step": …}` with the phase, item or reason; without, a sentence.

### `plans review <name> [--json]`

What a person reads before accepting a built plan, assembled from its documents and its branch. The admin's review panel renders the JSON.

- **Promises** — each promise the brief makes, with the rows naming it and their states. A promise is *proven* when every row naming it passes and names a test file — the same reading `indusk promises confirm` applies at close, so the review never calls proven what the close would refuse. An unproven one says why.
- **Falsification** — each falsification phase: the rows it added (what it looked for) and its fix items (what it changed).
- **Files** — what the plan's branch changed against the trunk branch since they diverged. Empty for a plan with no worktree.
- **Skips** — every gate item marked skipped rather than done, with its text, so its reason is read.

### `plans land <name>`

The one way a plan's build reaches the trunk. Merges the trunk into the branch, runs the project's checks in the worktree, merges the branch into the trunk with a merge commit, releases the assignment, removes the worktree and deletes the branch. The retrospective's landing step calls it.

The checks are `plans.land_checks` in `.indusk/config.json`, each a shell command run in the worktree; none run when the key is absent.

```json
{ "plans": { "land_checks": ["pnpm test"] } }
```

Refuses:

- a plan with no `accepted` — accept it first;
- a call from inside a build step (`INDUSK_BUILD_STEP`), naming the step;
- uncommitted changes in the worktree;
- a conflict bringing the trunk into the branch (the merge is aborted);
- a failing check, naming it;
- uncommitted changes on the trunk on the paths the plan touches, other than InDusk's bookkeeping, which it commits first.

### In a workbench: approve, accept, review and land

A workbench plan's documents are already at the workbench root, and its code is on a branch in the repo its `code.json` names. So:
- **`approve`** runs the same brief check and looks check (a look the brief names that is still proposed refuses it, read from the mockups at the root), then marks the impl `status: approved`, records the brief's hash as above, and commits the plan's documents (and the workbench's shadow contract) at the root. Nothing is merged.
- **`accept`** runs the same interface and story checks, the diff read from the code repo's branch and the looks from the root's mockups, then records `accepted` in the impl at the root and commits it there. **`reapprove`** runs the looks check too.
- **`review`** lists the files the code branch changed in its repo, against the repo's trunk branch, and any uncommitted work on that trunk on those paths.
- **`land`** refuses an unaccepted plan. Otherwise it brings the repo's trunk into the code branch, runs the land checks in the code worktree, and merges the branch into the repo's trunk with a merge commit. Then it removes the code worktree and branch. The documents stay at the root, where the retrospective archives them.

Every one of these reads the plan's code from `code.json`. A code file that names a worktree that is gone is refused by name.

## Housekeeping

### `plans archive-dead`

```bash
indusk plans archive-dead [--dry-run]
```

Moves **dead-draft** plans to `.indusk/planning/archive/` — the directory is moved intact; nothing is ever deleted or overwritten (a name collision with an existing archive entry is a skip, reported with a reason).

A plan is a dead draft only when **all three** hold:

1. **No document carries a status beyond draft.** Blocking statuses: `accepted`, `approved`, `in-progress`, `completed`, `complete`, `proposed`. Eligible: `draft`, `abandoned` (terminal — archive is where it belongs), or no status at all. A document whose frontmatter fails to parse **blocks** archiving — conservative on bad input.
2. **The newest file in the plan directory is older than `planning.dead_draft_days`** (default 30; configured in `.indusk/config.json`).
3. **master.md does not protect it.** A markdown link to the plan on a master.md line that does *not* contain the word "draft" protects it — so a `parked — revisit with v2` row protects its plan, while a `brief draft` row leaves it archivable.

Draft conversations age out in the same pass: a draft in the project's home untouched for `drafts.max_age_days` (default 30) is discarded, and `--dry-run` says which would be.

`--dry-run` prints the candidate list and skip reasons without moving anything. Always review the dry-run before the first real run on a project with a large backlog.

## Configuration

```json
{
  "planning": {
    "dead_draft_days": 30
  }
}
```

Absent field → 30-day default. `indusk update` scaffolds the key idempotently.

```json
{
  "drafts": {
    "max_age_days": 30
  }
}
```

`drafts.max_age_days` is the age at which `plans archive-dead` archives an untouched draft conversation, moving it to `drafts/archive/<id>/` in the project's home with what it held; absent, 30. A discard from the page still deletes.

## Tiers and models

```json
{
  "workflow": {
    "tiers": { "strong": "opus", "med": "sonnet", "weak": "haiku", "baby": "haiku" },
    "steps": {
      "plan": { "tier": "strong" },
      "work": { "tier": "med" },
      "falsify": { "tier": "strong" },
      "cleanup": { "tier": "med" },
      "audit": { "tier": "strong" },
      "retrospective": { "tier": "weak" }
    }
  }
}
```

`workflow.tiers` maps each tier to a model alias that Claude Code's Agent `model` accepts (`opus`, `sonnet`, `haiku`, `fable`). `workflow.steps.<step>.tier` gives each step's default. Changing a model here changes the next phase built; no plan is edited. A key that is not a tier, or a step InDusk does not read, is refused naming it. With no tiers configured, every phase runs on the session's own model.

A build started from the admin runs each step's session on its tier's model too: a `work` step on its phase's model (the `**Tier**:` line, or the `work` default), `falsify`, `cleanup`, `audit` and `retrospective` on their step's default. With no tiers, no model is passed and the session runs on `claude`'s own. A tier the config has no model for fails the step with that message.

A phase in an impl may name a different tier:

```markdown
### Build Phase 2: Rewrite the command runner

**Tier**: strong — rewrites how commands run
```

The impl validator refuses a tier that is not strong, med, weak or baby, and refuses a tier other than the `work` default that gives no reason. It also refuses a phase with more than one `**Tier**:` line (an escalation replaces the line), and, once the config names any tiers, a tier with no model in `workflow.tiers`. `plans model` refuses the same cases, naming the cause, rather than answering `session`.

## Relationship to the sweep

`plans archive-dead` and [`agent sweep`](/reference/cli/agent#agent-sweep) are the two halves of InDusk's decay layer (see the [indusk-makeover decision](/decisions/indusk-makeover)): plans and operational state both accumulate append-only, and these commands give each an owner. Both archive rather than delete, both run from the catchup/handoff rhythm, and both are safe to invoke manually at any time.

## Plan hierarchy (parents and subplans)

Plans are flat folders under `.indusk/planning/` — parents and children are all siblings on disk. Hierarchy is **declared in frontmatter**, not expressed by nesting, so moving a plan under a different parent is a one-line edit rather than a directory move that breaks links and history.

Declaration flows **top-down only**:

```yaml
# .indusk/planning/master.md — the root sequence
---
parents:
  - indusk-v2-dawn        # folders that own subplans
roadmap:
  - indusk-v2-dawn        # top-level display order; unlisted plans follow
  - local-telemetry
---
```

```yaml
# .indusk/planning/indusk-v2-dawn/master.md — one parent's children
---
subplans:
  - dawn-ui-plan-grouping
  - dawn-external-orchestrator
  - dawn-verify
---
```

A child declares **nothing** about its lineage. Only one place declares each parent→child link, so the two sides can never disagree and there is no drift to reconcile.

### Two rules that keep it safe

**The inventory comes from disk.** The filesystem is the list of plans; `parents:` / `roadmap:` / `subplans:` only add structure over it. A declaration can group plans — it can never subtract one. A plan named by no declaration appears at the top level, exactly as before.

**Broken declarations degrade, never fail.** A missing `master.md`, an absent key, a non-array value, or malformed YAML each yield empty declarations and the flat list. Losing structure is acceptable; losing a plan is not.

### Name hygiene

Declaration names are boundary values — they get joined into filesystem paths and rendered verbatim, so the parser guards them on the way in:

- A name that isn't a single clean path segment (contains `/` or `\`, or is `.` / `..` / blank) is **dropped** from `parents:`, `roadmap:`, and `subplans:` alike. A traversal name can never cause a read outside the planning directory.
- Duplicate names in one list collapse to the **first occurrence**, preserving declared order — a child is never rendered twice.

Both are silent degrades, consistent with the rule above: a bad name loses its structure, never a plan.

### Declared-but-uncreated subplans

A parent may name a subplan whose folder doesn't exist yet — that is the **normal** case for a sequence, not an error. Those entries render in the admin sidebar as greyed placeholders, so the plan list shows work queued ahead as well as work underway.

A subplan whose folder has moved to `archive/` is the opposite of uncreated — it renders as a navigable item with its real status, never as a placeholder. If the same name somehow exists both active and archived, the active copy wins.

### API

`readPlanDeclarations(planningDir)` in `apps/indusk-mcp/src/lib/plan-parser.ts` returns `{ parents, roadmap, subplans }`. It is exported for consumers at `@infinitedusky/indusk-mcp/planning/plan-parser` — the admin UI consumes it rather than re-reading frontmatter, per the never-duplicate-parsing rule.

## Papers (`kind: paper`)

A document that declares `kind: paper` in its frontmatter is a paper: a
thesis, an essay, a shape document, any prose that belongs to the plan.
Declared, never inferred from a filename, because nothing about a name says
whether a document is a paper.

- Every paper in a folder appears under the plan's `papers` field in
  `list_plans`, as `{ file, title, status, stale }`, in filename order.
- A folder with lifecycle documents keeps its lifecycle stage; the papers
  ride alongside. A folder with papers and **no** lifecycle document is a
  **`paper`-stage plan**. Before this, such a folder read as `unknown` with
  next step "Create a brief", which is wrong for a folder of finished essays.
- **Status vocabulary**: `draft`, `accepted`, `published`. Anything else
  reports `malformed`, and the next step names the file. A paper is never
  silently read as a draft.
- A `paper`-stage plan's `stageStatus` is the least-advanced paper's status,
  with `malformed` outranking everything so it surfaces. Its next step is one
  of `Fix paper status in <file>`, `Review paper: <file>`, `Publish n
  paper(s)`, or `Done`.
- **Staleness is derived, never stored.** A publish records `published.hash`,
  the SHA-256 of the document with `status` and the `published` block
  removed (so writing either back does not change the hash). Every read
  recomputes it; a mismatch, or a `published` paper with no recorded hash,
  reads `stale: true` and displays as `published (stale)`. It reports only.
  The ordinary state between a plan commit and its publish is stale, and the
  publish clears it.
- `list_plans { active: true }` counts a `paper`-stage plan as active while
  its least-advanced paper is `draft` or `accepted`. Every paper published is
  done, even if one has gone stale since; the next step still says
  `Publish`, but a finished plan is not resurrected into the active list by a
  hotfix.

Publishing a paper to a destination outside the repo is `indusk papers
publish`; the ADR is `.indusk/planning/archive/writing-skill/adr.md`.

