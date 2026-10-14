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
approved_brief: "a82730f18ba4adeb233118bed9becb88b55b7cb1db11b76048bf66813f8d9de9"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-14T16:05:59.822Z"
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
| Build Phase 4 | `lib/conversation-turns.ts` (`turnsOf`); `ConversationThread`; `Message` folded/open; the draft's `transcript.jsonl`; the shorter prompt; the `new_project.create` span | the session manager's events; the admin's `Markdown`; Build Phase 3's `createProject` |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | New project opens a page with only the "What do you want to build?" box and a way to add documents, needing no project | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-project-starts-as-a-conversation | apps/indusk-admin/src/components/new-project/NewProjectStart.test.tsx |
| A2 | The first message, with documents added, starts a conversation with the agent that holds both | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-project-starts-as-a-conversation | apps/indusk-admin/src/__tests__/new-project-routes.test.ts |
| A3 | Once the agent writes its proposal, the page shows the name, location and shape, each changeable before accepting | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-project-starts-as-a-conversation | apps/indusk-admin/src/components/new-project/NewProjectProposal.test.tsx |
| A4 | Accepting creates the workbench, a repository inside it with one commit, a worktrees folder, InDusk installed, and a registered project | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-new-project-is-made-by-the-agent | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A5 | The creation shows each step as it runs and ends with a way into the project | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-new-project-is-made-by-the-agent | apps/indusk-admin/src/components/new-project/NewProjectCreating.test.tsx |
| A6 | A created project's config declares its repository with its worktrees folder, and listing its worktrees reports nothing unattributed or unusual | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-new-project-has-the-standard-layout | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A7 | A created project opens with the founding brief from the conversation and a master plan ordering its milestones | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-project-keeps-its-founding-brief | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A8 | Each document the person added is in the created project byte for byte, beside the founding brief | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-project-keeps-its-founding-brief | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A9 | Adding a document with a name already added reports what changed between the two, and keeps the newer | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-new-version-of-the-founding-brief-shows-what-changed | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A10 | Declining a recommendation with a reason creates a project whose config records it declined, with the reason | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-recommendation-can-be-declined | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A11 | A proposal turning off the brief or the test plan is refused, naming the document | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-core-is-always-kept | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A12 | In a project with decision records turned off, a feature plan's ADR reads skipped, not missing | Test Phase 1 | Build Phase 2 | passing | unit | promise: the-core-is-always-kept | apps/indusk-mcp/src/__tests__/documents-off.test.ts |
| A13 | Creating without confirming the remote runs no GitHub command and leaves no remote | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-new-project-publishes-nothing-unasked | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A14 | Creating with the remote confirmed creates one private repository, once, and pushes the first commit | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-new-project-publishes-nothing-unasked | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A15 | A proposal located outside the configured parent is refused and nothing is created | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-new-project-is-written-only-under-its-parent | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A16 | With no parent configured, creation is refused, naming the command that sets one | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-new-project-is-written-only-under-its-parent | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A17 | Discarding a project conversation removes everything it held; nothing is under the parent or in the registry because of it | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-unkept-project-conversation-leaves-nothing-on-disk | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A18 | A project conversation open at any point before acceptance has created nothing outside its draft folder | Test Phase 1 | Build Phase 1 | passing | unit | promise: an-unkept-project-conversation-leaves-nothing-on-disk | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A19 | Starting a new plan in an existing project from the admin works exactly as before | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-plan-starts-as-a-conversation, promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository, promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/__tests__/drafts.test.ts, apps/indusk-admin/src/components/drafts/DraftConversation.test.tsx |
| A20 | A project conversation's agent can be stopped, and none is left running when the admin stops | Test Phase 1 | Test Phase 1 | passing | contract | promise: a-session-can-be-stopped | apps/indusk-mcp/src/__tests__/admin-session-lifecycle.test.ts |
| A21 | A created project resolves to exactly one contract | Test Phase 1 | Build Phase 3 | passing | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A22 | A created project's repository holds no telemetry vendor files written by installation | Test Phase 1 | Build Phase 3 | passing | unit | promise: init-writes-no-vendor-into-an-app | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A23 | A session's events read as alternating you/agent turns: an agent turn's reply is its last text, the tools and text before it its working | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-project-conversation-is-a-back-and-forth | apps/indusk-admin/src/lib/conversation-turns.test.ts |
| A24 | An agent reply in Markdown shows formatted; its working is hidden until See more, and See less hides it again | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-project-conversation-is-a-back-and-forth | apps/indusk-admin/src/components/new-project/ConversationThread.test.tsx |
| A25 | A question or permission the agent is waiting on is never folded away | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-project-conversation-is-a-back-and-forth | apps/indusk-admin/src/components/new-project/ConversationThread.test.tsx |
| A26 | Reopening a project conversation with no agent running shows the same turns; discarding removes them | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-project-conversation-is-a-back-and-forth | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A27 | The project conversation's prompt asks for a few sentences of Markdown and at most three questions at a time | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-project-conversation-is-a-back-and-forth | apps/indusk-mcp/src/lib/new-project/prompt.test.ts |
| A28 | Starting a project conversation starts its agent: the conversation opens with the agent working, with no second click | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-project-starts-as-a-conversation | apps/indusk-admin/src/components/new-project/NewProjectStart.test.tsx |
| A29 | Every agent turn carries one status: working while running without a reply, done once replied, stopped when it ended before replying | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-project-conversation-is-a-back-and-forth | apps/indusk-admin/src/lib/conversation-turns.test.ts |
| A30 | After a project is created, the conversation's agent is no longer running, and a new project conversation can be started straight away | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-session-can-be-stopped | apps/indusk-admin/src/__tests__/new-project-accept.test.ts |
| A31 | A proposal located through a symbolic link that leads out of the parent directory is refused and nothing is created outside the parent | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-new-project-is-written-only-under-its-parent | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A32 | A proposal located inside an existing git repository under the parent is refused and that repository is untouched | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-new-project-has-the-standard-layout | apps/indusk-mcp/src/__tests__/new-project-cli.test.ts |
| A33 | A proposal naming a repository `worktrees` is refused, so a repository never shares the worktrees folder | Build Phase 5 | Build Phase 5 | passing | unit | promise: a-new-project-has-the-standard-layout | apps/indusk-mcp/src/lib/new-project/proposal.test.ts |

