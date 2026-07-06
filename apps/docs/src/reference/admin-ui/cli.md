---
title: Admin UI — CLI Reference
---

# Admin UI — CLI Reference

The `indusk ui` subcommand manages the admin UI daemon — a single long-lived Node process that serves every registered InDusk project on your machine. One daemon per machine, not per project.

See [Overview](./overview) for the big-picture model. This page documents the CLI surface: commands, flags, env vars, exit codes, recovery.

## Commands

### `indusk ui start`

Spawn the detached admin UI daemon. Picks a free port, writes pid/port/log metadata to `~/.indusk/admin-ui.*`, and opens your default browser.

```bash
indusk ui start              # default: port 3939, auto-open
indusk ui start --port 4000  # explicit port
indusk ui start --port 0     # any free port
indusk ui start --no-open    # don't open the browser
```

**Behavior**

- If a daemon is already running (detected via `~/.indusk/admin-ui.pid`), prints `Admin UI is already running on ...` with the existing URL. Does not spawn a second daemon. Still opens the browser unless `--no-open`.
- If the requested `--port` is taken, auto-bumps to the next free port and prints a warning (`Port 3939 is in use; using 3940 instead.`).
- The browser URL is **cwd-aware**: if `process.cwd()` (realpath-normalized) matches a registered project's `path`, the browser opens to `/p/{project}/`. Otherwise it opens to `/` (the project grid).
- The CLI exits as soon as the daemon is spawned. The daemon persists across terminal close because it was spawned with `detached: true`.

**Bare `indusk ui`** is equivalent to `indusk ui start` — same flags, same behavior.

### `indusk ui stop`

SIGTERM the running daemon. After 3s without exit, escalates to SIGKILL and prints a warning.

```bash
indusk ui stop
```

**Output**

- Running daemon stopped: `Admin UI daemon (PID 12345) stopped.`
- Not running: `Admin UI is not running.`
- SIGKILL fallback: `Admin UI daemon (PID 12345) did not exit within 3s; forced with SIGKILL.`

### `indusk ui restart`

Stop (if running) then start the daemon. Picks up a new bundle from `npm i -g` without making you chain two commands.

```bash
indusk ui restart              # honors --port / --no-open from the parent command
indusk ui restart --no-open    # typical after an upgrade
```

**Behavior**

- If a daemon is running, SIGTERMs it (with the same 3s SIGKILL fallback as `stop`), then spawns a fresh one.
- If no daemon is running, the stop step prints `Admin UI is not running.` and continues straight to start — equivalent to a plain `start`.
- Honors `--port` and `--no-open` exactly as `start` does. Different port from the previous run is fine.
- Exits non-zero only if the `start` half fails (same failure modes — invalid port, missing admin bundle, unresolvable `next`).

Use this after every `npm i -g @infinitedusky/indusk-mcp@<newer>` so the daemon picks up the new admin bundle. `indusk ui start` alone no-ops when a daemon is already running and will continue to serve the old bundle.

### `indusk ui status`

Report whether the daemon is running plus the registered-project count (always reported, regardless of daemon state).

```bash
indusk ui status
```

**Running output**:

```
Admin UI: running on port 3939
  PID: 12345
  Started: 2026-04-20T14:30:22.000Z
  Admin dir: /Users/you/.nvm/.../indusk-mcp/admin
Registered projects 3 (~/.indusk/projects.json)
```

**Not running output**:

```
Admin UI: not running
Registered projects 3 (~/.indusk/projects.json)
```

If the daemon's pid file exists and points at a valid process but the port isn't yet listening (warmup race), the first line is suffixed `(port not yet listening — warming up?)`.

## Flags

All flags are declared on the parent `ui` command. Subcommands read them via commander's `optsWithGlobals()`. **Do not redeclare these on subcommands** — commander@13 silently drops duplicate options, routing the flag value to the parent and passing the default to the subcommand action. See [Known Gotchas in CLAUDE.md](https://github.com/infinite-dusky/dusk/blob/main/CLAUDE.md).

| Flag | Default | Effect |
|------|---------|--------|
| `--port <n>` | `3939` | Port to listen on. Must be `0–65535` or the CLI exits with code `1`. `0` means "pick any free port." If `<n>` is taken, auto-bumps to the next free port and prints a warning. |
| `--no-open` | (open by default) | Don't auto-open the browser when the server is ready. |

## Environment variables

| Variable | Default | Effect |
|----------|---------|--------|
| `INDUSK_HOME` | `~/.indusk` | Directory for the registry (`projects.json`), daemon metadata (`admin-ui.pid`, `admin-ui.json`, `admin-ui.log`), and global config. Used by tests to redirect away from the real home; rarely set in production. |

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success (daemon started, stopped, or status reported). |
| `1` | User error: invalid `--port` value (out of `0–65535` range or non-numeric); admin bundle missing from the install (`admin/.next/BUILD_ID` absent — reinstall indusk-mcp); `next` binary unresolvable (indusk-mcp dependencies broken — reinstall). |

`stop` and `status` never exit non-zero for "daemon not running" — that's a normal state, not an error.

## Routing tree

The daemon serves these routes, backed by the registry + project filesystems:

```
/                                  Project grid — one card per registered project

/p/{project}/                      Per-project home (sidebar: scorecards link, plan list, research group)
/p/{project}/scorecards            Per-project eval scorecards (1.27.2+)
/p/{project}/plan/{name}           Plan detail (brief, test-plan, ADR, phases, falsification, scorecards)
/p/{project}/research/{slug}       Per-project research article from .indusk/research/ (1.27.2+)
/p/{deleted}/                      Stale failure page (HTTP 200) with recovery hint
```

