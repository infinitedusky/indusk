# New project flow — a project starts as a conversation in the admin

**Decided 2026-10-14.** Full ADR: `.indusk/planning/new-project-flow/adr.md`.

## Goal

**A person starts a new project from the admin by talking, and gets a laid-out, InDusk-installed project with its founding brief, without typing a command.**

Today a project exists only after someone runs `git init`, `indusk init` (or
`indusk setup`) and writes its first documents by hand; the admin's home page
can only say "Run `indusk init`". Building Homework Gate this way took a
hand-written layout `indusk setup` cannot produce, a hand rewrite of the
worktree config, and a founding document with no home (research.md, entries
13–17).

## Y-Statement

**In the context of:**
the admin's existing plan conversation — a draft held outside the repository, an agent session launched by the package's session manager, a proposal accepted into a plan — and a project that does not exist yet.

**Facing:**
an admin that may start a process only through the package (`admin-uses-package-commands.test.ts`), an `init` that exits the process and writes to the console, draft storage keyed by a project that is not there, a layout `indusk setup` does not make, and a parent directory nothing configures.

**We decided for:**
a project draft at `~/.indusk/new-projects/<id>/`, talked through the existing session manager with a new-project prompt, under top-level routes `/new` and `/new/<id>`; a package module `lib/new-project/` with a CLI `indusk new-project` (`start`, `add`, `accept`, `discard`, `parent`) that the admin's routes call through the package like `./drafts`; creation that runs the package's own `indusk init` as a child process inside a workbench it lays out (repository inside, `worktrees/` beside, `repos[]` config), writes the founding brief, master plan and the person's documents, records declines and turned-off documents in the project's config, and runs `gh` only when the proposal confirms the remote.

**And against:**
reusing plan drafts (their home is a project's bookkeeping folder, which a new project lacks); calling `init()` in the daemon (it calls `process.exit` and logs to the console); `indusk setup` (it makes a sibling-symlink layout, not the standard one); putting the flow under `/p/<project>` (its layout renders a stale-project page with no project); and a parent directory guessed from registered projects (a wrong guess writes somewhere the person did not choose).

**To achieve:**
one conversation from idea to project, the standard layout every time, and nothing on disk or off the machine the person did not accept.

**Accepting:**
a second kind of draft beside plan drafts, a config key for declines and one for turned-off documents that the planning rules must now read, and a child `indusk init` per creation.

**Because:**
the plan conversation already solves talking, storing and accepting; the only new parts are where the draft lives, what acceptance does, and two config keys — and running `init` as its own process keeps its exits and output out of the daemon while staying inside the package boundary the admin is held to.

## Context

See [research.md](research.md) and [brief.md](brief.md). The code this builds
on: `lib/drafts/` (store, start), `lib/session/` (manager, start, protocol,
draft prompt), `bin/commands/init.ts` (`init(projectRoot, options)`),
`lib/admin/registry.ts` (`addProject`), `lib/worktree/repos.ts`
(`readWorkbenchRepos`), and the admin's `components/drafts/*`,
`components/session/*`, `app/api/drafts/*`.

## Decision

1. **Draft home.** `~/.indusk/new-projects/<id>/` (under `induskHome()`):
   `draft.json`, `brief.md`, `research.md`, `proposal.json`, `documents/`.
   Nothing about a project draft is written anywhere else until acceptance.
2. **Conversation.** The admin's `/new` page (the approved `new-project.start`
   look) posts to `/api/new-projects`; `/new/<id>` (`new-project.conversation`)
   talks through `sessionManager().start({ cwd: <draft dir>, kind: "planning",
   plan: "new-project:<id>", … })` with a prompt from
   `lib/new-project/prompt.ts`: the planner skill, the why / what / how-where
   order, and the proposal's shape. The agent writes `brief.md` and then
   `proposal.json`.
