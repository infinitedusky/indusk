---
title: "Dawn — Decisions Ledger"
created: 2026-04-21
status: in-progress
---

# Dawn — Decisions Ledger

Live working document. Keeps the current state of what's decided, pending, or changing for the dawn plan as the conversation evolves. Updated in place — not an artifact for a single moment.

Every entry has a state: `decided`, `pending`, `deleted`, or `new` (added this round, not yet ratified).

---

## Keep (still true from April 7 research)

| ID | Decision | State |
|----|----------|-------|
| K1 | Unified extension model — built-in and third-party indistinguishable on disk | decided |
| K2 | Config-as-source-of-truth — `.indusk/config.json` declares; init reconciles | decided |
| K3 | Scaffold/init separation — scaffold prompts; init is deterministic | decided |
| K4 | No backwards compat with v1 | decided |
| K5 | Build in `apps/dawn/`; v1 stays installable throughout development | decided |
| K6 | **Coexistence, not migration.** indusk and dawn live alongside in the same project. Each keeps its own directory (`.indusk/`, `.dawn/`). A toggle switches which is active (hooks + skills + MCP server). No migration script, no forced port of existing plans. | decided |

## Update

| ID | Previous framing | New framing | State |
|----|------------------|-------------|-------|
| U1 | OTel as extension | **Signal petal as extension** — OTel is one of six petals, not the only one. Generalize the contribution model so tests, compiler, annotations, preferences, flags all plug in the same way. **Petals are emission points in the codebase that send signals to the Dawn app, which sits OUTSIDE the codebase and correlates across signals + history + memory.** The petal is where it leaves; the Dawn app is where it lands. (Refined 2026-05-02 — see [research-dawn-project-architecture.md](research-dawn-project-architecture.md).) | new |
| U2 | Gate contribution model | **Evidence source contribution model** — extensions register which claim-evidence sources they emit (spans, test output, compiler output, annotations). Gates become derived from evidence requirements. | new |
| U3 | Rewrite-vs-copy inventory | Expand rewrite list with the product's novel pieces: claim registry, correlation engine, monitor agent, evidence stamp retrofit. | new |

## Delete

| ID | Removed concept | Why | State |
|----|-----------------|-----|-------|
| D1 | Semantic graph bridge as central substrate | Claim registry + Graphiti + OTel become the substrate. Semantic graph bridge (CGC+Graphiti projection) is demoted or removed. | new |
| D2 | CGC as required | Becomes bring-your-own optional petal. Static-code queries aren't load-bearing once runtime claim correlation works. | new |

## Add

