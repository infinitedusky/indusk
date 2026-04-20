---
title: "InDusk Admin UI — Retrospective"
date: 2026-04-20
status: accepted
---

# InDusk Admin UI — Retrospective

## What We Set Out to Do

Ship a first-class admin UI as the first Arc 1 demo asset: a Next.js + React + Tailwind standalone app at `apps/indusk-admin/`, plus an `indusk ui` CLI subcommand that launches it. v1 was explicitly read-only — sidebar of plans ordered by `master.md`, click-into shows the full plan (brief, test-plan, ADR, impl with phases + trajectory tables, falsification log, eval scorecards), malformed/missing inputs handled without blank screens.

Load-bearing constraints captured in the brief:
- **Custom Tailwind 4 primitives** — no shadcn-ui, no Radix. Build once under `src/components/ui/` and reuse everywhere; enforce the discipline structurally via an audit test.
- **Reuse indusk-mcp's parsers** — never duplicate trajectory-parsing or falsification-log logic. Subpath exports for workspace consumption.
- **vitest-browser-mode tests** with `@vitest/browser-playwright` provider (real Chromium) for every UI primitive and flow.
- Ship as 1.26.0.

## What Actually Happened

The six-phase plan shipped as 1.26.0 on 2026-04-19 within a single day, producing:

- **61 tests** across vitest browser-mode (components, HTTP smoke) and node-mode (data layer, audit).
- **Full component-reuse audit** structurally enforcing single-source-of-truth for visual primitives — zero violations at ship.
- **Workspace subpath exports** on indusk-mcp (`@infinitedusky/indusk-mcp/trajectory/parser` + `@infinitedusky/indusk-mcp/falsification/log`) so the admin app consumed the parsers as a workspace dep. Non-breaking additive change.
- **Structural malformed-frontmatter detection** via a `readDoc` helper that inspects the structural signal (has `---` + `---` + empty parsed data + non-trivial block) — because gray-matter silently returns `data: {}` inside the vitest runtime instead of throwing. Caught it early rather than late.
- **Manual-smoke procedure** at `apps/indusk-admin/test-fixtures/manual-smoke.md` for T15's outsider usability test.

**The big surprise**: within 24 hours of shipping 1.26.0, the per-project hosting model turned out to be structurally broken for any multi-project use. `admin-ui-hosting` (shipped 1.27.0 on 2026-04-20) rewrote the CLI subcommand, the hosting model, the routing structure, and the bundling pipeline. That plan transitively rewrote 60%+ of the original indusk-admin-ui surface:

- `indusk ui` CLI rewritten as a persistent daemon (start/stop/status/restart subcommands).
- Routes restructured from flat `/plan/[name]` to project-scoped `/p/[project]/plan/[name]`.
- Cross-project scorecards view (`/scorecards` from 1.26.0/1.27.0) removed in favor of per-project `/p/[project]/scorecards` (1.27.2).
- Admin app now bundled pre-built in the indusk-mcp tarball (variant A3) rather than shipped as a workspace source dep.

By the time indusk-admin-ui reached its retrospective, most of its "load-bearing" design decisions had been explicitly superseded. The plan's lasting contributions are the ones admin-ui-hosting built ON TOP of rather than replaced:

- **Custom Tailwind 4 primitives** (Button, Badge, Table, CollapsibleSection, Sidebar) — all survived; admin-ui-hosting extended them rather than replacing them.
- **Parser reuse via workspace subpath exports** — load-bearing, preserved.
- **Structural malformed detection + raw fallback view** — preserved in `readDoc` + `RawDocumentsSection`.
- **Component-reuse audit T16** — preserved and still passing.
- **vitest-browser-playwright test harness** — load-bearing, every subsequent plan's browser tests ran on top of it.
- **The data shape** (`Plan`, `FalsificationData`, trajectory + scorecard readers) — the architecture admin-ui-hosting extended.

## Getting to Done

This was a fast plan with one notable detour:

