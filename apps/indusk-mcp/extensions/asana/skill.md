# Asana Project Management

Asana provides access to the Asana Work Graph — tasks, projects, sections, comments, custom fields, time tracking, attachments — via Asana's official V2 remote MCP server. You query it with `mcp__asana__*` tools during a Claude Code session.

This is **not an observability tool** (unlike `dash0` and `datadog`). Asana is for project tracking: who's working on what, what's blocked, what comments were left on a task, what's due this sprint. Reach for the Asana extension when the question is about WORK COORDINATION, not about service health.

## One Interface (Remote MCP, OAuth)

Asana ships an **official V2 remote MCP server** at `https://mcp.asana.com/v2/mcp`. The V1 endpoint (`https://mcp.asana.com/sse`) was deprecated and shut down 2026-05-11 — V2 is the only supported version.

Setup is dead-simple compared to dash0 (no token to paste):

1. `cp .indusk/extensions/asana/.env.example .indusk/extensions/asana/.env`
2. `indusk extensions enable asana`
3. Open Claude Code → first MCP call to `mcp__asana__*` triggers the OAuth flow → choose your Asana account → done.

Subsequent sessions reuse the OAuth token transparently. Access tokens expire after one hour; refresh tokens handle renewal automatically without prompting again.

## Auth Model — OAuth, Bounded by User Permissions

Important properties of the Asana V2 OAuth flow:

- **All actions appear as the authorizing user.** If the user authorizing OAuth is a regular team member, MCP-driven edits (creating tasks, adding comments, etc.) appear as that user in audit logs. There's no service-account abstraction.
- **Permissions are bounded by the user's existing Asana access.** The MCP token cannot do anything the user couldn't already do via the Asana web UI. Querying private projects requires the user to be a member.
- **Tokens are scoped to MCP-only.** The OAuth token cannot be reused for the standard Asana REST API — separate auth flows.
- **No dynamic client registration.** Asana V2 only supports pre-registered MCP clients. Claude Code is one; if you're using a different client, you may need to register first.

## When to Use Asana

- **"What's my queue?"** — list tasks assigned to me, sorted by due date or project
- **"What's blocking this PR?"** — fetch the linked Asana task and its comments / dependencies
- **"Where did the spec for X get written?"** — search project descriptions, task notes, comments
- **"Who's owning the Y rollout?"** — query project membership, custom-field assignment
- **"What did I miss this week?"** — list recent activity (comments, status changes) on watched projects
- **"Create a follow-up task"** — write a new task with assignee, due date, project membership, custom fields
- **Status updates from terminal-resident work** — pull progress from the codebase, paste into a project status update

## Common MCP Tools

The exact tool list depends on Asana account features. Common tools (not exhaustive):

- `mcp__asana__list_tasks` — query tasks by project, assignee, status, search string, due date
- `mcp__asana__get_task` — fetch full task details by GID (notes, comments, custom fields, dependencies, subtasks)
- `mcp__asana__create_task` — create new tasks with assignee, project membership, custom fields
- `mcp__asana__update_task` — modify task fields (assignee, due date, status, custom fields)
- `mcp__asana__add_comment` — post a comment on a task
- `mcp__asana__list_projects` — enumerate projects in a workspace or team
- `mcp__asana__get_project` — fetch project details (members, sections, custom field schema)
- `mcp__asana__list_workspaces` — list workspaces the authenticated user belongs to
- `mcp__asana__search` — full-text search across tasks, projects, comments
- `mcp__asana__list_users` — list users in a workspace (for assignment lookups)

The full surface is product-enablement-dependent. Run `mcp__asana__list_tools` (or the discovery tool for your version) once after OAuth completes to see what's available in your account.

## Patterns

**Linking PRs to tasks**: when a commit message or PR description references an Asana task GID or URL, use `mcp__asana__get_task` to pull the task's spec/comments into context. This is far more accurate than guessing from the PR title.

**Status updates from completed work**: when wrapping up a feature, query Asana for the related task, then call `mcp__asana__add_comment` with a summary of what landed (commit SHA + changelog entry + open follow-ups). Better audit trail than out-of-band Slack updates.

**Avoid bulk operations without confirmation**: Asana does NOT have a robust "undo" mechanism for bulk edits. If you're about to update 50 tasks via `update_task`, confirm with the user first. The cost of asking is small; the cost of accidentally clearing 50 due-dates is high.

**Don't write OAuth tokens to logs**: even though tokens are short-lived (1 hour), they're still credentials. If a tool call fails and you're tempted to log the request for debugging, redact the `Authorization` header.

## Troubleshooting

**"OAuth flow didn't open"**: the MCP server URL is wrong or unreachable. Check `.indusk/extensions/asana/.env` — should be exactly `https://mcp.asana.com/v2/mcp`.

**"Authentication required" errors after a long pause**: the refresh token expired. Re-trigger an MCP call → OAuth re-prompts → done. Refresh tokens last ~14 days for inactive sessions.

**"Permission denied" on a known task**: the OAuth-authorizing user doesn't have access. Either they're not a member of the project, or the task was moved to a private project after authorization. Add the user to the project in Asana, then retry.

**"Tool not found"**: the toolset isn't enabled in your Asana plan. Some advanced tools (custom fields, time tracking, Goals) require Business/Enterprise tiers. Discover available tools via the listing tool, not by guessing.

**Rate limits**: Asana's API has per-user rate limits. Bulk-style scripts (listing 1000+ tasks across many projects) can hit them. If you see 429 responses, slow down or batch differently.

## See Also

- [Extensions index](../README.md) — full catalog of InDusk extensions with decision matrix
- [Asana V2 MCP docs](https://developers.asana.com/docs/using-asanas-mcp-server) — canonical reference
- [`dash0/skill.md`](../dash0/skill.md), [`datadog/skill.md`](../datadog/skill.md) — sibling extensions wrapping observability MCP servers (different problem space)
