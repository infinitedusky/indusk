---
title: "Recording never waits for a person to think of it"
date: 2026-10-08
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
gate_policy: ask
---

# Recording never waits for a person to think of it

## Goal

A promise broken in production becomes a committed incident, reopens its plan, and is in front of the developer's agent and admin with nobody running a command; an open incident stays loud until it is fixed; a reopened plan can be worked like any other. The six promises are in [brief.md](brief.md); the decisions D1–D10 in [adr.md](adr.md); the 26 assertions in [test-plan.md](test-plan.md).

## Scope

### In Scope
- `lib/promises/record.ts`: the one writer (`recordBreaks`), with its commit, its lock, its mark, the inbox, the heard record and the reminders; `watch` through it; `isBookkeeping` widened
- `hooks/break-inbox.js` on `UserPromptSubmit`, its registration row and the pin's new event
- `promise_health`'s open incidents with age; `promises status` printing them first; the admin's incidents table and counts from the record
- the `record_breaks` tool and the catchup skill's step 8a
- the admin daemon's loop (`instrumentation.ts`), per project naming a production source, with the probe on its own cadence
- `worktree create` / `assign` for a reopened archived plan

### Out of Scope
- the server recording by pull request (workbench-watch-provisioning); pub/sub (ADR D10); the bar chart of checks (plan-cockpit); multi-developer recording; a desktop notification (the VS Code extension)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A8–A13, A15, A16, A18, A24 red; A25 as a guard; the register for the rest | the CLI, the MCP tools, the hooks, the skill and the admin as they are |
| Build Phase 1 | `recordBreaks` (pass + commit + lock + mark); `watch` through it; `isBookkeeping` + incidents | `watchPromises`, `commitTrunkBookkeeping`'s shape, `markPromise` + `initEvalOtel`, `lib/agents/lock.ts` |
| Build Phase 2 | the inbox line, the heard record, the reminders, Slack from the laptop | Build Phase 1's writer; the project home (`bookkeeping/roots`); the server's Slack post |
| Build Phase 3 | `hooks/break-inbox.js`, its `HOOK_REGISTRATIONS` row, the pin's new event, the e2e probe | `_hook-paths.js`, the home's id; `hook-runner.ts` |
| Build Phase 4 | `openIncidents` in `promise_health`; `status` prints them first; the admin's age column, phase link and counts from the record | the registry's incidents; `lib/promises/heard.ts` |
| Build Phase 5 | the `record_breaks` tool; catchup step 8a | Build Phase 1's writer; `promise-tools.ts`; `skills/catchup.md` |
| Build Phase 6 | the admin daemon's loop, the probe cadence, stop with the daemon; A5 in the system tier; A6 live; A7's marks read | Build Phases 1–2; `admin.refresh_ms`; `lib/admin/registry.ts` (the registered projects) |
| Build Phase 7 | `requirePlan` resolving a reopened archived plan; the refusal for a closed one | `reopen.ts`'s `ownerDir`, `after-close.ts`'s `openMaintenancePhasesIn` |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A pass over a production source holding a new violation leaves an incident naming that trace and a Maintenance phase in the owner's impl; a second pass leaves both as they were | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-production-break-is-recorded-unasked | apps/indusk-mcp/src/lib/promises/record.test.ts |
| A2 | What a pass records is committed on the trunk in a commit of its own, named as InDusk's, and the tree is clean after; an owner worked in a plan worktree gets its phase in that copy, left for the plan's session | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-production-break-is-recorded-unasked | apps/indusk-mcp/src/lib/promises/record.test.ts |
| A3 | A pass that cannot read the server, finds it blind, or cannot write records nothing and marks itself broken with the reason; one that recorded or had nothing to record marks itself held | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-production-break-is-recorded-unasked | apps/indusk-mcp/src/lib/promises/record.test.ts |
| A4 | A hand `watch` at the same moment as a recording pass, in one checkout, makes one incident, not two | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-production-break-is-recorded-unasked | apps/indusk-mcp/src/lib/promises/record.test.ts |
| A5 | With the admin daemon running and no page open, a violation marked in a project's production source is recorded within a minute, with nothing typed | Build Phase 6 | Build Phase 6 | planned | contract | promise: a-production-break-is-recorded-unasked | apps/indusk-mcp/src/__tests__/admin-recorder.test.ts |
| A6 | In the demo project, with the admin running, flipping the fault switch against the deployed source puts the committed incident and the reopened plan on screen with nothing typed; timed once | Build Phase 6 | Build Phase 6 | planned | live check | a live check of a-production-break-is-recorded-unasked, recorded in Build Phase 6; the promise is proven by A1–A5 | manual: the seat-holds example exporting to the always-on server, `indusk demo break`, the admin's plan page |
| A7 | In production use every pass that follows a violation ends within a minute of it or marks itself broken; `promises status` reads the recorder's marks like any promise's | Build Phase 6 | Build Phase 6 | planned | promise | a reading of the recorder's own marks, which is what makes a-production-break-is-recorded-unasked a behaviour promise the watcher holds | manual: `indusk promises status` after the loop has run, recorded in Build Phase 6 |
| A8 | Asked to record, catchup's tool opens incidents for every unrecorded production violation, commits them and answers with what it opened; asked again it says nothing was unrecorded | Test Phase 1 | Build Phase 5 | planned | unit | promise: catchup-records-what-it-finds | apps/indusk-mcp/src/__tests__/record-breaks-tool.test.ts |
| A9 | The catchup skill directs the agent to record and report what it opened, and nowhere tells the person to run `watch` | Test Phase 1 | Build Phase 5 | planned | unit | promise: catchup-records-what-it-finds | apps/indusk-mcp/src/__tests__/catchup-records.test.ts |
| A10 | `promise_health` lists each open incident with id, age, owner and whether the owner carries its Maintenance phase, even when no source can be read | Test Phase 1 | Build Phase 4 | planned | unit | promise: an-open-incident-stays-loud | apps/indusk-mcp/src/__tests__/open-incidents-loud.test.ts |
| A11 | `indusk promises status` prints the open incidents, with age and owner, before any source's counts | Test Phase 1 | Build Phase 4 | planned | unit | promise: an-open-incident-stays-loud | apps/indusk-mcp/src/__tests__/open-incidents-loud.test.ts |
| A12 | The admin's promise page shows each open incident's age and links to its owner's Maintenance phase; a fixed one shows when it was fixed | Test Phase 1 | Build Phase 4 | planned | unit | promise: an-open-incident-stays-loud | apps/indusk-admin/src/components/Promises.incidents.test.tsx |
| A13 | The catchup skill puts open incidents, with ages, ahead of the roadmap alongside unrecorded violations | Test Phase 1 | Build Phase 5 | planned | unit | promise: an-open-incident-stays-loud | apps/indusk-mcp/src/__tests__/catchup-records.test.ts |
| A14 | An incident open longer than a day is announced again, in the inbox and in Slack when a webhook is named, once a day and not again the same day across restarts; fixing it ends the announcements | Build Phase 2 | Build Phase 2 | planned | unit | promise: an-open-incident-stays-loud | apps/indusk-mcp/src/lib/promises/reminders.test.ts |
| A15 | `worktree create` on an archived plan with an open Maintenance phase creates its worktree and records the assignment; `assign` accepts one made another way; `list_plans` and the admin read the plan from it | Test Phase 1 | Build Phase 7 | planned | unit | promise: a-reopened-plan-can-be-worked | apps/indusk-mcp/src/__tests__/reopened-plan-worktree.test.ts |
| A16 | `worktree create` on an archived plan with no open Maintenance phase is refused, saying it is archived and how it reopens | Test Phase 1 | Build Phase 7 | planned | unit | promise: a-reopened-plan-can-be-worked | apps/indusk-mcp/src/__tests__/reopened-plan-worktree.test.ts |
| A17 | When a pass opens or extends an incident, the project's inbox gains an entry naming the promise, the incident and the reopened plan | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-break-reaches-the-working-agent | apps/indusk-mcp/src/lib/promises/inbox.test.ts |
| A18 | On a session's next turn the hook puts every undelivered inbox entry in front of the agent and marks it delivered; a later turn repeats nothing; another project's session sees nothing; an unreadable inbox is said | Test Phase 1 | Build Phase 3 | planned | unit | promise: a-break-reaches-the-working-agent | apps/indusk-mcp/src/__tests__/break-inbox-hook.test.ts |
| A19 | Claude Code delivers the hook's text on the prompt after the entry was written: a session asked "what is next" names the broken promise first, without a catchup | Build Phase 3 | Build Phase 3 | planned | contract | promise: a-break-reaches-the-working-agent | apps/indusk-mcp/e2e/break-inbox.e2e.test.ts |
| A20 | Each pass appends what it heard to the project's record, per violation: when, promise, trace, incident; a pass that heard nothing appends nothing; never a trace twice | Build Phase 2 | Build Phase 2 | planned | unit | promise: the-admin-keeps-what-it-heard | apps/indusk-mcp/src/lib/promises/heard.test.ts |
| A21 | The promise page counts a promise's violations over time from the record, including those heard with no page open and those older than the source still holds | Build Phase 4 | Build Phase 4 | planned | unit | promise: the-admin-keeps-what-it-heard | apps/indusk-admin/src/components/Promises.heard.test.tsx |
| A22 | While the production source cannot be read, the page still shows the record, marked as of when the admin last heard, never as zero | Build Phase 4 | Build Phase 4 | planned | unit | promise: the-admin-keeps-what-it-heard | apps/indusk-admin/src/components/Promises.heard.test.tsx |
| A23 | A break seen only by the local daemon is never recorded unprompted: the writer refuses to record `production` for a project naming none, and the daemon starts no loop for it | Build Phase 1 | Build Phase 6 | planned | unit | promise: the-demo-break-is-caught-locally | apps/indusk-mcp/src/lib/promises/record.test.ts, apps/indusk-mcp/src/lib/admin/recorder-loop.test.ts |
| A24 | An incident file counts as InDusk's bookkeeping: `isBookkeeping` says so, and a landing with an uncommitted incident on the trunk is not stopped by it; `watch` by hand commits what it wrote and says so | Test Phase 1 | Build Phase 1 | planned | unit | promise: indusk-leaves-main-clean | apps/indusk-mcp/src/__tests__/incident-bookkeeping.test.ts |
| A25 | An incident the writer opens names the tests that were proving the promise, as a hand-run `watch` does | Test Phase 1 | Test Phase 1 | planned | unit | promise: an-incident-names-its-tests | apps/indusk-mcp/src/__tests__/incident-proven-by.test.ts |
| A26 | In a workbench the writer reads the repo's promises through the one resolver and writes the incident where it says, never to a copy of its own | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-project-has-one-contract | apps/indusk-mcp/src/lib/promises/record.test.ts |