- **Brittle gray-matter malformed-YAML detection.** In plain Node, `matter(badYaml)` throws. Inside vitest's module-resolution path, the same call silently returns `data: {}`. Relying on the throw would have let malformed plans appear clean in the vitest suite but crash in production. Fix: structural signal (`---\n` + closing `---` + empty parsed data + non-trivial block) in `readDoc`. Took longer than budgeted because the symptom was "tests pass but prod breaks" — the slowest kind of debugging.
- **`next/link` in vitest browser tests requires a mock** because `next/link` references Node-only globals (`process`) not defined in the browser runtime. Stubbed with a synchronous `vi.mock` factory returning a plain `<a>` component. Every subsequent browser test in PlanList/PlanDetail/ProjectGrid reused the same pattern.
- **Local `PerProjectLayoutProps` interface instead of Next's `LayoutProps<"/p/[project]">`** helper — the latter regenerates from the route tree during `next build`, but `tsc --noEmit` in isolation can't resolve it, so typecheck-only CI falsely fails. Local interface keeps typecheck hermetic. This gotcha shipped in Phase 3 context and survives in admin-ui-hosting.
- **T15 (30-second outsider usability smoke) deferred to outsider availability.** Procedure documented; trajectory row marked `skipped` at plan close. The manual-smoke file still exists for future use — and actually may be more useful now against the 1.27.7 admin UI than it would have been against the 1.26.0 version the plan authored.

## What We Learned