| ID | New decision | State |
|----|--------------|-------|
| A1 | **Claim/evidence model** as the core data model. Claims live in-repo (trajectory rows, plan docs); evidence emitted by petals with 6-field stamp; Graphiti holds state history; correlation engine queries federated. | new |
| A2 | **Three-agent architecture:** monitor (watches divergence), coder (makes changes), eval (curates memory). Asymmetric information flow. | new |
| A3 | **Spiral iteration** as the product's own delivery doctrine. Every cycle touches every petal + center; retrospective identifies next cycle's bottleneck petal. Codified in a skill. | new |
| A4 | **Product brief as a plan type.** First thing dawn's planner adds: a brief type that sets path/rules for downstream feature plans. | new |
| A5 | **Dawn is a product, not a rewrite.** Thesis: signal-correlation PM system for agent-assisted development. Reframes the whole plan's scope. | new |
| A6 | **Positioning:** project management system for agent-assisted software development that self-improves by correlating development and delivery across every signal. | new |
| A7 | **Adapter-extension boundary for external tools.** The core speaks only the claim/evidence/state protocol. External tools integrate via adapter extensions that translate in both directions — planning (GitHub/Linear/markdown), testing (vitest/jest/pytest/playwright), telemetry (Dash0/Honeycomb/local), flags (LaunchDarkly/GrowthBook/in-repo). Adapters are swappable; the core doesn't import tool-specific code. Core protocol is versioned (semver + documented breaking-change rules). *(Pattern inspired by hexagonal / ports-and-adapters; not committing to full Clean Architecture discipline — just this one principle.)* | new |
| A8 | **Agent-neutral skills & hooks with per-agent adapters.** Skills and hook scripts are source of truth in the **Dawn app** (NOT in the codebase — see A13). The Claude Code adapter projects them into `.claude/` format inside the codebase when the user is driving Claude Code; future adapters cover other agents (Cursor, Aider, Codex CLI, etc.). The codebase-side `.claude/` (or equivalent) becomes derived state, regenerated on `dawn sync`. Skills declare agent compatibility in frontmatter; adapters filter accordingly. (Revised 2026-05-02 — moved skills/hooks from "codebase `.dawn/` source of truth" to "Dawn app source of truth, projected into the codebase per active agent.") | new |
| A9 | **Fork-and-extract as a special case of the Dawn-app/codebase split.** For long FDE engagements against an external codebase, the codebase is a continuously-rebased fork; the Dawn app sits outside it; PR submission walks the production-code delta to upstream. For your own projects, no fork — same architecture, different deployment shape. The fork is a mechanism, not the central pattern. (See [research-fde-and-extraction.md](research-fde-and-extraction.md).) | new |
| A10 | **AST-driven OTel rule engine — reject marker-based extraction.** Inline `// dawn-start` / `// dawn-end` comments break catastrophically on refactors (renames, splits, file moves, signature changes). Instead, declare instrumentation rules ("every async function in `lib/vapi/tools/` gets a tool-call span"); apply them by AST analysis on each upstream sync. Rules describe *what kind of function gets a span*, not *where the span lives*. Survives upstream refactors because rules don't track location. Same engine generalizes to test scaffolding and any other code-structural insertion. | new |
| A11 | **Tree-shaped worktree inheritance for tests + OTel rules.** A worktree branched off a parent inherits the parent's tests + OTel rules, with override and add. Inheritance graph lives in the Dawn app, not in the codebase. Worktrees just *are*; the Dawn app knows what each one inherits from. Cuts re-authoring cost when sub-worktrees branch off feature work. | new |
| A12 | **Emission-only direction discipline.** Worktrees emit signals out (OTel spans, test results, logs); the Dawn app receives, correlates, accumulates. The Dawn app reads the codebase via git/fs (to render plans, parse trajectories, walk diff state) but does NOT write to it as part of normal operation. Code changes happen because the agent edits the codebase, not because the Dawn app reaches in. This is what makes fork-and-extract clean. | new |
| A13 | **Codebase contains ONLY production code + tests + OTel rules** (+ optional thin gitignored pointer). No durable Dawn state in the codebase: no planning, no lessons, no Graphiti episodes, no skill files, no memory. All durable state is in the Dawn app, which lives outside the codebase. Worktrees never have a Dawn install. The Dawn app discovers codebases (via git remote, gitignored pointer, or explicit user assignment); they don't announce themselves. | new |
| A14 | **`apps/dawn-test-target/` synthetic Next.js app inside dusk** for iterating the AST rule engine. Minimal Next.js with 3-5 API routes covering Dawn's instrumentation patterns (sync handler, async with external calls, error path, middleware-wrapped, mock business logic). Realistic shape, zero external complexity. When the rule engine works against this target, apply to a real engagement (avoca-next). | new |

## Still open (from original research)

These decisions from the April 7 research doc remain unanswered and need resolution — either in the brief or punted to impl.

| ID | Question | Blocked by | State |
|----|----------|-----------|-------|
| O1 | Built-in extension storage — Option A (copy on scaffold), B (reference by name), or C (hybrid — built-ins stay in package, `.indusk/extensions/` holds only third-party)? | — | pending |
| O2 | Config schema shape — final field set | O1 | pending |
| O3 | Extension manifest schema — which fields make the v2.0 cut | O1 | pending |
| O4 | Scaffold flow UX — interactive prompts, flag-driven, presets | O2, O3 | pending |
| O5 | Init reconciliation behavior — how it handles drift, logs, update merge | O4 | pending |
| O6 | Local mode rethink — is the overlay model the right answer for v2? | — | pending |
| O7 | Plan parser refactor — extension-aware discovery | O2 evidence-source model | pending |
| O8 | Migration script design — what reads, what writes, what deletes | most decisions | pending |
| O9 | Planner v2 additions — subplans, mandatory timestamps, work activity events | — | pending |
| O10 | Rule-engine syntax — TypeScript decorators? AST-visitor functions? DSL? Configuration files? | A10 | pending |
| O11 | AST library — TypeScript compiler API (most accurate, TS-only) vs Babel (broader, JS-first) vs Tree-sitter (multi-language, faster, less idiomatic for TS)? | A10 | pending |
| O12 | Conflicts between Dawn instrumentation and human-authored OTel already in upstream — detect, defer, or warn? | A10 | pending |
| O13 | Reviewer-access UI shape — signed URLs, ephemeral preview deploys, GitHub bot comments, or something else? | A9 | pending |
| O14 | Conflict resolution during upstream rebases — automated, semi-automated, or manual? | A9, A10 | pending |
| O15 | How does the Dawn app discover a codebase's identity? Candidates: git remote URL match, gitignored thin pointer file, explicit user assignment via Dawn UI, or some combination. | A13 | pending |