## Checklist

### Test Phase 1: Over the tools, the CLI, the hook runner, the skill and the admin, as they are

**Goal**: author A8–A13, A15, A16, A18 and A24 red against things as they are; run A25 as a guard; record why the rest wait for the symbols their build phases introduce.

- [ ] Confirm this plan's worktree (`indusk worktree create incident-recording` ran on 2026-10-08 and recorded the assignment) — worktree-per-plan default
- [ ] A8: `record-breaks-tool.test.ts` calls `record_breaks` through `toolCaller(registerPromiseTools)` on a fixture project with an open registry; RED: the tool is unknown (the MCP boundary)
- [ ] A9, A13: `catchup-records.test.ts` reads `skills/catchup.md` step 8a: it names the recording tool and "what it opened", never "run `indusk promises watch`" (A9); it ranks open incidents with their ages ahead of the roadmap (A13); RED: today's text says "Run `indusk promises watch` to record them"
- [ ] A10, A11: `open-incidents-loud.test.ts`: `promise_health` through `toolCaller` on a fixture whose registry holds one open incident (opened two days ago, owner archived with its phase) and one fixed, `INDUSK_HOME` a temp dir with no daemon — expect `openIncidents` with id, age ≥ 2 d, owner, `ownerHasPhase: true` beside the source failure (A10); `indusk promises status` through `runCli` on the same fixture prints the open incident with its age before any source line, exit as today (A11); RED: no such field, no such line
- [ ] A12: `Promises.incidents.test.tsx` renders the incidents table with an open incident opened two days ago and a fixed one: expect "2 days" and a link whose href names the owner's plan page and its `Maintenance — <id>` phase; the fixed one shows its `fixed` time; RED: the table has `status` and `date` only
- [ ] A15, A16: `reopened-plan-worktree.test.ts` through `runCli` on a `planLifecycleProject` whose plan is archived with `### Build Phase 2: Maintenance — i-…` holding an unchecked item: `worktree create` succeeds and `indusk worktree list`/`list_plans` show the assignment (A15); the same with every Maintenance item checked is refused, naming the archive and the incident route (A16); RED: both refused with "no plan named"
- [ ] A18: `break-inbox-hook.test.ts` runs `runHook("break-inbox.js", …)` (add the name to `HookName` in `helpers/hook-runner.ts`) with a `UserPromptSubmit` event in a fixture project whose home inbox holds two undelivered entries and one delivered: expect exit 0, `additionalContext` naming the two, and `inbox-delivered.jsonl` grown by two; a second run says nothing; a session in another project says nothing; an inbox with a malformed line is said on its own line; RED: no such hook (a spawned process, a boundary red)
- [ ] A24: `incident-bookkeeping.test.ts`: `isBookkeeping(".indusk/promises/incidents/i-x.md")` is true, and `plans land` through `runCli` on a `planLifecycleProject` with an uncommitted incident file on the trunk lands (the plan touching `.indusk/promises/`); RED: false, and refused as uncommitted work. The "`watch` commits" half joins A2 in Build Phase 1
- [ ] A25: run `incident-proven-by.test.ts`; a guard — the writer reuses `watch`'s `recordViolations`, which names the tests

