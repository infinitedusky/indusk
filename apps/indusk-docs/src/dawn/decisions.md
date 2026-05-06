---
title: "Dawn — Architecture Decisions"
---

# Architecture Decisions

The architectural calls that have settled or are settling for Dawn. Mirrored from the live working ledger at [`.indusk/planning/indusk-v2-dawn/decisions.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/decisions.md). The planning version is the source of truth and gets updated in place; this docs-site copy is refreshed when decisions stabilize.

> **Reading this cold?** Start with [Why Dawn](./why) and [Pick, Defer, Cut](./pick-defer-cut) first. This document is the architectural detail under those product decisions.

## Status legend

| State | Meaning |
|---|---|
| `decided` | Settled. Reversing means a rewrite. |
| `new` | Recent decision (April-May 2026). Stable enough to design against, but not yet ratified by implementation. |
| `pending` | Real question, not yet answered. Will be resolved before or during the corresponding feature work. |
| `to-evaluate` | Alternate direction surfaced; needs evaluation against the main path before committing. |

---

## Decisions in force (carried from earlier research)

| ID | Decision | State |
|----|----------|-------|
| K1 | **Unified extension model** — built-in and third-party extensions are indistinguishable on disk | decided |
| K2 | **Config-as-source-of-truth** — `.indusk/config.json` declares what the project uses; init reconciles | decided |
| K3 | **Scaffold/init separation** — scaffold prompts interactively; init is deterministic | decided |
| K4 | **No backwards compat with v1** — Indusk-mcp freezes; Dawn is a separate product (per [A5](#a5)) | decided |
| K5 | **Build in `apps/dawn/`** — v1 stays installable throughout development | decided |
| K6 | **Coexistence, not migration** — Indusk and Dawn live alongside in the same project. Each keeps its own directory (`.indusk/`, `.dawn/`). A toggle switches which is active. No migration script, no forced port of existing plans | decided |

---

## Updates to earlier decisions

These supersede prior framings. The original framing is recorded for context.

| ID | From | To | State |
|----|------|------|-------|
| U1 | OTel as extension | **Signal petal as extension.** OTel is one of six petals, not the only one. Generalized contribution model: tests, compiler, annotations, preferences, flags all plug in the same way. Petals are emission points in the codebase that send signals to the Dawn app, which sits OUTSIDE the codebase and correlates across signals + history + memory. The petal is where it leaves; the Dawn app is where it lands. | new |
| U2 | Gate contribution model | **Evidence source contribution model.** Extensions register which claim-evidence sources they emit (spans, test output, compiler output, annotations). Gates become derived from evidence requirements rather than hand-authored. | new |
| U3 | Rewrite-vs-copy inventory | Expanded rewrite list to include the product's novel pieces: claim registry, correlation engine, monitor agent, evidence stamp retrofit. | new |

---

## Removed concepts

Concepts demoted from "load-bearing infrastructure" to "optional or absent."

| ID | Removed | Why | State |
|----|---------|-----|-------|
| D1 | **Semantic graph bridge as central substrate** | Claim registry + Graphiti + OTel become the substrate. The CGC+Graphiti projection becomes legacy infrastructure or removed | new |
| D2 | **CGC as required infrastructure** | Becomes bring-your-own optional petal. Static-code queries aren't load-bearing once runtime claim correlation works | new |

---

## New decisions {#new-decisions}

The architectural shape of Dawn. Each is stable enough to design against; ratification happens through implementation.

### A1 — Claim/evidence model is the core data model {#a1}

Claims live in the codebase (trajectory rows, plan documents). Evidence is emitted by petals with a 6-field stamp. Graphiti holds state history. The correlation engine queries federated across them.

### A2 — Three-agent architecture {#a2}

- **Monitor agent** — watches divergence between claims and evidence
- **Coder agent** — makes changes
- **Eval agent** — curates memory

Asymmetric information flow between them.

### A3 — Spiral iteration as the product's own delivery doctrine {#a3}

Every cycle touches every petal + the center. Retrospective identifies next cycle's bottleneck petal. Codified in a skill so it's repeatable and not founder-only.

### A4 — Product brief as a plan type {#a4}

The first thing Dawn's planner adds is a brief plan-type that sets path/rules for downstream feature plans.

### A5 — Dawn is a product, not a rewrite {#a5}

The original framing was "rewrite Indusk-mcp as `@infinitedusky/dawn`." That framing is replaced with: Dawn is a separate product with its own thesis. Indusk-mcp continues independently as a Claude-Code-only solo-dev tool. **This is the decision that reframes the entire plan's scope.**

### A6 — Positioning {#a6}

> **Dawn is a project management system for agent-assisted software development that self-improves by correlating development and delivery across every signal.**

Note: this positioning predates the FDE-wrapper framing in [Why Dawn](./why). The two are compatible — the wrapper is the *vehicle*; signal correlation is the *internal mechanism*. Resolving how the public-facing positioning sits relative to the FDE wedge is an open product question (see [Pick, Defer, Cut](./pick-defer-cut)).

### A7 — Adapter-extension boundary for external tools {#a7}

The core speaks only the claim/evidence/state protocol. External tools integrate via adapter extensions that translate in both directions:

- **Planning** — GitHub, Linear, markdown
- **Testing** — Vitest, Jest, Pytest, Playwright
- **Telemetry** — Dash0, Honeycomb, local OTel
- **Flags** — LaunchDarkly, GrowthBook, in-repo

Adapters are swappable; the core doesn't import tool-specific code. Core protocol is versioned (semver + documented breaking-change rules).

> Pattern inspired by hexagonal / ports-and-adapters; not committing to full Clean Architecture discipline — just this one principle.

### A8 — Agent-neutral skills & hooks with per-agent adapters {#a8}

Skills and hook scripts are source of truth in **the Dawn app**, NOT in the codebase (see [A13](#a13)).

- Claude Code adapter projects them into `.claude/` format inside the codebase when the user is driving Claude Code
- Future adapters cover other agents (Cursor, Aider, Codex CLI, etc.)
- The codebase-side `.claude/` (or equivalent) becomes derived state, regenerated on `dawn sync`
- Skills declare agent compatibility in frontmatter; adapters filter accordingly

> Revised 2026-05-02 — moved skills/hooks from "codebase `.dawn/` source of truth" to "Dawn app source of truth, projected into the codebase per active agent."

### A9 — Fork-and-extract as a special case of the Dawn-app/codebase split {#a9}

For long FDE engagements against an external codebase: the codebase is a continuously-rebased fork; the Dawn app sits outside it; PR submission walks the production-code delta to upstream.

For your own projects: no fork — same architecture, different deployment shape.

The fork is a mechanism, not the central pattern. The central pattern is the Dawn-app / codebase split (see [A13](#a13)).

### A10 — AST-driven OTel rule engine — reject marker-based extraction {#a10}

Inline `// dawn-start` / `// dawn-end` comments break catastrophically on refactors (renames, splits, file moves, signature changes).

Instead: declare instrumentation rules ("every async function in `lib/vapi/tools/` gets a tool-call span"); apply them by AST analysis on each upstream sync. Rules describe *what kind of function gets a span*, not *where the span lives*. Survives upstream refactors because rules don't track location. Same engine generalizes to test scaffolding and any other code-structural insertion.

### A11 — Tree-shaped worktree inheritance for tests + OTel rules {#a11}

A worktree branched off a parent inherits the parent's tests + OTel rules, with override and add. Inheritance graph lives in the Dawn app, not in the codebase. Worktrees just *are*; the Dawn app knows what each one inherits from. Cuts re-authoring cost when sub-worktrees branch off feature work.

### A12 — Emission-only direction discipline {#a12}

- Worktrees emit signals out (OTel spans, test results, logs)
- The Dawn app receives, correlates, accumulates
- The Dawn app reads the codebase via git/fs (to render plans, parse trajectories, walk diff state) but does NOT write to it as part of normal operation
- Code changes happen because the agent edits the codebase, not because the Dawn app reaches in

This is what makes fork-and-extract clean.

### A13 — Codebase contains ONLY production code + tests + OTel rules {#a13}

Plus an optional thin gitignored pointer.

**No durable Dawn state in the codebase:** no planning, no lessons, no Graphiti episodes, no skill files, no memory.

All durable state is in the Dawn app, which lives outside the codebase. Worktrees never have a Dawn install. The Dawn app discovers codebases (via git remote, gitignored pointer, or explicit user assignment); they don't announce themselves.

### A14 — `apps/dawn-test-target/` synthetic Next.js app inside dusk {#a14}

For iterating the AST rule engine. Minimal Next.js with 3-5 API routes covering Dawn's instrumentation patterns:

- Sync handler
- Async with external calls
- Error path
- Middleware-wrapped
- Mock business logic

Realistic shape, zero external complexity. When the rule engine works against this target, apply to a real engagement (avoca-next).

---

## Open architectural questions

Real questions still pending. Will be resolved before or during the corresponding feature work, not in the brief.

| ID | Question | Blocked by | State |
|----|----------|-----------|-------|
| O1 | Built-in extension storage — copy on scaffold, reference by name, or hybrid (built-ins stay in package, `.indusk/extensions/` holds only third-party)? | — | pending |
| O2 | Config schema shape — final field set | O1 | pending |
| O3 | Extension manifest schema — which fields make the v2.0 cut | O1 | pending |
| O4 | Scaffold flow UX — interactive prompts, flag-driven, presets | O2, O3 | pending |
| O5 | Init reconciliation behavior — how it handles drift, logs, update merge | O4 | pending |
| O6 | Local mode rethink — is the overlay model the right answer for v2? | — | pending |
| O7 | Plan parser refactor — extension-aware discovery | O2 evidence-source model | pending |
| O8 | Migration script design — what reads, what writes, what deletes | most decisions | pending |
| O9 | Planner v2 additions — subplans, mandatory timestamps, work activity events | — | pending |
| O10 | Rule-engine syntax — TypeScript decorators? AST-visitor functions? DSL? Configuration files? | A10 | pending |
| O11 | AST library — TypeScript compiler API (most accurate, TS-only), Babel (broader, JS-first), or Tree-sitter (multi-language, faster, less idiomatic for TS)? | A10 | pending |
| O12 | Conflicts between Dawn instrumentation and human-authored OTel already in upstream — detect, defer, or warn? | A10 | pending |
| O13 | Reviewer-access UI shape — signed URLs, ephemeral preview deploys, GitHub bot comments, or something else? | A9 | pending |
| O14 | Conflict resolution during upstream rebases — automated, semi-automated, or manual? | A9, A10 | pending |
| O15 | How does the Dawn app discover a codebase's identity? Git remote URL match, gitignored thin pointer, explicit user assignment via Dawn UI, or some combination | A13 | pending |

## Open product questions

Broader questions, not architectural detail.

- Does Dawn keep the "MCP server" framing or position itself as a dev system that *includes* an MCP server?
- Is `indusk-docs` part of v2 or a separate concern?
- Project management surface — is the admin UI the primary surface, or does Dawn get its own?

---

## Alternate directions under evaluation

Surfaced as standalone research notes. Not yet decided — flagged for evaluation against the main direction.

| Doc | Thesis | State |
|-----|--------|-------|
| [`research-alt.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/research-alt.md) — **Workbench Mode** | Make workbench root configurable so Dawn's source-of-truth can live alongside (rather than inside) managed projects. Project-local becomes the special case where workbench root = project root. Originated from FDE consulting usage. Has a load-bearing Claude Code prerequisite (cwd-only `.mcp.json` resolution) | to-evaluate |

---

## Change log

The full evolution log lives in the planning ledger ([`.indusk/planning/indusk-v2-dawn/decisions.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/decisions.md)). Recent landmarks:

