---
title: "Trunk guard — no code edits on main"
date: 2026-09-17
status: accepted
workflow: bugfix
---

# Trunk guard — Brief

## Bug

Worktree-per-plan is the default and every close-out lands by merge, but
nothing stops an agent from editing code straight on `main` when the change
feels small. On 2026-09-17 alone, one session committed to `main` a skill
step, a release-guard fix, a version-state feature, and a WIP for another
session; a second session was editing the write skill on `main` at the same
time. Two of those touched packaged paths with no plan, no test phase and no
ritual. The release guard refuses an unmerged packaged *branch*; it has no
opinion about packaged edits made on trunk directly, so the shape "one plan,
one branch, one landing" holds only as long as every agent remembers it.

Sandy, 2026-09-17: "maybe indusk and workbenches don't allow work on main."

## Fix

A PreToolUse hook, `trunk-guard.js`, shaped like the CLAUDE.md budget hook:

- On **Edit / Write**, when the file's repository is on a protected branch
  (`main`, `master`) and the file is not on the allow-list, refuse (exit 2)
  with a message that names the way through: `indusk worktree create <plan>`
  and land by merge (retrospective Step 10).
- On **Bash** `git commit` (the anchored regex the eval hook uses), when the
  repository is on a protected branch and any staged path is not on the
  allow-list, refuse the same way — this is what catches edits made through
  `sed`, `python` or a heredoc, which the Edit gate never sees.
- **Allowed on trunk**: `.indusk/**` (plans, current.md, config), `.claude/lessons/**`,
  `.claude/settings*.json`, `CLAUDE.md`, `AGENTS.md`. These are the writes a
  plan makes *before* it has a worktree (its brief) or *after* it landed (the
  compaction, the landing note), and what the eval agent writes.
- **Exempt**: a commit whose message begins `chore(release):` — the one
  packaged edit that belongs on trunk, made by the release command.
- **Off switches**, both deliberate and visible: `worktree.trunk_guard.enabled:
  false` in `.indusk/config.json` for a project that wants trunk work;
  `INDUSK_TRUNK_GUARD=off` in the environment for one call.
- **Workbench**: the rule applies to the declared code repository's branch;
  the workbench repository holds plan documents and is allow-listed by path.
- Registered by `init`, ensured by `update` on existing projects (the budget
  hook's ensure shape), and in this repository's own settings.

## Scope

### In Scope
- The hook, its two matchers (Edit|Write, Bash), the allow-list and the
  exemptions above
- `init` and `update` registration; this repository's `.claude/settings.json`
- `hook-runner.ts` learns the hook's name; docs: the hooks guide and the
  worktree reference; a CLAUDE.md line

### Out of Scope
- Detecting writes inside arbitrary Bash commands (the run loop's escape scan
  is best-effort and stays there); the commit gate is the second line
- Protecting branches other than trunk, or protected-branch rules on the
  remote
- Moving existing trunk-side work onto branches retroactively

## Success Criteria

- On `main`, an Edit to a source file is refused naming `indusk worktree
  create`; the same Edit on a `plan/*` branch is allowed; the same Edit to a
  planning document on `main` is allowed.
- On `main`, `git commit` with a staged source file is refused; with only
  allow-listed paths staged it is allowed; a `chore(release):` commit is
  allowed.
- In a versioned workbench the code repository's `main` is guarded and the
  workbench's `.indusk/` is not.
- `indusk init` registers both matchers; `indusk update` adds them to a
  project that lacks them; a second `update` changes nothing.
- The off switches allow the edit and say nothing.
