---
title: Admin UI — Overview
---

# Admin UI — Overview

The InDusk admin UI is a read-only viewer over `.indusk/planning/` and `.indusk/eval/`. It's the first Arc 1 demo asset: a visible, demoable surface for the working agent's flow (plans, phases, trajectory rows, falsification logs, eval scorecards). It runs locally on your machine, served by Next.js, started by the `indusk ui` CLI subcommand.

## What it shows

The app has two regions:

**Sidebar (left rail)** — header + scrollable plan list. Active plans appear in the order declared by `.indusk/planning/master.md`'s pipeline tables. Plans not in `master.md` appear in an "Unordered" group below. Archived plans (under `.indusk/planning/archive/`) appear in a collapsed `Archived (N)` section at the bottom. Each plan item is a clickable link to `/plan/[name]` and carries a status badge (color-coded by trajectory state convention: green for completed/passing, blue-ish for in-progress, gray for draft/planned). Plans whose YAML frontmatter failed to parse get a red "malformed" badge and still appear — never silently dropped.

**Main pane** — when no plan is selected, an empty-state pointing you to the sidebar. When a plan is selected, the detail page renders sections conditionally on which documents are present:

| Section | Source | Behavior |
|---------|--------|----------|
| Header | `name` + computed `status` | Always visible — name, archived/active marker, status badge |
| Malformed banner | `plan.malformed` | Red banner when any document failed to parse |
| Raw documents | `plan.rawDocuments` | One CollapsibleSection per malformed file with raw markdown in a `<pre>` |
| Brief | `brief.md` | Markdown rendered (`react-markdown`) — Problem + Proposed Direction visible |
| Test Plan | `test-plan.md` | Collapsible Markdown render |
| ADR | `adr.md` | Collapsible Markdown render — Goal + Y-statement come through verbatim |
| Phases | `impl.md` | One CollapsibleSection per `### Phase N:` heading. Each phase contains a trajectory `<Table>` (filtered to rows whose `Passes at` matches the phase number) followed by the phase's full markdown |
| Falsification | `falsification.md` | One entry per hypothesis, outcome-color-coded (`fix-in-scope` → green, `spawn-plan` → blue, `accept-finding` → gray); terminator entry shown as a closer; "no falsification ritual run" empty state when log is missing |
| Scorecards | `.indusk/eval/results.log` | Table of scorecards whose timestamp falls in the plan's date range (`brief.date` → `retrospective.date`/now). Most-recent first. Status is ✓ ok / ✗ error |

Missing optional documents are NOT errors — sections simply don't render. A plan with only a brief renders the header + brief + falsification empty state; everything else is omitted.

## How to run it

From any project root with a `.indusk/` directory:

```bash
indusk ui
```

That spawns the admin app on `http://localhost:3939/` and opens your default browser. To override:

| Flag | Default | Effect |
|------|---------|--------|
| `--port <n>` | `3939` | Port to listen on. `0` = auto-pick a free one. If the requested port is taken, auto-bumps to a free one and prints a warning |
| `--no-open` | (open by default) | Don't auto-open the browser when the server is ready |

The CLI walks up from your `cwd` looking for `.indusk/config.json` to determine the project root (same pattern as every other `indusk` non-init command). The admin app reads from `process.cwd()`, which is inherited from the CLI's invocation — so the project root is wherever you ran `indusk ui` from.

## What's in v1, what's in v2

**v1 (this release):**
- Read-only viewer over plans + scorecards on disk
- Custom Tailwind primitives (no shadcn / no Radix)
- Server components for the data layer (no client-side fetching)
- Per-plan dynamic route at `/plan/[name]`
- Color-coded trajectory states
- Falsification log with outcome badges
- Scorecards joined by date-range overlap (approximate — see [known gotchas in CLAUDE.md](https://github.com/infinite-dusky/dusk/blob/main/CLAUDE.md))
- Component-reuse audit (`pnpm vitest run src/__tests__/component-reuse-audit.test.ts`) catches inline JSX where a primitive exists

**Deliberately deferred to v2 (Arc 2 / Arc 3):**
- Knowledge-graph viewer (waits for `graph-knowledge-architecture` to settle the schema)
- Test-run timeline (Arc 1 plan #2: `test-run-history`)
- Runtime telemetry (Arc 1 plan #3: `local-telemetry`)
- Cross-project polish (waits for `evaluator-structured-scorecard-output` to canonicalize scorecard schema across projects)
- Mutations (anything that writes — writes belong to the working agent)

## How it's organized

```
apps/indusk-admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Server component; reads planning data on every request
│   │   ├── page.tsx                # Empty-state when no plan selected
│   │   └── plan/[name]/page.tsx    # Server component; renders PlanDetail for the named plan
│   ├── components/
│   │   ├── ui/                     # Primitives: Button, Badge, Table, CollapsibleSection, Sidebar
│   │   ├── EmptyPlansSidebarSlot.tsx
│   │   ├── Markdown.tsx            # react-markdown wrapper (single import surface for swapability)
│   │   ├── PlanList.tsx            # Sidebar list with master-order + archived-collapsed
│   │   └── PlanDetail.tsx          # Main pane (header, brief, phases, falsification, scorecards, raw view)
│   ├── lib/
│   │   ├── planning-reader.ts      # Filesystem reader; reuses indusk-mcp parsers
│   │   └── phases.ts               # extracts Phase[] from impl markdown + pairs with trajectory rows
│   └── __tests__/
│       └── component-reuse-audit.test.ts  # T16 — grep audit for inline JSX where primitives exist
├── test-fixtures/
│   ├── sample-project/             # Used by planning-reader.test.ts
│   └── manual-smoke.md             # T15 — the outsider 30s identification check
├── package.json                    # workspace dep on @infinitedusky/indusk-mcp
└── vitest.config.ts                # Two projects: node (lib + audit), browser (components)
```

See [Component conventions](./component-conventions) for the visual primitive discipline that `<PlanList>` and `<PlanDetail>` consume, and the audit that enforces it.

## See also

- [Component conventions](./component-conventions) — the primitives, the no-shadcn rationale, the audit
- [`apps/indusk-admin/test-fixtures/manual-smoke.md`](https://github.com/infinite-dusky/dusk/blob/main/apps/indusk-admin/test-fixtures/manual-smoke.md) — T15 outsider-30s usability smoke
- [`apps/indusk-docs/src/changelog.md`](/changelog) — the 1.26.0 entry that shipped this
- [`apps/indusk-docs/src/lessons/`](/lessons) — retrospective lessons (added at plan archival)
