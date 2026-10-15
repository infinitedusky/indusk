# Never run `indusk update` from a plan's worktree: the installed binary copies its own package's skills, edits unrelated files and registers the worktree as a project; resync `.claude/skills/` with `cp apps/indusk-mcp/skills/<name>.md .claude/skills/<name>/SKILL.md` and run `skill-sync-parity.test.ts`

Found the hard way in skip-reason-why (2026-10-14). A Build Phase 1 subagent ran `indusk update` from the worktree to sync the skills it had just edited in `apps/indusk-mcp/skills/`. The installed `indusk` copied *its own* package's skills, not the worktree's, so the sync did not happen; it also edited unrelated files and registered the worktree as a 27th project in `~/.indusk/projects.json`. The files were reverted and the registry entry removed by hand.

The wrong assumption then travelled: the impl item was checked off with 'the sync happens at landing', but `pnpm install:local` does not sync `.claude/skills/`. The four installed copies stayed stale until a cold audit found them in Build Phase 5.

Do instead: after editing `apps/indusk-mcp/skills/`, copy each changed source to `.claude/skills/<name>/SKILL.md` by hand (the parity test's failure message gives the command) and run `pnpm exec vitest run apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts` in the same phase; `vitest related` does not reach it. Brief subagents not to run `indusk update` from a worktree.

See `.indusk/planning/archive/skip-reason-why/retrospective.md` (Getting to Done) and `apps/indusk-mcp/CLAUDE.md`, which carries the resync rule.
