/**
 * Resolve the InDusk project root. The admin UI is launched by `indusk ui`
 * which spawns `next dev` from `apps/indusk-admin/` (not from the project
 * root) and sets `INDUSK_PROJECT_ROOT` in the env so the server components
 * can find `.indusk/planning/`.
 *
 * Falls back to `process.cwd()` only if the env var is unset (which would
 * happen if the user runs `pnpm dev` directly from `apps/indusk-admin/` for
 * local UI development — fine, but the cwd will be the admin app dir).
 */
export function getProjectRoot(): string {
  return process.env.INDUSK_PROJECT_ROOT ?? process.cwd();
}
