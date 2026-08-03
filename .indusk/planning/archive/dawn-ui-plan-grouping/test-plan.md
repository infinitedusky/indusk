---
title: "Dawn UI — Plan Grouping — Test Plan"
date: 2026-08-02
status: accepted
---

# Dawn UI — Plan Grouping — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean plan grouping is working. Each names the mechanism that verifies it — not the test code, but the approach. These assertions become the rows of the impl's `## Test Trajectory`.

The theme running through them: **the sidebar gains structure, and never loses a plan.** Grouping is the feature; not-hiding-things is the invariant. Most of the assertions below are about the second, because a plan that silently disappears from the UI is worse than no grouping at all.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | A parent plan appears in the sidebar with its subplans shown beneath it, rather than all of them sitting in one flat list. | vitest browser (sidebar render) |
| A2 | Subplans appear in the order their parent declares — not alphabetically, and not in filesystem order. | vitest browser (sidebar render) |
| A3 | A plan that no parent claims appears at the top level, exactly as it does today. | vitest browser (sidebar render) |
| A4 | A subplan a parent names but that has not been created yet appears as a greyed placeholder, so the sidebar shows work queued ahead. | vitest browser (sidebar render) |
| A5 | Clicking a subplan opens that plan's page, the same as clicking any other plan. | vitest browser (navigation) |
| A6 | When a parent's declaration file is missing, corrupt, or has no subplan list, every plan on disk still appears — the sidebar falls back to the flat list rather than erroring or blanking. | vitest unit (reader) + vitest browser (render) |
| A7 | A plan that exists on disk but is named by no declaration is never hidden — the plan list still accounts for every folder in the planning directory. | vitest unit (reader) |
| A8 | Declaring a plan as a parent when it owns no subplans leaves it displayed as an ordinary plan rather than an empty group. | vitest unit (reader) |
| A9 | The plan list the CLI and MCP report is unchanged by this feature — grouping is a display concern and does not alter which plans are considered active. | vitest unit (parser regression) |

## Notes

- **A6 and A7 are the load-bearing pair.** They encode "grouping never costs you visibility." If either is hard to satisfy, the design is wrong, not the test.
- A4's placeholder is deliberately a *rendering* assertion rather than a data one: the parent's declaration is the source, and the UI decides how an unbuilt plan looks. Naming it behaviorally keeps that boundary intact.
- A9 guards a regression rather than a feature: the shared parser is consumed by `list_plans`, the `plans` CLI, and the admin app, so a change made for display reasons must not alter what those report.
- No assertion here names a function, type, or field. The declaration mechanism (`parents:` / `roadmap:` / `subplans:` frontmatter) is an implementation detail of the brief; if the mechanism changed tomorrow, every assertion above would still hold as written.
- No untestable assertions. Everything in scope is observable from the rendered sidebar or the reader's output, and the fixtures are plain directories — no external services, no paid integrations, no LLM output to judge.