### Deferred Verification

- **The agent asks only what the input leaves open (U1)**
  - reason: the quality of a model's questions is a judgement, not an output a test can fix
  - would require: a rubric and a judged set of real conversations
  - mitigation: expectation 2 counts questions per creation; Build Phase 4 records one real run (Homework Gate's brief) as a live check in this impl

- **The agent's replies are short enough to read without opening the working (U2)**
  - reason: how short is enough is a judgement
  - would require: a judged set of real conversations
  - mitigation: expectation 5's words per reply and folds opened, on each creation's span; the live check records one real run

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
- [x] `lib/workflow-types.ts`: a workflow's required documents minus the project's `documents_off`, so the plan status reads a turned-off document `skipped`; the planner skill (`apps/indusk-mcp/skills/planner.md`) says a turned-off document is not written
- [x] Admin: `/new/[id]` shows `NewProjectProposal` once `proposal.json` exists — editable name, location and shape (`layout-tree`), `workflow-strip`, `recommendation` rows with Decline and a reason, the founding brief with its `file-chip`s, the remote confirm, Create project
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-admin/src/components/new-project/NewProjectProposal.tsx`) — reviewed, left as-is: the four cards (shape, workflow, recommendations, brief) and the remote confirm share one edited proposal; the decline editor's reason state is read by the recommendation rows and written back into that proposal, so splitting it moves state without removing a job. The edits' meaning (`decline`, `keep`, `layoutOf`, `workflowDocuments`) is already out in the tested `proposal-edit.ts`.
- [x] Shape — reviewed the other files this phase changed (`lib/new-project/proposal.ts`, `config.ts` refusal, `plan-parser.ts` `readDocumentsOff`, `required-documents`, the three ui components, the proposal route, `NewProjectProposalPanel`, the page) against the enabled extensions' craft rules by reading them; nothing else to change. `prepareShapeReview` not run: the review was done by reading the files.

#### Build Phase 1 Forward Intelligence

- **Watch out**: `new-project.proposal` exists only once a draft has a `proposal.json`, so `indusk looks check admin` cannot reach it from `/new`. Apply the mechanism Build Phase 1 added: give the `new-project` screen in `screens.json` a `paths` entry for `proposal` (`/new/{seed}`) and make its `seed` also write a valid `proposal.json` into the draft, and the same for `recommendation`, `workflow-strip` and `layout-tree` (which are drawn only on the proposal). The `seed` and `unseed` commands already exist on `new-project`; changing them does not reopen an approval (the declarations hash covers devices, `ignore` and `sources` only).
- **Assumption**: the daemon on :3939 serves the main checkout's admin, so a looks check of this worktree's pages runs against `next dev` of the worktree with a temporary `INDUSK_HOME`, and `indusk` on `PATH` must be the worktree's build.

#### Build Phase 2 Verification

- [x] A3, A11, A12 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/documents-off.test.ts src/__tests__/new-project-cli.test.ts -t A11 && cd ../indusk-admin && pnpm exec vitest run src/components/new-project`); `pnpm exec vitest related` over the changed files; `workflow-types-parity.test.ts` still passes
- [x] `indusk looks check admin` holds `new-project.proposal` by value
  - Result: `new-project.proposal`, `new-project.conversation`, `recommendation.kept`, `recommendation.declined`, `workflow-strip.default` and `layout-tree.default` are **held** at all six device-and-scheme combinations; 576 held, 226 unchecked, 0 broken. The check ran against this worktree's `next dev` on :4939 with a temporary `INDUSK_HOME` and this worktree's `indusk` build on `PATH`. The `new-project` screen's seed now also writes `proposal.json` and `brief.md` (`seed/homework-gate-proposal.json`), so its `conversation` path is `/new/{seed}?talk=1` (a draft with a proposal opens on the proposal). The four new stories (`recommendation.kept`, `recommendation.declined`, `workflow-strip.default`, `layout-tree.default`) read *proposed, never approved* until a person approves them on the Looks page.

