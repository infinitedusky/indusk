# Sessions

The admin plans and builds through the developer's own Claude Code: it starts the `claude` on their machine, on their login, with their hooks, skills and MCP servers, so a session the admin starts behaves like one in their editor. It runs headless and talks to the admin over Claude Code's stream protocol. Introduced by admin-plan-authoring; the decision is `/decisions/admin-plan-authoring`.

## Two kinds

| Kind | Started for | Permission mode | What is asked |
|---|---|---|---|
| **planning** | a planning conversation (`/planner <type> <name>`) | `acceptEdits` | decided in code: a tool given a path inside the plan's folder, or given none, is allowed unasked; a path outside it, and every question the planner asks, reaches the person in the panel |
| **build** | one step of an unattended build (`/work`, `/falsify`, `/cleanup`) | `acceptEdits` | nobody: a tool given a path is allowed inside the plan's worktree and refused outside it; a tool given none runs in the worktree, judged by the project's hooks; a question is answered by telling the session to decide and record why |

Both kinds run `acceptEdits` whatever the developer's own Claude Code is set to, and decide in code (`protocol.ts`, `permissions.ts`). In the spike, a session that inherited `auto` wrote a file outside its project without asking; `bypassPermissions` let a draft's agent write into the repository unasked. Neither kind ever bypasses permissions.

**Every request is recorded with how it was decided.** A request a session makes goes in its log, followed by a `decided` event: allowed, or denied with the reason, and whether the session's own rule decided it (a build, a planning session's writes in its folder, a project conversation's draft) or you did. A planning session's writes inside its folder, decided by rule, are in the log too.

**A decided request shows its outcome.** In the panel, a request with a `decided` event has no Allow, Deny or Answer buttons: a tool shows *Allowed* or *Denied — the reason*, a question the session declined on its own shows *Declined — the reason*, and a question you answered shows *Answered* with the answer you gave. In the project conversation's thread, a decided request is no longer listed as waiting; the thread draws no outcome line. The state is read from the log, so a reload shows the same; a click may close a prompt a moment early, but the event is the record. When the server refuses a click's reply, the request stays open with its buttons back beside the problem shown, never with neither buttons nor an outcome.

## The protocol

```
claude -p --input-format stream-json --output-format stream-json --verbose
       --permission-prompt-tool stdio --permission-mode <default|acceptEdits>
```

Claude writes one JSON object per line. A question (`AskUserQuestion`) and a request to use a tool both arrive as a `control_request` of subtype `can_use_tool`; the reply is a `control_response` with `behavior: allow` (and, for a question, the answers) or `behavior: deny` with a message the session reads. An interrupt is a `control_request` of subtype `interrupt`; the session ends with an `error_during_execution` result.

`lib/session/protocol.ts` holds the whole protocol as pure functions, tested against exchanges recorded from a real session. `--permission-prompt-tool stdio` is the protocol under the official Agent SDK but is not in `claude --help`. A contract test (`session-protocol-contract.test.ts`) runs the real CLI through a question, a write and an interrupt at every landing and release. If Claude Code changes it, the fallback is the Agent SDK with an API key, behind the same `lib/session` interface.

## The panel

