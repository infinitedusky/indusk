---
title: "Plan authoring from the admin"
date: 2026-10-06
status: proposed
---

# Plan authoring from the admin

## Goal

**A plan can be made, built, reviewed and released from the admin, through
the developer's own Claude Code, with a person asked only to plan, to judge
what the plan declared, and to accept.**

Today the admin only reads. A build stops for approvals at every ritual, a plan
is written on `main`, and nothing in code stops an unaccepted plan from
merging: landing is prose in the retrospective skill.

## Y-Statement

**In the context of:**
InDusk as a planning, implementation and release system built on promises; an
admin daemon that serves every registered project and has no write path; a
spike that drove `claude -p` through a question, a permission request and an
interrupt; and Dawn (`indusk run`), a phase loop that calls model providers
directly.

**Facing:**
no request handler and no owner for a session that outlives a request; a build
that hands back to the person after the impl phases; plans written on `main`
in the trunk's shared working tree; and a landing that is instructions, with
no refusal behind them.

**We decided for:**
one session module in the package that drives the developer's installed
`claude` over its stream protocol; sessions owned by the admin daemon, behind
its first route handlers, bound to localhost; four plan commands (`start`,
`approve`, `accept`, `land`) that the admin, the skills and the terminal all
call; a build orchestrated in code, one fresh session per step, where a pure
function decides the next step; gate skips allowed in a build and listed at
review; and a promise mark, written on commit, for a plan written on `main`.

**And against:**
the Agent SDK, which for a published product means an API key in place of the
developer's subscription; Dawn's loop, which bills an API key, runs none of
the project's skills, MCP servers or trunk guard, and cannot write the ritual
phases; one long session told to do the whole build; a trunk guard that
refuses plan documents on `main`; and a separate session daemon.

**To achieve:**
the demo's plan written and built without a terminal; builds that interrupt
only for what the plan declared; and a merge to `main` that cannot happen
before acceptance.

**Accepting:**
a protocol flag (`--permission-prompt-tool stdio`) that `claude --help` does
not list, pinned by a contract test; uncertainty about how Anthropic's policy
on third-party login applies to a tool that drives the user's own CLI; an
admin that now writes, through package commands; and build skips judged at
review rather than as they happen.

**Because:**
the developer's own Claude Code already carries their login, hooks, skills
and MCP servers, so a session the admin starts behaves like one in their
editor; and a decision written as a function can be tested, where a decision
left to an agent's prose can only be watched.

## Context

[Research](research.md) holds the spike, the headless findings and the
decisions made in conversation; the [brief](brief.md) has the six promises;
the [test plan](test-plan.md) has the 30 assertions. This is step 3 of the
[demo](../indusk-demo/master.md). Three choices were Sandy's (2026-10-06):
the developer's own CLI over the Agent SDK, gate skips recorded and shown at
review, and a plan's documents reaching `main` when its impl is approved.

## Decision

**D1 — One session module drives the developer's `claude`.**
`lib/session/` in indusk-mcp, exported as a subpath. It spawns

```
claude -p --input-format stream-json --output-format stream-json --verbose
       --permission-prompt-tool stdio --permission-mode <mode>
```

in the plan's worktree. `<mode>` is `default` for a planning session (A4) and
`acceptEdits` for a build (A30). The protocol is pure functions over lines:
`parseSessionLine` turns a stdout line into an event (text, question,
permission request, result, error); `answerQuestion`, `decidePermission` and
`interrupt` build the reply. Unit tests feed recorded streams (A1–A3); one
contract test runs the real `claude` through the three exchanges (A5), in the
system tier. A build session's permission requests are decided in code:
allowed inside the worktree, denied outside it (A30). The module refuses to
start in a project Claude Code has not trusted, and says how to trust it,
because an untrusted project's allow-list is ignored (research, the spike).

**D2 — The admin daemon owns sessions.** The admin gets its first route
handlers, all thin calls into D1:

- `POST /api/sessions` starts one; `POST /api/sessions/:id/reply` answers a
  question or a permission request; `POST /api/sessions/:id/stop` interrupts
  it (A21).
- `GET /api/sessions/:id/events` streams its events to the panel
  (server-sent events). The plan page refreshes when a session reports a
  write, through the existing `router.refresh()`.

One session runs at a time; a second is refused, naming the first. Each
session is recorded in `~/.indusk/admin-sessions.json` (`id`, `pid`,
`project`, `plan`, `kind`, `startedAt`). `indusk ui stop` stops every
recorded session before the daemon; a daemon that starts finds recorded pids
still alive, checks each is the `claude` it started, and stops it (A22).

