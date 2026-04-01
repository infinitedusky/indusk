---
title: "OpenTelemetry Extension — Implementation"
date: 2026-03-31
status: completed
---

# OpenTelemetry Extension — Implementation

## Goal
Make every indusk-mcp project observable from `init`. Pino structured logging, OTel auto-instrumentation, category-based filtering, console exporter by default, OTLP when a backend is configured.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Template files: `instrumentation.ts`, `logger.ts`, `filtering-exporter.ts` | ADR decisions (packages, patterns, categories) |
| Phase 2 | `init` scaffolds OTel into new projects | Templates from Phase 1, runtime detection logic |
| Phase 3 | OTel built-in extension (manifest, skill, health checks) | Extension system, templates |
| Phase 4 | OTel gate enforcement + end-to-end validation | All previous phases, Dash0 extension |

## Checklist

### Phase 1: Template Files

#### Phase 1 Implementation
- [x] Create `templates/instrumentation.ts` — OTel auto-instrumentation setup
  - NodeSDK with auto-instrumentations (fs and dns disabled — too noisy)
  - FilteringExporter wrapping OTLPTraceExporter when endpoint configured
  - ConsoleSpanExporter fallback when no endpoint
  - OTEL_SERVICE_NAME from env, graceful SIGTERM shutdown
- [x] Create `templates/filtering-exporter.ts` — category-based span filtering
  - Standard categories: http, db, business, inference, state, system
  - OTEL_ENABLED_CATEGORIES env var (comma-separated), defaults to all
  - refreshCategories() for runtime toggle without restart
- [x] Create `templates/logger.ts` — Pino with dual transport
  - stdout always, pino-opentelemetry-transport when OTLP endpoint set
  - LOG_LEVEL env var (default: info)
  - Documented log level semantics in comments
- [x] Create `templates/instrumentation.py` — Python OTel auto-instrumentation
  - TracerProvider with Resource, OTLP or Console exporter
  - Trace context correlation in Python logging
  - Documented opentelemetry-instrument CLI usage

#### Phase 1 Verification
- [x] All template files are valid TypeScript (transpile check: OK) and valid Python (py_compile: OK)
- [x] Templates use correct import paths — all 9 npm packages verified on registry (current versions)
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes (templates not part of build, but build confirms no regressions)

#### Phase 1 OTel
- [x] Templates ARE the instrumentation — they define how other projects get instrumented. No runtime code paths added to indusk-mcp itself.

#### Phase 1 Context
- [x] Add to CLAUDE.md Architecture: list OTel template files scaffolded by `init` (added to indusk-mcp description)

#### Phase 1 Document
- [x] Add inline code comments to each template explaining the structure — each has a header doc block with usage, configuration env vars, and examples

### Phase 2: Init Integration

#### Phase 2 Implementation
- [x] Add runtime detection to `init.ts`
  - Check for `next.config.js`/`next.config.ts`/`next.config.mjs` → Next.js
  - Check for `requirements.txt`/`pyproject.toml` → Python
  - Check for `vite.config.ts`/`vite.config.js` (no next.config) → React SPA
  - Default → Node.js/TypeScript
- [x] Add OTel scaffolding to `init` flow
  - Node.js: copies instrumentation.ts, filtering-exporter.ts, logger.ts to src/
  - Next.js: copies instrumentation.next.ts to root + instrumentation.web.ts + logger.ts to src/
  - React SPA: copies instrumentation.web.ts to src/
  - Python: copies instrumentation.py to root
  - Sets OTEL_SERVICE_NAME to project name, prints install and wiring instructions
- [x] Make scaffolding idempotent — skips each file if it already exists (unless `--force`)
- [x] Add `[OpenTelemetry]` section to init output showing what was created

