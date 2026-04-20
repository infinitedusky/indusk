# Handoff

**Date:** 2026-04-19
**Session:** Authored full planner lifecycle for `admin-ui-hosting` (research → brief → test-plan → ADR → impl) + executed Phase 1 in full + Phase 2 item 1 (registry library). Total of 3 plans worked: rationale-baseline-frontmatter (shipped 1.25.0/1.25.1, archived), indusk-admin-ui (shipped 1.26.0, **still status: in-progress** by user direction — closure deferred until admin-ui-hosting ships), admin-ui-hosting (Phase 2 in progress).

## What Was Being Worked On

`admin-ui-hosting` Phase 2 item 1: created `apps/indusk-mcp/src/lib/admin/registry.ts` with `readRegistry`, `addProject`, `validateProject`, `touchProject`. Atomic file writes, basename-collision suffixing (`-2`, `-3`), `INDUSK_HOME` env-var override for test isolation. 7 unit tests passing in `apps/indusk-mcp/src/lib/admin/__tests__/registry.test.ts`. Trajectory rows T8/T9/T10 → `passing`.

## Where It Stopped

Phase 2 item 1 (registry) is COMPLETE. Phase 2 item 2 (`daemon.ts` — PID/port/log file management, detached spawn, port probing) is the next checklist item. Test files for T3–T7 are already authored as red at `apps/indusk-mcp/src/__tests__/admin-cli-lifecycle.test.ts` (they spawn the CLI binary via subprocess; will start passing once `ui.ts` lands).

## What's Next

In order, all under Phase 2 of admin-ui-hosting:

1. **`apps/indusk-mcp/src/lib/admin/daemon.ts`** — `daemonStart`, `daemonStop`, `daemonStatus`, `findFreePort`. Spawn via `spawn(..., { detached: true, stdio: "ignore" })` + `unref()`. PID at `~/.indusk/admin-ui.pid`, metadata at `~/.indusk/admin-ui.json`, logs at `~/.indusk/admin-ui.log`. Use `INDUSK_HOME` env var (registry.ts already does).
2. **`apps/indusk-mcp/src/bin/commands/ui.ts`** — REPLACE existing 1.26.0 file. Export `uiStart`, `uiStop`, `uiStatus`. Internally call `daemon.ts`. `uiStart` resolves the bundled admin via `resolveBundledAdminDir()` (look at indusk-mcp install root + `/admin`), checks `daemonStatus()` first to avoid double-start, opens browser unless `--no-open`.
3. **`apps/indusk-mcp/src/bin/cli.ts`** — wire commander: `ui.command("start"/.option(...))`, `ui.command("stop")`, `ui.command("status")`. Bare `indusk ui` should alias to `start` — verify commander supports parent-command-with-action-AND-subcommands (the spike I deferred).
4. **`apps/indusk-mcp/src/bin/commands/init.ts`** — call `addProject(cwd)` after init succeeds; print registered name (and suffix if collision).
5. **`apps/indusk-mcp/src/bin/commands/update.ts`** — `validateProject(name)` + `touchProject(name)` after update succeeds; `addProject(cwd)` if missing.
6. Run `pnpm build` in indusk-mcp; then `pnpm vitest run src/__tests__/admin-cli-lifecycle.test.ts` to flip T3–T7 from `written` → `passing`.
7. Phase 2 Verification + Context (CLAUDE.md Architecture/Conventions per impl) + Document (folded into Phase 5).
8. Then Phase 3 (route restructure: `/`, `/p/[project]/...`, project switcher).

## Open Issues

- **None blocking.** Clean checkpoint — registry passes 7/7, T18 (Phase 1 bundling) passes 3/3, all builds work.
- **Aside (low priority)**: `apps/indusk-mcp/infinitedusky-indusk-mcp-1.26.0.tgz` was created locally during Phase 1 portability spike and is gitignored (added in this session). Can `rm` it any time.
- **Stale background processes possible**: this session spawned several `next start` instances on ports 3939, 3941, 3943, 3944, 3945. If any survived, kill via `pkill -f "next.*start"`. The current process tree should be clean (all explicitly killed).
- **Local global indusk install** is at 1.26.0 (the per-project version that this whole plan replaces). When Phase 5 ships 1.27.0, that gets superseded.

## Decisions Made This Session

All major decisions are captured in plan documents — but two implementation-level calls aren't in the plan and need to be remembered:

1. **Lift admin's React/Next deps to indusk-mcp WITHOUT removing them from admin** (originally the impl said "move from admin to mcp"). pnpm dedups via workspace; both contexts work; removing breaks `pnpm --filter indusk-admin dev`. This is reflected in the impl.md item check-off note.
2. **`indusk-admin-ui` plan stays `in-progress`** (user direction option (a)). The hosting plan IS its v2 follow-up; falsify + retro for indusk-admin-ui will run AFTER admin-ui-hosting ships. Don't try to close indusk-admin-ui in isolation.

## Watch Out For

Three real findings from this session that future-you needs to know — all already in CLAUDE.md Known Gotchas, but worth flagging here too:

1. **`scripts/bundle-admin.js` MUST exclude `.next/dev` AND `.next/cache`** (already does). Leftover `next dev` state in `.next/dev` can balloon a "production build" bundle to 200+ MB. The exclusion is a single-character regex change; don't remove it.
2. **`apps/indusk-admin/src/app/layout.tsx` MUST export `dynamic = "force-dynamic"`** — without it, Next.js prerenders `/` at build time using the build's empty `INDUSK_PROJECT_ROOT`, baking the empty-state HTML in forever. Was a real production bug discovered during Phase 1 smoke. Don't remove the export.
3. **Shared mutable default bug in `registry.ts`** — was caught and fixed during Phase 2 item 1. Original code had `const EMPTY_REGISTRY: Registry = { version: 1, projects: [] }` and `return { ...EMPTY_REGISTRY }`. Spread is shallow — `projects` array reference is shared, mutations leak across calls. Replaced with `function emptyRegistry()`. **Look for this pattern when authoring `daemon.ts`** — any module-level "default state" object should be a factory function, not a frozen constant.

Plus: **commander's parent-command-with-action-AND-subcommands** (for bare `indusk ui` aliasing to `ui start`) hasn't been proven yet — verify with a quick spike before committing the cli.ts wiring.

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
