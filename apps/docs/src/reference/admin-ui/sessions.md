# Sessions

The admin plans and builds through the developer's own Claude Code: it starts the `claude` on their machine, on their login, with their hooks, skills and MCP servers, so a session the admin starts behaves like one in their editor. It runs headless and talks to the admin over Claude Code's stream protocol. Introduced by admin-plan-authoring; the decision is `/decisions/admin-plan-authoring`.

## Two kinds

| Kind | Started for | Permission mode | What is asked |
|---|---|---|---|
| **planning** | a planning conversation (`/planner <type> <name>`) | `default` | every write, and every question the planner asks — the person answers in the panel |
| **build** | one step of an unattended build (`/work`, `/falsify`, `/cleanup`) | `acceptEdits` | nobody: a tool given a path is allowed inside the plan's worktree and refused outside it; a tool given none runs in the worktree, judged by the project's hooks; a question is answered by telling the session to decide and record why |

A planning session uses `default` whatever the developer's own Claude Code is set to. In the spike, a session that inherited `auto` wrote a file outside its project without asking. Neither kind ever bypasses permissions.

## The protocol

```
claude -p --input-format stream-json --output-format stream-json --verbose
       --permission-prompt-tool stdio --permission-mode <default|acceptEdits>
```

Claude writes one JSON object per line. A question (`AskUserQuestion`) and a request to use a tool both arrive as a `control_request` of subtype `can_use_tool`; the reply is a `control_response` with `behavior: allow` (and, for a question, the answers) or `behavior: deny` with a message the session reads. An interrupt is a `control_request` of subtype `interrupt`; the session ends with an `error_during_execution` result.

`lib/session/protocol.ts` holds the whole protocol as pure functions, tested against exchanges recorded from a real session. `--permission-prompt-tool stdio` is the protocol under the official Agent SDK but is not in `claude --help`. A contract test (`session-protocol-contract.test.ts`) runs the real CLI through a question, a write and an interrupt at every landing and release. If Claude Code changes it, the fallback is the Agent SDK with an API key, behind the same `lib/session` interface.

## The panel

New plan, on a project's page, takes a type and a name. It starts the plan on its own branch (`indusk plans start`), then a planning session running `/planner <type> <name>` in the plan's worktree, and opens the plan's page, where the panel runs. Approve appears on a plan's page once it is on its own branch with an impl not yet approved. It runs `indusk plans approve` and shows a refusal in the command's own words.

The panel shows what the session says and the tools it uses, in order. A question appears with its choices; the person picks one per question and answers. A request to use a tool can be allowed or denied. Stop ends the session, and what it already wrote stays written. When the session writes a file, the page refreshes, so the plan appears and grows in the sidebar as it is written.

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

The daemon listens on `127.0.0.1` only, and every route, reads included, answers only on the admin's own hosts: `127.0.0.1`, `localhost`, `[::1]` and the Caddy route `indusk.dawn`, on any port. Listening on loopback is not enough by itself. Another site can point its own name at `127.0.0.1` (DNS rebinding), and its page then talks to the daemon with an `Origin` and a `Host` that agree. Checking the host refuses it. Every `POST` is also refused unless its `Origin` is the host the request was sent to, so another site's page in the developer's browser cannot start a session, answer one, or accept a plan.

## Trust

Claude Code ignores a project's own allow-list until the project is trusted (`hasTrustDialogAccepted` in `~/.claude.json`), and each plan's worktree is a new path it has never seen. So before a session starts in a worktree, InDusk trusts the worktree like its project: when Claude Code already trusts the project, the worktree gets `hasTrustDialogAccepted: true` and nothing else in the file changes. A project nobody trusted is never trusted on their behalf. Such a session still runs, but it ignores its own allow-list, so more is asked. The session's first event says which happened (`trusted` or `untrusted`), and the panel shows it. The write replaces the file in one rename. Claude Code also writes this file, so a write of its own landing in the same few milliseconds would be lost; that happens once per new worktree.
