# Restart the running cockpit (and any `next dev` holding the worktree) after rebuilding indusk-mcp — a stale server writes approvals the new rules never count and blocks every contract that boots its own server

**Rule.** After `pnpm build` in `apps/indusk-mcp`, restart the admin cockpit / `next dev` that imports it before a person approves anything or a browser contract runs. A server started before the build keeps the old package in memory.

**Why.** storybook-components Build Phase 9 bound a story's approval to its stylesheet (`stylesheetHash`). Sandy's first re-approval pass went through a cockpit started at 09:14, before the build: its Approve wrote story entries *without* `stylesheetHash`, so all 57 stories still read proposed. The old code was not refused — it silently wrote an entry the new rule never counts; the round was spent twice. The same long-lived `next dev` (pid 99735) held `.next/` through Build Phases 6-9 and kept the browser contracts A7, A18 and A19 from booting, so they were deferred three phases running and their bodies changed meanwhile.

**How to apply.**
- When a phase changes what a record binds (an approval entry's fields, a hash), say in the item or the pause that the cockpit must be restarted on the new build first, and check the first write after restart carries the new field.
- Before a pause for a person, confirm the serving process's start time is later than the package build.
- Prefer contracts that start their own server on a free port or build directory (A30's static server) so a developer's running dev server cannot block them.

See `.indusk/planning/storybook-components/impl.md` Build Phase 9 re-approval note and Build Phase 6/7/9 Forward Intelligence.
