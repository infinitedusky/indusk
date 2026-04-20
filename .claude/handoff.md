# Handoff

**Date:** 2026-04-20
**Session:** admin-ui-hosting Phases 2, 3, and 4 landed end-to-end. Phase 5 (ship 1.27.0) intentionally deferred — user is switching to Numero poker migration work first, then will return here for ship + smoke.

## What Was Being Worked On

`admin-ui-hosting` Phases 2 → 3 → 4 all completed in a single session. Every trajectory row except T1/T2/T17 (the live-smoke assertions that require a published npm install) is `passing`:

- **Phase 2** (registry + daemon CLI): `daemon.ts`, `ui.ts` rewrite, commander wiring, `init`/`update` registry calls. T3–T10 passing.
- **Phase 3** (route restructure): `/` = ProjectGrid, `/p/[project]/*` namespace, ProjectSwitcher, registry-client, slimmed root layout. T12–T14 passing.
- **Phase 4** (stale-failure page + cross-project scorecards + cwd-aware bare ui): StaleProjectFailurePage, scorecards walker injects project labels, `uiStart` resolves open URL from cwd. T11, T15, T16 passing.

## Where It Stopped

Impl is at status `in-progress`. Phase 4 closed cleanly — verification + context + document gates all checked off, semantic graph synced, CLAUDE.md updated (Architecture + Conventions + Known Gotchas + routing). Phase 5 (version bump, changelog, publish, live smoke) is **deliberately** unstarted. User paused here to run the Numero poker migration first so 1.27.0 can be validated against a real second project (`indusk init` / `update` / `ui start` on Numero) before publish.

## What's Next

Phase 5 of `admin-ui-hosting` in this exact order:

1. **Before ship: dogfood on Numero.** During the poker migration, use `pnpm link` or a local install of indusk-mcp (not the published 1.26.0) so Numero exercises `indusk init` → registry write → `indusk ui start` → homepage shows Numero+dusk → `/p/numero/` works. Any bug found there is a Phase 5 scope addition before publish. This **de-risks T17** (the "non-dusk consumer works without extra tooling" assertion).
2. **Version bump** — `apps/indusk-mcp/package.json` → `1.27.0`.
3. **Changelog** — add 1.27.0 entry to `apps/indusk-docs/src/changelog.md` with the breaking-change callout ("1.26.0 users: run `indusk init` once per project, then `indusk ui start` from anywhere") per ADR Documentation Plan.
4. **Overview docs** — rewrite `apps/indusk-docs/src/reference/admin-ui/overview.md` per ADR: daemon model, registry, homepage + per-project routing, architecture Mermaid (sequence: `indusk ui start` → daemon spawn → registry read → browser request → per-project file read).
5. **CLI docs** — new `apps/indusk-docs/src/reference/admin-ui/cli.md` per ADR: full reference for `indusk ui start/stop/status`, exit codes, env vars (`INDUSK_HOME`), port auto-bump, routing tree diagram.
6. **Build + publish** — `cd apps/indusk-mcp && pnpm publish`. `prepublishOnly` already runs `pnpm build && pnpm --filter indusk-admin build && node scripts/bundle-admin.js` so the admin bundle ships automatically. Tarball size ~12 MB (cap 50 MB).
7. **Upgrade globals** — user runs `indusk update` on dusk + Numero.
8. **Live smoke** — `indusk ui start` from dusk, verify browser opens to populated grid. `indusk ui stop` → `status` reports not running. Same on Numero. Closes T1, T2, T17.
9. **CLAUDE.md Current State + Phase 5 Document gate** — standard close-out.
10. **Then** `/falsify admin-ui-hosting` (hard-blocks retrospective otherwise) → `/retrospective admin-ui-hosting`.

## Open Issues

