# `indusk plans`

A plan's lifecycle from start to landing — `start`, `approve`, `accept`, `land` (admin-plan-authoring) — and planning housekeeping, `archive-dead` (indusk-makeover).

## A plan's lifecycle

A plan is written on its own branch, in its own worktree. Its documents and declared promises reach the trunk when it is approved; its build reaches the trunk only after it is accepted. The admin, the skills and the terminal all call these same four commands.

```bash
indusk plans start <type> <name>    # its branch, its worktree, its first document
indusk plans approve <name>         # the brief check, then its documents merge to the trunk
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

#### In a workbench: `plans start <type> <name> [--repo <repo>]`

A workbench keeps its plans at the workbench root and its code in the repos it declares. There:
- **the documents** go at the workbench root, on the root's own branch, and the first one is committed there (the root's sync loop pushes it);
- **the code** gets a worktree in the repo, on `plan/<name>`. It is made through the worktree extension's setup script when the workbench configures the repo (`.indusk/worktree-configs/<repo>.json`), so the repo's overlays and env apply; otherwise it is a plain `git worktree add`;
- **`.indusk/planning/<name>/code.json`** links the two: `{ repo, branch, worktree }`, the worktree relative to the root. Every later step reads it. A code file naming a worktree that is gone is reported by name, never guessed.

`--repo` names the repo when the workbench wraps more than one. Without it, starting is refused, listing the repos. With one repo, it is that repo.

A code worktree inside the root that the root's ignore rules don't already cover gets an ignore line, committed with the plan, so sync never sweeps it into the root's history.

### `plans approve <name>`

Runs the brief check [`promises contract`](/reference/cli/promises) runs, on the worktree's copy; sets the impl's `status: approved` and commits it on the branch; merges the branch into the trunk with a merge commit. The build then continues in the same worktree on the same branch.

Refuses:

- a brief the check refuses, with the check's message;
- a branch that already changes anything outside `.indusk/`, naming the files — it is past approval;
- uncommitted changes in the worktree;
- uncommitted changes on the trunk on any path the merge would bring in (never stashed), other than InDusk's bookkeeping.

### InDusk's bookkeeping on the trunk

The evaluator, the highlight tool and the session sections write into the trunk's working tree and nothing else commits them: `.indusk/current.md`, `.indusk/highlights.jsonl`, `.indusk/highlights-processed.jsonl`, `.indusk/eval/` and `.claude/lessons/`. `approve` and `land` commit whatever of these is uncommitted, in a commit of its own (`chore(indusk): bookkeeping, committed before …`), then check the trunk. Anything else uncommitted there may be someone's real work: it is refused, named, and listed by `plans review` as *uncommitted on main* so the person sorts it out before accepting.

### `plans accept <name> [--auto]`

Writes `accepted: <time>` and `accepted_by: person` (or `auto`, with `--auto`: a workflow that accepts on its own) to the impl's frontmatter and commits it on the branch.

Refused inside a build step. An unattended build runs each step (work, falsify, cleanup) with `INDUSK_BUILD_STEP` set to the step, and `accept` and `land` refuse under it, naming the step: a build stops at review, and acceptance is the person's. The release session that acceptance starts is not marked, so it lands. This stops a confused session, not a determined one: a session that unsets the variable is not stopped.

### `plans next <name> [--json]`

What an unattended build does next, read from the plan as it stands — its worktree while it has one. It writes nothing; the build runner asks it after every step, and a person can ask it too.

| Answer | When |
|---|---|
| `work` | a phase is open — an impl phase, or a falsification or cleanup phase; names the phase |
| `falsify` | every phase is closed and no falsification phase or skip exists |
| `cleanup` | falsification is closed and no cleanup phase or skip exists |
| `judgement` | the open phase's next item is one the plan declared for a person — a Deferred Verification row, a manual or visual check; names the item |
| `review` | every phase, the falsification and the cleanup are closed. Never `retrospective`: that waits for acceptance |
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