#### Build Phase 2 Context

- [x] planning: `apps/indusk-mcp/templates/planning/CLAUDE.md` — `planning.documents_off` turns a document off for a project; the brief and the test plan cannot be — guarded by `documents-off.test.ts` (A12)

#### Build Phase 2 Document

- [x] `apps/docs/src/guide/new-project.md`: the proposal — name, location, shape, the workflow and what can be turned off, recommendations and declines

### Build Phase 3: Creation

**Tier**: med — the work step's default

- [x] `lib/new-project/create.ts`: `createProject(home, id, { now, report })` — refuse an unset parent (naming `indusk new-project parent <dir>`) or a location outside it; make `<location>/`, `<location>/<repo>/` (`git init -b main`, README commit), `<location>/worktrees/`, a minimal `package.json`; run `indusk init --workbench --wrapped-repo <repo> --sibling-parent <location>` as a child process; rewrite `worktree` to `repos: [{ name, worktrees: "worktrees" }]`; write `project-brief.md` (`kind: project-brief`), `sources/<file>` per document, `master.md` with `roadmap:`; write `recommendations` and `planning.documents_off`; `gh repo create <name> --private --source <repo> --push` only when `remote.github`; commit the workbench root; delete the draft. Every step calls `report(step, state)`; a failure removes what the run made
  - Decision: the worktree config is written `{ shape: "workbench", repos: [{ name, worktrees: "worktrees" }], repos_root: "." }`, not with `sibling_parent` as the ADR wrote: `repos_root: "."` is the declared shape for repositories inside the workbench (`readReposRoot`), and without it `worktree list` reads the repository as an "unusual" trunk (A6). Progress is also kept in the draft as `creating.json` (steps and where each stands, `lib/new-project/steps.ts`) so a page opened mid-run or after a failure can show it; `gh repo create` is named for the first repository and its failure leaves the finished local project (a `remoteError`), as the ADR's Risks say.
