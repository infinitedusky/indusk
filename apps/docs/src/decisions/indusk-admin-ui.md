# InDusk Admin UI — Decision Summary

Shipped in `@infinitedusky/indusk-mcp@1.26.0`. Archived at `.indusk/planning/archive/indusk-admin-ui/` in the repo. Transitively superseded in hosting mechanics by [Admin UI Hosting](./admin-ui-hosting) (1.27.0–1.27.7), but the primitives, data layer, component-reuse discipline, and test harness all survive unchanged.

## The Problem

InDusk's planning artifacts (brief / ADR / impl / trajectory / falsification log / eval scorecards) are authored as markdown files under `.indusk/planning/` and referenced across workflows, but there was no rendered reader surface. Nobody looked at impl.md files as plain markdown in practice — they needed a sidebar of plans, a pane of phases with color-coded trajectory states, and at-a-glance falsification + scorecards context. Arc 1 (the InDusk demo) needed a first-class visual surface or the system's discipline would read as abstract.

## The Decision

Ship `apps/indusk-admin/` as a **Next.js + React + Tailwind 4 standalone app**, plus an `indusk ui` CLI subcommand to launch it. v1 is **read-only** — no mutations, no auth, no hosted deployment — with these load-bearing constraints:

- **Custom Tailwind primitives** under `src/components/ui/` (Button, Badge, Table, CollapsibleSection, Sidebar). No shadcn-ui, no Radix. A grep-based audit (`component-reuse-audit.test.ts`) structurally enforces single-source-of-truth for visual primitives.
- **Reuse indusk-mcp's parsers** via workspace subpath exports (`@infinitedusky/indusk-mcp/trajectory/parser`, `@infinitedusky/indusk-mcp/falsification/log`) — never duplicate parsing.
- **vitest-browser-mode with @vitest/browser-playwright** (real Chromium) for component tests; node-mode for data-layer tests. Separate test projects in the same vitest config.
- **Structural malformed-frontmatter detection**: gray-matter's throw-vs-return-empty behavior is inconsistent across runtimes (plain Node throws; vitest runtime swallows), so detect malformed by structural signal (`---\n` + closing `---` + parsed data empty + block non-trivial). Runtime-independent and correct.

## Why This Shape

| Decision | Rationale |
|----------|-----------|
| **Custom primitives, no shadcn/Radix** | The admin UI's visual surface is ~200 LOC of primitives total. Adopting a component library adds dependency graph, version skew, and generator drift — real costs for no real benefit at this size. Custom primitives keep the surface legible and the audit trivially enforceable. |
| **Direct filesystem reads, not MCP tools** | The admin UI renders planning artifacts at request time. An MCP tool layer would add indirection with no benefit — the parser is already a library, not an MCP surface, and reusing it as a workspace dep is faster and more honest. |
| **Workspace subpath exports on indusk-mcp** | Adding `"./trajectory/parser"` and `"./falsification/log"` as subpath exports is non-breaking additive config that exposes exactly the functions consumers need, with TypeScript types. The admin app declares `"@infinitedusky/indusk-mcp": "workspace:*"` and the pnpm workspace resolves it. No duplication, no version skew. |
| **Structural malformed detection** | gray-matter's parse-error behavior differs across runtimes. Relying on throw would have malformed plans appear clean in vitest and crash in production. A structural signal ("block present, parsed data empty, block non-trivial = malformed") is runtime-independent. |
| **T16 component-reuse audit via grep** | The audit fires on inline `<button className=...>` and `<table className=...>` patterns where a primitive exists. v1 is deliberately simple — grep-based, not AST-aware. v2 may add AST parsing if drift becomes a problem; until then, simple > clever. |
| **v1 deliberately read-only** | Mutating plans is the working agent's responsibility via skills. Baking write paths into the admin UI would compete with that discipline; keeping v1 strictly a reader clarifies the boundary. |

## What Was Superseded in v2

Within 24 hours of shipping, `admin-ui-hosting` (1.27.0) rewrote the hosting model and related surfaces:

- **Per-project `indusk ui` → single machine-global daemon** (`indusk ui start/stop/status/restart`). The per-project model broke on contact with multi-project use.
- **Flat `/plan/[name]` routes → project-scoped `/p/[project]/plan/[name]`**. The flat routes couldn't disambiguate across projects.
- **Cross-project `/scorecards` route** (shipped in 1.26.0) → **per-project `/p/[project]/scorecards`** (1.27.2). Project-siloed is canonical going forward.
- **Workspace source dep distribution → pre-built Next.js output in the indusk-mcp tarball** (variant A3). v1's source-dep model only worked inside the monorepo; consumers installing via `npm i -g` couldn't run it.

What survived:
- Custom Tailwind 4 primitives (Button, Badge, Table, CollapsibleSection, Sidebar).
- Workspace subpath export pattern for parser reuse.
- Structural malformed-frontmatter detection + raw-content fallback view.
- T16 component-reuse audit (still passing).
- vitest-browser-playwright test harness.
- The `Plan`, `FalsificationData`, `Scorecard` data shapes and all planning-reader functions.

## Falsification

Falsification was run at plan close and skipped via `falsification: skipped` + reason frontmatter, because the three findings surfaced are defensive hardening items that don't block v1's shipped contract:

1. **Non-string frontmatter `status` crashes renderers** — `statusToBadge(42).toLowerCase()` throws; TS `as string` cast is a compile-time lie. Fix direction: `String(x ?? "").toLowerCase()` guards.
2. **`extractPhases` truncates on `##` inside fenced code blocks** — sentinel doesn't track code-block state. Fix direction: `inCodeBlock` toggle.
3. **Component-reuse audit regex line-scoped** — misses multi-line inline JSX. Fix direction: full-content `matchAll` with line-number computation.

All three are captured in the skip-reason for future pickup; likely targets for an `admin-ui-hardening` plan if drift bites.

## Related Plans

- Extended by [Admin UI Hosting](./admin-ui-hosting) — the v2 that rewrote the hosting model.
- Consumed by every subsequent `/work` cycle that renders plans in the admin UI.

See the archived plan at `.indusk/planning/archive/indusk-admin-ui/` for the full brief, research, ADR, test plan, impl (6 phases, 16 trajectory rows), and retrospective.