#### Phase 2 Verification
- [x] (none needed — asked: "These 4 verification items require publishing to npm and testing in an external project. Can I defer them to Phase 4 end-to-end validation?" — user: "yes")
- [x] (none needed — asked: "see above" — user: "yes")
- [x] (none needed — asked: "see above" — user: "yes")
- [x] (none needed — asked: "see above" — user: "yes")
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` succeeds
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes (29 tests, 5 files)
- [x] `pnpm check` — build passes, biome has pre-existing nested root config issue (not caused by our changes)

#### Phase 2 OTel
- [x] init.ts is a CLI build tool, not a runtime service — no code paths to instrument.

#### Phase 2 Context
- [x] Update CLAUDE.md Conventions: `init` now scaffolds OTel instrumentation
- [x] Update CLAUDE.md Known Gotchas: OTel auto-instrumentation must be loaded before any other imports

#### Phase 2 Document
- [x] Update `guide/getting-started.md`: added OTel files to "what init creates" list

### Phase 3: OTel Extension

#### Phase 3 Implementation
- [x] Create `extensions/otel/manifest.json` — health checks for instrumentation file and packages, auto-detect via `**/instrumentation.{ts,py}`
- [x] Create `extensions/otel/skill.md` — full instrumentation patterns skill with span naming, kind, status, categories, Pino usage, error propagation, sensitive data, validation checklist, env vars, framework notes
- [x] Add OTel extension to auto-detect in init — manifest has `detect.file_pattern`, `autoEnableExtensions` in init picks it up automatically

#### Phase 3 Verification
- [x] Extension manifest parses correctly: name=otel, 2 health checks, detect=instrumentation.ts, skill file exists
- [x] (none needed — asked: "Phase 3 verification: extensions_status and health check display are working but need MCP restart to confirm visually. We validated OTel end-to-end with otel-test app (traces in Dash0). Can I skip these?" — user: "Yeah, we can skip that.")
- [x] (none needed — asked: "see above" — user: "yes")
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes (29 tests)
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes

#### Phase 3 OTel
- [x] Extension manifest and skill files are configuration/documentation — no runtime code paths to instrument.

#### Phase 3 Context
- [x] Update CLAUDE.md Key Decisions: added OTel as core instrumentation with category-based filtering reference

#### Phase 3 Document
- [x] Create `reference/tools/otel.md` — four-runtime reference, span naming, category taxonomy, filtering config, trace flow Mermaid diagram, how to add manual traces, env vars, health checks
- [x] Add to sidebar in `.vitepress/config.ts` — under Tools
- [x] Add to changelog: OpenTelemetry extension entry in Unreleased

### Phase 4: OTel Gate + End-to-End Validation

#### Phase 4 Implementation
- [x] End-to-end test (otel-test app): traces flow from Node.js → OTLP → Dash0 → queryable via MCP
  - Manual spans with `otel.category: "business"` appear in Dash0
  - Error spans with `recordException` appear with ERROR status
  - Pino structured logs on stdout with JSON format
  - Console exporter works when no OTLP endpoint configured
- [x] Add OTel as a fifth gate in the plan skill
  - Added `#### Phase N OTel` section to impl template in plan.md
  - Gate asks about spans, categories, domain attributes, error recording
  - Can be opted out per gate policy for phases with no new endpoints/business logic
- [x] Update the work skill to enforce the OTel gate
  - Updated gate order to five: implementation → verification → otel → context → document
  - Updated teach mode gate transition text
- [x] Update `validate-impl-structure.js` hook to require OTel section per phase
  - Added `otel` to requirements for feature/refactor workflows
  - Added `hasOtel`/`otelIsOptOut` tracking to phase parser
  - Added OTel section header detection (`#### Phase N OTel`)
- [x] Update `check-gates.js` hook to block phase transitions with incomplete OTel items
  - Added `otel` to `WORKFLOW_GATES` for feature/refactor
  - Updated gate header regex to include `OTel`
- [x] Update the plan skill impl template to include OTel gate section
  - Added `#### Phase 1 OTel` with example items and trigger question

#### Phase 4 Verification
- [x] Traces visible in Dash0 when OTLP endpoint configured (verified with otel-test app)
- [x] `validate-impl-structure.js` correctly detects missing OTel sections (tested — blocks edit when OTel section missing)
- [x] Hook took effect immediately — blocked edits to this impl until OTel sections were added
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes (29 tests)
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes

#### Phase 4 OTel
- [x] Hook scripts are build-time gate enforcement — no runtime code paths to instrument.

#### Phase 4 Context
- [x] Update CLAUDE.md Conventions: every impl phase has five gates — implementation, verification, otel, context, document
- [x] Update CLAUDE.md Current State: OTel extension active, OTel gate enforced on all plans

#### Phase 4 Document
- [x] Update the OTel reference docs page with the gate section — five-gate order, example items
- [x] Add decision page to docs: `decisions/otel-extension.md` — added to sidebar

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/templates/instrumentation.ts` | New: OTel auto-instrumentation template (Node.js) |
| `apps/indusk-mcp/templates/instrumentation.next.ts` | New: Next.js server instrumentation (@vercel/otel) |
| `apps/indusk-mcp/templates/instrumentation.web.ts` | New: Browser instrumentation (OTel Web SDK) |
| `apps/indusk-mcp/templates/filtering-exporter.ts` | New: category-based span filter |
| `apps/indusk-mcp/templates/logger.ts` | New: Pino dual-transport logger |
| `apps/indusk-mcp/templates/instrumentation.py` | New: Python OTel template |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Modified: add OTel scaffolding + runtime detection (4 runtimes) |
| `apps/indusk-mcp/extensions/otel/manifest.json` | New: extension manifest |
| `apps/indusk-mcp/extensions/otel/skill.md` | New: comprehensive instrumentation patterns skill |
| `apps/indusk-mcp/skills/plan.md` | Modified: added OTel gate to impl template |
| `apps/indusk-mcp/skills/work.md` | Modified: five-gate order |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | Modified: OTel section required |
| `apps/indusk-mcp/hooks/check-gates.js` | Modified: OTel in WORKFLOW_GATES |
| `apps/indusk-docs/src/reference/tools/otel.md` | New: full reference page |
| `apps/indusk-docs/src/.vitepress/config.ts` | Modified: add sidebar entry |

## Dependencies
- Extension system (completed)
- Dash0 extension (completed — needed for Phase 4 validation)

## Notes
- Templates are starting points — projects customize their `instrumentation.ts` as they add manual spans. The skill teaches them how.
- Python template is simpler — `opentelemetry-instrument` CLI wraps the app. Less scaffolding needed.
- FilteringExporter uses env vars (`OTEL_ENABLED_CATEGORIES`), not `globalThis` state like numero. Cleaner, works across processes.
- Dash0 agent-skills repo (dash0hq/agent-skills) was studied for best practices — span naming, kind, status, sensitive data, validation patterns incorporated into our skill.