- [x] CLI `indusk new-project accept <id>` printing each step
- [x] Admin: `/api/new-projects/[id]/accept` streaming the steps; `NewProjectCreating` (the `new-project.creating` look) ending with a link to `/p/<name>/`
  - Decision: the look is reached with `paths.creating` = `/new/{seed}?creating=1` and the `new-project` seed also copying `seed/homework-gate-creating.json` into the draft as `creating.json`; the page shows the creation only for `?creating=1` (the panel sets it when a run starts), so the `proposal` and `conversation` seeds, which share the draft, are untouched.
- [x] Live check — moved to Build Phase 4 (amended 2026-10-14): the person asked for the folded, back-and-forth conversation first, so the agent is judged with the shorter prompt in place
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-mcp/src/lib/new-project/create.ts`) — the `documents` step of `createProject` inlined three jobs (writing the founding documents, recording the person's choices in the config, committing the workbench); moved into `writeFoundingDocuments`, `recordChoices` and `commitWorkbench`, which also reads the config once. Rule: Should this inline block have been a named function or module? (shape: intra-unit)
- [x] Shape — reviewed the other files this phase changed (`steps.ts`, `registry.ts` `removeProject`, the CLI `accept`, the accept route, `NewProjectCreating`, `NewProjectCreatingPanel`, `creation-stream.ts`, the proposal panel and `/new/[id]` page) against the enabled extensions' craft rules; nothing else to change. `NewProjectCreatingPanel` was considered and left as-is: starting the run, folding its events and offering the stop's two buttons share one view state, so a hook would move the state, not remove a job. The step labels are read from `steps.ts` in both the package and the panel, one definition.

#### Build Phase 2 Forward Intelligence

- **Watch out**: `new-project.creating` is reached the same way as the proposal states: a `paths` entry and a `seed` that leaves the draft mid-creation (or a fixture the creating page reads), unseeded after. See Build Phase 1's Forward Intelligence.
- **Watch out**: `indusk new-project accept` is only the proposal check today (`newProjectAccept` in `bin/commands/new-project.ts` ends with "creating a project is not built yet", exit 1); `createProject` replaces that last line. The proposal page's Create project already saves the edits (`/api/new-projects/[id]/proposal`) and then POSTs `/api/new-projects/[id]/accept`, which does not exist until this phase builds it; until then Create shows the 404.
- **Assumption**: `readProposal(draft)` (`lib/new-project/proposal.ts`) is the one validated read; `createProject` takes its result and does the parent guard (A15, A16) itself - the proposal check does not look at the parent. A declined recommendation may carry `title` and `why`; `config.recommendations` takes only `name`, `kept`, `reason`, so write those three.
- **Fragile**: `new-project.proposal` is seeded by writing `proposal.json` and `brief.md` into the draft with `cp` (`screens.json`); the `conversation` state therefore opens at `?talk=1`. A `creating` seed that leaves a draft mid-creation must not break those two.

#### Build Phase 3 Verification

- [x] A4–A8, A10, A13–A16, A21, A22 pass; every earlier row still passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/new-project-cli.test.ts && cd ../indusk-admin && pnpm exec vitest run src/components/new-project`); `pnpm exec vitest related` over the changed files
- [x] `indusk looks check admin` holds `new-project.creating` by value; `indusk promises contract new-project-flow` passes
  - Result: `new-project.creating` is **held** at all six device-and-scheme combinations; 582 held, 220 unchecked, 0 broken. Run against this worktree's `next dev` on :4939 with a temporary `INDUSK_HOME` and this worktree's `indusk` build on `PATH`. `indusk promises contract new-project-flow`: its brief, its rows and the registry agree (10 made, 6 kept, 4 expectations).

