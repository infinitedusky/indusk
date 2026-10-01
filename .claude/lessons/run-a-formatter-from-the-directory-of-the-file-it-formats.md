# Run a formatter (biome, prettier) from the directory of the file being formatted, never from a sibling package — a monorepo's per-package config means the wrong cwd silently applies the wrong rules

In admin-plan-type, `biome check --write` was run from `apps/indusk-mcp` against a file that actually lives in `apps/indusk-admin`. Biome resolved the nearest config from the cwd it was invoked in, not from the target file's own package, and rewrote 489 lines of formatting for what was intended as an 8-line change — because the admin app's biome config differs from indusk-mcp's.

This generalizes the existing lessons about scoping a formatter to changed files ([[scope-biome-write-to-changed-files-not-whole-directories]], [[scope-formatter-to-changed-files-not-whole-directories]]): scoping to the right *files* isn't sufficient in a monorepo with per-package config overrides if the formatter is invoked from the wrong *directory* — the file-list scope was already correct here, but the cwd was not.

**Rule:** invoke a formatter with a cwd inside (or matching) the package that owns the file being formatted, not from whatever package you happen to be working in. In a monorepo, `pnpm --filter <package> exec biome check --write <file>` is safer than a bare `biome check --write <path-into-another-package>`.

**Related, same retrospective:** verify every commit's actual contents with `git show --stat` after making it — a commit given three file paths to stage had recorded only two, for a reason that was never established before moving on. Don't trust that a commit command's argument list reflects what actually landed; check the commit, not the command.