#### Deferred to Build Phase 1

- **A1, A2, A3, A4, A26** — their subject is `recordBreaks(planRoot, deps)` in `lib/promises/record.ts`, which Build Phase 1 introduces; a test importing it fails to load today. Body reviewed:

  ```typescript
  // record.test.ts — the seam is Build Phase 1's
  const fx = makeFixture(); // lib/bookkeeping/fixture.test-support: main + one plan worktree + a home
  seedRegistry(fx.main, { promise: "seat-released", owner: "seat-holds" /* archived */ });
  const marks = fakeMarks({ "seat-released": [violated("t1", "2026-10-08T20:00:00Z")] });
  const deps = { now: () => at, reads: marks, git: realGit, home: fx.home, mark: recordMark };
  const first = await recordBreaks(fx.main, { source: "production", by: "admin" }, deps);
  expect(first.opened).toEqual([expect.objectContaining({ promise: "seat-released" })]);
  expect(readFileSync(incidentPath)).toContain("t1");
  expect(await git(fx.main, "status", "--porcelain")).toBe("");            // A2: committed
  expect(await git(fx.main, "log", "-1", "--format=%s")).toMatch(/^chore\(indusk\): incident i-/);
  const second = await recordBreaks(fx.main, …, deps);
  expect(second.opened).toEqual([]);                                        // A1: never twice
  // A2, worktree: an active owner assigned to fx.worktree gets its phase there, uncommitted
  // A3: deps.reads that throws JaegerUnreachable → nothing written, mark { outcome: "violated", symptom: /unreachable/ }
  // A4: two concurrent calls → one incident; the second waited on recorder.lock
  // A26: a two-repo workbench (buildTwoRepoWorkbench) → the incident lands where contractResolver says
  ```

