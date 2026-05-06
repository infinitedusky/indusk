# Dawn

> **Status: product definition in progress.** This section captures what Dawn is, who it's for, and what the MVP looks like. The architecture is sketched in [the indusk-v2-dawn planning research](https://github.com/infinite-dusky/dusk/tree/main/.indusk/planning/indusk-v2-dawn) and continues to evolve. Decisions land here when ratified.

## What Dawn is, in one sentence

A wrapper that lets a forward-deployed engineer (FDE) walk into an unfamiliar codebase and start working productively on day one — built on an architecture that scales from one engineer to a coordinated team without rewrites.

## What Dawn is NOT

- Not a rewrite of indusk-mcp. Indusk-mcp continues to ship as a Claude-Code-only solo-dev tool. Dawn is a separate product.
- Not an orchestration platform. Paperclip already does that. Dawn focuses on the *engineer's* workflow inside a codebase, not the *company's* workflow across many engineers.
- Not a replacement for Claude Code, Cursor, Codex, or any other agent CLI. Dawn wraps whichever agent the engineer prefers.
- Not autonomous. The engineer is in the loop; Dawn accelerates them.

## The product-definition documents

Read in order. Each closes doors the previous opened.

1. [Why Dawn](./why) — the problem Dawn is positioned against
2. [Who Dawn is for](./who) — personas, design partner, buyer vs user
3. [5x on day 1](./5x-on-day-1) — the MVP success metric
4. [Pick, Defer, Cut](./pick-defer-cut) — the trade-off matrix that closes doors
5. [Out of scope](./out-of-scope) — what Dawn is NOT, despite being tempting

## Architecture

The architectural decisions under the product:

- [Decisions](./decisions) — A1–A14 new decisions, K1–K6 carried, U1–U3 updates, D1–D2 removed concepts, O1–O15 still open. Mirrored from the live planning ledger.

## Why this section exists

Indusk-mcp has been growing additively for a year. Capabilities accumulated; almost nothing got cut. Dawn is the explicit response: a separate product with a tight scope, a named user, an MVP success metric, and a discipline of subtraction.

This section is the working brief for Dawn. It is also the artifact aligned with a potential founding partner — written to be readable cold, not as a stream of internal context.

## Status

| Document | Status |
|---|---|
| Why | Draft — needs partner-reviewed pass |
| Who | Draft — needs design partner named |
| 5x on day 1 | Draft — needs concrete success metric |
| Pick / Defer / Cut | Draft — picks not yet ratified |
| Out of scope | Draft — needs explicit kill criteria |

When the matrix is ratified and the design partner is named, this section moves from `draft` to `v1` and becomes the spec.
