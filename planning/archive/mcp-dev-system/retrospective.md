---
title: "MCP Dev System"
date: 2026-03-24
---

# MCP Dev System — Retrospective

## What We Set Out to Do
Package the InDusk dev system as an npm package with CLI (init, update, serve), 14 MCP tools, core parsers, and docs.

## What Actually Happened
Published as @infinitedusky/indusk-mcp. CLI handles init (scaffolds entire project), update (syncs skills by hash), init-docs (VitePress setup), and serve (MCP server). Core parsers for plans, context, and impl files. Dogfooded on the infinitedusky and numero codebases.

## Getting to Done
- Package name changed from @infinitedusky/dev-system to @infinitedusky/indusk-mcp
- .npmignore needed to exclude test files
- init --force needed to handle existing projects without overwriting CLAUDE.md
- npm publish required org creation on npmjs.com
- jj (Jujutsu) workflow learned during this plan — splitting changes, bookmarks, PRs

## What We Learned
- The init command should handle EVERYTHING — FalkorDB, CGC, indexing, skills, hooks, config
- update should sync new skills that didn't exist before, not just replace existing ones
- Domain skills and extensions solve the same problem — led to extension system replacing domain skills
- jj split is powerful for creating clean commit history after the fact

## What We'd Do Differently
- Would have planned the extension system earlier — domain skills were an intermediate step that got replaced
- Would have tested npm publish flow before building (org creation, token management)

## Quality Ratchet
No new Biome rules.

## Metrics
- Sessions spent: 3
- Files touched: 30+ (full package structure)
- Lines added: ~3500