#### Deferred to Build Phase 2

- **A14, A17, A20** — their subjects are the writer's three outputs, `lib/promises/inbox.ts`, `heard.ts` and `reminders.ts`, which Build Phase 2 introduces. Body reviewed:

  ```typescript
  // inbox.test.ts (A17): after recordBreaks opened i-…, readInbox(home) has one { kind: "break", promise, incident, owner, phase }
  // heard.test.ts (A20): heard.jsonl gains one line per violation; a pass with none appends nothing; the same trace twice → one line
  // reminders.test.ts (A14): an incident opened 25 h ago → one reminder line + one Slack post (captured); a second pass 1 h later → none;
  //   announced.json survives a "restart" (a fresh call with the same home); the incident fixed → none; no webhook named → inbox only
  ```

#### Deferred to Build Phase 3

- **A19** — the e2e probe needs the hook registered in this repository's settings, which Build Phase 3 does; it runs with `pnpm e2e` (a real `claude`), as the context-tiers probe does. Body reviewed:

  ```typescript
  // break-inbox.e2e.test.ts: write one inbox entry for this project's home; run claude -p "what is next" in a scratch session;
  // expect the answer to name the promise and incident before any plan
  ```

#### Deferred to Build Phase 4

- **A21, A22** — the page's counts come from `lib/promises/heard.ts`'s reader (Build Phase 2) through a prop the page gains in Build Phase 4; a component test rendering that prop today would fail to typecheck and would assert against markup that does not exist. Body reviewed:

  ```tsx
  // Promises.heard.test.tsx: render PromisesTable with heard={[{ at, promise, trace, incident }…]} and sources where production is ok:false
  // A21: the count column shows 3 for seat-released over the last day, including one older than the source window
  // A22: with production unreachable, the counts are still shown with "as of 20:00", and no "0"
  ```

