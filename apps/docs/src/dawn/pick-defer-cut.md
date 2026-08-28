# Pick, Defer, Cut

The trade-off matrix that closes doors. Each row is a decision Dawn must make explicitly. The decision *type* matters: some things must be picked once and forever, some get deferred to v1.x with the architecture committing to compatibility, some get demoted or cut entirely.

Without explicit picks here, every decision drifts back to "support both" and the scope inflates uncontrollably. This document is the meta-discipline that keeps Dawn from becoming Indusk-but-bigger.

## How to read

| Type | Meaning |
|---|---|
| **PICK** | Choose A or B forever. Reversing later is a rewrite. |
| **DEFER** | Architecture supports both; MVP ships only the simpler one. Reversing is feature work, not architecture work. |
| **DEMOTE** | Currently exists in Indusk; not load-bearing for Dawn-MVP. Stays available for users who want it; not promoted; not maintained as core. |
| **CUT** | Currently exists in Indusk; doesn't ship in Dawn at all. |

Each entry has a kill condition: the evidence that would make us reverse the call.

## The matrix

| # | Dimension | Type | The call | What we give up | Kill condition |
|---|---|---|---|---|---|
| P1 | Solo-dev tool ↔ team-multiplicative architecture | PICK | Team-multiplicative architecture, even though MVP serves only one engineer | Simpler local-only data model | Design partner explicitly says they don't care about team-multiplicative — they want a solo-dev tool. (Unlikely given the FDE thesis.) |
| P2 | Local-only ↔ hosted backing | PICK | Hosted-capable from day one (architecture); local-only in deployment for MVP | Simpler ops; lower hosting cost early | Design partner refuses to use anything that touches a hosted service for client-IP reasons. (Real risk; mitigation: self-hosted Dawn app option from day one.) |
| P3 | Claude-Code-only ↔ cross-CLI | PICK | Cross-CLI via AGENTS.md + MCP (architecture); MVP ships only Claude Code adapter | One-CLI optimization shortcuts | Design partner uses something we don't have an adapter for and won't switch. (Mitigated by Claude Code adapter being first.) |
| P4 | Build substrate ↔ adopt Paperclip | PICK | Open until SPEC review of Paperclip's plugin system. **Default-tilt: don't fork; explore plugin or partner-collab path before committing.** | If we build, slower; if we plug into Paperclip, less roadmap control | Paperclip's plugin contract can't host Dawn's opinions OR Paperclip's roadmap diverges from FDE thesis OR licensing trajectory becomes hostile. |
| P5 | Codebase contains Dawn state ↔ Dawn app outside codebase | PICK | Dawn app sits outside the codebase. Codebase contains only production code, tests, OTel rules. ([Architectural decision A13](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/decisions.md).) | Single-directory simplicity | Discovery flow proves unworkable in practice — engineers can't find or onboard the Dawn app reliably. |
| P6 | Adapter-based extension model ↔ direct integration | PICK | Adapter-based ([decision A7](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/decisions.md)). External tools speak claim/evidence/state protocol. | Slower per-tool integration | Protocol surface area becomes too complex; revert to direct integration for the top 2-3 tools. |
| P7 | Free OSS ↔ open-core ↔ pure SaaS | PICK | Open-core (proposed). OSS layer = the wrapper substrate; paid layer = enterprise extensions (SSO, RBAC, hosted, support SLA). | Pure-OSS evangelism | Open-source community fragments Dawn's audience away from paid enterprise tier; consider pure SaaS later. |
| | | | | | |
| D1 | Multi-tenancy in data model | DEFER | Schema supports it from day one. UI/auth ships single-tenant for MVP. | None for MVP | If single-tenant ships and multi-tenant retrofit is worse than expected (cross-tenant leak risk), revisit. |
| D2 | Approval gates / governance | DEFER | Workflow shape supports them. Don't ship them in MVP. | None for MVP | Design partner needs approval gates from day one for client-engagement compliance. |
| D3 | Cross-CLI adapters beyond Claude Code | DEFER | Adapter abstraction lands; Cursor/Codex/Aider adapters ship in v1.x | None for MVP if Claude Code adapter is the design partner's choice | Design partner uses something else; promote that adapter ahead of others. |
| D4 | UI surface beyond CLI | DEFER | Admin UI exists in Indusk; Dawn ships CLI-first; UI in v1.x | Visual onboarding affordance for new engineers | Design partner needs a UI to onboard non-engineering stakeholders to the project. |
| D5 | Memory/Knowledge graph at full Indusk depth | DEFER | the lessons registry integration ships in v1; CGC defers to v2 (already demoted in Indusk per 1.28.7) | Some structural code-graph queries | Engineers explicitly want code-graph queries. (Indusk experience suggests they don't.) |
| | | | | | |
| C1 | CGC as required infrastructure | DEMOTE | Optional petal. ([Architectural decision D2](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/decisions.md).) Not in Dawn-MVP. | Structural code intelligence by default | Adopters loudly want it; promote back to default. |
| C2 | Eval-agent-on-every-commit | DEMOTE | Value depends on team-scale data. Not in Dawn-MVP. Architecture allows turning on later. | Continuous quality feedback for solo engineers | Solo engineers report missing it strongly. |
| C3 | Semantic graph event log | DEMOTE OR CUT | jj-only, complex, low signal in current state. Not in Dawn-MVP. Open question whether to cut entirely. | Append-only audit log of every project event | Audit-trail use case emerges that needs the log shape specifically. |
| C4 | OTel-as-default scaffolding | DEMOTE | OTel becomes one of six "petals" ([decision U1](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/decisions.md)). MVP ships OTel rules but doesn't auto-scaffold instrumentation. | Out-of-the-box telemetry for new projects | Design partner needs telemetry from day one and won't set it up themselves. |
| C5 | indusk-mcp's full extension surface | DEMOTE | Most extensions (excalidraw, falkordb, dash0, telemetry binaries) are not Dawn-MVP. Available as plugins. | Out-of-box capability breadth | Specific extension is load-bearing for design partner. |
| C6 | Falsification ritual + trajectory tables | KEEP — DO NOT CUT | These ARE Dawn's differentiation. Engineering rigor that prevents under-baked work shipping. | None | N/A — these stay. |
| C7 | Catchup + handoff + plans + lessons | KEEP — DO NOT CUT | These ARE the FDE-onboarding primitives. They are the wedge. | None | N/A — these stay. |

## What's still missing from this matrix

Decisions to make in subsequent passes:

- **What's the Dawn app's runtime form factor?** Local CLI + hosted service? Long-running daemon? Browser extension? Each affects auth, deployment, billing.
- **What's the licensing model for OSS layer?** MIT, Apache, AGPL, Elastic License? Affects defensibility of paid layer.
- **What's the data isolation guarantee for hosted Dawn app?** Per-engagement? Per-customer? Affects auth, schema, audit log retention.
- **How does Dawn-MVP discover an existing codebase?** Git remote match, gitignored pointer file, manual config? Affects first-run UX.

## Discipline note

Every "DEFER" entry is a promise to ship something later, but every "DEFER" still costs architecture work in MVP (compatibility surface, schema flexibility, future-proofed APIs). DEFERs aren't free. If the matrix has too many DEFERs, the MVP is too ambitious — convert some to CUT.

A healthy v1 ratio is 4-6 PICKS, 3-5 DEFERS, 5-10 DEMOTE/CUT. We're currently in that band.
