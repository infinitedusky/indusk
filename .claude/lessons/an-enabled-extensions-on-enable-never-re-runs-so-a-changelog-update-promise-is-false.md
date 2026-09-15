# An already-enabled extension's on_enable hook never fires again on `indusk update` — autoEnableExtensions skips enabled extensions and extensionsUpdate is third-party-only, so a changelog promising "arrives on the next update" is false unless the manifest declares on_update

Any file an extension's `on_enable` hook materializes into a consumer project (a starter config, a copied schema, scaffolded scripts) is frozen at whatever package version the extension was enabled with — `indusk update` does not refresh it for a built-in extension unless that extension explicitly declares an `on_update` hook.

Why: `update.ts` calls two things that sound like they'd cover this and don't. `autoEnableExtensions` only enables extensions that are not yet enabled — it skips every extension already present, so it never re-runs `on_enable` for one that's already on. `extensionsUpdate` only reaches third-party extensions (the ones with a declared `on_update`); built-in extensions like `worktree` have no update path through it at all.

Found 2026-09-14/15 in `worktree-config-schema-pointer`: the fix's own first changelog entry promised the schema "arrives on the next enable or `indusk update`" — that promise was false the moment it was written, because no code path re-ran `on_enable` for an already-enabled `worktree` extension. The fix required adding an explicit step 7d in `update.ts` that re-runs `on_enable` specifically for `worktree` (its docblock already declared the re-run idempotent).

Corollary: a package-owned file materialized this way is inherently machine-local and version-drifting — it must be ignored by name in workbench sync rules, or two teammates on different package versions will silently overwrite each other's copy on every sync.

How to apply: before writing a changelog/doc sentence claiming a materialized file "updates" or "refreshes" via `indusk update`, check whether that extension's hook is actually re-invoked by `update.ts` — do not assume enable-time behavior extends to update-time without reading the update path. See `.indusk/planning/archive/worktree-config-schema-pointer/impl.md` Phase 2 and `apps/indusk-mcp/src/bin/commands/update.ts`.
