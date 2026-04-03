# Handoff

**Date:** 2026-04-03
**Session:** React Native plan (research + brief), Graphiti infra Phase 1 complete with OTel verified, OTel skill updated

## What Was Being Worked On
Two plans advanced:
1. **`react-native-support`** — research complete, brief accepted (Expo + Embrace SDK). Next: ADR.
2. **`graphiti-infrastructure`** — Phase 1 (Bundled Infrastructure Container) fully complete. Phase 1.5 added but not started.

## Where It Stopped
- **Phase 1 complete.** All gates checked off. `indusk-infra` container builds, runs, passes 8-point smoke test, OTel traces + logs verified in Dash0.
- **Phase 1.5 next:** Migrate CGC from `falkordb.orb.local:6379` (old standalone container) to `localhost:6379` (bundled `indusk-infra` container). This must happen before Phase 2.

## What's Next
1. **Phase 1.5:** Migrate CGC to bundled container — update `.mcp.json`, `init.ts`, `graph_ensure`, re-index if needed, stop old FalkorDB
2. **Phase 2:** `indusk infra start/stop/status` CLI commands + `~/.indusk/config.env` global config
3. **Phase 3:** `graphiti-client.ts` MCP client wrapper
4. **Phase 4:** Graphiti extension manifest + health checks
5. **Phase 5:** `init` integration + Getting Started docs rewrite
6. **Phase 6:** End-to-end validation
7. **react-native-support:** Write ADR (Expo + Embrace SDK)

## Open Issues
- `docker/otel-setup.py` and `docker/supervisord.conf` are unused — can be deleted
- FalkorDB RediSearch syntax error on group_id `test-otel` — word `test` is reserved in RediSearch. Use different group_id names.
- `~/.graphiti/` manual source clone still exists from spike — can be deleted once container is standard
- OTel skill updated in `apps/indusk-mcp/extensions/otel/skill.md` but `.claude/skills/otel/SKILL.md` needs `indusk update` to sync
- Handoff lock problem is a recurring annoyance — writing a handoff mid-session blocks all edits until catchup boxes are checked. Needs a lock/unlock mechanism.

## Decisions Made This Session
- **Expo over bare React Native** — Expo is the standard RN toolchain. Detection via `expo` dependency.
- **Embrace SDK for RN OTel** — auto-instrumentation with standalone OTLP export to Dash0.
- **Bundled `indusk-infra` container** — FalkorDB + Graphiti in one image, replaces standalone FalkorDB.
- **Global install model** — `npm i -g @infinitedusky/indusk-mcp`, `indusk infra start`, `indusk init` per-project.
- **`~/.indusk/config.env`** for global secrets (GOOGLE_API_KEY), not per-project.
- **OTel via `opentelemetry-instrument`** — auto-instruments starlette, redis, httpx. Protocol defaults (`http/protobuf`) baked into Dockerfile ENV. Disabled by default.
- **Span events deprecated (March 2026)** — OTel skill updated: use logs instead of `recordException`/`addEvent`.
- **Port 8100 for Graphiti** — 8000 taken by OrbStack.
- **Text-based lessons don't scale** — knowledge graph is the real fix, prioritize graphiti-infrastructure.

## Watch Out For
- jj is co-managing this repo — detached HEAD is normal, use jj commands
- The OTel gate is active on ALL feature/refactor impls
- `indusk-infra` container may be running on localhost:6379 and 8100 — conflicts with old standalone FalkorDB
- `opentelemetry-instrument` adds ~90s to Graphiti startup time inside the container
- The `OTEL_EXPORTER_OTLP_HEADERS` env var format (`key=value,key=value`) with spaces in Bearer token works with Python SDK but needs the env vars baked into the Dockerfile (not shell-level) to propagate correctly

## Catchup Status
- [x] handoff
- [x] lessons
- [x] skills
- [x] health
- [x] context
- [x] plans
- [x] extensions
- [x] graph