New plan, on a project's page, takes a type and a name. It starts the plan on its own branch (`indusk plans start`), then a planning session in the plan's worktree, and opens the plan's page, where the panel runs. The session's first message is `/planner <type> <name>` with instructions to prepare first (read the master, `current.md` and the project's promises), say when it is ready, and ask you to describe the plan. It does not plan from the name. Continue planning sends `/planner <plan>` alone, since the plan's documents already say what it is. In a workbench wrapping more than one repo, the form also asks which repo the plan's code goes in. Approve appears on a plan's page once it is on its own branch with an impl not yet approved. It runs `indusk plans approve` and shows a refusal in the command's own words.

The panel shows what the session says and the tools it uses, in order. A question appears with its choices; the person picks one per question and answers. A request to use a tool can be allowed or denied. Stop ends the session, and what it already wrote stays written. When the session writes a file, the page refreshes, so the plan appears and grows in the sidebar as it is written.

A turn ends one of three ways, and the panel says which. **Turn done** is a turn that completed, with the session's closing text; the session is still there and takes the next message. **Failed** is a turn that ended in an error, shown with the error's first line. When there is no error text, it says why in words instead: the turn limit was reached, or it stopped on an error while running. The session may still be there. **Session ended** is the process itself exiting, with its exit code, which is the only ending after which nothing more arrives. The panel never shows the protocol's own words for these (its `subtype`, such as `success`), which named the turn and read as if they named the session.

The panel only renders the events the package's protocol produced and sends the person's choices back through the routes. It never reads Claude's output itself.

## The daemon owns them

The admin daemon, the one `indusk ui` starts, holds the sessions through one `SessionManager`:

- **One at a time.** A second start is refused, naming the session that is running.
- **Recorded** in `~/.indusk/admin-sessions.json`: id, pid, the program started, project, plan, kind and start time.
- **Stopped from the panel.** The session is interrupted; whatever it already wrote stays written.
- **Never left behind.** `indusk ui stop` ends every recorded session before it stops the daemon. `indusk ui start` ends any that a crashed daemon left. A recorded pid now running a different program is left alone. Nothing restarts a crashed daemon by itself, so a session it left runs until the admin next starts.

### Routes

| Route | Does |
|---|---|
| `GET /api/sessions` | the running session's record, or `null` |
| `POST /api/sessions` | start one: `{ project, plan, kind, prompt }`, in the plan's worktree while it has one |
| `POST /api/sessions/:id/reply` | answer a question (`{ requestId, answers }`) or a tool request (`{ requestId, allow, message? }`), once |
| `POST /api/sessions/:id/stop` | interrupt and end it |
| `GET /api/sessions/:id/events` | its events as server-sent events: everything so far, then each new one |
| `POST /api/trust` | trust a project in Claude Code: `{ project }`, sent by Trust in Claude Code |
| `POST /api/plans/:name/decision` | answer the decision the plan waits on: `{ project, choice: accept \| alternative \| reply, text? }` (see Decisions) |

The daemon listens on `127.0.0.1` only, and every route, reads included, answers only on the admin's own hosts: `127.0.0.1`, `localhost`, `[::1]` and the Caddy route `indusk.dawn`, on any port. Listening on loopback is not enough by itself. Another site can point its own name at `127.0.0.1` (DNS rebinding), and its page then talks to the daemon with an `Origin` and a `Host` that agree. Checking the host refuses it. Every `POST` is also refused unless its `Origin` is the host the request was sent to, so another site's page in the developer's browser cannot start a session, answer one, or accept a plan.

## Decisions

A plan that waits on you waits in one place. Introduced by plan-cockpit; the decision is `/decisions/plan-cockpit`.

**What a plan waits on** is the package's `plans/waiting`, at most one thing per plan, read on every render from what the admin can see:

| Waiting on | When | Accept does | The alternative |
|---|---|---|---|
| a **question** | a session the admin runs for the plan asked (`AskUserQuestion`) and nobody answered (`SessionManager.pendingQuestion`) | answers with the first option, as the panel does; an ask of several questions shows each with its two answers and a box for your own words (words replace the chosen option for that question) and sends them together, an answer under each question's text — never the first alone | answers with the second option |
| **approval** | the impl is a `draft`, every document before it that the plan's type requires is accepted, no session the admin runs for the plan is still writing it (its turn open, nothing asked), and its plan review (`plan-review.md`) is written with every finding answered — once its turn ends, the plan appears here, even while the session stays alive waiting for you | `indusk plans approve` | *Not yet — keep planning*, sent to the agent as words |
| **plan review** | the impl is a `draft`, every document before it is accepted, no session is still writing it and no planning run for it is still going, and `plan-review.md` is missing or leaves a finding unanswered; when the admin's planning run for it stopped, the decision says why, and after an admin restart it says only that the plan needs its plan review | asks the plan's agent, in words, to write it | *Not yet*, sent to the agent as words |
| **review** | the build stopped at review, or the plan stands at review (so it is still listed after the admin restarts) | accepts the plan and starts the release, as the build's Accept does | *Not yet — send it back*, sent to the agent as words |

Every Approve button — the decision card, the plan page and the brief page — asks this answer; while a planning run is going, nothing is listed.

A question outranks the rest: an agent blocked on an answer is the most urgent thing a plan can wait on. A question asked in a terminal session is not seen here; the cockpit shows what the admin runs.

**Needs you**, in the nav under Promises, lists each waiting plan by title with the step it waits at, and links to its page.

**The decision card**, at the top of a waiting plan's page, shows the decision in words, the step, and three ways to answer: accept, the alternative, or a reply in your own words. For a review, the evidence (`indusk plans review`: each promise with the tests that prove it, what falsification found and fixed, the files changed, every skip) is shown inside the card. While the card offers Approve or Accept, the page does not offer them a second time.

**Where a reply goes.** To a question, your words are its answer. Otherwise they go to the plan's agent: said to the session running for the plan if there is one, or else a new planning session is started for the plan, in its worktree, with the decision and your words as its first message. A reply is never queued, since nothing would read a queue until someone opened a session. If another plan's session is running, the reply is refused, naming it, since one session runs at a time.

Every answer goes through `POST /api/plans/:name/decision`. The route reads what the plan waits on again rather than trusting the page, so an answer to a question already answered, or to a review already accepted, is refused rather than sent somewhere else.

### The recorded history


An answer that reached its agent but could not be written to the history is reported as sent, with the reason it was not recorded; it is never reported as a failed answer, because a retry would send it twice. A review accepted once starts its release and the plan stops waiting on review; a second accept while the release runs is refused.
Every answer that reached its target is recorded by `plans/history` as one dated line in `.indusk/plan-history/<plan>.md`:

```
- 2026-10-10T10:00:00.000Z — The plan is written. Approve it, …? — answered "Approve" by person
```

The file is in the main checkout, whichever checkout the admin reads, and each line is committed on `main` as `chore(indusk): <plan> — <answer>` by the same notes writer `current.md` and lessons use. Only that file is committed, so anything you have staged stays staged and out of the commit. When `main` cannot take the commit (the main checkout is on another branch, or a merge, rebase, cherry-pick or revert is in progress), the line stays written and uncommitted, and the route's answer says why. An answer that failed to arrive (a refused approval, say) is not recorded.

The plan's page reads the file back as **What happened**, newest first, so the decisions are still there after the admin restarts. The file is never edited by hand.

## In a workbench

A workbench plan's documents are at the workbench root and its code is in a worktree of the repo its `code.json` names. A session for it runs at the root, so the workbench's own hooks judge every checkoff, and adds the code worktree with `--add-dir`. A build session may write in either place: in the code worktree for the code, and at the root to check items off. Anywhere else is refused, as in normal mode.

## Trust

Claude Code ignores a project's own allow-list until the project is trusted (`hasTrustDialogAccepted` in `~/.claude.json`), and each plan's worktree is a new path it has never seen. So before a session starts in a worktree, InDusk trusts the worktree like its project: when Claude Code already trusts the project, the worktree gets `hasTrustDialogAccepted: true` and nothing else in the file changes. A project nobody trusted is never trusted on their behalf. Such a session still runs, but it ignores its own allow-list, so more is asked. The session's first event says which happened (`trusted` or `untrusted`), and the panel shows it.

A project Claude Code does not trust shows **Trust in Claude Code** on its project page and its plan pages. The click is your consent, as accepting Claude Code's own trust prompt is: it writes `hasTrustDialogAccepted` for the project's root (`POST /api/trust`) and nothing else, and the button goes. Nothing is trusted without the click. The write replaces the file in one rename. Claude Code also writes this file, so a write of its own landing in the same few milliseconds would be lost; that happens once per new worktree.
