---
title: "Decided prompts stay closed"
date: 2026-10-14
status: in-progress
workflow: bugfix
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
approved_brief: "458b34365821f6437a177f2be6a459bb881dfac26d9b76baeead937d83cade51"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-14T23:04:11.069Z"
---

# Decided prompts stay closed

## Goal

Every request a session makes is recorded in its log together with how it was decided, so the panel draws a decided request as decided, and keeps it that way after a reload. Today a build's requests are streamed to the panel and then answered in code (`build-session.ts`), but nothing tells the panel they were answered. The panel knows a request is done only from a set in the browser that a click fills (`SessionPanel.tsx`, `answered`), so every auto-answered request stays open, and a reload reopens even the ones a person answered. The new-project thread reads the same browser-held set (`conversation-turns.ts`). A planning session's auto-allowed requests are dropped before the log (`manager.ts`), so they never appear at all.

## Scope

### In Scope
- A `decided` event the session manager records after every decision: by the session's rule (a build's, a planning session's, a confined draft's) or by a person's reply.
- The session panel and the conversation thread read a request's state from that event.
- The panel draws a decided request with its outcome: allowed, or denied with the reason.

### Out of Scope
- How any session decides (`permissions.ts` is unchanged).
- The look of every session as one conversation (`one-conversation-view`).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `{ type: "decided"; requestId; allow; message?; by: "rule" \| "person" }` on `StartedEvent`; the manager records it after every decision and keeps auto-decided requests in the log; `reply(id, reply, by?)` | `permissions.ts`'s decisions, `build-session.ts`'s replies |
| Build Phase 2 | `SessionPanel` and `turnsOf` read `decided` events; the panel's outcome line | Build Phase 1's event |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | During a build, a request to write inside the worktree shows in the panel already allowed, with no Allow or Deny | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-prompt-shows-only-when-a-person-must-choose | apps/indusk-mcp/src/lib/build/build-session.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A2 | During a build, a request to write outside the worktree shows already denied, with the build's reason, and no Allow or Deny | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-prompt-shows-only-when-a-person-must-choose | apps/indusk-mcp/src/lib/build/build-session.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A3 | A request nothing has decided, in a running session, still shows Allow and Deny | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-prompt-shows-only-when-a-person-must-choose | apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A4 | In the new-project conversation, a request its agent's rule decided is not waiting on the person | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-prompt-shows-only-when-a-person-must-choose | apps/indusk-admin/src/lib/conversation-turns.test.ts |
| A5 | A request a planning session allowed on its own rule appears in the log as allowed | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-decided-request-stays-decided | apps/indusk-mcp/src/lib/session/manager.test.ts |
| A6 | A request the person allowed or denied shows the outcome they chose, and a panel connecting afterwards shows it decided, with no buttons | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-decided-request-stays-decided | apps/indusk-mcp/src/lib/session/manager.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A7 | A question a build declined on its own shows as declined, with the reason, never as waiting | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-decided-request-stays-decided | apps/indusk-mcp/src/lib/build/build-session.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A8 | Watching a real build in the cockpit, no prompt is left looking undecided, and a reload leaves every one decided | Build Phase 2 | Build Phase 2 | passing | live check | the brief's expectation: watching a build shows no prompt waiting unless it is | recorded in this impl, Build Phase 2 |
| A9 | A question the person answered shows the answer they gave, and a panel connecting afterwards (a reload) still shows it answered with that answer, not a blank question with every option disabled | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-decided-request-stays-decided | apps/indusk-mcp/src/lib/session/manager.test.ts, apps/indusk-admin/src/components/session/SessionPanel.test.tsx |
| A10 | A click on Allow, Deny or Answer whose reply the server refuses leaves the request waiting with its buttons back, never with neither buttons nor an outcome | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-prompt-shows-only-when-a-person-must-choose | apps/indusk-admin/src/components/session/SessionPanel.test.tsx, apps/indusk-admin/src/components/new-project/ConversationThread.test.tsx |
| A11 | A click closes its request at once; a reply the server refuses reopens it, and an accepted one keeps it closed — one hook the panel and the thread both use | Build Phase 4 | Build Phase 4 | written | unit | promise: a-prompt-shows-only-when-a-person-must-choose | apps/indusk-admin/src/components/session/use-answered-requests.test.tsx |

