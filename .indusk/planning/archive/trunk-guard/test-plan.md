---
title: "Trunk guard — Test Plan"
date: 2026-09-17
status: accepted
---

# Trunk guard — Test Plan

## Purpose

Every assertion crosses the boundary the bug lives on: the hook as Claude
Code runs it (a node subprocess fed the event on stdin, in a real git
repository on a real branch), or the built CLI writing a real settings file.
A test that imported an allow-list constant would prove the list and nothing
about whether an edit is refused.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | In a project on `main`, an Edit or Write to a source file is refused, and the refusal names `indusk worktree create` and the branch; the identical edit on a `plan/x` branch is allowed with no output | vitest, `runHook("trunk-guard.js", event)` against a temp git repo |
| A2 | On `main`, edits to `.indusk/planning/…`, `.indusk/current.md`, `.claude/lessons/…`, `.claude/settings.json`, `CLAUDE.md` and `AGENTS.md` are allowed | vitest, hook runner |
| A3 | On `main`, a Bash `git commit -m …` with a staged source file is refused naming the file; with only allow-listed paths staged it is allowed; a `git commit -m "chore(release): 1.51.0 — …"` with a packaged file staged is allowed; a Bash command that is not `git commit` (`git commitment`, `echo git commit`) is ignored | vitest, hook runner, real staged files |
| A4 | In a versioned workbench with one declared repo, an edit to a file in the code repository on its `main` is refused, and an edit to the workbench's `.indusk/planning/…` is allowed — over every one-repo layout | vitest, hook runner, `helpers/versioned-workbench.ts` `LAYOUTS` |
| A5 | `indusk init` registers `trunk-guard.js` under both the the Edit/Write matcher and the `Bash` PreToolUse matchers; `indusk update` on a project whose settings lack them adds both; a second `update` changes the settings file by zero bytes | vitest, `runCli` (`INDUSK_HOME` pinned by the helper) |
| A6 | With `worktree.trunk_guard.enabled: false` in the project's config, or `INDUSK_TRUNK_GUARD=off` in the environment, the refused edit from A1 is allowed and the hook writes nothing | vitest, hook runner |
| A7 | This repository's own `.claude/settings.json` registers `trunk-guard.js` under both matchers, through the one `hookCommand` form | vitest, reads the file |

## Deferred Verification

None. Every assertion is checkable in the suite.