- **2026-04-21** — Initial ledger created. Carried K1–K6 from April 7 research; added U1–U3 updates, D1–D2 deletes, A1–A6 new decisions reflecting signal-correlation vision. K6 rewritten same day from "bespoke migration script" to "coexistence, not migration." A7 added (adapter-extension boundary). A8 added (agent-neutral skills with per-agent adapters).
- **2026-04-30** — Workbench-mode surfaced as research alt. Originated from real FDE consulting usage. Load-bearing prerequisite: Claude Code currently resolves `.mcp.json`/skills/hooks only from cwd at session launch.
- **2026-05-01** — Captured fork-and-extract pattern + AST-rule-engine thread from the Avoca FDE engagement. Permanent-fork dev pattern; marker-based extraction rejected (refactor-fragile); declare-rules + AST-aware re-application chosen. Surfaced that *only* OTel needs structural code insertion (planning, Graphiti, tests, lessons all live outside production code).
- **2026-05-02** — Captured Dawn project architecture as companion doc. Sharpened the architecture: Dawn projects are two distinct surfaces — Dawn app outside the codebase; codebase contains only production code + tests + OTel rules. Worktrees inherit tests + OTel rules tree-shaped from their parent. Direction is emission-only. Added A9–A14 and O10–O15. Revised A8 — skills/hooks moved from "codebase `.dawn/` source of truth" to "Dawn app source of truth, projected into the codebase per active agent."

---

## Source documents

The decisions on this page are distilled from research. Full reasoning lives in:

- [`research.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/research.md) — original April 7 research; K1-K6 + first-pass open questions
- [`research-fde-and-extraction.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/research-fde-and-extraction.md) — fork-and-extract pattern + AST rule engine
- [`research-dawn-project-architecture.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/research-dawn-project-architecture.md) — Dawn-app / codebase split + worktree inheritance + emission-only direction
- [`research-alt.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/research-alt.md) — workbench-mode alternate direction

Read the source documents for the *why* behind each decision; this page is the *what*.
