---
title: "Rename to Dusk"
date: 2026-04-13
status: accepted
---

# Rename to Dusk — Brief

## Problem
The monorepo is named `infinitedusky` but it's really the dev system (indusk-mcp, docs, skills, graph infra). The portfolio site doesn't belong here — it's brand management, not dev tooling. The name should reflect what the repo actually is.

## Proposed Direction
1. Remove `apps/indusk-portfolio` and its composable.env config
2. Rename the repo from `infinitedusky` to `dusk`
3. Clean up all internal references

The portfolio will be rebuilt from scratch in a separate repo later.

## Context
The portfolio app is just a Next.js scaffold — three source files, no real content. Nothing to migrate. The rename touches ~87 files that reference "infinitedusky" or "indusk-portfolio", but most are planning docs and archived plans where the references are historical context (fine to leave as-is or batch-update).

## Scope

### In Scope
- Delete `apps/indusk-portfolio/` directory
- Remove composable.env files: `env/components/indusk-portfolio.env`, `env/contracts/indusk-portfolio.contract.json`
- Remove portfolio scripts from root `package.json` (`dev:indusk-portfolio`, `build:indusk-portfolio`, `start:indusk-portfolio`)
- Rename root `package.json` name from `infinitedusky` to `dusk`
- Update `.indusk/config.json` group IDs and project references
- Update `CLAUDE.md` — repo name, architecture section, current state
- Update `.mcp.json` if it references the old name
- Update graph namespace references (CGC uses `cgc-infinitedusky`, semantic graph uses `semantic-infinitedusky`)
- Update `docker/Dockerfile.nextdev` if portfolio-specific
- Update `.ce-managed.json` if it references portfolio
- Update memory files that reference the old repo name

### Out of Scope
- Renaming `indusk-mcp` (that's dusk-v2 scope)
- Renaming the npm package `@infinitedusky/indusk-mcp` (dusk-v2)
- Creating the new brand/portfolio repo
- Updating archived planning docs (historical references are fine)
- Renaming the GitHub remote or directory on disk (user's choice, not automated)

## Success Criteria
- `apps/indusk-portfolio/` no longer exists
- `pnpm install` and `pnpm check` pass cleanly
- `pnpm turbo build --filter=indusk-mcp` succeeds
- `pnpm turbo build --filter=indusk-docs` succeeds
- No dangling references to `indusk-portfolio` in active config files
- Root package name is `dusk`

## Depends On
- None

## Blocks
- dusk-v2 (will continue the rename of indusk-mcp itself)
