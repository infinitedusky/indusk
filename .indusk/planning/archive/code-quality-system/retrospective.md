---
title: "Code Quality System"
date: 2026-03-24
---

# Code Quality System — Retrospective

## What We Set Out to Do
Establish Biome as the single linting/formatting tool with a quality ratchet that only gets tighter. Design MCP tools for quality checks.

## What Actually Happened
Biome configured with VS Code integration. biome-rationale.md created to document why each non-default rule exists. MCP tools designed (quality_check, suggest_rule, get_quality_config). The retrospective step now asks "could this have been caught by a Biome rule?"

## Getting to Done
Biome 2.x API differs significantly from docs/examples. `noVar` doesn't exist, `noUnusedVariables` has no `ignorePattern`, overrides use `includes` not `include`. Had to match schema version to installed version.

## What We Learned
- biome-rationale.md as a knowledge artifact is valuable — it explains the "why" not just the "what"
- The quality ratchet concept (only tighter, never looser) is a good forcing function
- Biome 2.x documentation lag is real — always check the installed version's schema

## What We'd Do Differently
- Nothing significant — this was clean

## Quality Ratchet
The entire plan IS the quality ratchet. Added to biome-rationale.md as the origin.

## Metrics
- Sessions spent: 1
- Files touched: 4 (biome.json, biome-rationale.md, MCP tools design, CLAUDE.md)
