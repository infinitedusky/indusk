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

## Trust

Claude Code ignores a project's own allow-list until the project is trusted (`hasTrustDialogAccepted` in `~/.claude.json`). Each plan's worktree is a new path Claude Code has not trusted, even when the project itself is. A session in an untrusted folder still runs; it is asked more, because the allow-list is not applied. The session reports this as its first event, `untrusted`, and the panel says so. InDusk does not write Claude Code's trust record.