## Checklist

### Test Phase 1: Author every assertion, RED

**Tier**: med — the work step's default

**Goal**: author A1–A7 against today's code and read each failure; A3 is a guard that passes at once.

- [x] Create/confirm this plan's worktree (`indusk worktree create decided-prompts-stay-closed`; made by `indusk plans start`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] A1, A2, A7 (package half) in `build-session.test.ts`: run a build step against the manager with the existing fake session, emit an inside write, an outside write and a question, and read the events a subscriber hears. Each request is followed by a `decided` event (`allow: true`; `allow: false` with the refusal's message; the question declined with its message), `by: "rule"`. Read the event's `type` as a string so the file loads before the type exists. RED today: no `decided` event
- [x] A5 and A6 (package half) in `manager.test.ts`: a planning session's auto-allowed permission is in the events, followed by `decided` `by: "rule"`; a person's `reply` is followed by `decided` `by: "person"` with their outcome; a subscriber joining afterwards hears both. RED today: the auto-allowed request is dropped, and no `decided` event is recorded
- [x] A1, A2, A6, A7 (panel half) in `SessionPanel.test.tsx`: render a fresh panel (as after a reload) with `[permission, decided]`, running. It shows no Allow/Deny, and shows "Allowed", or "Denied" with the message. RED today: the buttons show
- [x] A3 in `SessionPanel.test.tsx`: a running panel with an undecided permission shows Allow and Deny
- [x] A4 in `conversation-turns.test.ts`: `turnsOf([permission, decided])` with no `answered` set lists nothing waiting. RED today: the permission is waiting
- [x] Confirm each red test fails on its own assertion rather than on a missing import

#### Deferred to Build Phase 2

- **A8** — a live check of the built change in the running cockpit; nothing exists to watch before Build Phase 2 lands.

#### Regression Guards

- **A3** — a request that waits on a person must keep its buttons; today's panel already shows them, and the change must not hide them.

#### Test Phase 1 Verification

- [x] A1, A2, A4–A7 authored and each fails on its own assertion; A3 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/build/build-session.test.ts src/lib/session/manager.test.ts; cd ../indusk-admin && pnpm exec vitest run src/components/session/SessionPanel.test.tsx src/lib/conversation-turns.test.ts`)

### Build Phase 1: The manager records every decision

**Tier**: med — the work step's default

**Goal**: one `decided` event, recorded by the manager wherever a request is decided.

- [x] `session/start.ts`: add to `StartedEvent`
  ```typescript
  /** How a request was decided, recorded after its decision: by the session's own rule or by a person. */
  | { type: "decided"; requestId: string; allow: boolean; message?: string; by: "rule" | "person" }
  ```
- [x] `session/manager.ts`: one private `record(holder, opts, ev)` that pushes, calls `opts.onEvent` and notifies listeners (today's three lines in `onEvent`), used for every event. The confined and planning paths record the permission, decide it, then record its `decided` (`by: "rule"`), instead of returning before the log. `reply` takes `by: "rule" | "person" = "person"` and records `decided` after `h.answered.add`
- [x] `build/build-session.ts`: both of its `manager.reply` calls pass `by: "rule"`
- [x] A draft's `transcript.jsonl` is appended through `opts.onEvent`, so a reopened draft keeps its decisions; confirm by reading `startProjectConversation`
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape (`manager.ts`) — the confined and planning paths repeated record, decide, record; extracted `decideByRule`
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing further to change.

#### Build Phase 1 Verification

- [x] A5 passes, and the package halves of A1, A2, A6 and A7 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/build/build-session.test.ts src/lib/session/manager.test.ts && pnpm exec vitest related src/lib/session/manager.ts src/lib/session/start.ts src/lib/build/build-session.ts --run`); tsc and biome clean on the changed files

