# Running a command inside another project's directory resolves Claude Code's PreToolUse hooks to THAT project's (possibly older) validator, not the one you're working from

Found during versioned-workbench Build Phase 3 (commit d3d2b166), while testing `indusk workbench restore` against a real cloned copy of the avoca workbench inside a temp directory. Because the working directory for that test invocation was inside avoca's checkout, Claude Code's PreToolUse hooks resolved to avoca's `.claude/hooks/` — an older, unrelated project's validator — rather than dusk's own. This produced confusing validation behavior that had nothing to do with the code under test.

## Why

Claude Code hook resolution is directory-scoped: it walks up from the current working directory to find `.claude/settings.json` and the hooks it registers. Spawning a subprocess, cd'ing into a fixture, or testing against a real second checkout (as this plan's Build Phase 3 and 7 both do deliberately) means any interactive or hook-triggering action taken from inside that directory is now governed by THAT project's hook stack — which may be stale, differently configured, or simply not what you expect.

## How to apply

When a plan's test strategy deliberately involves operating inside a second real project's checkout (this plan's "point the tool at a real second checkout" pattern, matching [[point-the-tool-at-itself-before-calling-it-done]]), expect hook behavior to change the moment the cwd crosses that boundary. Prefer running the actual CLI-under-test as a subprocess (`spawnSync`/`execFileSync` with an explicit `cwd`) rather than `cd`-ing the interactive session itself into the target directory — the subprocess is scoped correctly, while the interactive session's own hook resolution silently follows the last `cd`. If confusing validator behavior appears mid-session, check whether the actual cwd migrated into a different project before assuming the validator itself is broken.