The daemon starts with `-H 127.0.0.1` (today `daemon.ts` passes no host, and
Next.js listens on every interface), and every `POST` checks that its
`Origin` is the admin's own. A route that starts `claude` must never be
reachable from the network.

The admin stays a reader of plan files: everything it writes goes through a
package command or a session, never through its own file writes. This
amends the admin-ui-hosting decision (`/decisions/admin-ui-hosting`), which
made it read-only.

**D3 — Four plan commands, one definition each.** In `lib/plans/`, behind
`indusk plans <verb>`, called by the admin, the skills and the terminal
(A25):

1. **`start <type> <name>`** creates `plan/<name>` and its worktree (reusing
   `createPlanWorktree` and the assignment record) and the plan folder with
   `workflow: <type>` declared. It refuses a name that already has a folder,
   a branch or a worktree, naming which (A7, A10). The admin then starts a
   planning session there with `/planner <type> <name>`; the planner skill
   calls the same command when it starts a plan in the editor.
2. **`approve <name>`** runs `checkPlanContract` on the worktree's copy and
   refuses with its message (A23). It refuses a branch that changes anything
   outside `.indusk/`, and a trunk whose working tree is dirty on the paths
   the branch touches (never stash). Then it merges the branch into `main`
   (`--no-ff`) and sets the impl to `approved`; the build continues on the
   same branch (A8, A9).
3. **`accept <name>`** writes `accepted: <time>` and `accepted_by:
   <person|auto>` to the impl's frontmatter and commits it on the branch.
4. **`land <name>`** refuses a plan with no `accepted` (A18), then does what
   the retrospective's landing step describes today: merge `main` into the
   branch, run the project's checks, merge into `main` with `--no-ff`,
   release and remove the worktree, delete the branch. The retrospective
   skill's landing step calls it instead of spelling the steps out.

A plan's documents reach `main` at approval, when the impl is approved, and
its build at landing.

**D4 — The build is orchestrated in code.** `nextBuildStep(plan, lastStep)`
in `lib/build/` is pure. It takes the parsed plan (through `lifecycle`) and
the outcome of the step just run, and returns one of:

| Returns | When |
|---|---|
| `work` | an impl phase, or a falsification or cleanup phase, is open |
| `falsify` | every phase is closed and no falsification phase or skip exists |
| `cleanup` | falsification is closed and no cleanup phase or skip exists |
| `judgement` (the item) | the next open item is one the plan declared for a person: a deferred verification, a manual or visual check (A12) |
| `review` | every phase, falsification and cleanup is closed (A14) |
| `cannot-continue` (why) | see below (A13) |

**Cannot continue** means one of three things: a step's session ended in an
error after its retries; two steps in a row made no progress (no item
checked, no row's state changed); or the open phase has a `blocker:` line.

The build runner, in the admin daemon, starts a fresh session for each step
(`/work <plan>`, `/falsify <plan>` or `/cleanup <plan>`), waits for its
result, re-reads the plan and asks `nextBuildStep` again (A11). It never
starts `/retrospective`. Judgement items are recognised by the rule Dawn
already uses (`detectHumanGate`), moved to a shared module so both read one
definition. The work, falsify and cleanup skills gain an *unattended* section:
they finish on their own judgement where today they ask the person to
confirm, and `work.md`'s "human-gated by design" text is replaced.

**D5 — A build may skip a gate item, with its reason.** The runner sets
`INDUSK_GATE_POLICY=auto` in each build session's environment;
`check-gates.js` and `validate-impl-structure.js` read it first, as the
per-invocation level the policy table already ranks highest. A skip must
carry its reason. The review lists every skipped item with its reason
(A30).

**D6 — The review is assembled by one function.** `buildReview(root, plan)`
in `lib/build/` returns:

- each promise the plan makes, with the rows naming it and their states, and
  any promise with no passing row marked unproven, read through the same code
  as `indusk promises confirm` (A15);
- each falsification phase: its rows, its fix items and whether they closed
  (A16);
- the files changed, `git diff --stat` of the branch against its merge base
  with `main` (A17);
- every gate item skipped, with its reason (D5).

The panel renders it, and has Accept. Accepting runs `plans accept`, then
starts the release workflow (A19).

**D7 — One release workflow, built in.** A session in the worktree runs
`/retrospective <plan>`, whose landing step calls `plans land`; the version
bump follows as today, and publishing stays the operator's (`pnpm release`,
one-time password). `pnpm release` already refuses an unmerged plan branch
that touches packaged files, so an unaccepted plan cannot be published. A
project with `release.auto_accept: true` in `.indusk/config.json` has the
runner accept at review and go straight on (A20). Configuring the rest of the
workflow belongs to `release-checks-run-once`.

