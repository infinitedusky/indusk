# A test asserting a specific untracked file is absent from `git status --porcelain` can pass for the wrong reason — plain porcelain collapses an untracked directory to one summary line

`git status --porcelain` (no flags) reports an entirely-untracked directory as a single line (`?? path/to/dir/`), not one line per file inside it. A test that filters porcelain output for a specific file's path (e.g. checking that `.indusk/worktree-configs/config.schema.json` is never offered to `workbench sync`) can match nothing and pass — not because git is ignoring the file, but because the directory-collapse line doesn't contain the filename being searched for. The test is green while git is in fact offering the file for commit.

Fix: pass `--untracked-files=all` to force one line per untracked file, so a path-based filter has something to actually match against. Caught in worktree-config-schema-pointer's A6 falsification test: the assertion passed *before* the ignore rule for the schema file existed, which was the tell that the check wasn't exercising what it claimed.

**How to apply:** any test that inspects `git status --porcelain` output for a specific file path (ignore-rule checks, "this file should never be tracked" assertions, sync-safety tests) must use `--untracked-files=all`. If such a test passes on the very first run before the fix it's supposed to verify exists, that is the same "green for an uninteresting reason" smell as `a-green-falsification-row-can-be-green-for-an-uninteresting-reason` — interrogate it rather than accepting the green.

See `.indusk/planning/worktree-config-schema-pointer/impl.md` A6 and `apps/indusk-mcp/src/__tests__/worktree-config-schema-versioned.test.ts`.