#### Build Phase 1 Context

- [x] `apps/indusk-mcp/CLAUDE.md` (Run, verify, Shape, cleanup → `lib/build/`): every request a session makes is recorded with a `decided` event by the manager, by rule or by person; a decision is never made off the log. Guarded by `manager.test.ts` (A5, A6)

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/admin-ui/sessions.md`: every request a session makes is recorded with how it was decided, by the session's rule or by the person

### Build Phase 2: The panel and the thread read the decision

**Tier**: med — the work step's default

**Goal**: a request's state comes from its `decided` event, in the panel and in the thread alike.

- [x] `SessionPanel.tsx`: build a `requestId → decided` map from `events`; `open` is `running && !decided.has(id) && !answered.has(id)` (the local set stays, so a click closes the prompt before the event arrives); a permission with a decision shows its outcome line, "Allowed", or "Denied — {message}", in place of the buttons; a question with a declining decision shows "Declined — {message}"
- [x] `lib/conversation-turns.ts`: `turnsOf` treats a request with a `decided` event as answered, whatever `answered` set it is handed; a `decided` event is not drawn as a line of its own
- [x] A8 live check: run a build of a small approved plan from the cockpit, watch the panel, reload mid-build, and record here what was seen (the plan, the number of requests, any left open)
  - Seen 2026-10-14, `cockpit-audit-fixes` built from this branch's admin (`next dev -p 3942` in the worktree), a scripted Chromium sampling the panel every 20s. Build step: requests rose 1 → 23, every one "Allowed", no Allow, Deny or Answer button at any sample. A fresh page connecting mid-build (the reload) showed 17 of 17 "Allowed", no buttons; a second reload after the build moved to falsify showed the new session, nothing waiting. No request was denied or declined, so those outcomes were not seen live (A2, A7 hold them in tests). No blank row for a `decided` event. Seen, not yet judged: a decided request still sits in the yellow `border-warn bg-warn-wash` card a waiting prompt uses (`SessionPanel.tsx:226`), with "Allowed" inside it
  - Judged 2026-10-15 by Sandy, shown the screenshot: "that look fine". The yellow card stays; a decided request's look is `one-conversation-view`'s to draw
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.
  - The review's file list also held everything the merge of main brought in (the phase opened before it); the files this phase wrote are `SessionPanel.tsx` and `conversation-turns.ts`. `decisionsOf` is one named reader; the thread's own set of decided ids is the same idea in a second file, which is `/cleanup`'s to judge, not Shape's

#### Build Phase 2 Verification

- [x] A1, A2, A4, A6, A7 pass, A3 still passes (`cd apps/indusk-admin && pnpm exec vitest run src/components/session/SessionPanel.test.tsx src/lib/conversation-turns.test.ts && pnpm exec vitest related src/components/session/SessionPanel.tsx src/lib/conversation-turns.ts --run`); tsc and biome clean on the changed files
- [x] A8 recorded above with what was seen

#### Build Phase 2 Context

- [x] `apps/indusk-admin/CLAUDE.md`: a view reads whether a request is decided from its `decided` event, never from a set of its own; a click may close a prompt early but the event is the record. Guarded by `SessionPanel.test.tsx` (A6) and `conversation-turns.test.ts` (A4)

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/admin-ui/sessions.md`: a decided request shows its outcome in the panel and the thread; and correct the page's stale line that a planning session runs under `default` (it runs `acceptEdits`, deciding in code, `protocol.ts`)

### Build Phase 3: Falsification — an answered question's outcome, and a refused click

**Tier**: med — the work step's default

**Goal**: verify whether the attested state holds against two failure modes found by reading the code. (1) The `decided` event a person's answer records carries only `allow: true` (`manager.ts` `reply` → `decidedBy(…, { allow: true })`), and `QuestionView` keeps the picks in component state (`chosen`), so after a reload an answered question renders every option disabled, none selected, and no outcome line: it looks like an unanswered question, not "done with its outcome" as `a-decided-request-stays-decided` promises. (2) `SessionPanel` and `ConversationThread` still add the request to their local `answered` set on click, and `SessionConnector.post` only sets `problem` when the reply route refuses (409) or the request fails; the set is never undone, so the request is still waiting in the manager while the panel shows neither buttons nor an outcome until a reload.

