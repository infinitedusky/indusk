# Promises in your editor

The InDusk extension for VS Code (and Cursor) shows every promise at the line
that keeps it, with its health, and turns a break into Claude working on the
fix in one click. It only shows: nothing in your project is written by it.

## Install

```bash
indusk editor install
```

The extension ships inside the InDusk package. The command installs it into
VS Code, and into Cursor when Cursor's `cursor` command is on your `PATH`, and
says which. Then open a project that uses InDusk: the extension starts only in
a folder with `.indusk/config.json`. See [`editor`](/reference/cli/editor).

## What you see

**A marker at the end of every line that carries a promise's token.** A
promise is kept where code says so in a comment, `// promise: seat-never-double-booked`.
That line ends with the promise's name and its state:

| Marker | Meaning |
|---|---|
| `seat-never-double-booked · holding` | Seen upheld. |
| `seat-never-double-booked · broken (production)` | A live break in that source. |
| `… · holding, broken (local)` | Production holds; a change on your machine breaks it. |
| `… · fixed` | Every break in the window has a fixed incident. |
| `… · not seen` | No run marked it in the window. |
| `… · watched by the tests` | A state or structure promise: the tests watch it, not telemetry. |
| `… · proved here` | This file is one of the promise's tests. |
| `… · not in this project` | The token names a promise the project does not have. |
| `… · production unreadable` / `watcher blind` | That source could not be read, or did not hear its probe. Never shown as holding. |
| `… · not reading` | No health has arrived for two reads. |

**Hover a marked line** for the promise's sentence, its state in each source,
and when it last broke or was last seen.

**A break** also appears in the Problems list, and as one notification the
first time it is read. It is not told again while it lasts, however many more
violations arrive or reads fail in between. Once the break's incident is marked
fixed, the next read shows `fixed` and clears the Problem, with no reload. A
later break is told again.

A folder inside your project that is its own InDusk project, such as dusk's
`examples/seat-holds/`, keeps its own promises: its lines get no marker from
the outer project.

**When the editor cannot read health**, it says why, once. It names the
command when it is not found (set `indusk.command` to the right `indusk`), or
the reader's last error when it keeps stopping, for example an `indusk` too old
to have `promises health`. Until a first read arrives, markers and hovers say
`not reading`.

The states are the admin's: the editor reads `indusk promises health --json`,
the line built by the same rule the admin's chips use, every five seconds. A
break shows within two reads of being readable from its source.

::: info Observed (2026-10-08)
On the seat-holds demo, a late release showed as `broken (local)` in VS Code
5.3 seconds after it happened. From pressing **Break it** and holding a seat it
took 14.9 seconds, 9.5 of them the demo's own hold window and fault delay. In
Cursor, the same extension showed the marker and opened the Claude terminal.
:::

## Fix with Claude

On a broken promise, the light bulb offers **Fix with Claude**. It opens a
terminal in the project running your own `claude`, its first message carrying
the promise, the symptom, a link to the trace, and the tests that prove it. It
asks Claude to record the break first (the `record_breaks` tool, or
`indusk promises watch`) and fix it under the plan that owns the promise.

Without Claude Code installed, it says how to install it and opens nothing.

The break's facts come from the span that recorded it, so they are typed into
the terminal as text only: each on one line, with control characters removed.
Hovers show them as text too, never as links.

```mermaid
sequenceDiagram
  participant App as Your app
  participant J as Jaeger (local or production)
  participant CLI as indusk promises health --json --every 5
  participant Ed as VS Code
  participant C as claude
  App->>J: span marks the promise violated
  CLI->>J: read (every 5 s)
  CLI-->>Ed: one JSON line: the promise is red
  Ed->>Ed: marker turns broken, a Problem, one notification
  Ed->>C: Fix with Claude: promise, symptom, trace, tests
  C->>C: record the break, find the cause, fix it
```