#### Deferred to Build Phase 6

- **A5** — the admin daemon running the loop is Build Phase 6's; the test starts `next start` with a project naming a local Jaeger as its `production` source, in the system tier (`vitest.tiers.ts` `SYSTEM`), the shape of `always-on-source.test.ts`.
- **A6** — the live check: the seat-holds example exporting to the always-on server (`promises.jaeger` + `otlp_url` in its config), the admin running, `indusk demo break`; recorded once with its timing.
- **A7** — the promise-level reading: `indusk promises status` showing the recorder's own marks after the loop has run; recorded once, and read by the watcher from then on.
- **A23**'s second half (no loop for a local-only project) is Build Phase 6's `recorder-loop.test.ts`; its first half is in `record.test.ts` at Build Phase 1.

#### Regression Guards

- **A25** — `watch`'s writer already names the proving tests (`incident-proven-by.test.ts`, planner-promises); the writer reuses it, and the guard keeps it so.

#### Test Phase 1 Verification

- [ ] A8–A13, A15, A16, A18, A24 are authored and fail on their own assertions; A25 passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/record-breaks-tool.test.ts src/__tests__/catchup-records.test.ts src/__tests__/open-incidents-loud.test.ts src/__tests__/reopened-plan-worktree.test.ts src/__tests__/break-inbox-hook.test.ts src/__tests__/incident-bookkeeping.test.ts src/__tests__/incident-proven-by.test.ts; cd ../indusk-admin && pnpm exec vitest run src/components/Promises.incidents.test.tsx`)
- [ ] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims?

### Build Phase 1: One writer

- [ ] `lib/promises/record.ts`: `recordBreaks(planRoot, { source: "production", by: "admin" | "catchup" | "watch", now? }, deps)` — runs `watchPromises` with the deps' reads, then commits (next item), marks the pass (the item after), returns `{ opened, extended, unowned, committed: string[], mark }`; takes `now`, the reads, `git`, the home and `mark` as inputs (`lesson: code-that-decides-takes-its-clock-and-its-reads`); refuses `production` for a project naming no `promises.jaeger`, saying so (A23's first half)
  ```typescript
  export interface RecordDeps { now(): Date; reads: typeof readPromiseMarks; git: typeof git; home: string; mark(m: PassMark): void }
  ```
- [ ] The commit: the incident file, and the owner's `impl.md` when `ownerCopy` resolved to the trunk (archived, or active with no worktree), `git commit -q -m "chore(indusk): incident <id> — <promise>, recorded by <by>" -- <paths>` by path, under `withLock(join(home, "recorder.lock"))` (`lib/agents/lock.ts`); an owner in a worktree keeps its phase uncommitted there (A2, A4)
- [ ] The mark: one root span per pass through `initEvalOtel`'s exporter to the local daemon, `markPromise(span, { promise: "a-production-break-is-recorded-unasked", outcome, symptom })` — `violated` on `JaegerUnreachable`, `WatcherBlind`, a write or commit error, each with its reason; `upheld` otherwise (A3). `promise: a-production-break-is-recorded-unasked` at the site
- [ ] `lib/plans/bookkeeping.ts`: `BOOKKEEPING_DIRS` gains `.indusk/promises/incidents/` (A24); `bin/commands/promises.ts`'s `watch` calls `recordBreaks` with `by: "watch"` and prints what it committed; its docblock loses "commits nothing"
- [ ] A26: `record.test.ts`'s workbench case through `buildTwoRepoWorkbench` — the incident lands where the contract resolver says

#### Build Phase 1 Verification

- [ ] A1–A4, A26 pass, A23's first half passes, A24 passes; A25 still does (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/lib/promises/record.test.ts src/__tests__/incident-bookkeeping.test.ts src/__tests__/incident-proven-by.test.ts src/__tests__/plans-land.test.ts src/lib/promises && pnpm exec vitest related src/lib/promises/record.ts src/lib/plans/bookkeeping.ts src/bin/commands/promises.ts --run`)