#### Build Phase 3 Context

- [x] mcp: the docblock of `lib/new-project/create.ts` — the standard layout and the order of creation — `promise: a-new-project-has-the-standard-layout`

#### Build Phase 3 Document

- [x] `apps/docs/src/guide/new-project.md`: creation, the parent directory, the remote confirm; the Mermaid flow
- [x] `apps/docs/src/guide/worktree-setup.md`: the admin as the first way to make a workbench
- [x] `apps/docs/src/decisions/new-project-flow.md` published; changelog entry "Added — start a new project from the admin by describing it"

### Build Phase 4: The conversation as a thread

**Tier**: med — the work step's default

- [x] `apps/indusk-admin/src/lib/conversation-turns.ts`: `turnsOf(events)` — alternating `{ who: "you", text }` and `{ who: "agent", reply, working, waiting }` turns; the reply is the turn's last `text` (or the `result` text when there is none), `tool` events and earlier text are `working`, an open `question` or `permission` is `waiting`
- [x] `Message` (`components/ui/Message.tsx`) gains the `agent-folded` and `agent-open` states: the reply through `Markdown`, the working behind "See more ›" / "See less"; stories for both states, `indusk looks stories admin`
- [x] `components/new-project/ConversationThread.tsx`: the thread of `Message` bubbles from `turnsOf`, a waiting question or permission answered in place, the reply box sending through the session's `say`; `NewProjectConversation` uses it in place of `SessionConnector` (the plan conversation keeps `SessionConnector`)
- [x] The draft keeps `transcript.jsonl`: the manager's events for a project conversation's session are appended to it; the page reads it when no session runs; `discard` removes it with the draft
- [x] `lib/new-project/prompt.ts`: reply in a few sentences of Markdown, at most three questions at a time, only what the documents leave open
- [x] Looks: the `new-project` seed copies `seed/homework-gate-transcript.jsonl` into the draft so `new-project.conversation` and `message.agent-folded` / `agent-open` are reached with turns; `paths` entries for the two message states
- [x] Start launches the agent (amended 2026-10-14): `/api/new-projects` starts the draft's session as it creates it, and `/new/<id>` opens on the thread with the agent working — no "Talk to the agent" click; the button remains only for a conversation whose agent is not running
- [x] `turnsOf` gives each agent turn a `status` — `working`, `done` or `stopped` — and an agent turn appears as soon as the session starts, before any text; `Message` gains `agent-working` (pulsing dot with the `shadow.ring` halo, "Working…") and `agent-stopped` (grey dot, the pick-up line); `agent-folded` / `agent-open` carry the green done dot; stories for the new states, `indusk looks stories admin`
- [x] Looks: `paths` and seed lines reaching `message.agent-working` and `message.agent-stopped` (a transcript fixture ending mid-turn, read as working only while a session runs, or a query the page honours for the check)
  - Decision: the `message` seed copies `seed/homework-gate-transcript-unfinished.jsonl` (the finished transcript, then a person turn and an agent turn that used two tools and never replied); `agent-stopped` is `/new/{seed}?talk=1` (no session runs, so the last turn is stopped) and `agent-working` is `/new/{seed}?talk=1&working=1`, a query that draws the thread as if an agent runs (`showRunning`, no session started). The page declares the message states its turns are in (`replyLookStates`), not a fixed list.
