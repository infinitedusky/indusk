# VS Code Extension

The developer's editor shows every promise at the line that keeps it, lists
every promise in a panel, turns a break red within ten seconds of it being
readable, and starts their own `claude` on the fix in one click. It reads
health from the same one place the admin does, and writes nothing. The full
record is the archived plan: `.indusk/planning/archive/vscode-extension/`
(research, brief, test plan, ADR, impl, retrospective). How to use it:
[Promises in your editor](/guide/promises-in-your-editor) and
[`indusk editor`](/reference/cli/editor).

## What was decided

**Health is worked out once, in the package.** The admin's health reader and
its mark store moved into `@infinitedusky/indusk-mcp` as `promises/health` and
`promises/store`. The admin, `indusk promises health --json`, the agents'
`promise_health` report and the editor all read them; a single-definition test
refuses a second copy.

*Against:* the extension importing the package in-process (the project's
dependency inside the editor's host, a second cache per window), and reading
the admin daemon over HTTP (the editor would be blank whenever the admin was
not running).

**A JSON line stream is the boundary.** `indusk promises health --json --every
5` prints one line per read: every promise with its plan, tests and sites;
every source's state for each; and the newest runs. The command re-reads the
registry before every line, so a break marked fixed reads `fixed` without a
reload. The editor runs one such process per window.

**The extension is presentation only.** A pure core turns each line, each
file's text and a clock into markers, hovers, problems, notifications, the fix
action and the panel's model and HTML; a thin VS Code layer applies them. Every
rule is a unit test against the core.

**The Promises panel** (added after the first hands-on look): the project's
name, broken promises as cards with the latest break first, the rest grouped
by the plan that owns them with the most recently run first, and an activity
section adding each run as it arrives. It is a webview, because cards were
asked for and a tree cannot draw them; its model and HTML are built in the
core.

**Install is one command.** The `.vsix` ships inside the npm package;
`indusk editor install` installs it into VS Code and, when its CLI is found,
Cursor.

## Tradeoffs accepted

- A long-lived `indusk` process per open window with InDusk.
- The admin's health code moved into the package, a larger move than the
  editor alone needed.
- Text from spans is untrusted: it is stripped of control characters before
  the fix terminal and escaped before a hover or the panel, so a symptom shows
  as written text and never acts.
- A run on the line carries no symptom: the mark store keeps a run's time,
  outcome, trace and environment only.

## Observed

On the seat-holds demo, a late release showed in VS Code 5.3 seconds after it
happened; Cursor showed the same marker and opened the fix terminal.