- [x] `session/start.ts`: the `decided` event carries `answers?: Record<string, string>` for a question a person answered
- [x] `session/manager.ts` `reply`: a reply with `answers` records `decided` with those answers
- [x] `SessionPanel.tsx` `QuestionView`: a question with an allowing decision shows "Answered — {each question: answer}" from the decision, in place of the Answer button (options stay disabled)
- [x] `SessionPanel.tsx` + `SessionConnector.tsx`: `onAnswer`/`onDecide` resolve to whether the reply was accepted; on a refusal the panel removes the request from its local `answered` set, so its buttons come back beside the shown problem
- [x] `ConversationThread.tsx` + `NewProjectConversation.tsx` (`session.answer`/`session.decide`): the same — a refused reply reopens the request in the thread
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.
  - `settle` (close a prompt at once, reopen it on a refusal) is written in `SessionPanel.tsx` and in `ConversationThread.tsx`; two copies across files is `/cleanup`'s to judge, not Shape's

#### Build Phase 3 Verification
- [x] A9: a person's `reply` with answers records `decided` carrying them; a fresh panel rendered with `[question, decided{answers}]` shows "Answered" with the answer and no Answer button — fails today (no answers on the event, no outcome line) (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/session/manager.test.ts; cd ../indusk-admin && pnpm exec vitest run src/components/session/SessionPanel.test.tsx`)
- [x] A10: a running panel and a running thread whose `onDecide`/`onAnswer` resolve `false` show Allow and Deny (or Answer) again after the click — fails today (the buttons stay gone) (`cd apps/indusk-admin && pnpm exec vitest run src/components/session/SessionPanel.test.tsx src/components/new-project/ConversationThread.test.tsx`)
- [x] A1–A8 still pass; tsc and biome clean on the changed files (`cd apps/indusk-admin && pnpm exec vitest related src/components/session/SessionPanel.tsx src/components/new-project/ConversationThread.tsx --run`)

#### Build Phase 3 Context
- [x] `apps/indusk-admin/CLAUDE.md`: amend the decided-event entry — a click's early close is undone when the reply is refused; an answered question's outcome is read from its `decided` event's answers. Guarded by `SessionPanel.test.tsx` (A9, A10)

#### Build Phase 3 Document
- [x] `apps/docs/src/reference/admin-ui/sessions.md`: an answered question shows the answer given; a refused click leaves the request open with the problem shown

