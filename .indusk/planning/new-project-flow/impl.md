---
title: "New project flow — from a text box to a laid-out project"
date: 2026-10-14
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
approved_brief: "993ef4e0e1536ed600631a1d2ec4c159af37043f3827e96a44e1759e7513f94f"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-14T00:39:49.320Z"
---

# New project flow

## Goal

A person starts a new project from the admin by describing it; the agent
proposes it, and acceptance creates the workbench, the repository inside it,
its worktrees folder, InDusk, the founding brief and the master plan — and
nothing the person did not accept (see [adr.md](adr.md)).

## Scope

### In Scope
- Project drafts at `~/.indusk/new-projects/<id>/` and the CLI `indusk new-project start | add | accept | discard | parent`.
- The admin's `/new` and `/new/<id>` pages, their API routes, and New project on the home page — the approved looks `home.default`, `new-project.start | conversation | proposal | creating` and the new components they draw.
- Creation (`lib/new-project/create.ts`), the parent-directory guard, the GitHub step on confirm.
- `recommendations` and `planning.documents_off` in a project's config; turned-off documents read by `workflow-types`.

### Out of Scope
- Placing existing components with their own words — `component-content`, after this plan.
- Contributed scaffolds, recommendations that resurface, adopting an existing repository (the brief's Not promised).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `lib/new-project/{store,prompt,documents,parent}.ts`; CLI `start`, `add`, `discard`, `parent`; `/api/new-projects/*` (create, talk, add, discard); `/new`, `/new/[id]`; New project on the home page | `lib/session/` manager, `induskHome()`, the approved looks |
| Build Phase 2 | `lib/new-project/proposal.ts` (read, validate); `planning.documents_off` in `InduskConfig` and `workflow-types`; the proposal page | Build Phase 1's draft store |
| Build Phase 3 | `lib/new-project/create.ts`; CLI `accept`; `/api/new-projects/[id]/accept`; the creating page | Build Phase 2's validated proposal; `init` as a child process; `addProject` |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | New project opens a page with only the "What do you want to build?" box and a way to add documents, needing no project | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-project-starts-as-a-conversation | apps/indusk-admin/src/components/new-project/NewProjectStart.test.tsx |
| A2 | The first message, with documents added, starts a conversation with the agent that holds both | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-project-starts-as-a-conversation | apps/indusk-admin/src/__tests__/new-project-routes.test.ts |
| A3 | Once the agent writes its proposal, the page shows the name, location and shape, each changeable before accepting | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-project-starts-as-a-conversation | apps/indusk-admin/src/components/new-project/NewProjectProposal.test.tsx |
| A4 | Accepting creates the workbench, a repository inside it with one commit, a worktrees folder, InDusk installed, and a registered project | Test Phase 1 | Build Phase 3 | written | unit | promise: a-new-project-is-made-by-the-agent | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A5 | The creation shows each step as it runs and ends with a way into the project | Build Phase 3 | Build Phase 3 | planned | unit | promise: a-new-project-is-made-by-the-agent | apps/indusk-admin/src/components/new-project/NewProjectCreating.test.tsx |
| A6 | A created project's config declares its repository with its worktrees folder, and listing its worktrees reports nothing unattributed or unusual | Test Phase 1 | Build Phase 3 | written | unit | promise: a-new-project-has-the-standard-layout | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A7 | A created project opens with the founding brief from the conversation and a master plan ordering its milestones | Test Phase 1 | Build Phase 3 | written | unit | promise: a-project-keeps-its-founding-brief | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A8 | Each document the person added is in the created project byte for byte, beside the founding brief | Test Phase 1 | Build Phase 3 | written | unit | promise: a-project-keeps-its-founding-brief | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A9 | Adding a document with a name already added reports what changed between the two, and keeps the newer | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-new-version-of-the-founding-brief-shows-what-changed | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A10 | Declining a recommendation with a reason creates a project whose config records it declined, with the reason | Test Phase 1 | Build Phase 3 | written | unit | promise: a-recommendation-can-be-declined | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A11 | A proposal turning off the brief or the test plan is refused, naming the document | Test Phase 1 | Build Phase 2 | written | unit | promise: the-core-is-always-kept | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A12 | In a project with decision records turned off, a feature plan's ADR reads skipped, not missing | Test Phase 1 | Build Phase 2 | written | unit | promise: the-core-is-always-kept | apps/indusk-mcp/src/__tests__/documents-off.test.ts |
| A13 | Creating without confirming the remote runs no GitHub command and leaves no remote | Test Phase 1 | Build Phase 3 | written | unit | promise: a-new-project-publishes-nothing-unasked | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A14 | Creating with the remote confirmed creates one private repository, once, and pushes the first commit | Test Phase 1 | Build Phase 3 | written | unit | promise: a-new-project-publishes-nothing-unasked | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A15 | A proposal located outside the configured parent is refused and nothing is created | Test Phase 1 | Build Phase 3 | written | unit | promise: a-new-project-is-written-only-under-its-parent | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A16 | With no parent configured, creation is refused, naming the command that sets one | Test Phase 1 | Build Phase 3 | written | unit | promise: a-new-project-is-written-only-under-its-parent | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A17 | Discarding a project conversation removes everything it held; nothing is under the parent or in the registry because of it | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-unkept-project-conversation-leaves-nothing-on-disk | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A18 | A project conversation open at any point before acceptance has created nothing outside its draft folder | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-unkept-project-conversation-leaves-nothing-on-disk | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A19 | Starting a new plan in an existing project from the admin works exactly as before | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-starts-as-a-conversation, promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository, promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/__tests__/drafts.test.ts, apps/indusk-admin/src/components/drafts/DraftConversation.test.tsx |
| A20 | A project conversation's agent can be stopped, and none is left running when the admin stops | Test Phase 1 | Test Phase 1 | passing | contract | promise: a-session-can-be-stopped | apps/indusk-mcp/src/__tests__/admin-session-lifecycle.test.ts |
| A21 | A created project resolves to exactly one contract | Test Phase 1 | Build Phase 3 | written | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A22 | A created project's repository holds no telemetry vendor files written by installation | Test Phase 1 | Build Phase 3 | written | unit | promise: init-writes-no-vendor-into-an-app | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |

### Deferred Verification

- **The agent asks only what the input leaves open (U1)**
  - reason: the quality of a model's questions is a judgement, not an output a test can fix
  - would require: a rubric and a judged set of real conversations
  - mitigation: expectation 2 counts questions per creation; Build Phase 3 records one real run (Homework Gate's brief) as a live check in this impl

## Checklist

### Test Phase 1: Author the CLI-boundary assertions, RED

**Tier**: med — the work step's default

**Goal**: author every test that can honestly be authored now, and record every test that cannot.

- [x] Create/confirm this plan's worktree (`indusk worktree assign new-project-flow /Users/the_dusky/code/sandbox/dusk-worktrees/new-project-flow`, the one `plans start` made) — worktree-per-plan default
- [x] Author A4, A6–A11, A13–A18, A21, A22 in `new-project-cli.test.ts` through the built CLI with a temporary `INDUSK_HOME`, a temporary parent directory and a fake `gh` on `PATH` that records its arguments; a draft is seeded by `indusk new-project start --message … --document <file>` and its proposal written as the agent would (`proposal.json`, `brief.md`). RED: `new-project` is an unknown command
- [x] Author A12 in `documents-off.test.ts`: a temp project whose config sets `planning.documents_off: ["adr"]`, a feature plan with brief, test plan and impl; the plan status the admin reads (`lib/plan-parser.ts`) reports the ADR. RED: it reads missing
- [x] Confirm A19's existing tests (`drafts.test.ts`, `DraftConversation.test.tsx`) and A20's (`admin-session-lifecycle.test.ts`, with a session whose plan is `new-project:<id>`) pass
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Deferred to Build Phase 1

- **A1** — its subject is `NewProjectStart`, which Build Phase 1 introduces; the test file cannot load before it exists. Body reviewed:

  ```tsx
  render(<NewProjectStart />);
  expect(screen.getByRole("heading", { name: "What do you want to build?" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /add documents/i })).toBeInTheDocument();
  expect(screen.queryAllByRole("textbox")).toHaveLength(1);
  ```

- **A2** — its subjects are the `/api/new-projects` routes, which Build Phase 1 introduces; the route modules cannot be imported before then. Body reviewed:

  ```ts
  const { POST } = await import("@/app/api/new-projects/route");
  const res = await POST(jsonRequest({ message: "A parental control system", documents: [brief] }));
  const { id } = await res.json();
  expect(fakeManager.started[0]).toMatchObject({ kind: "planning", plan: `new-project:${id}` });
  expect(fakeManager.started[0].prompt).toContain("A parental control system");
  expect(readdirSync(join(home, "new-projects", id, "documents"))).toEqual(["brief.md"]);
  ```

#### Deferred to Build Phase 2

- **A3** — its subject is `NewProjectProposal`, which Build Phase 2 introduces. Body reviewed:

  ```tsx
  render(<NewProjectProposal proposal={homeworkGate} />);
  expect(screen.getByLabelText("Name")).toHaveValue("homework-gate");
  expect(screen.getByLabelText("Location")).toHaveValue(homeworkGate.location);
  expect(screen.getByRole("button", { name: "Create project" })).toBeEnabled();
  ```

#### Deferred to Build Phase 3

- **A5** — its subject is `NewProjectCreating`, which Build Phase 3 introduces. Body reviewed:

  ```tsx
  render(<NewProjectCreating steps={[done("Workbench created"), working("InDusk installed")]} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByRole("link", { name: /open the project/i })).toBeInTheDocument();
  ```

#### Regression Guards

- **A19** — starting a plan in an existing project must not change; its tests already pass and must keep passing.
- **A20** — a session is stoppable whatever its plan string; the guard holds it for `new-project:<id>`.

#### Test Phase 1 Verification

- [x] A4, A6–A18 (CLI rows), A21, A22 and A12 authored, each failing on its own assertion (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/new-project-cli.test.ts src/__tests__/documents-off.test.ts`)
- [x] A19 and A20 pass (`pnpm exec vitest run src/__tests__/drafts.test.ts`; A20 with `pnpm exec vitest run --config vitest.system.config.ts src/__tests__/admin-session-lifecycle.test.ts`)
- [x] Every deferred body above reviewed: will it compile at the phase it names, and does it assert what it claims?

Deferred-body review (Test Phase 1):

- A1 — assertions are right, the API is not: this repo's component tests run in Vitest browser mode with `vitest-browser-react` (`const screen = await render(...)`, `await expect.element(screen.getByRole(...))`), not a global `screen` with `toBeInTheDocument`. Build Phase 1 adapts the calls; the three assertions stand.
- A2 — needs a decision: the body asserts that POST `/api/new-projects` starts the session, but Build Phase 1 splits create (`/api/new-projects`) from `/[id]/talk`, which starts it. Either create starts it or the body posts to `/talk`. It also needs `vi.mock("@/lib/session-host")` for `fakeManager`, `jsonRequest`, `brief` and `home` (the pattern in `promise-fix-route.test.ts`).
- A3 — same API adaptation as A1; `homeworkGate` is an undefined fixture to author in Build Phase 2.
- A5 — same API adaptation (`getAllByRole` is `.elements()` in browser mode); `done`/`working` step helpers to author in Build Phase 3.

### Build Phase 1: A project conversation

**Tier**: med — the work step's default

- [x] `lib/new-project/store.ts`: `createProjectDraft(home, { message, documents })`, `readProjectDraft`, `discardProjectDraft`, under `<induskHome()>/new-projects/<id>/` (`draft.json`, `brief.md`, `research.md`, `documents/`)
- [x] `lib/new-project/documents.ts`: `addDocument(draft, file)` — a name already present keeps the newer bytes and returns the unified diff
- [x] `lib/new-project/prompt.ts`: the new-project prompt — the planner skill, ask why / what / how-where and only what the input leaves open, write `brief.md` then `proposal.json`
- [x] `lib/new-project/parent.ts`: `readParent()` / `setParent(dir)` on `newProjects.parent` in `~/.indusk/admin-ui.json`
  - Decision: the setting is kept in `<INDUSK_HOME>/new-projects.json`, not `admin-ui.json` as written above: `admin-ui.json` is the daemon's own record (`daemonStart` overwrites it, `daemonStop` removes it), so a parent kept there would be lost by `indusk ui stop`.
- [x] CLI `indusk new-project start | add | discard | parent` in `bin/cli.ts`; the package exports `./new-project` for the admin
- [x] Admin: `/api/new-projects` (POST create), `/api/new-projects/[id]/talk` (session with `plan: "new-project:<id>"`, refused while another session runs), `/[id]/add` (the diff sent with `/api/sessions/[id]/say`), `/[id]/discard`
  - Decision (A2): `POST /api/new-projects` creates the draft **and** starts the session (`kind: "planning"`, `plan: "new-project:<id>"`) with the first message and documents in its prompt; `/[id]/talk` handles later turns and restarting the session. This keeps the reviewed A2 body, which posts to the create route, valid.
- [x] Admin: `/new` (`NewProjectStart`, the `prompt-box` look) and `/new/[id]` (`NewProjectConversation` with `message`, `file-chip`, `knowledge-list`, reusing `SessionConnector`); New project in `ProjectGrid`'s header and empty state (`home.default`, `project-card`)
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-admin/src/app/api/new-projects/[id]/add/route.ts`) — move the wording of the notice the agent is sent when a document arrives out of the route into a named, tested documentNotice in the package (lib/new-project/documents.ts). Rule: Should this inline block have been a named function or module? (shape: intra-unit)
- [x] Shape (`apps/indusk-admin/src/components/new-project/NewProjectConversation.tsx`) — reviewed, left as-is: four handlers (find the running session, reopen, add documents, discard) share one state and one panel; splitting them into a hook would move the state, not remove a job. The project name it matches sessions on duplicates `NEW_PROJECT_SESSION_PROJECT` because a client component cannot import the package's node module; that is cross-file and left to `/cleanup`.
- [x] Shape — reviewed the other files this phase changed (`lib/new-project/*`, `bin/commands/new-project.ts`, the other routes, the five components and the pages) against the enabled extensions' craft rules; nothing else to change. `prepareShapeReview` skipped because Build Phase 1's last Verification item is open (see its note); the review was done by reading the files.
- [x] Looks check seeds what a state needs (discovered work): `screens.json` screens gain optional `paths` (a path per state), `seed` (a command whose trimmed stdout is `{seed}`) and `unseed` (run after, always); `lib/looks/{mockups,check}.ts`, tested in `check.test.ts`. Decision — asked: "how should the looks check reach states that exist only once a draft does?" — user: "Check seeds a draft". The mechanism is generic; the looks checker knows nothing of projects. Build Phases 2 and 3 apply the same mechanism to `proposal` and `creating`.
- [x] Seed a project conversation for the check: `.indusk/mockups/admin/seed/homework-gate-brief.md` as the sample document; `screens.json` gives `new-project` (and `message`, `file-chip`, `knowledge-list`, which are drawn only in a conversation) `seed: indusk new-project start --message … --document …` (prints only the draft id; no agent session is started) and `unseed: indusk new-project discard {seed}`, and `paths` sending `conversation` (and `you`, `default`) to `/new/{seed}`

#### Build Phase 1 Verification

- [x] A1, A2, A9, A17, A18 pass; A19, A20 still pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/new-project-cli.test.ts -t "A9|A17|A18" && cd ../indusk-admin && pnpm exec vitest run src/components/new-project src/__tests__/new-project-routes.test.ts src/__tests__/admin-uses-package-commands.test.ts`); `pnpm exec vitest related` over the changed files
- [x] `indusk looks check admin` holds `home.default`, `new-project.start` and `new-project.conversation` by value
  - Result: with the check seeding a draft (the two items above), `home.default`, `new-project.start`, `new-project.conversation`, `project-card.default`, `prompt-box.default`, `message.you`, `file-chip.default` and `knowledge-list.default` are **held** at all six device-and-scheme combinations; 522 held, 246 unchecked, 0 broken across the app; the seeded draft was discarded (no `new-projects/` entry left). The admin was this worktree's `next dev` on :4939 with a temporary `INDUSK_HOME` (the seed went into it), and `indusk` on `PATH` was this worktree's build: the daemon on :3939 serves the main checkout's older admin, which has no `/new`, until this plan lands and `pnpm install:local` runs. `message.agent` stays unchecked: no conversation page draws an agent message.

#### Build Phase 1 Context

- [x] Root (Key Decisions): `- New project flow: a project starts as a conversation in the admin; drafts at ~/.indusk/new-projects/, creation by the package — see /decisions/new-project-flow` — always-on because every session that touches the admin or init needs to know projects are now created this way
- [x] admin: `apps/indusk-admin/CLAUDE.md` — the admin writes a project only through `indusk new-project`, never its own process — guarded by `admin-uses-package-commands.test.ts`

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/cli/new-project.md`: `start`, `add`, `discard`, `parent`

### Build Phase 2: The proposal

**Tier**: med — the work step's default

- [x] `lib/new-project/proposal.ts`: `readProposal(draft)` validating the ADR's shape — name, location, repos, milestones, recommendations (`kept`, `reason` required when declined), `documentsOff` (refusing `brief` and `test-plan`), `remote.github`
- [x] `InduskConfig` gains `planning?: { documents_off?: string[] }` and `recommendations?: { name: string; kept: boolean; reason?: string }[]`; reading a config whose `documents_off` names `brief` or `test-plan` refuses, naming it
- [ ] `lib/workflow-types.ts`: a workflow's required documents minus the project's `documents_off`, so the plan status reads a turned-off document `skipped`; the planner skill (`apps/indusk-mcp/skills/planner.md`) says a turned-off document is not written
- [ ] Admin: `/new/[id]` shows `NewProjectProposal` once `proposal.json` exists — editable name, location and shape (`layout-tree`), `workflow-strip`, `recommendation` rows with Decline and a reason, the founding brief with its `file-chip`s, the remote confirm, Create project
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 1 Forward Intelligence

- **Watch out**: `new-project.proposal` exists only once a draft has a `proposal.json`, so `indusk looks check admin` cannot reach it from `/new`. Apply the mechanism Build Phase 1 added: give the `new-project` screen in `screens.json` a `paths` entry for `proposal` (`/new/{seed}`) and make its `seed` also write a valid `proposal.json` into the draft, and the same for `recommendation`, `workflow-strip` and `layout-tree` (which are drawn only on the proposal). The `seed` and `unseed` commands already exist on `new-project`; changing them does not reopen an approval (the declarations hash covers devices, `ignore` and `sources` only).
- **Assumption**: the daemon on :3939 serves the main checkout's admin, so a looks check of this worktree's pages runs against `next dev` of the worktree with a temporary `INDUSK_HOME`, and `indusk` on `PATH` must be the worktree's build.

#### Build Phase 2 Verification

- [ ] A3, A11, A12 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/documents-off.test.ts src/__tests__/new-project-cli.test.ts -t A11 && cd ../indusk-admin && pnpm exec vitest run src/components/new-project`); `pnpm exec vitest related` over the changed files; `workflow-types-parity.test.ts` still passes
- [ ] `indusk looks check admin` holds `new-project.proposal` by value

#### Build Phase 2 Context

- [ ] planning: `apps/indusk-mcp/templates/planning/CLAUDE.md` — `planning.documents_off` turns a document off for a project; the brief and the test plan cannot be — guarded by `documents-off.test.ts` (A12)

#### Build Phase 2 Document

- [ ] `apps/docs/src/guide/new-project.md`: the proposal — name, location, shape, the workflow and what can be turned off, recommendations and declines

### Build Phase 3: Creation

**Tier**: med — the work step's default

- [ ] `lib/new-project/create.ts`: `createProject(home, id, { now, report })` — refuse an unset parent (naming `indusk new-project parent <dir>`) or a location outside it; make `<location>/`, `<location>/<repo>/` (`git init -b main`, README commit), `<location>/worktrees/`, a minimal `package.json`; run `indusk init --workbench --wrapped-repo <repo> --sibling-parent <location>` as a child process; rewrite `worktree` to `repos: [{ name, worktrees: "worktrees" }]`; write `project-brief.md` (`kind: project-brief`), `sources/<file>` per document, `master.md` with `roadmap:`; write `recommendations` and `planning.documents_off`; `gh repo create <name> --private --source <repo> --push` only when `remote.github`; commit the workbench root; delete the draft. Every step calls `report(step, state)`; a failure removes what the run made
- [ ] CLI `indusk new-project accept <id>` printing each step
- [ ] Admin: `/api/new-projects/[id]/accept` streaming the steps; `NewProjectCreating` (the `new-project.creating` look) ending with a link to `/p/<name>/`
- [ ] Live check: create Homework Gate from its brief through the admin into a temporary parent; record the questions asked and the result here
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 2 Forward Intelligence

- **Watch out**: `new-project.creating` is reached the same way as the proposal states: a `paths` entry and a `seed` that leaves the draft mid-creation (or a fixture the creating page reads), unseeded after. See Build Phase 1's Forward Intelligence.

#### Build Phase 3 Verification

- [ ] A4–A8, A10, A13–A16, A21, A22 pass; every earlier row still passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/new-project-cli.test.ts && cd ../indusk-admin && pnpm exec vitest run src/components/new-project`); `pnpm exec vitest related` over the changed files
- [ ] `indusk looks check admin` holds `new-project.creating` by value; `indusk promises contract new-project-flow` passes

#### Build Phase 3 Context

- [ ] mcp: the docblock of `lib/new-project/create.ts` — the standard layout and the order of creation — `promise: a-new-project-has-the-standard-layout`

#### Build Phase 3 Document

- [ ] `apps/docs/src/guide/new-project.md`: creation, the parent directory, the remote confirm; the Mermaid flow
- [ ] `apps/docs/src/guide/worktree-setup.md`: the admin as the first way to make a workbench
- [ ] `apps/docs/src/decisions/new-project-flow.md` published; changelog entry "Added — start a new project from the admin by describing it"

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/new-project/*.ts` | new: store, documents, prompt, parent, proposal, create |
| `apps/indusk-mcp/src/bin/cli.ts` | `indusk new-project` |
| `apps/indusk-mcp/src/lib/config.ts` | `planning.documents_off`, `recommendations` |
| `apps/indusk-mcp/src/lib/workflow-types.ts` | required documents minus `documents_off` |
| `apps/indusk-mcp/package.json` | `./new-project` export |
| `apps/indusk-mcp/skills/planner.md` | a turned-off document is not written |
| `apps/indusk-admin/src/app/new/page.tsx`, `app/new/[id]/page.tsx` | new pages |
| `apps/indusk-admin/src/app/api/new-projects/**` | new routes |
| `apps/indusk-admin/src/components/new-project/*` | `NewProjectStart`, `NewProjectConversation`, `NewProjectProposal`, `NewProjectCreating` and the new components |
| `apps/indusk-admin/src/components/ProjectGrid.tsx`, `ProjectCard.tsx` | New project; `project-card` marker |
| `apps/indusk-mcp/templates/planning/CLAUDE.md` | `documents_off` rule |
| `apps/docs/src/guide/new-project.md`, `reference/cli/new-project.md`, `decisions/new-project-flow.md`, `guide/worktree-setup.md` | docs |

## Dependencies
- None; `component-content` follows this plan.

## Notes
- The new components (`prompt-box`, `message`, `file-chip`, `knowledge-list`, `workflow-strip`, `layout-tree`, `recommendation`, `project-card`) each get one implementation and a story per state in the phase that first uses them; `plans accept` waits on their approved stories.
