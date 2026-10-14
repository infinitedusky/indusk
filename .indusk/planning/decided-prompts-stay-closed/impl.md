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
| A8 | Watching a real build in the cockpit, no prompt is left looking undecided, and a reload leaves every one decided | Build Phase 2 | Build Phase 2 | planned | live check | the brief's expectation: watching a build shows no prompt waiting unless it is | recorded in this impl, Build Phase 2 |

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
- [ ] A8 live check: run a build of a small approved plan from the cockpit, watch the panel, reload mid-build, and record here what was seen (the plan, the number of requests, any left open)
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 2 Verification

- [x] A1, A2, A4, A6, A7 pass, A3 still passes (`cd apps/indusk-admin && pnpm exec vitest run src/components/session/SessionPanel.test.tsx src/lib/conversation-turns.test.ts && pnpm exec vitest related src/components/session/SessionPanel.tsx src/lib/conversation-turns.ts --run`); tsc and biome clean on the changed files
- [ ] A8 recorded above with what was seen

#### Build Phase 2 Context

- [x] `apps/indusk-admin/CLAUDE.md`: a view reads whether a request is decided from its `decided` event, never from a set of its own; a click may close a prompt early but the event is the record. Guarded by `SessionPanel.test.tsx` (A6) and `conversation-turns.test.ts` (A4)

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/admin-ui/sessions.md`: a decided request shows its outcome in the panel and the thread; and correct the page's stale line that a planning session runs under `default` (it runs `acceptEdits`, deciding in code, `protocol.ts`)

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