#### Build Phase 1 Context

- [ ] root (Key Decisions): `- Incident recording: one writer (\`recordBreaks\`) behind the admin's loop, catchup and \`watch\`; it commits on the trunk and marks its own pass; the admin asks, nothing pushes — see /decisions/incident-recording` — always-on because every reader and writer of incidents must go through it, and a second writer is the collision this plan exists to prevent
- [ ] mcp `CLAUDE.md` single-definition list: `recordBreaks` (`lib/promises/record.ts`) — `promises-single-definition.test.ts` gains the pin. The file is 16382 of 16384 bytes: move one existing entry down to its enforcer's `lesson:` token first, in the same edit

#### Build Phase 1 Document

- [ ] `apps/docs/src/reference/cli/promises.md`: `watch` commits what it writes, naming the commit; the recorder's writer and its mark; `apps/docs/src/changelog.md` Unreleased: Changed — `promises watch` commits

### Build Phase 2: What a pass leaves for the machine

- [ ] `lib/promises/inbox.ts`: `appendInbox(home, entry)` / `readInbox(home)` / `markDelivered(home, ids)` over `inbox.jsonl` + `inbox-delivered.jsonl` in the project's home; the writer appends one `break` entry per opened or extended incident (A17)
  ```typescript
  export interface InboxEntry { id: string; at: string; kind: "break" | "reminder"; promise: string; incident: string; owner: string; phase: string }
  ```