**D8 — A plan written on `main` is marked, not refused** (A29). The commit
path in `eval-trigger.js`, which already finds the repository each commit
lands in, checks a commit that landed on the trunk branch: one that is not a
merge and changes files under an active plan's folder in
`.indusk/planning/<plan>/` marks `a-plan-is-written-on-its-own-branch`
violated, naming the plan and the commit; a merge from `plan/<plan>` marks it
upheld. The mark is written by a new `markPromise(span, name, outcome,
symptom)` in `lib/promises/`, which `markEvaluation` then uses, so the mark
has one definition. It is not checked for commits made in a terminal, outside
Claude Code; the convention it watches is the planner's, which runs in
Claude Code. Commits before this plan lands are not marked.

**D9 — New lifecycle positions, rendered.** `approved`, `in review` and
`accepted` join the lifecycle module, and the admin renders each, in this
plan (the planning rules: a plan that adds a position adds its rendering).

## Alternatives Considered

### The Agent SDK

The supported way to embed Claude Code: `canUseTool`, sessions, hooks and
skills, all documented. Rejected because its documentation says a third-party
product must use API-key authentication, so every planning session and build
would bill an API key instead of the developer's subscription. If the CLI's
stream protocol breaks, the SDK is the fallback, behind the same D1
interface.

### Dawn's loop as the build engine

It already runs phases, guards against moved goalposts and pauses at human
gates. Rejected because it calls providers with an API key, runs only three
of the project's hooks (not the trunk guard), uses none of the project's
skills or MCP servers, does not find a plan in its worktree, and cannot write
the falsification or cleanup phases. Its judgement-item rule is reused (D4).

### One long session for the whole build

Simpler to start. Rejected because the decision to stop would live in an
agent's prose, which no unit test can reach, and the context of one session
covering every phase, falsification and cleanup would not last.

### Refuse plan documents on `main`

Makes U2 testable. Rejected by Sandy (2026-10-06): keep it a convention and
see the violations (D8).

### A separate session daemon

Keeps the admin read-only. Rejected because the admin is already one
long-lived process per machine with a stop command; a second daemon doubles
the lifecycle to manage for no gain while one session runs at a time.

## Consequences

### Positive

- A plan started in the admin or the editor is the same plan, made by the
  same commands.
- Merging to `main` before acceptance is refused in code, wherever the plan
  started.
- The build's stops are decided by a tested function, and each is visible.

### Negative

- The admin is no longer read-only, and exposes routes that start `claude`.
- A build's gate skips are seen at review, not as they happen.
- The skills gain an unattended mode beside the attended one.

### Risks

- **The stream protocol changes.** `--permission-prompt-tool stdio` is not
  in `claude --help`. The contract test (A5) runs at every landing and
  release; the Agent SDK is the fallback.
- **Policy.** Anthropic does not allow third-party products to offer
  claude.ai login. InDusk offers none; it starts the developer's own
  installed CLI, as its evaluator already does. Confidence that this is
  allowed: moderate. If Anthropic says otherwise, D1 moves to the SDK with
  an API key.
- **Unattended work goes wrong quietly.** Falsification and cleanup still
  run, the review shows the evidence, and nothing merges before acceptance.
- **A crashed daemon leaves a session running** until the daemon starts
  again (D2). Nothing restarts the daemon on its own.

## Documentation Plan

### Pages

- `/decisions/admin-plan-authoring`: this decision.
- `/reference/cli/plans`: `start`, `approve`, `accept`, `land`.
- `/reference/admin-ui/sessions`: the panel, its routes, stopping a session,
  localhost only.
- `/guide/plan-lifecycle`: plan → approve → build → review → accept →
  release, from the admin or the editor.
- `/reference/skills/work`: the unattended section; `/reference/skills/
  retrospective`: landing calls `plans land`.

### Diagrams

- A Mermaid sequence for one plan from start to release: the person, the
  admin, the session, the branch and `main`.

### Changelog

- The admin can start, build, review and release a plan.
- `indusk plans start | approve | accept | land`.
- A plan cannot land before it is accepted.

### ADR in Docs

Published to `/decisions/admin-plan-authoring` at close.

## References

- Spike and headless findings: [research](research.md).
- Agent SDK overview, the note on claude.ai login:
  https://code.claude.com/docs/en/agent-sdk/overview
- Dawn's loop: `apps/indusk-mcp/src/lib/run/loop.ts`.
- Landing as prose today: `apps/indusk-mcp/skills/retrospective.md`, Step 10.
