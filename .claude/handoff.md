# Handoff

**Date:** 2026-04-05
**Session:** CGC/FalkorDB fix, catchup hardening, `indusk update` consolidation, react-native-support plan, product direction research

## What Was Being Worked On
Multiple threads this session:
1. **CGC FalkorDB Lite fix** — discovered CGC CLI connects to embedded FalkorDB Lite instead of container. Fixed via `~/.zshrc` env vars. Catchup skill hardened with hook-enforced `mcp-ready` gate.
2. **`indusk update` consolidation** — merged `upgrade` into `update`. One command now: self-update → skills → lessons → hooks → built-in extensions (with `on_update`/`on_post_update` hooks) → third-party extensions (with version display, single install).
3. **react-native-support plan** — full lifecycle: research → brief (accepted) → ADR (accepted) → impl (approved). Standard OTel JS packages for React Native (no Embrace), Expo/Storybook/Framer extensions, Phase 0 auto-add MCP servers from extension manifests.
4. **Product direction research** — `.indusk/research/indusk-product-direction.md`. InDusk as application build environment for professionals. Three pillars: monorepo DevEx, context management, process. Long-term Capacitor vision.

## Where It Stopped
- **v1.8.0 built, awaiting Sandy's `npm publish`** (needs OTP). Includes all update/extension/hook changes.
- **react-native-support impl approved** — ready for `/work` to start Phase 0.
- **Product research** written but status `in-progress` — Sandy may want to iterate further.
- **Turbopack warning removed** from init.ts — Sandy prefers Turbopack despite fast watcher risks.
- **~42 uncommitted files** in the repo. Need to commit before next session.

## What's Next
1. **Publish v1.8.0** — `cd apps/indusk-mcp && npm publish --access public`
2. **Commit all changes** — massive uncommitted diff. Silo by concern: indusk-mcp changes, planning docs, research doc.
3. **`/work react-native-support`** — Phase 0 (auto-add MCP servers from extensions), then Phase 1 (Expo/Storybook/Framer extensions).
4. **Test `/catchup`** in fresh session — verify `mcp-ready` hook gate works.
5. **CGC reindex** — remote FalkorDB graph is empty (data was in FalkorDB Lite). Run `graph_ensure` + `index_project` after env vars active.

## Open Issues
- CGC remote FalkorDB graph is **empty** — all data in old FalkorDB Lite. Needs reindex.
- `~/.codegraphcontext/.env` does NOT support `DATABASE_TYPE` — only shell env vars work.
- `infra start` should configure CGC env vars for new users — not done yet.
- `plan-parser.test.ts` has 1 failing test (pre-existing).
- composable.env `scaffold:sync` during `indusk update` may add example files to existing projects — Sandy is fixing this in the composable.env repo.
- `indusk update` self-update re-runs itself after upgrading — needs testing that the re-run actually uses the new binary and doesn't infinite loop.

## Decisions Made This Session
- **CGC stays on host, not in container** — needs filesystem access for indexing
- **Catchup must hard-fail, not degrade** — hook-enforced `mcp-ready` gate checks FalkorDB (6379) + Graphiti (8100)
- **Never run bare `cgc` CLI** — all graph ops through indusk MCP tools
- **`indusk upgrade` deleted, merged into `indusk update`** — one command for everything
- **Turbopack is OK** — Sandy prefers it despite fast watcher, removed warnings from init
- **React Native OTel: standard packages, no Embrace** — `api` + `sdk-trace-base` + `exporter-trace-otlp-http` with Metro config workaround
- **Product direction: "application build environment for professionals"** — three pillars: monorepo DevEx, context management, process. Capacitor as long-term brand/vision.

## Watch Out For
- jj manages this repo — detached HEAD is normal
- `indusk-infra` container running on localhost:6379 and 8100
- `~/.zshrc` has CGC env vars — only active in new shells
- `.mcp.json` uses `indusk serve` (global binary), not npx
- **v1.8.0 not published yet** — local build only. Global `indusk` is still on whatever Sandy last published.
- 42 uncommitted files — commit before doing more work
- composable.env v1.16.1 published with `--serve` flag for `dc:up`

## Catchup Status
- [x] mcp-ready
- [x] handoff
- [x] lessons
- [x] skills
- [x] health
- [x] context
- [x] plans
- [x] extensions
- [x] graph

## Session 2026-04-07 — Phase 5.5 work
Picking up graphiti-infrastructure to insert Phase 5.5 (Surface Graphiti to the Agent)
between Phase 5 and Phase 6. Phase 6 cannot run without it — Graphiti has no MCP tool
exposure to the agent right now. Option C: register Graphiti directly in `.mcp.json`
via init + keep `GraphitiClient` wrapper for internal use + add capture triggers in
planner/work/retrospective/catchup skills + update graphiti skill to show real tool
calls.