- [x] Found in use (2026-10-14): a message that restarts the agent showed only after the next one was sent — it is written after the new session's marker, which `historyBefore` dropped, and the manager never replays it. `historyBefore` now keeps the `you` lines right after the connected session's marker, and the page shows the words itself until its transcript marks the new session (`marks`)
- [x] Found in use (2026-10-14): Enter in the reply box did nothing, and Stop and "+ Add a document" were submit buttons, so Stop also sent the half-typed reply. Enter sends (Shift+Enter a new line); both are `type="button"`
- [x] Live check — deferred (asked: "the live check is still open — run it now?" — user: "I think we can approve this project, this new project flow, for now. We pick up any problems later"). Partly run 2026-10-14 through the admin: the Homework Gate conversation reached the founding brief with the person's brief and investor deck attached and found the lag and Stop bugs fixed above; not carried to creation. U1 and U2 stay open for the plan that makes promises mark-first
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`apps/indusk-admin/src/app/new/[id]/page.tsx`) — the inline nested ternary that decides which message look state the page draws (`!hasWorking ? "none" : open === undefined ? "folded" : "open"`) becomes a named function `replyLookState(hasWorking, open)` beside `lookStates`. Rule: Should this inline block have been a named function or module? (shape: intra-unit)
- [x] Shape (`apps/indusk-admin/src/components/new-project/ConversationThread.tsx`) — reviewed, left as-is: the thread and its reply box share one state (the draft, which turns are open, which requests are answered) and move together; a `ReplyBox` component would move that state, not remove a job. `TurnView` is already its own unit
- [x] Shape (`apps/indusk-mcp/src/lib/new-project/transcript.ts`) — reviewed, left as-is: `conversationFigures` reads replies the way the admin's `turnsOf` does but counts them without drawing; the two live in different packages by the admin-through-the-package rule, so sharing them is `/cleanup`'s inter-file question, not an intra-unit one
- [x] Shape (`apps/indusk-admin/src/lib/conversation-turns.ts`, `components/ui/Message.tsx`, `app/new/[id]/page.tsx`, for the status dots) — the agent's look state was decided twice (the thread's inline ternary, the page's own list); it is now one exported `agentState(turn, open)` read by both, and the page's fixed look-state list is `replyLookStates`, derived from the turns. `withStatus` is its own function beside `turnsOf` rather than more state inside it. `Message` keeps its status tables (`DOT`, `NOTE`) as data beside `SHAPE` and `WHO`; `Who` is a local presentational piece, not a component a mockup names. Rule: Should this inline block have been a named function or module? (shape: intra-unit)

#### Build Phase 4 OTel

- [x] `createProject` emits a `new_project.create` span: duration from the draft's creation (expectation 1), `conversation.questions` and `conversation.has_document` (expectation 2), `conversation.reply_words` and `conversation.folds_opened` read from the transcript before the draft is deleted (expectation 5); "See more" appends a `fold-opened` line to the transcript

#### Build Phase 3 Forward Intelligence

- **Fragile**: the `new-project` seed is shared by `start`, `conversation`, `proposal` and `creating`; a transcript added to it must not change what `proposal` and `creating` show.
- **Assumption**: the session manager replays a running session's events to a new `EventSource`; a stopped one replays nothing, which is why the transcript is kept in the draft.

#### Build Phase 4 Verification

- [x] A23–A29 pass; every earlier row still passes (`cd apps/indusk-admin && pnpm exec vitest run src/lib/conversation-turns.test.ts src/components/new-project && cd ../indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/new-project-cli.test.ts src/lib/new-project`); `pnpm exec vitest related` over the changed files
- [x] `indusk looks check admin` holds `new-project.conversation` and `message.agent-folded`, `agent-open`, `agent-working`, `agent-stopped` by value; `indusk promises contract new-project-flow` passes
  - Result: `new-project.conversation` and `message.agent-folded`, `agent-open`, `agent-working`, `agent-stopped` are **held** at all six device-and-scheme combinations; 642 held, 218 unchecked, 0 broken. Run against a `next dev` of a copy of this worktree's admin on :4952 (the person's :4939 server holds `.next/`) with a temporary `INDUSK_HOME` and this worktree's `indusk` build on `PATH`, after rebuilding Storybook; `agent-working` is `/new/{seed}?talk=1&working=1`, `agent-stopped` is `/new/{seed}?talk=1`. The first run broke `agent-working` in dark: the Tailwind `shadow-ring` utility compiled the light value, so the dot uses the `.halo` class (the foundation's `--shadow-ring`, as Step does). `indusk promises contract new-project-flow` passes (11 made, 6 kept, 5 expectations). The full admin suite passes (97 files, 606 tests); `component-reuse-audit.test.ts` failed on an inline `<button>` in `NewProjectCreating.tsx`, now a `<Button>`.