## Open questions (broader, from original research)

- Does `dawn` keep the "MCP server" framing or position itself as a dev system that *includes* an MCP server?
- Is `indusk-docs` part of v2 or a separate concern?
- Project management surface — is the admin UI the primary surface, or does dawn get its own?

## Research alts (to evaluate)

Alternate directions surfaced as standalone research docs. Not yet decided — flagged for evaluation against the main direction.

| Doc | Thesis | State |
|-----|--------|-------|
| [research-alt.md](research-alt.md) — Workbench Mode | Make workbench root configurable so Dawn's source-of-truth can live alongside (rather than inside) managed projects. Project-local becomes the special case where workbench root = project root. Originated from FDE consulting usage. Has a load-bearing Claude Code prerequisite (cwd-only `.mcp.json` resolution). | to-evaluate |

---

## Change log

**2026-04-21** — initial ledger created. Carried K1–K6 from April 7 research; added U1–U3 updates, D1–D2 deletes, A1–A6 new decisions reflecting signal-correlation vision. O1–O9 retained as pending from original research.

**2026-04-21 (same day)** — K6 rewritten from "bespoke migration script" to "coexistence, not migration." indusk and dawn live alongside; toggle switches which is active; no migration work. Forward-looking only.

**2026-04-21 (same day)** — Added A7: hexagonal architecture (ports & adapters). Core speaks the claim/evidence protocol; external tools plug in via adapter extensions. Protocol is versioned.

**2026-04-21 (same day)** — Renamed A7 from "Hexagonal architecture" to "Adapter-extension boundary for external tools" to avoid overclaiming. Committing to the adapter principle only, not the full Clean Architecture pattern.

**2026-04-21 (same day)** — Added A8: agent-neutral skills & hooks with per-agent adapters. Skills/hooks live in `.dawn/`; Claude Code (and future agents) get them via adapter projection into the agent's native format.

**2026-04-30** — Surfaced workbench-mode as a research alt at [research-alt.md](research-alt.md). Originated from real FDE consulting usage; proposes making workbench root configurable so the Dawn state can live alongside managed projects rather than inside them. State: to-evaluate. Load-bearing prerequisite: Claude Code currently resolves `.mcp.json`/skills/hooks only from cwd at session launch (no composition with parent dirs / workbench root) — without an upstream fix or launcher workaround, the abstraction is broken. Also bundled adjacent feedback (init-docs Docker scaffold collision with composable.env, `.env.secrets.shared` plaintext-leak default, OrbStack 502 caching lesson, vitepress-openapi as default scaffold).

**2026-05-01** — Captured fork-and-extract pattern + AST-rule-engine thread from the Avoca FDE engagement at [research-fde-and-extraction.md](research-fde-and-extraction.md). Verbatim research note. Adds: permanent-fork dev pattern, marker-based extraction rejection (refactor-fragile), declare-rules + AST-aware re-application as the right shape, the simplification that *only* OTel needs structural code insertion (planning / Graphiti / tests / lessons all live outside production code), and `apps/dawn-test-target/` as a synthetic Next.js iteration target for the rule engine.

**2026-05-02** — Captured Dawn project architecture as companion doc at [research-dawn-project-architecture.md](research-dawn-project-architecture.md). Sharpens the architecture: a Dawn project is **two distinct surfaces** — the Dawn app (Graphiti, Jaeger, admin UI, planning, lessons, skills+hooks library) running OUTSIDE the codebase, and the codebase itself which holds ONLY production code + tests + OTel rules. Worktrees inherit tests + OTel rules tree-shaped from their parent. Direction is emission-only — worktrees emit signals out; Dawn app receives. The signal-correlation loop made concrete: test runs → OTel error span → Dawn app correlates with test history + plan-in-place + Graphiti memory → produces hypothesis ("missed a case" / "test written wrong"). Refined U1 to call out petals as emission points + Dawn app as correlation point. Revised A8 — skills/hooks now Dawn-app source of truth, projected into the codebase per active agent (NOT codebase `.dawn/` source of truth). Added A9–A14: fork-and-extract as special case (A9), AST rule engine (A10), worktree-tree inheritance (A11), emission-only direction (A12), codebase-contains-only-prod-code-tests-rules (A13), `dawn-test-target/` (A14). Added O10–O15: rule-engine syntax, AST library choice, OTel conflict handling, reviewer-access UI, rebase conflict resolution, codebase-identity discovery.
