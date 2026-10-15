---
title: "Open core and the workbench server"
date: 2026-10-15
status: in-progress
---

# Open core and the workbench server — Research

Two ends of one spectrum, settled in conversation with Sandy on 2026-10-14/15,
so that work can start without asking each time "is this server or local?".
It answers the open question left in
[indusk-product-direction.md](indusk-product-direction.md) (April): *open
source the process layer (growth) or keep it proprietary (moat)?* — both, split
by one rule.

## The two ends

**Open core — local, no server.** Anyone can take the promise-driven core and
do what they like with it: promises as files, the plan lifecycle in Claude
Code, marks as plain OpenTelemetry read from a local Jaeger. Minimal setup, no
account, no server. This is how InDusk gets attention.

**The workbench server — a subscription.** One box per team, started with one
command, running everything: `claude`, git, the worktrees, the admin, the looks
checks. People use a browser; nothing is installed on their machine. One copy
of everything is the synchronisation: who is on what, live. Builds run with
laptops shut; the promise loop runs always.

The server is **not a fork**. It is the open core plus hosting, sync, identity
and a runner.

## The sorting rule — decided once

A capability goes in the **server** when it needs either of:

1. **to run continuously** — while nobody is at a keyboard (the watcher, an
   unattended build, the diagnosis loop running on every break); or
2. **to know more than one person** — identity, shared state, approvals by
   someone, Slack, who is working on what.

Everything else is **core**. Asked of each new capability as it is planned —
never as a separate "what goes in the open source" pass afterwards. The rule is
what stops cherry-picking.

| Core (open, local) | Server (subscription) |
|---|---|
| Promises as files: declare, check, confirm | The always-on watcher reading production telemetry |
| The plan lifecycle in Claude Code: skills, hooks, gates | A break opens an incident and reopens its plan, unattended |
| Marks as plain OpenTelemetry; local `promises status` | The diagnosis loop on every break, continuously |
| Looks lint and check (CLI) | Agents on the box, each person on their own Claude account |
| A single-user local admin view (it demos well) | Shared state, identity on approvals, Slack |

Read simply: **the core detects, on your machine, when you run it; the server
closes the loop, continuously, for a team.** The outer loop is what InDusk wants
to be known for — free to try, paid to have running.

## The rule that keeps it cohesive

**The server never holds anything the files do not.** Promises, plans,
incidents, approvals and their history stay in the repository. A team can stop
paying and keep everything; that is also the strongest trust message for an
open-source launch.

Consequence for the core today: anything that assumes the admin daemon or a
machine-global home (`~/.indusk/`) must keep working without either.

## The workbench server — what was settled

- **Option A, not B.** The work runs on the box (one copy), not locally with a
  sync layer (B: every copy drifts, and drift is today's hardest problem).
- **One box per team, the team's own** — the same "yours, one command" pattern
  as `indusk server deploy`; multi-tenant hosting is deferred until asked for.
- **Each person on their own Claude account.** Claude Code runs on a Linux box;
  a person gives the box their own token once (`claude setup-token` →
  `CLAUDE_CODE_OAUTH_TOKEN`), and every session they start runs on it, so usage
  lands on their own subscription. The box never shares one account. Without a
  connected account a person can look, comment and approve, but not start an
  agent. Tokens are per-person secrets: never shown, revocable by their owner.
- **To check before building:** what Anthropic's own cloud sessions
  (claude.ai/code, Remote Control) already provide, before running boxes
  ourselves.

## Order

1. **This split** — decided here; cheap.
2. **`mark-first`** — Sandy's priority: lean on telemetry far more than tests.
   Its pieces sort cleanly: clauses, marks, browser marks and local reading are
   core; the diagnosis running on every break unattended is server.
3. **The Homework Gate run** through the admin, locally, noting every place
   local hurts — evidence for the workbench server.
4. **`workbench-server`** as a plan, with that evidence.

## Open Questions

- Licence for the core.
- Whether the local admin view is in the core from the first release or follows.
- Repository split: one repo with a core package and a server package, or two
  repos. The rule above works with either; one repo is simpler while one person
  builds both.

## Sources

- `.indusk/research/indusk-product-direction.md` — the April thesis and its
  open-source question
- `/decisions/server-provisioning` — "every recording server is the person's
  own"
- `.indusk/planning/mark-first/` — telemetry over tests
