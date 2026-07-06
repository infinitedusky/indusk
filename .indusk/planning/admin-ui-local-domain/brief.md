---
title: "Admin UI Local Domain (indusk.dawn)"
date: 2026-07-06
status: accepted
---

# Admin UI Local Domain (indusk.dawn) — Brief

## Problem

Reaching the admin UI today means remembering `http://localhost:<port>`, and the port isn't fixed — `daemonStart` in `apps/indusk-mcp/src/lib/admin/daemon.ts` records whatever port `findFreePort` picked, and `uiStart` (`apps/indusk-mcp/src/bin/commands/ui.ts`) silently bumps to a different port if the default 3939 is taken. Sandy wants to type a name in the browser instead of tracking a port number.

## Proposed Direction

Have `indusk ui start` / `indusk ui restart` write a Caddy route for `indusk.dawn` → `127.0.0.1:<actual bound port>` into the shared host-Caddy setup already running on this machine, and reload Caddy so it takes effect immediately. `indusk ui stop` removes the route.

This piggybacks entirely on infrastructure that already exists and already works — no new daemon, no DNS changes, no sudo. Confirmed live this session:

- Host Caddy runs via Homebrew (`caddy run --config /opt/homebrew/etc/Caddyfile`). That config's header says "Managed by indusk — DO NOT EDIT" and it does `import /Users/the_dusky/.indusk/proxy/sites/*.caddyfile`.
- `~/.indusk/proxy/sites/dusk.caddyfile` already has a working block routing `docs.dusk.dawn` → `127.0.0.1:4173`. `dscacheutil -q host -a name docs.dusk.dawn` resolves to `127.0.0.1` right now.
- `/etc/resolver/dawn` (`nameserver 127.0.0.1`) + dnsmasq's `address=/dawn/127.0.0.1` wildcard-resolve *any* `*.dawn` hostname — a brand-new name under `.dawn` needs zero new DNS setup.

So the mechanism is: write one file, `~/.indusk/proxy/sites/indusk-admin.caddyfile`, containing one block —

```
indusk.dawn {
	tls {
		issuer internal {
			lifetime 720h
			sign_with_root
		}
	}
	reverse_proxy 127.0.0.1:<port>
}
```

— matching the exact shape every other site file already uses, then hit Caddy's local admin API (`localhost:2019`) to reload without restarting the Caddy process itself.

## Context

Investigated directly against the live environment this session — no separate `research.md`, findings are folded in here:

- The admin-ui daemon's real, current port lives at `~/.indusk/admin-ui.json` (the `DaemonMeta.port` field written by `daemonStart`). That file is the single source of truth for "what port is the daemon actually on" — it's the only place this plan should read the port from, never a hardcoded 3939.
- CLI surface today: `uiStart` / `uiRestart` / `uiStop` / `uiStatus` in `apps/indusk-mcp/src/bin/commands/ui.ts`, registered in `src/bin/cli.ts` under the `ui` command.
- A bigger architectural direction — a full `indusk proxy` daemon owning a multi-project route registry (`indusk proxy start/stop/status/reload`, parallel to `indusk telemetry *`) — was scoped in a 2026-05-20 design note but was never built. Confirmed: no `proxy` subcommand exists anywhere in the current CLI (checked both this repo's source and the globally-installed 1.31.12 build). This plan deliberately does **not** build that system. Sandy was asked directly ("minimal now" vs. "full `indusk-proxy` daemon") and chose minimal.
- That May note assumed composable.env would generate each project's Caddyfile. Composable.env is now deprecated repo-wide (the doppler extension is the default env layer), and the existing `numero.local.caddyfile` in the sites directory already carries a comment noting it's hand-maintained since ce was removed (2026-06-10). This plan doesn't touch that dependency question at all — it just writes one file directly, the same way the existing hand-maintained files already work.

## Scope

### In Scope
- `indusk ui start` and `indusk ui restart` write/update `~/.indusk/proxy/sites/indusk-admin.caddyfile` with a single `indusk.dawn → 127.0.0.1:<port>` block, reading the port from the same value `daemonStart` just recorded, then trigger a Caddy reload.
- Graceful no-op when the shared Caddy setup isn't present on the machine (no `/opt/homebrew/etc/Caddyfile`, no `~/.indusk/proxy/sites/` directory) — one clear warning, `ui start` still succeeds and behaves exactly as it does today.
- `indusk ui stop` removes the Caddyfile block (or deletes the file) so a stopped daemon doesn't leave a route that 502s forever.
- Unit tests around the Caddyfile block read/write/remove logic — pure file operations, no real Caddy process required in CI.

### Out of Scope
- No new `indusk proxy` daemon, no multi-project route registry, no per-project registration hooks, no extension.
- No `/etc/hosts` edits, no sudo, no DNS/dnsmasq changes — the existing `.dawn` wildcard already covers any new hostname under it.
- No changes to composable.env, no revisiting the doppler-vs-ce dependency question.
- No TLS/CA trust-install workflow — reuses the existing internal-issuer TLS block verbatim; this machine already trusts it.
- Live end-to-end verification against the real Caddy process is a manual smoke step (Sandy's machine only) — there's no Caddy binary in CI, so this isn't an automated test.

## Success Criteria
- After `indusk ui start` (fresh), `https://indusk.dawn` is reachable in a browser and shows the admin UI — no port number typed anywhere.
- If the daemon's port changes (e.g. the default was taken and `findFreePort` bumped it), the next `start`/`restart` updates the Caddyfile block to match — no stale port left behind.
- `indusk ui stop` removes the route; hitting `https://indusk.dawn` afterward fails cleanly (DNS still resolves; connection refused, not a hang).
- On a machine without the shared Caddy setup, `ui start`/`ui stop` behave exactly as they did before this plan, plus one warning line.

## Depends On
(none)

## Blocks
(none)

## Notes
- Chosen hostname: `indusk.dawn`, not `admin.dusk.dawn` — the admin-ui daemon is machine-global (serves every registered project under `/p/{project}/...`), so a dusk-scoped-looking domain would misdescribe it.
- Workflow shape follows the `workbench-setup-command` precedent: brief + test-plan + impl, no ADR — the one real design fork (full `indusk proxy` daemon vs. wiring this one route directly) was already settled in conversation before this plan was opened, so there's no architectural decision left to formalize.
