# Untracking a file moves its provisioning onto every path that makes a checkout

A tracked file reaches clones, plan worktrees and CI for free; once it is untracked, every path that makes a checkout (update, the daemon's sync, createPlanWorktree, and the still-open startWorkbenchPlan, eval worktrees, init) has to provision it, or that checkout has none.

**Why:** untrack-mcp-json took `.mcp.json` out of git. Build Phase 1 only covered `indusk update`; falsification found the daemon's sync could create a jaeger-only file that `update` then called "present", and that `createPlanWorktree` (a plain `git worktree add`) left every new plan worktree with no MCP config. The audit then found more writers outside `ensureMcpJson`.

**How to apply:** before untracking a file, grep for its name, list every path that creates a checkout or writes it, route each through one create-if-missing function, and add a row per path. See `.indusk/planning/untrack-mcp-json/` (impl.md Build Phase 2, audit.md, retrospective.md). The test-side rule (pin `INDUSK_SKIP_TELEMETRY_AUTOSTART=1` when running `indusk update`) is already covered by the daemon-leak lessons.