#### Build Phase 4 Context

- [x] admin: `apps/indusk-admin/CLAUDE.md` — the project conversation renders a thread from `turnsOf`; the other agent conversations still use the session panel until they move — `promise: a-project-conversation-is-a-back-and-forth`

#### Build Phase 4 Document

- [x] `apps/docs/src/guide/new-project.md`: the conversation as a thread, what "See more" holds, the transcript kept in the draft
- [x] `apps/docs/src/decisions/new-project-flow.md`: decision 9 published; changelog entry under the plan's "Added"

### Build Phase 5: Falsification — the agent outlives its project, and the parent guard reads paths as text

**Tier**: med — the work step's default

**Goal**: verify whether the attested state holds against four failure modes found by reading the code. Accepting never stops the conversation's agent, which keeps running in a deleted draft folder and holds the one session slot (`/api/new-projects/[id]/accept` stops nothing; `discard` does). The parent guard (`isUnderParent`) compares `path.resolve` text, so a symbolic link inside the parent leads out of it. Nothing refuses a location inside an existing repository under the parent (`~/code/sandbox/dusk/x` when the parent is `~/code/sandbox`). And a repository may be named `worktrees`, the folder plan worktrees go in. Each row below is one hypothesis; each item is the fix if it confirms.

- [x] Accepting stops the draft's running session before creation starts (the same `sessionManager().current()` / `newProjectSessionPlan(id)` check `discard` makes), in the accept route
- [x] `isUnderParent` compares real paths: the parent's `realpath`, and the `realpath` of the location's nearest existing ancestor joined with the rest — so a link out of the parent is outside it
- [x] `guard` refuses a location inside an existing git working tree (any directory from the parent down to the location's nearest existing ancestor holding `.git`), naming that repository
- [x] `validateProposal` refuses a repository named `worktrees`

#### Build Phase 5 OTel

- [x] A refused creation sets `new_project.refused` on the `new_project.create` span with which guard refused it (`no-parent`, `outside-parent`, `inside-repository`, `exists`, `no-brief`, `proposal`), so refusals are counted in real use, not only in tests

#### Build Phase 5 Verification

- [x] A30–A33 pass; every earlier row still passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/new-project-cli.test.ts src/lib/new-project && cd ../indusk-admin && pnpm exec vitest run src/app/api/new-projects src/components/new-project`); `pnpm exec vitest related` over the changed files

#### Build Phase 5 Context

- [x] mcp: the docblock of `lib/new-project/parent.ts` — the guard compares real paths and refuses a location inside an existing repository — `promise: a-new-project-is-written-only-under-its-parent`

#### Build Phase 5 Shape

- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (`realPathOf` is shared by `isUnderParent` and `repositoryAround` rather than repeated.)

#### Build Phase 5 Document

- [x] `apps/docs/src/guide/new-project.md`: the parent directory section names the two refusals (a link out of the parent, a location inside an existing repository) and that creating a project ends its conversation's agent

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
| `apps/indusk-admin/src/lib/conversation-turns.ts`, `components/new-project/ConversationThread.tsx`, `components/ui/Message.tsx` | the conversation as a thread |
| `apps/docs/src/guide/new-project.md`, `reference/cli/new-project.md`, `decisions/new-project-flow.md`, `guide/worktree-setup.md` | docs |

## Dependencies
- None; `component-content` follows this plan.

## Notes
- The new components (`prompt-box`, `message`, `file-chip`, `knowledge-list`, `workflow-strip`, `layout-tree`, `recommendation`, `project-card`) each get one implementation and a story per state in the phase that first uses them; `plans accept` waits on their approved stories.
