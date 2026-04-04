---
title: "CodeGraphContext"
date: 2026-03-24
---

# CodeGraphContext — Retrospective

## What We Set Out to Do
Set up CGC with a global FalkorDB instance for structural code intelligence across projects.

## What Actually Happened
FalkorDB running as global Docker container, CGC installed via pipx, per-project isolation via graph names. Later evolved significantly: port forwarding removed in favor of OrbStack hostnames, volume mount fixed (/var/lib/falkordb/data not /data), 12 wrapper tools built in indusk-mcp, fast-fail connection checking added.

## Getting to Done
Multiple issues discovered post-impl:
- Volume mount pointed to /data but FalkorDB writes to /var/lib/falkordb/data — data lost on container recreation
- Port forwarding to localhost caused collisions with application FalkorDB instances
- CGC MCP errors returned -32000 with no helpful context — 60-second timeout before failing
- SCIP indexer caused broken pipe errors on some codebases

## What We Learned
- Always verify where Docker images actually write data before mounting volumes
- OrbStack hostnames eliminate an entire class of port collision bugs
- Fast-fail with helpful error messages is critical — 60-second timeouts are unacceptable
- CGC's Module nodes for npm packages create graph noise but aren't filterable

## What We'd Do Differently
- Would have tested volume mounts by recreating the container on day 1
- Would have started with OrbStack hostnames instead of localhost

## Quality Ratchet
Added community lessons: community-mount-to-actual-data-dir.md, community-orbstack-no-port-forwarding.md

## Metrics
- Sessions spent: 3+
- Files touched: 15+ (graph-tools.ts, init.ts, .mcp.json, manifests, skills, lessons)