- **Pre-existing stale test** in indusk-mcp: `plan-parser.test.ts > parseAllPlans > returns all plans sorted by name — expected names to include 'agent-roles'`. `agent-roles` was archived to `.indusk/planning/archive/agent-roles/` in earlier work; the test still asserts it lives in the active planning dir. **Not a Phase 2/3/4 regression** — was already failing against main before this branch started. Unrelated fix: either delete the assertion or move the fixture to archive-aware. Not blocking ship, but worth a one-line PR somewhere.
- **No live Phase 5 smoke yet** — T1, T2, T17 are still `planned`. They can only flip after publish, which is the whole point of Phase 5.
- **`indusk-admin-ui` plan stays `in-progress`** per user direction (same as last handoff): the hosting plan IS the v2 follow-up. Run `/falsify indusk-admin-ui` + `/retrospective indusk-admin-ui` AFTER `admin-ui-hosting` ships.

## Decisions Made This Session

Three implementation-level choices worth preserving — all are already in CLAUDE.md or the impl's item notes, but listed here for quick handoff reference:

1. **Commander@13 silently drops duplicate options on subcommands.** Declaring `--port`/`--no-open` on BOTH the parent `ui` command AND its `start` subcommand made the subcommand always receive the default value. Fix: options live only on the parent; subcommand actions read via `this.optsWithGlobals()`. Verified live with a minimal repro. Already a Known Gotcha in CLAUDE.md. Don't re-split.
2. **vitest node project needs `fileParallelism: false`.** Multiple HTTP smoke tests each spawn `next dev`; running them in parallel spikes CPU/memory enough that `next dev` misses the "Ready in" stdout within 30s and fetch fires against an unbooted server. Serializing fixed it. Non-HTTP node tests pay negligible overhead.
3. **Cwd ↔ registry path compare needs realpath normalization.** On macOS, `mkdtempSync` returns `/var/folders/...` while `process.cwd()` after `cd` returns `/private/var/folders/...`. Raw string compare misses. `resolveOpenPath()` in `ui.ts` wraps both sides in `safeRealpathSync`. Same concern will apply anywhere else registry paths are compared to runtime cwd — keep the helper in mind.

## Watch Out For

- **Phase 5 Verification requires the published 1.27.0 to actually work end-to-end.** The bundled admin dir already exists at `apps/indusk-mcp/admin/` (from Phase 1), and `prepublishOnly` rebundles before publish. But T17 requires the tarball works on a consumer project with NO `pnpm install` step — make sure to validate on Numero via `pnpm link` BEFORE publishing, not after. An actual bad publish means a 1.27.1 patch.
- **`app/scorecards/page.tsx` ships in 1.27 with project labels ONLY when multiple registered projects have scorecards.** Single-project setups look identical to 1.26. The two-project fixture `http-scorecards-cross-project.test.ts` asserts the labels appear — verify that test still passes before publish.
- **`StaleProjectFailurePage` returns 200, not 404 or 500.** Don't be alarmed when `/p/deleted/` returns a green HTTP status — that's the T11 contract. The failure message is in the HTML body.
- **`vitest.config.ts`'s `fileParallelism: false`** slows non-HTTP node tests slightly. If someone tries to "speed up tests," don't let them remove this — the regression class is silent (tests go red under CPU load, green when run alone). CLAUDE.md Known Gotchas covers the why.
- **Plan detail page at `/p/[project]/plan/[name]/page.tsx` early-returns `null`** when the project is stale. The layout catches the stale case and renders StaleProjectFailurePage; the null return prevents the page's own code from tripping on `readActivePlans` against a deleted dir. Don't replace with `notFound()` — that would override the layout's failure page with Next's 404 UI.
- **Indusk-mcp has uncommitted state in @** — Phase 4 commits are in jj but not yet evaluated. `jj log` to verify chain looks clean before ship.
- **Queued test-runner-integration plan:** user flagged wanting a vitest test-runner panel in the admin UI ("watch tests run, see logs") but explicitly deferred until AFTER the InDusk testing-strategy brief lands. Don't start it unprompted.

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
- [x] graphiti