#### Build Phase 3 — what the falsification looked at
- Searched without an attack vector: the confined and planning rule paths (`decideByRule`; the draft's `transcript.jsonl` is written by a `subscribe` listener in `new-project-session.ts`, not `opts.onEvent` as Build Phase 1 assumed, and `record(…, false)` still notifies listeners, so a reopened draft keeps both events); a double reply (refused by `h.answered`); the build's question decline (its message is never empty); `pendingQuestion` and Needs you (read `h.answered`, which `reply` still fills); `turnsOf` (collects decisions in a first pass, so order does not matter).
- Seen, not authored: in a build a live subscriber hears `decided` before its `permission` (`record` calls the build's `onEvent`, which replies, before the listeners run), while the log replayed to a reconnecting panel is in order. Every reader builds a map first, so nothing draws it wrong.
- Not investigated: what a panel shows once the manager drops a session's events at `stop` (a finished build step); that is the session's lifetime, not how a decision is recorded.

### Build Phase 4: Cleanup — one reader of a request's decision, one closer of a click

**Tier**: med — the work step's default

**Goal**: decompose what this plan grew twice in the admin, per the `typescript` extension's extract-a-module idiom (no `react`/`nextjs` extension is enabled). The plan wrote the same two pieces in two files: the "close on click, reopen when the reply is refused" state (`settle` plus a local `answered` set, identical in `SessionPanel.tsx` and `ConversationThread.tsx`), and the "which requests are decided" reading of the log (`decisionsOf` in `SessionPanel.tsx`, a hand-rolled `decided` set in `conversation-turns.ts`). Each pair holds one invariant the admin's `CLAUDE.md` now states, so each becomes one unit. `SessionPanel.tsx` is also over its cap (442 / 400).

- [x] Extract the click-closing state into `apps/indusk-admin/src/components/session/use-answered-requests.ts`: `useAnsweredRequests()` returning `{ answered, settle }`; `SessionPanel` and `ConversationThread` use it and drop their copies — two identical stateful copies of one invariant (a refused reply reopens the request); a third view would copy it again
- [ ] Move `Decision` and `decisionsOf` from `SessionPanel.tsx` into `apps/indusk-admin/src/lib/request-decisions.ts`; `SessionPanel` imports them, and `turnsOf` (`conversation-turns.ts`) uses `decisionsOf(events)` in place of its own `decided` set — one reader of the `decided` record, in `lib/` where the non-component reader can import it without reaching into a component file
- [ ] Extract `QuestionView` (and its `OTHER` constant) from `SessionPanel.tsx` into `apps/indusk-admin/src/components/session/QuestionView.tsx` — a self-contained component with its own state (`chosen`, `other`), about 130 lines, the panel's largest unit; brings `SessionPanel.tsx` under its cap
- [ ] (reviewed `apps/indusk-mcp/src/lib/session/manager.ts` — left as-is: 413 / 400, the overage is `record`, `decideByRule` and `decidedBy`, which exist to keep every event on one path through the class; moving them out would split the log from the manager that owns it)
- [ ] (reviewed `SessionPanel.test.tsx` (402) and `manager.test.ts` (513) — left as-is: each is one subject's tests grouped by trajectory row; splitting by row would scatter shared fakes)
- [ ] (reviewed `build-session.ts`, `start.ts`, `SessionConnector.tsx`, `use-project-session.ts` — left as-is: small edits, under cap, no repeat across files)

#### Build Phase 4 Verification
- [ ] A11: the hook's own test (`cd apps/indusk-admin && pnpm exec vitest run src/components/session/use-answered-requests.test.tsx`)
- [ ] Behaviour parity: A1–A10 still pass (`cd apps/indusk-admin && pnpm exec vitest run src/components/session/SessionPanel.test.tsx src/components/new-project/ConversationThread.test.tsx src/lib/conversation-turns.test.ts && pnpm exec vitest related src/components/session/SessionPanel.tsx src/components/session/QuestionView.tsx src/components/new-project/ConversationThread.tsx src/lib/conversation-turns.ts --run`); tsc and biome clean on the changed files

#### Build Phase 4 Context
- [ ] `apps/indusk-admin/CLAUDE.md`: the decided-event entry names its two units — `lib/request-decisions.ts` (`decisionsOf`) is the one reader of a request's decision, `useAnsweredRequests` the one early close of a click

#### Build Phase 4 Document
- [ ] (none — internal decomposition; asked/user proof to be recorded at `/work` per `gate_policy: ask`)

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/session/start.ts` | `decided` on `StartedEvent` |
| `apps/indusk-mcp/src/lib/session/manager.ts` | records every request and its decision |
| `apps/indusk-mcp/src/lib/build/build-session.ts` | replies `by: "rule"` |
| `apps/indusk-admin/src/components/session/SessionPanel.tsx` | reads decisions; outcome line |
| `apps/indusk-admin/src/lib/conversation-turns.ts` | reads decisions |
| tests named in the trajectory | A1–A7 |

## Dependencies

- None. sessions-per-plan (in progress) also edits `manager.ts`; whichever lands second rebases.

## Notes

- A `decided` event is recorded by the manager only; the protocol parser never produces one, so it sits on `StartedEvent`, beside `you` and `exit`.