- Only one top-level route: `/` (project grid). Everything else is project-scoped.
- 1.26.0/1.27.0's cross-project `/scorecards` is **removed in 1.27.2** — use `/p/{project}/scorecards`.
- Deleted registry entries render a 200 failure page, not 404 or 500. See Recovery below.

## Daemon metadata

`~/.indusk/` (or `$INDUSK_HOME/`) holds:

| File | Contents | Written by |
|------|----------|------------|
| `projects.json` | Registry — version + project list (name, path, registeredAt, lastSeenAt) | `indusk init`, `indusk update` |
| `admin-ui.pid` | Plain-text daemon pid | `indusk ui start` |
| `admin-ui.json` | `{ pid, port, startedAt, adminDir }` | `indusk ui start` |
| `admin-ui.log` | Daemon stdout + stderr | The daemon itself |

`indusk ui stop` removes `admin-ui.pid` and `admin-ui.json` on successful SIGTERM. `admin-ui.log` is preserved for debugging.

## Recovery recipes

**"Admin UI bundle not found at ..."** — `admin/.next/BUILD_ID` is missing from your indusk-mcp install. Reinstall from npm (`npm i -g @infinitedusky/indusk-mcp@latest`), or if you're on a source checkout, rebuild with `pnpm --filter indusk-admin build && (cd apps/indusk-mcp && node scripts/bundle-admin.js)`.

**"Could not resolve the 'next' binary"** — indusk-mcp's node_modules is broken. Reinstall: `npm i -g @infinitedusky/indusk-mcp`.

**Port conflict warning (`Port 3939 is in use; using 3940 instead.`)** — informational only; the daemon started successfully on the auto-bumped port. If you want a deterministic port, pass `--port <n>` with a known-free value, or let it auto-pick with `--port 0`.

**Stale registry entry (`/p/{project}/` renders StaleProjectFailurePage)** — a registered project's path no longer exists on disk (the directory was deleted or moved). The page shows the registered name, the old path, and the recovery command. `cd` to the project's current location and run `indusk update` to refresh the registry entry. The registry is never auto-pruned; recovery is explicit user action.

**"Admin UI is already running ..." on every `indusk ui start`** — the daemon is up from a previous session. Use `indusk ui status` to confirm, open the printed URL, or `indusk ui stop && indusk ui start` to restart.

**Daemon won't stop (SIGKILL warning)** — `indusk ui stop` escalates to SIGKILL after 3s. If you still see zombie state (`status` reports running but the port isn't listening), manually check the pid file: `cat ~/.indusk/admin-ui.pid`, `ps <pid>`, then `kill -9 <pid>` and `rm ~/.indusk/admin-ui.{pid,json}`.

**Daemon reports "not running" right after a crash (1.27.5+)** — when the daemon process exits unexpectedly, the OS may later recycle its PID to an unrelated process (bash, postgres, another vitest). `daemonStatus` and `daemonStop` in 1.27.5+ detect this by combining PID liveness with a port-listening probe: if the recorded PID is alive but nothing is listening on the recorded port, it's not our daemon. The PID + meta files are auto-swept on the next `indusk ui status` / `indusk ui stop` — no user action required. Check `~/.indusk/admin-ui.log` for the underlying crash cause (Next build error, port bind race, OOM).

**Registered projects seem to have disappeared (1.27.5+)** — if `indusk ui status` reports `0 projects` right after an edit to `~/.indusk/projects.json` broke the JSON, the malformed file was quarantined, not lost. Look in `~/.indusk/` for `projects.json.corrupt.{ISO}.bak`. Recovery procedure:

```bash
# 1. Inspect the backup
cat ~/.indusk/projects.json.corrupt.*.bak
# 2. Hand-fix the JSON (wrong shape, missing comma, etc.)
# 3. Move it back, replacing the fresh empty file
mv ~/.indusk/projects.json.corrupt.{ISO}.bak ~/.indusk/projects.json
# 4. Verify
indusk ui status
```

If you've added new projects since the corruption, merge them into the restored registry manually — the backup captures only the pre-damage state. The quarantine filename's ISO timestamp lets repeated corruption events coexist without overwriting each other.

**Bare `indusk ui` from a subdirectory of my project (1.27.5+)** — the CLI walks up cwd's parents to find the nearest registered project root (capped at 40 ancestors, which no real path reaches). `cd apps/indusk-mcp && indusk ui` opens `/p/{project}/`, as does any deeper invocation. Before 1.27.5 only an exact match at the project root resolved; deeper invocations silently fell through to `/`. If walk-up still lands on `/`, confirm the project is registered: `cat ~/.indusk/projects.json | jq '.projects[].path'`.

## Registry commands

Registry mutations are handled by existing commands, not `ui` subcommands:

| Command | Registry effect |
|---------|-----------------|
| `indusk init` | Appends the initializing project to `projects.json` via `addProject(projectRoot)`. If a name collision exists, registers under a numeric-suffixed name and prints a warning. |
| `indusk update` | Validates the entry exists and the path matches (`validateProject(name)`), then touches `lastSeenAt` (`touchProject(name)`). If the entry is missing or the path has diverged, calls `addProject` to recover. |

There is no `indusk ui add`, `indusk ui remove`, or equivalent — registry mutations happen at `init`/`update` time, not through the admin-ui command surface. To deregister a project, edit `~/.indusk/projects.json` by hand.

## See also

- [Overview](./overview) — the daemon model, registry, routing, and what each page shows
- [Component conventions](./component-conventions) — the primitives that back the rendered pages
- [`apps/docs/src/changelog.md`](/changelog) — 1.27.0 breaking-change callout and migration note