3. **Proposal.** `proposal.json`:
   ```json
   { "name": "homework-gate", "location": "/…/homework-gate-workbench",
     "repos": [{ "name": "homework-gate" }],
     "milestones": ["lockdown-baseline", "…"],
     "recommendations": [{ "name": "docs-site", "kept": true },
                         { "name": "adr", "kept": false, "reason": "…" }],
     "documentsOff": ["adr"], "remote": { "github": false } }
   ```
   Validation refuses `documentsOff` naming `brief` or `test-plan`, and a
   `location` not under the configured parent. The page shows it as the
   `new-project.proposal` look; every field is editable before accepting.
4. **Documents.** `indusk new-project add <id> <file>` copies into
   `documents/`; a file whose name is already there keeps the newer version
   and sends the agent the unified diff (`session say`).
5. **Creation.** `createProject(draftId, now)` in `lib/new-project/create.ts`:
   guard the parent; make `<location>/`, `<location>/<repo>/` (`git init -b
   main`, a README commit) and `<location>/worktrees/`; write a minimal
   `package.json`; run `indusk init --workbench --wrapped-repo <repo>
   --sibling-parent <location>` as a child process; rewrite `worktree` to
   `{ shape: "workbench", repos: [{ name, worktrees: "worktrees" }],
   sibling_parent }`; write `.indusk/planning/project-brief.md` (from the
   draft's brief, `kind: project-brief`), `.indusk/planning/sources/<file>`
   for each document, and `master.md` with the milestones as `roadmap:`;
   write `recommendations` and `planning.documents_off` to the project's
   config; if `remote.github`, run `gh repo create <name> --private
   --source <repo> --push` once; commit the workbench root; delete the draft.
   Each step reports as it runs, which the `new-project.creating` look shows.
   A failure removes everything the run made, as `setup` does.
6. **Parent directory.** `indusk new-project parent <dir>` writes
   `newProjects.parent` to `~/.indusk/admin-ui.json`; unset, creation is
   refused naming that command.
7. **Turned-off documents.** `planning.documents_off` in a project's config is
   read where a workflow's required documents are decided (the package's
   `workflow-types` module), so a turned-off ADR is *skipped*, never
   *missing*; `brief` and `test-plan` in it are refused when the config is
   read.
8. **Home page.** `ProjectGrid`'s header gains New project (the `home.default`
   look); its empty state offers it beside `indusk init`.

## Alternatives Considered

### Reuse plan drafts
Rejected: their home is `bookkeepingRoots(root).home`, which needs a project
that does not exist yet.

### Call `init()` inside the daemon
Rejected: it calls `process.exit(1)` and writes to the console; a failed
creation would kill the admin.

### `indusk setup`
Rejected: it makes `<repo>-workbench` beside the clone with a symlink — not
the standard layout, and it needs an existing clone.

### Routes under `/p/<project>`
Rejected: the project layout renders a stale-project page when the project is
not registered.

### Guess the parent from registered projects
Rejected: the promise is the directory the person configured.

## Consequences

### Positive
- One flow from idea to project; the plan conversation's code is reused.
- The standard layout is made by code, not by hand.

### Negative
- Two kinds of draft to sweep; a child `init` per creation.

### Risks
- A half-made project after a failure. Mitigation: creation removes what it
  made, and the tests for discarding and for a conversation left open hold the parent directory clean.
- `gh` not installed or not signed in. Mitigation: the remote step fails on
  its own after the project exists locally, and says so; nothing else is
  undone.

## As built

Three things differ from the decisions above, each found while building creation:

- **Repositories are declared inside the workbench with `repos_root: "."`** (decision 5). The ADR wrote the `worktree` config with `sibling_parent`; `repos_root` supersedes it and is what says the repositories live inside the workbench, without which `indusk worktree list` reads each one as an unusual trunk. The config is `{ shape: "workbench", repos: [{ name, worktrees: "worktrees" }], repos_root: "." }`.
- **A creation records its steps in the draft** (decision 5). `creating.json` in the draft's folder holds the steps and where each stands, so a page opened mid-run or after a stop (`/new/<id>?creating=1`) can show them; it is the package's file, written by `createProject`, and removed with the draft when the project is made.
- **`gh repo create` is named for the first repository**, since the remote holds a repository; with one repository (every proposal so far) it is also the project's name. Its failure is reported and leaves the finished local project, as the Risks say.
