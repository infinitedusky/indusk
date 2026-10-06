---
title: "Workbench plan authoring"
date: 2026-10-06
status: proposed
---

# Workbench plan authoring

## Goal

**The admin's plan flow works in a workbench, and a repo has one contract.**
New plan, approve, build, review, accept and land all work in a workbench,
with the plan at the workbench root and its code on a branch in the repo it
names. A repo's promises live in the repo once it accepts them, and in the
workbench's versioned shadow contract until then.

## Y-Statement

**In the context of:**
1.63.0's plan commands and admin, all built for normal-mode projects; eight
of Sandy's sixteen projects are workbenches. A workbench root is its own git
repo that a sync loop commits and pushes on every edit, on whatever branch is
checked out. `resolveExecutionRoots` already splits a plan root from a code
root for `indusk run`, `verify` and `cleanup`.

**Facing:**
- `plans start` refuses in a workbench, and every later verb refuses through
  `planBranch`;
- nothing records which code worktree belongs to which plan;
- the promise registry lives in the workbench, while the code that names the
  promises lives in the repo, so two workbenches on one repo could define
  one promise twice.

**We decided for:**
- plan documents at the workbench root, on its main branch, and the code on
  `plan/<name>` in the repo the plan names;
- the link between them kept in one small file in the plan's folder;
- one contract resolver that every promise reader uses: the repo's own
  `.indusk/promises/` when it exists, otherwise the workbench's;
- build sessions started at the workbench root, with the code worktree added
  as a second writable directory.

**And against:**
- a plan branch at the workbench root, which sync would commit and push;
- reusing the plan-worktree record, which lives in one repository's git
  directory and is inert in a workbench by design;
- reading both contracts and merging them.

**To achieve:**
`a-plan-knows-its-code` and `a-project-has-one-contract`, and the three
promises the brief changes to cover workbenches.

**Accepting that:**
- a workbench plan's documents and its code have two histories, joined only
  by the plan's code file;
- a promise declared by a plan whose repo holds a contract lands only with
  that plan's code.

## Context

[Research](research.md) maps the code. The brief's decisions, taken with
Sandy:
- documents at the root on main;
- the repo picked at New plan;
- one contract, kept with the code.

## Decision

**D1 — A workbench plan is documents at the root and code in a repo.** `plans
start <type> <name> [--repo <repo>]` in a workbench:
- writes the first document at the workbench root and commits it there;
- makes the code worktree in the named repo, on `plan/<name>`, through the
  worktree extension's setup script, so the repo's overlays, env and
  post-create steps apply as they do for `indusk worktree create`;
- needs `--repo` when the workbench declares more than one repo, and
  otherwise refuses, naming them;
- refuses, naming which, when the name already has a folder at the root or a
  branch in the repo.

Normal mode is unchanged.

**D2 — The plan's code file: `.indusk/planning/<plan>/code.json`.**
- **Shape:** `{ repo, branch, worktree }`, with `worktree` relative to the
  workbench root.
- **Written** by `plans start`.
- **Read** by one function, `readPlanCode(root, plan)`. It returns the code
  root, or a problem when the file is malformed or names a worktree that is
  gone. It never guesses by name.
- **Why a file in the folder:** it is a plan document, so it is versioned and
  synced at the root with the rest of the plan, and the admin reads it the
  way it reads the plan's other files.
- `resolveExecutionRoots` gains the plan as an input: for a workbench plan,
  the code root is its code worktree. Multi-repo workbenches stop refusing
  once a plan names its repo.

**D3 — Approving a workbench plan merges nothing.** `plans approve`:
- runs the brief check, as in normal mode;
- refuses with the check's message when it refuses;
- otherwise sets `status: approved` and commits that at the root.

**D4 — One contract resolver.** `promisesDir` becomes `contractDir(root, plan?)`:
- **normal mode:** the project's own `.indusk/promises/`;
- **workbench:** the plan's repo's `.indusk/promises/` (the code worktree's
  copy for a plan in flight) when that repo holds one, otherwise the
  workbench's shadow contract.

Every reader goes through it: the registry, `promises check`, `status`,
`watch`, the plan commands, the MCP tools and the admin. A single-definition
test refuses any other path to the folder. A promise declared by a plan whose
repo holds a contract is written in its code worktree, so it lands with the
code.

**D5 — A build session starts at the root and also writes the code.** It runs
with:
- its working directory at the workbench root, so the workbench's hooks judge
  every checkoff;
- `--add-dir <code worktree>`, so the code is reachable.

`decideBuildPermission` allows a write inside either root and refuses
anything else. Planning sessions start the same way.

**D6 — The review reads the repo.** A workbench plan's changed files and
uncommitted trunk work come from its repo: the code branch against that
repo's trunk branch, read with `currentTrunkBranch(repoTrunk)`.

**D7 — Landing merges in the repo and archives at the root.** `plans land`:
- refuses an unaccepted plan;
- merges the repo's trunk into the code branch;
- runs the land checks in the code worktree;
- merges the code branch into the repo's trunk with `--no-ff`;
- removes the code worktree and deletes its branch.

The retrospective archives the plan at the root, as in normal mode, and the
archive commit is the root's.

**D8 — The plan commands commit their own writes at the root.**
- Each write at the root is committed at once, under a plain message
  (`plan(<name>): approved`).
- Sync carries those commits and pushes them.
- The trunk check before a landing applies to the repo's trunk, not the
  root, which sync keeps committed.

**D9 — The admin shows a workbench plan's actions.**
- **The plan reader** exposes the plan's code file. Continue planning,
  Approve, Build and Review are offered from it where a normal-mode plan
  uses its worktree.
- **New plan** lists the workbench's repos and asks for one when there is
  more than one.

## Alternatives Considered

### A plan branch at the workbench root

Mirrors normal mode: documents on `plan/<name>` at the root, merged at
approve. Sync commits and pushes whatever branch is checked out, so the
branch would be pushed on every edit. Each plan would also need its own
worktree of the workbench repo, beside the code worktree. Sandy chose the
root's main.

### The plan-worktree record

It lives in a repository's git common directory and is written under a lock.
In a workbench there are two repositories. The record is inert there by design
(`plan-worktree-record.ts:37`), and the link belongs with the plan, which
lives at the root.

### A key in the brief's frontmatter

Visible, but the first document is a brief or a research note depending on
the workflow, and status edits rewrite that frontmatter. A file of its own
has one writer.

### Reading both contracts

A repo's contract taking precedence over the workbench's, merged by name.
That is exactly the two-definitions problem the brief exists to end
("A promise is never read from both").

## Consequences

- Multi-repo workbenches can run `indusk run`, `verify` and `cleanup` for a
  plan that names its repo.
- A workbench whose repo has no contract keeps working as today, on the
  shadow contract.
- Moving a shadow contract into the repo is the next plan.

## Documentation Plan

- `reference/cli/plans.md`: `--repo`, the code file, approve and land in a
  workbench.
- `guide/workbench-sharing.md` or a new `guide/contract.md`: one contract
  per repo, the shadow contract, and how a repo adopts it.
- `reference/admin-ui/sessions.md`: New plan's repo picker; sessions
  starting at the root.