- [ ] `lib/promises/heard.ts`: `appendHeard(home, rows)` / `readHeard(home)` / `countHeard(rows, { bucketMs, since })` over `heard.jsonl`, one line per violation `{ at, promise, trace, incident, source }`, deduplicated by trace (A20)
- [ ] `lib/promises/reminders.ts`: `dueReminders(registry, announced, now, { after: 1 d, every: 1 d })`; the writer appends a `reminder` inbox line for each, posts to Slack when `promises.slack_webhook_env` names a set variable (the server's `postSlack`, moved to `lib/promises/slack.ts` so both use it), and writes `announced.json` after the post is accepted (A14)

#### Build Phase 2 Verification

- [ ] A14, A17, A20 pass; A1–A4 still do (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/promises/inbox.test.ts src/lib/promises/heard.test.ts src/lib/promises/reminders.test.ts src/lib/promises/record.test.ts src/lib/always-on && pnpm exec vitest related src/lib/promises/slack.ts --run`)

#### Build Phase 2 Context

- [ ] current.md (Project shared): the project home now holds `inbox.jsonl`, `inbox-delivered.jsonl`, `heard.jsonl`, `announced.json`, `recorder.lock` beside the eval and highlight files — machine state, never in the repo

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/cli/promises.md`: what the recorder keeps in the home and why each file; `promises.slack_webhook_env` in the config reference; changelog Added — reminders

### Build Phase 3: The hook

- [ ] `hooks/break-inbox.js`: `UserPromptSubmit`; resolves the state root (`_hook-paths.js`) and the home's project id (one definition with `bookkeeping/roots` — a `_project-home.js` port, pinned by count like the other `_` modules); reads undelivered entries, prints `hookSpecificOutput.additionalContext` naming each, appends to `inbox-delivered.jsonl`; exits 0 with nothing in under 100 ms; says on its own line when the inbox cannot be read; `promise: a-break-reaches-the-working-agent` in its header (A18)
- [ ] `HOOK_REGISTRATIONS` gains `["UserPromptSubmit", "", "break-inbox.js"]`; `hookGroups`/`ensureHookRegistered` accept an empty matcher (no `matcher` key written); `hook-registration.test.ts` A24's event and matcher rules learn the new event; `init`/`update` register it; this repository's `.claude/settings.json` and `.claude/hooks/` resynced (hook parity)
- [ ] A19: `e2e/break-inbox.e2e.test.ts` authored and run (`pnpm e2e -- break-inbox`)

#### Build Phase 3 Verification

- [ ] A18 passes; A19 passes in the e2e run; the registration and parity tests still do (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/break-inbox-hook.test.ts src/__tests__/hook-registration.test.ts src/__tests__/hook-cwd-independence.test.ts src/__tests__/hook-sync-parity.test.ts src/__tests__/hooks-record-parity.test.ts src/__tests__/hook-shared-modules.test.ts && pnpm e2e -- break-inbox`)

#### Build Phase 3 Context

- [ ] hooks `CLAUDE.md`: `break-inbox.js` runs on every prompt and must stay under 100 ms — it reads one file and exits; `_project-home.js` mirrors `bookkeeping/roots`'s id

#### Build Phase 3 Document

- [ ] `apps/docs/src/guide/index.md` hooks table: nine hooks, `break-inbox` under its own event; the Dawn master's keep/shed record classifies it (shed: the thin lane has no prompt); `apps/docs/src/guide/multi-agent.md`: how a break reaches a running session

### Build Phase 4: Age in every reader

- [ ] `lib/promises/health.ts`: `openIncidents: [{ id, promise, owner, openedAt, ageMs, ownerHasPhase }]` from the registry, present whether or not any source could be read (A10); `bin/commands/promises.ts`'s `status` prints them first, with age and owner (A11)
- [ ] `apps/indusk-admin/src/components/Promises.tsx`: the incidents table gains `age` and the owner's phase link; a fixed incident shows `fixed` (A12); the page takes `heard` and shows counts per promise from `countHeard`, kept with "as of <last heard>" when production is `ok: false` (A21, A22); `promises-reader.ts` reads the home through `lib/promises/heard`

#### Build Phase 4 Verification

- [ ] A10, A11, A12, A21, A22 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/open-incidents-loud.test.ts src/__tests__/promise-health*.test.ts && pnpm exec vitest related src/lib/promises/health.ts src/bin/commands/promises.ts --run; cd ../indusk-admin && pnpm exec vitest run src/components/Promises.incidents.test.tsx src/components/Promises.heard.test.tsx src/components/Promises.test.tsx`)

#### Build Phase 4 Context

- [ ] admin `CLAUDE.md`: the promise page's counts come from the home's `heard.jsonl` through the package's `promises/heard` subpath, never a second reader; incidents show age and owner

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/tools/indusk-mcp.md`: `promise_health`'s `openIncidents`; `apps/docs/src/reference/admin-ui/promises.md`: the incidents table, the counts and "as of"; changelog Added

### Build Phase 5: Catchup records

- [ ] `tools/promise-tools.ts`: `record_breaks` — runs `recordBreaks` with `by: "catchup"` for the project and answers `{ opened, extended, unowned, committed }` or the refusal (A8)
- [ ] `skills/catchup.md` step 8a: when `promise_health` reports unrecorded production violations, call `record_breaks` and report what it opened; list open incidents with their ages ahead of the roadmap; never "run `indusk promises watch`" (A9, A13); resync `.claude/skills/`

#### Build Phase 5 Verification

- [ ] A8, A9, A13 pass; skill parity still does (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/record-breaks-tool.test.ts src/__tests__/catchup-records.test.ts src/__tests__/skill-sync-parity.test.ts src/__tests__/promise-tools*.test.ts`)

#### Build Phase 5 Context

- [ ] current.md (Project shared): catchup records unrecorded production violations itself; the summary's Promises line names what it opened

#### Build Phase 5 Document

- [ ] `apps/docs/src/reference/skills/catchup.md`: step 8a as it now reads; `apps/docs/src/reference/tools/indusk-mcp.md`: `record_breaks`

### Build Phase 6: The admin daemon's loop

- [ ] `lib/admin/recorder-loop.ts`: `startRecorderLoops({ projects, intervalFor, probeEveryMs: 60_000, record })` — one loop per registered project naming `promises.jaeger` (none for a local-only project: A23's second half), on that project's `admin.refresh_ms`, an in-process guard so a slow pass never overlaps, a thrown pass logged and the interval kept, the probe on its own cadence; `stopRecorderLoops()`; `recorder-loop.test.ts` with fake timers
- [ ] `apps/indusk-admin/src/instrumentation.ts` `register()`: starts the loops in the Node runtime once at daemon start; `ui stop` ends them with the daemon
- [ ] A5: `__tests__/admin-recorder.test.ts` in the system tier (`vitest.tiers.ts` `SYSTEM`): start the admin daemon with a fixture project whose `promises.jaeger` is a local Jaeger holding one violated span; within a minute the incident is committed on the fixture's trunk; stop the daemon
- [ ] A6: the live check — the seat-holds example with `promises.jaeger` pointing at `indusk-always-on` and its exporter at the server's intake, the admin running, `indusk demo break`; record here what appeared and when
- [ ] A7: `indusk promises status` on this project after the loop has run shows `a-production-break-is-recorded-unasked` held; record the output here

#### Build Phase 6 Verification

- [ ] A5 passes in the system tier, A23 passes, A6 and A7 recorded (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/admin/recorder-loop.test.ts src/lib/promises/record.test.ts && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/admin-recorder.test.ts`)

#### Build Phase 6 Context

- [ ] admin `CLAUDE.md`: the daemon runs the recorder loops from `instrumentation.ts`; a project is watched only when it names `promises.jaeger`; `ui stop` ends the loops

#### Build Phase 6 Document

- [ ] `apps/docs/src/decisions/incident-recording.md` with the sequence diagram (server's Jaeger → the admin's loop → the writer → the trunk commit → the inbox → the hook → the agent); `apps/docs/src/reference/admin-ui/overview.md`: the daemon records; changelog Added — the admin records production breaks unasked

### Build Phase 7: A reopened plan's worktree

- [ ] `lib/worktree/plan-worktree-commands.ts` `requirePlan`: resolve the folder as `reopen.ts`'s `ownerDir` does — active, else archived — and accept an archived plan only when `openMaintenancePhasesIn` finds an open phase; otherwise refuse naming the archive and that a plan reopens through an incident (A15, A16); `createPlanWorktree` and `assignPlan` both go through it

#### Build Phase 7 Verification

- [ ] A15, A16 pass; the worktree tests still do (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/reopened-plan-worktree.test.ts src/__tests__/plan-worktree*.test.ts src/lib/worktree`)

#### Build Phase 7 Context

- [ ] planning `CLAUDE.md` (via the package template): a plan reopened from the archive is worked in a worktree like any other, `indusk worktree create <plan>`; a closed plan reopens through an incident, never through `worktree create`

#### Build Phase 7 Document

- [ ] `apps/docs/src/reference/cli/worktree.md`: a reopened archived plan; changelog Fixed

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/record.ts`, `inbox.ts`, `heard.ts`, `reminders.ts`, `slack.ts` | the writer and what it leaves |
| `apps/indusk-mcp/src/lib/plans/bookkeeping.ts` | incidents are bookkeeping |
| `apps/indusk-mcp/src/bin/commands/promises.ts` | `watch` through the writer; `status` prints open incidents first |
| `apps/indusk-mcp/src/lib/promises/health.ts`, `src/tools/promise-tools.ts` | `openIncidents`; `record_breaks` |
| `apps/indusk-mcp/hooks/break-inbox.js`, `hooks/_project-home.js`, `src/lib/hook-command.ts` | the prompt hook and its row |
| `apps/indusk-mcp/skills/catchup.md` | step 8a records |
| `apps/indusk-mcp/src/lib/admin/recorder-loop.ts`, `apps/indusk-admin/src/instrumentation.ts` | the loop |
| `apps/indusk-admin/src/components/Promises.tsx`, `src/lib/promises-reader.ts` | age, phase link, counts from the record |
| `apps/indusk-mcp/src/lib/worktree/plan-worktree-commands.ts` | a reopened plan's folder |
| `apps/indusk-mcp/src/__tests__/helpers/hook-runner.ts` | `break-inbox.js` in `HookName` |

## Dependencies

- small-fixes (closed 2026-10-08): `HOOK_REGISTRATIONS` and `registerHook`, which the hook row extends.
- A deployed always-on server for A6 (`indusk-always-on` on Fly, day-always-on-deploy).

## Notes

- A6 does not need the demo app deployed: the seat-holds example runs locally and exports its spans to the always-on server's intake, which makes that server its `production` source; the switch then breaks the promise "in production" as far as every reader is concerned.
- `promises.slack_webhook_env` is new config: the name of the environment variable holding a webhook, never the webhook. Absent, reminders go to the inbox only.
- The recorder's lock is per project in the home, so two checkouts of one project (a trunk and a plan worktree) share it.
