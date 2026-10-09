---
title: "VS Code extension — promises in the editor, the break where the fix happens"
date: 2026-10-08
status: complete
---

# VS Code extension — Research

## Question

What does it take for the editor to show each promise at the code that keeps
it, with its live health, and to turn a production break into Claude working
on the fix in one action?

## Background

Step 4 of the root master's "Now — show the promise loop" and child 9 of the
[demo](../indusk-demo/master.md): "promise markers on the code that carries
each promise, live health from telemetry, 'fix with Claude' on a break. The
break moment, where the fix happens." The demo's script ends on a production
break: Slack hears, the admin shows it red, it is recorded and fixed. Today the
fix starts with a person reading the admin and opening a terminal. The editor
is where the code is, and where the fix happens.

The standing rule (root master, after the launch list): **one source of truth,
several windows** — the promise files and telemetry, read through the package;
the editor, the admin and DevTools only show them.

The April note [`indusk-interface.md`](../../research/indusk-interface.md)
weighed a VS Code fork against an extension and webviews; this plan takes the
smallest of those, an extension.

## Findings

### What the editor can read

- **Where a promise is kept**: code carries `promise: <name>` in a comment.
  The grammar is defined once, `lib/tokens.ts` (`TOKEN_OPENER`, `TOKEN_KINDS`);
  `indusk promises confirm` records each promise's `sites:` and `tests:` in its
  file under `.indusk/promises/`. The demo app marks its promise in
  `examples/seat-holds/src/telemetry.ts`.
- **The registry**: `@infinitedusky/indusk-mcp/promises/registry` (name, kind,
  state, statement, owner, sites, tests, incidents).
- **Health**: computed by the admin in `apps/indusk-admin/src/lib/promise-health.ts`
  (`readHealth`, `redPlans`) over the package's exported readers
  (`promises/sources`, `promises/telemetry`, `promises/timeline`). The CLI's
  `indusk promises status` prints prose and has no machine-readable output.
  Two windows computing health each their own way is the drift the standing
  rule forbids; the ADR decides where the one health reader lives.
- **Both sources**: `local` (the telemetry daemon) and `production`
  (`promises.jaeger`, credential from the environment or `~/.indusk/config.env`
  since server-provisioning).

### The machine

VS Code 1.141.0 is installed (`/usr/local/bin/code`). Cursor runs VS Code
extensions from a `.vsix` as well.

### What "fix with Claude" can start

The admin already starts the developer's own `claude` headless for planning
and building (`lib/session/`). The editor's version is simpler: a terminal in
the project running `claude` with a first message carrying the promise, its
symptom, the trace link and the tests that prove it — the same facts an
incident records.

## Decisions

Sandy accepted the five promises and the expectation as read back on
2026-10-08. The five questions were not answered one by one; these are the
defaults, each to be corrected if wrong:

- **Both people**: the developer coding, who sees a promise in the file they
  are in, and the one sent by a break.
- **A break shows three ways**: a red marker on the line that keeps the
  promise, an entry in the Problems list, and one notification per new break.
  Both sources are shown, production first, as the admin does.
- **"Fix with Claude" opens the developer's own `claude` in a terminal** in
  the project, the break's facts in its first message. It does not record the
  incident or reopen the plan itself; Claude does that through the CLI, as the
  incident-recording work defines.
- **The editor only shows.** It writes nothing to the project.
- **Shipped with InDusk as a `.vsix`**, installed by an `indusk` command into
  VS Code and Cursor. The Marketplace waits until after the launch.

## Open Questions

- Where the one health reader lives — moved from the admin into the package,
  or a `--json` on `promises status` — and how the editor learns of a new
  break within a minute: polling that reader, or a file the watcher writes.
  The ADR's.
- How incident-recording, landed or about to land, names a break, so the
  editor's prompt carries the same facts.

## Sources

- Root [master](../master.md), "Now — show the promise loop", step 4
- [indusk-demo master](../indusk-demo/master.md), child 9
- [`indusk-interface.md`](../../research/indusk-interface.md)
- `apps/indusk-mcp/src/lib/tokens.ts`, `apps/indusk-admin/src/lib/promise-health.ts`,
  the package's `promises/*` subpath exports