- **Compile-time type assertions don't guarantee runtime shape.** The `status: string` claim in the `Plan` interface is enforced by TypeScript only at authoring boundaries. At runtime, gray-matter returns whatever YAML parsed to — a `status: 42` in a plan's frontmatter produces a number. Every `status.toLowerCase()` in `PlanList`/`PlanDetail` would then throw `TypeError`. The falsification investigation at plan close surfaced this as a real vulnerability and it's captured in the skip-reason for future hardening.
- **Shipping a v1 quickly lets the v2 be informed by real usage.** 1.26.0 shipped in a day with a working demo. The per-project hosting model broke on contact with multi-project reality, but the broken-ness was visible within 24 hours and 1.27.0 rewrote the lifecycle as a response to that visibility. If we'd deliberated the hosting model upfront, we'd probably still be arguing. The cost (1.26.0's lifecycle model is effectively throwaway code) was low because the surface it touched was small.
- **Workspace subpath exports are the right pattern for cross-package parser reuse within a monorepo.** Zero duplication, versioning via the workspace protocol, and the API surface is explicit (each subpath export is a deliberate commitment). Additive (non-breaking) so adoption costs nothing.
- **Structural detection beats exception-based signaling for malformed input, when the underlying library is inconsistent across runtimes.** gray-matter's throw-vs-return-empty behavior depends on the runtime. Relying on a structural signal (block present + data empty + block non-trivial) is runtime-independent and correct regardless of what gray-matter does on a given day.
- **Manual smoke procedures are worth writing even if never run.** T15's procedure at `apps/indusk-admin/test-fixtures/manual-smoke.md` forced clarity on what "works" means for an outsider — "identify the active plan, the active phase, and one passing vs one failing row, all within 30 seconds." That definition of success is load-bearing for future UI polish even when no outsider is available to run the smoke.

## What We'd Do Differently

- **Design the hosting model for multi-project before v1.** Per-project `indusk ui` sounded tidy at brief time, but the admin UI is a reader — there's no per-project mutable state that needs isolation, so a machine-global daemon was always the right shape. 1.26.0 → 1.27.0 wasn't catastrophic, but the per-project code is effectively dead weight now. A single upfront question ("what happens when a user has two InDusk projects?") would have caught it.
- **Bundle the pre-built output from day one.** 1.26.0 shipped with a workspace source dep model that only worked inside the monorepo; admin-ui-hosting had to rewrite this as variant A3 (pre-built Next.js output in the tarball). The "users install the package and run `indusk ui`" promise wasn't testable until the bundling was real; we should have validated distribution with the first publish, not the second.
- **Scope "what surfaces need to render this convention" into every plan that changes a convention.** indusk-admin-ui authored a convention (falsification-log rendering via `readFalsificationLog`) that was superseded by falsify-phase-authoring's new phase-authoring flow — and the admin UI didn't know about the new flow until admin-ui-hosting Phase 8 patched it. A "what renders this?" checklist at plan-close time would have caught the gap earlier.
- **Run the falsification dogfood at plan close, not at retrospective time.** The three hardening items (non-string status crash, extractPhases code-fence, audit multi-line bypass) were surfaced by the late falsification investigation. Running the ritual while the code is fresh would have caught them during Phase 6; deferring to retrospective cost us nothing here (we chose to skip the fixes) but could have cost a lot if any were production-impacting.

## Insights Worth Carrying Forward

- **The v1→v2 rewrite is not a bug pattern, it's a feature pattern, when the cost of getting v1 wrong is low.** indusk-admin-ui shipped broken-for-multi-project; admin-ui-hosting fixed it within 24 hours. Both plans were productive; neither was wasted. When a plan's surface is small and the blast radius of a wrong decision is contained, shipping fast and rewriting is cheaper than deliberating upfront.
- **"No shadcn, no Radix" is a load-bearing constraint for a small UI surface.** The custom primitives are ~200 lines combined (Button/Badge/Table/CollapsibleSection/Sidebar). No dependency graph, no version skew, no shadcn-CLI to run, no generated components drifting from hand-edited ones. The component-reuse audit structurally locks in the discipline. For small UIs, build > adopt; for big UIs, pick your poison.
- **Falsification dogfood reveals compile-time type lies.** The `as string` cast on gray-matter output was the same class of bug as admin-ui-hosting Phase 7's `isAlive(pid)` false-positive — both were places where a type claim (TypeScript's `string` / C's "PID is a process identity") didn't match runtime behavior. The pattern generalizes: any time you write `x as T` without runtime validation, you're claiming a guarantee the language doesn't enforce. Falsification investigation is good at finding these.

## Skipped Falsification — What Was Found

The falsification gate for this plan is satisfied via `falsification: skipped` + reason in the impl frontmatter. The investigation was run 2026-04-20 and surfaced three defensive hardening items, all recorded in the skip-reason for future pickup:

1. **Non-string frontmatter status crashes PlanList and PlanDetail.** `statusToBadge(plan.status).toLowerCase()` throws when YAML yields `status: 42`, `status: null`, or `status: true`. The TS `as string` cast is a compile-time lie; gray-matter returns the raw YAML type. Fix: `String(x ?? "").toLowerCase()` guards in both renderers + planning-reader's status derivation.
2. **`extractPhases` truncates on `##` inside fenced code blocks.** The `^##\s+\S` sentinel fires on any level-2-ish line regardless of code-block context, silently dropping phases after a phase whose content contains a fenced SQL/shell example with `## ...` lines. Fix: track `inCodeBlock` state toggled by lines matching `^```` at start.
3. **Component-reuse audit T16 regex is line-scoped.** `<button\n  className=...` splits across lines and bypasses the audit. Fix: apply regex against full file content with `matchAll` + match.index → line-number computation.

None of the three are blockers for v1's shipped contract, and admin-ui-hosting's own Phase 7 falsification already hardened the neighboring daemon/registry/resolve-open-path surfaces on the same code. The three findings are candidates for a future `admin-ui-hardening` plan; they do not gate this plan's archive.

## References

- Brief: [brief.md](./brief.md)
- ADR: [adr.md](./adr.md)
- Research: [research.md](./research.md)
- Test Plan: [test-plan.md](./test-plan.md)
- Impl: [impl.md](./impl.md) — 6 phases, 16 trajectory rows (14 passing, 1 skipped for T15, 1 passing post-retro)
- Changelog entry: 1.26.0 in [changelog.md](/changelog)
- Builds-upon relationship: `admin-ui-hosting` (1.27.0–1.27.7) rewrote the hosting model and extended the data layer.
