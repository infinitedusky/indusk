---
title: "OpenTelemetry Extension — Retrospective"
date: 2026-04-01
---

# OpenTelemetry Extension — Retrospective

## What We Set Out to Do
Make every indusk-mcp project observable from `init`. The brief proposed three pieces: scaffolding via `init`, an extension with skill/health checks, and category-based filtering. The ADR added decisions for Pino, backend-agnostic OTLP, console exporter default, and the autonomous feedback loop vision.

## What Actually Happened
We built significantly more than the original three pieces:

1. **Four runtime templates** (not one) — Node.js, Next.js (server + client), React SPA, Python. The original scope only mentioned Node.js and Python. Next.js server/client split and React SPA browser instrumentation were added during implementation after realizing Next.js needs `@vercel/otel` (not the Node SDK) and that browser apps need a completely different SDK (`@opentelemetry/sdk-trace-web`).

2. **Dash0 auto-setup** — not in the original scope at all. Emerged from testing when we realized there was no way to configure the Dash0 MCP server without manual `.mcp.json` editing. Built the `readExtensionEnv` + `claude mcp add` flow with composable.env contract integration.

3. **OTel gate** — added as Phase 4 after realizing that having instrumentation templates is useless if the agent never adds spans during implementation. The gate makes OTel a fifth enforcement gate alongside verification, context, and document. This was the most impactful addition — it changes the core plan/work lifecycle.

4. **Skill rewrite** — the original skill was 153 lines. After studying Dash0's `agent-skills` repo, we rewrote it to ~300 lines incorporating span kind, status codes, low-cardinality naming, sensitive data rules, trace correlation helpers, and a validation checklist.

## Getting to Done
Several unexpected detours:

- **`@opentelemetry/resources` API change** — `Resource` class was replaced by `resourceFromAttributes()` function in newer versions. The template didn't work until we fixed this. Discovered during the otel-test validation.

- **`--import` vs `--require`** — the instrumentation file must be loaded BEFORE application code. Our first test ran `npx tsx src/index.ts` without preloading instrumentation, so no spans were generated. The fix was `--import ./src/instrumentation.ts`. This is documented in the skill now.

- **npx bin resolution** — we changed `npx @infinitedusky/indusk-mcp serve` to `npx indusk serve` to fix a hanging issue in numero, but that broke other projects because npx can't resolve a bin name from a scoped package. Fixed with `npx --yes @infinitedusky/indusk-mcp serve`.

- **Template leaking into src/** — running `init` on the indusk-mcp source repo copied OTel templates into `src/`, breaking the TypeScript build. Added a guard that skips scaffolding when the project has `templates/instrumentation.ts`.

- **Dash0 MCP endpoint** — the OTLP ingestion endpoint (`ingress.`) is different from the MCP endpoint (`api.`). The component had only the ingress endpoint. Added `API_ENDPOINT` to the component and `DASH0_ENDPOINT_MCP` to the contract.

- **OTel gate chicken-and-egg** — after adding the OTel gate to the hooks, we couldn't edit the OTel plan's own impl because it was written before the gate existed. Had to add `#### Phase N OTel` sections to all four phases to unblock.

## What We Learned
- **Browser and server instrumentation are completely different stacks.** `@opentelemetry/sdk-node` for server, `@opentelemetry/sdk-trace-web` for browser, `@vercel/otel` for Next.js server. One template can't cover all.
- **Dash0's agent-skills repo is a gold standard** for how to write prescriptive agent guidance. Their span naming, sensitive data, and validation rules significantly improved our skill.
- **Gate enforcement should come early in a plan's lifecycle.** Adding the OTel gate at the end meant all existing impls needed retrofitting. If we'd planned the gate from Phase 1, the impl would have included OTel sections from the start.
- **`npx --yes`** is essential for MCP server commands that run in non-interactive stdio mode.
- **The OTel gate order matters.** OTel should come before verification so that trace verification can be part of the verify step.

## What We'd Do Differently
- **Start with the gate, not the templates.** The gate changes how every future plan is written. The templates are just files. We should have added the gate to the plan/work skills first, then built the templates.
- **Test with a fresh project earlier.** We built everything in the indusk-mcp source repo and only tested in a target project late. The template leak and npx resolution issues would have been caught sooner.
- **Research the OTel package API before writing templates.** The `Resource` → `resourceFromAttributes` change was a wasted iteration.

## Insights Worth Carrying Forward
- The pattern of "scaffold at init, enforce at work, verify at gate" is powerful and reusable. Any new concern (security headers, accessibility, performance budgets) could follow the same model.
- Dash0's `agent-skills` format (SKILL.md + rules/ subdirectory) is worth adopting for our skills. Created a plan brief for this: `planning/agent-skills-format/`.

## Quality Ratchet
No new Biome rules needed — the mistakes in this plan were architectural (wrong API, wrong endpoint URL, wrong npx command), not code quality issues that a linter could catch.

## Metrics
- Phases: 4
- Files created/modified: 15+
- Templates: 6 (instrumentation.ts, instrumentation.next.ts, instrumentation.web.ts, filtering-exporter.ts, logger.ts, instrumentation.py)
- Skills modified: 3 (plan, work, toolbelt)
- Hooks modified: 2 (validate-impl-structure.js, check-gates.js)
- Docs pages: 2 new (reference/tools/otel.md, decisions/otel-extension.md)
- npm versions published during development: 1.5.9 through 1.6.1 (7 versions)
- End-to-end validated: traces from otel-test and otel-test-v2 confirmed in Dash0 via MCP query
