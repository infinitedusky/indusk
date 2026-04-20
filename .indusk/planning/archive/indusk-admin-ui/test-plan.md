---
title: "InDusk Admin UI — Test Plan"
date: 2026-04-19
status: accepted
---

# InDusk Admin UI — Test Plan

## Purpose

Behavioral assertions that, taken together, mean the v1 admin UI is working. Each assertion is described in user-visible terms (what someone opening the browser experiences) — not in implementation language (what a function returns). The mechanism column names how each will be tested but never describes test code itself.

When all these assertions pass, the v1 demo flow works: an outsider can be shown a plan, see its current state, and understand the discipline InDusk enforces — in under 30 seconds.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Running `indusk ui` from a project root prints a localhost URL and (by default) opens that URL in the user's browser. | manual smoke (run command, observe browser) |
| A2 | When the URL opens, the user sees a sidebar listing every active plan in this project. | vitest-browser-mode against a fixture project |
| A3 | The sidebar's plan list appears in the order defined by `master.md`'s pipeline. | vitest-browser-mode (assert sidebar plan order matches a fixture master.md) |
| A4 | Plans that live in `.indusk/planning/archive/` appear in a separate "Archived" section of the sidebar that is visually distinct from the active list and collapsed by default. | vitest-browser-mode (assert archive section presence + collapsed state) |
| A5 | Clicking a plan in the sidebar shows that plan's content in the main pane. | vitest-browser-mode (click + URL changes + content updates) |
| A6 | The main pane shows the plan's brief — at minimum the Problem and Proposed Direction. | vitest-browser-mode (assert visible text from a fixture brief.md) |
| A7 | The main pane lists the plan's impl phases as collapsible sections. | vitest-browser-mode (assert phase headings present + click expands) |
| A8 | Expanding a phase shows its trajectory rows in a table with columns: ID, Asserts, Writable at, Passes at, State. | vitest-browser-mode (assert table headers + row count) |
| A9 | Each trajectory row's State is visually color-coded — passing green, blocked red, planned/written gray, skipped muted, etc. — so you can see pass/fail status at a glance without reading the State text. | vitest-browser-mode (assert row's background or badge color matches expected for each state) |
| A10 | When a plan has a falsification log, the main pane shows it as a section with one entry per hypothesis, including the hypothesis text and outcome (fix-in-scope / spawn-plan / accept). | vitest-browser-mode (assert falsification section visible when log exists) |
| A11 | When the active plan has eval scorecards in `.indusk/eval/results.log` from commits in the plan's date range, the scorecards appear listed in the main pane (most recent first), each showing changeId, timestamp, and a clean/error indicator. | vitest-browser-mode against a fixture results.log |
| A12 | When the planning directory is empty (no plans), the user sees an empty-state message ("No plans yet — create one with `/planner`") rather than a blank screen or JS error. | vitest-browser-mode against an empty fixture |
| A13 | When a plan's `brief.md` has malformed YAML frontmatter, the plan still appears in the sidebar (with a "malformed frontmatter" indicator) and clicking it shows the raw file content rather than crashing. | vitest-browser-mode against a fixture with broken frontmatter |
| A14 | When a plan is missing optional documents (e.g., no ADR), the main pane renders without an error — sections corresponding to missing documents simply don't appear (or show a muted "not yet written" placeholder). | vitest-browser-mode against a fixture missing ADR |
| A15 | An outside reviewer (someone who has never seen InDusk) can be shown the UI and within 30 seconds correctly identify: which plan is active, which phase that plan is in, and at least one passing test row vs. one failing/blocked row. | manual user test (timed walkthrough with a stakeholder; the demo-flow load-bearing measurable from the brief's Success Criteria) |
| A16 | Audit of the components directory: every visual primitive (Sidebar, CollapsibleSection, Table, Badge, Button) has exactly one source file under `src/components/ui/`. No inline JSX duplicates a primitive's role anywhere in the app — this is the component-reuse discipline checked structurally. | vitest custom audit (grep-based: walk source files, flag inline `<button className="px-...">` patterns where a primitive exists, etc.) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | "The UI feels good to use." Visual polish, animation timing, color contrast that pleases. | Aesthetic judgment varies; no test can score it. | Manual review by user before declaring v1 shipped; iterate based on feedback. Demo flow (A15) is the proxy — if outsiders can navigate it confidently, the feel is acceptable for v1. |
| U2 | "The UI generalizes to other projects, not just dusk." | Requires running it against multiple real codebases — outside this plan's CI scope. | Same generalization pattern as eval-agent-mcp-access: ship to global indusk-mcp, run in Numero, manually verify it lists Numero's plans and renders them correctly. Document as a deferred verification item in impl Phase 4 (smoke). |

## Notes

- **Behavioral discipline check**: every assertion above describes what the user sees, not what the code does. A1 says "user runs command, browser opens" not "ui.ts spawns next dev." A9 says "color-coded by state" not "Badge component receives variant prop." If we catch ourselves writing function-level assertions during impl, that's a leak — rewrite at the user level.
- **Mechanism choice**: A2–A14 use `vitest-browser-mode` (vitest tests that render in a real browser via Playwright under the hood, with the standard vitest API). This is right for a read-only viewer because the user-facing question is "does the page show what I expect?" — and a real browser catches CSS/layout/color rendering that jsdom misses (critical for A9's color-coded states). Single tool (vitest) instead of separate Playwright project. Standalone Playwright is reserved for cases that need multi-page navigation or network interception (none in v1). Fall back to vitest + jsdom + react-testing-library if vitest-browser-mode bites — same test code mostly works. Component-level isolation (testing individual primitives in jsdom) is appropriate where the test is genuinely about the component's API contract, not user-visible behavior.
- **Fixture strategy**: create a fixture directory under `apps/indusk-admin/test-fixtures/` that mimics `.indusk/planning/` shape with several plans in different states (one with falsification, one missing ADR, one with malformed frontmatter, one in archive). The same fixture set serves multiple Playwright tests.
- **A16 (component reuse audit)** is the structural enforcement of the discipline named in the brief. A grep-based vitest test walks source files and flags any `<button>` or `<table>` pattern that bypasses the corresponding primitive. Catches the cleanup-debt before it accumulates.
- **A11 (eval scorecards)** is moderately scoped — needs to handle the join between commits and plans (dates? or do we add a `plan` field to scorecards in a future plan?). For v1, simplest: list scorecards per plan by date overlap (plan creation date → archival date → most recent first). Refine in impl if it gets messy.
