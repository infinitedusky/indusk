---
title: "Browser telemetry leftovers — a click and its server work share a trace"
date: 2026-10-10
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
cleanup: skipped
cleanup_reason: "reviewed all 15 changed files — 12 code and docs, plus the lockfile, the phase-boundary ledger and the impl (listOversizedChangedFiles flagged three: changelog.md 1055 lines and otel.md 448 lines are append-only/reference prose this plan added 4 and 19 lines to; init.ts 1331 lines is a long-standing command function the plan touched with one 10-line helper and four print calls). Templates, tests and audit.ts are under the cap and cohesive: the four env reads in instrumentation.web.ts repeat only because Next inlines literal process.env.NEXT_PUBLIC_* references, so a helper would break the build-time substitution; the A8/A12 audit tests are two cases in one file, below the rule of three; the one new helper (printPropagationInstructions) already serves both browser branches. Nothing warrants extraction."
accepted: 2026-10-11T00:35:33.591Z
accepted_by: person
---

# Browser telemetry leftovers — a click and its server work share a trace

## Goal

The scaffolded browser instrumentation carries a click's trace to the project's own services on any origin or origin pattern the project names, and `indusk init` writes and says nothing vendor-specific (brief promises 1 and 2; research findings 2, 4 and 5).

## Scope

### In Scope
- `templates/instrumentation.web.ts`: `propagateTraceHeaderCorsUrls` from a project setting, `VITE_OTEL_PROPAGATE_TO` / `NEXT_PUBLIC_OTEL_PROPAGATE_TO`: comma-separated origins, an entry with `*` a pattern; empty means same-origin only.
- `init`'s printed lines and comment for the React SPA and Next.js branches; its instructions for a cross-origin API.
- `"dash0"` out of the trajectory audit's telemetry keywords.
- A browser test project in `apps/indusk-mcp` for the templates.

### Out of Scope
- Destinations other than InDusk (`telemetry-destinations`, backlog).
- Browser instrumentation in the seat-holds demo.
- Editing anyone's server CORS settings: `init` says what to set.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | a browser vitest project for `templates/`; A1–A3, A5–A8 authored | today's template, `init`, the audit |
| Build Phase 1 | the propagation setting in the template; `init`'s true output and instructions; the audit keyword gone; A4 recorded | Test Phase 1's tests |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A click on a page running the shipped browser template that makes a request to the page's own origin sends that request with a `traceparent` header in the click's trace | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-click-and-its-server-work-share-a-trace | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| A2 | With `VITE_OTEL_PROPAGATE_TO=http://localhost:3000`, a request from the click to `http://localhost:3000` carries the click's trace, and a request to `https://api.thirdparty.example` carries no `traceparent` | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-click-and-its-server-work-share-a-trace | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| A3 | With `VITE_OTEL_PROPAGATE_TO=https://*.dev.example.com`, requests to `https://plan-a.dev.example.com` and `https://plan-b.dev.example.com` carry the trace, and `https://dev.example.com.evil.test` does not | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-click-and-its-server-work-share-a-trace | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| A4 | A project scaffolded by `indusk init`, its frontend on one port calling its API on another with the API's origin named, shows in local Jaeger one trace that starts at the click and holds the server's spans | Build Phase 1 | Build Phase 1 | passing | live check | the whole story once, against a real scaffolded project and the local Jaeger | manual: recorded in Build Phase 1 |
| A5 | `indusk init` on a React SPA, a Next.js app and a Node service writes no file naming or importing an observability vendor, and every line it prints about a file it created names that file and the OpenTelemetry SDK in it | Test Phase 1 | Build Phase 1 | passing | unit | promise: init-writes-no-vendor-into-an-app | apps/indusk-mcp/src/__tests__/init-browser-telemetry.test.ts |
| A6 | No instrumentation template under `apps/indusk-mcp/templates/` names or imports an observability vendor (`dash0`, `datadog`, `newrelic`, `honeycomb`, `sentry`, `posthog`) | Test Phase 1 | Test Phase 1 | passing | unit | promise: init-writes-no-vendor-into-an-app | apps/indusk-mcp/src/__tests__/init-browser-telemetry.test.ts |
| A7 | For a React SPA and a Next.js app, `indusk init` prints the setting that names an API on another origin (`VITE_OTEL_PROPAGATE_TO` / `NEXT_PUBLIC_OTEL_PROPAGATE_TO`) and that the API must allow the `traceparent` header in its CORS settings | Test Phase 1 | Build Phase 1 | passing | unit | the decision to prefer capability over configuration (research, Decisions): the two places to configure are said, not left to be discovered | apps/indusk-mcp/src/__tests__/init-browser-telemetry.test.ts |
| A8 | A Deferred Verification row whose mitigation names only a vendor ("dash0") is not classified as a telemetry alert by the trajectory audit | Test Phase 1 | Build Phase 1 | passing | unit | the second half of the backlog entry this plan owns: a vendor's name is not instrumentation | apps/indusk-mcp/src/lib/trajectory/audit.test.ts |
| A9 | With `VITE_OTEL_PROPAGATE_TO=https://API.Example.com` (mixed case) and, separately, `=https://api.example.com:443` (default port spelled out), a request to `https://api.example.com/seats` — which the browser reports as `https://api.example.com/seats` — carries the click's trace | Build Phase 2 | Build Phase 2 | passing | unit | falsification of Build Phase 1: exact entries are compared as the user typed them, while the request URL arrives normalized (lower-case host, default port dropped) | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| A10 | With `VITE_OTEL_PROPAGATE_TO=*`, a request to `https://api.thirdparty.example` carries no `traceparent`; with `=localhost:3000` (no scheme) the entry is reported by one `console.warn` naming it, since it can never match | Build Phase 2 | Build Phase 2 | passing | unit | falsification of Build Phase 1: the documented `*` (one or more characters other than `/` and `.`) is compiled so that a bare `*` matches `http:` followed by `/`, i.e. every URL; a scheme-less entry never matches and says nothing | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| A11 | A click handler that awaits before it fetches (`await Promise.resolve(); fetch(url)`) sends that request in the click's trace, for the same origin and for a named origin | Build Phase 2 | Build Phase 2 | skipped | unit | the case A1–A3 leave out: a handler that awaits before it fetches; skipped by decision and carried in Deferred Verification | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| A12 | A Deferred Verification row whose mitigation names only "grafana" ("dashboards in grafana, reviewed by the on-call") is not classified as a telemetry alert | Build Phase 2 | Build Phase 2 | passing | unit | falsification of Build Phase 1: A8 removed `dash0` because a vendor's name is not instrumentation; `grafana` is the same kind of word and is still in the list | apps/indusk-mcp/src/lib/trajectory/audit.test.ts |
| A13 | A click whose handler makes a request through `XMLHttpRequest` (as axios does) to the page's own origin and to a named origin sends it with a `traceparent` in the click's trace, and a request to a third-party origin carries none | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-click-and-its-server-work-share-a-trace | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| A14 | `indusk init` on a Node service and on a Python project prints, for every file it created, a line naming that file and the OpenTelemetry SDK in it, and writes no file naming a vendor | Build Phase 3 | Build Phase 3 | passing | unit | promise: init-writes-no-vendor-into-an-app | apps/indusk-mcp/src/__tests__/init-browser-telemetry.test.ts |

## Checklist

### Test Phase 1: Author every assertion against today's template, init and audit, RED

**Tier**: med — the work step's default

**Goal**: author A1–A3 and A5–A8 against today's code; nothing needs a symbol that does not exist.

- [x] Create/confirm this plan's worktree (`indusk worktree create browser-telemetry-leftovers`; made by `indusk plans start` on 2026-10-10 at `dusk-worktrees/browser-telemetry-leftovers`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] A browser test project for the templates: `apps/indusk-mcp/vitest.templates.config.ts`, headless Chromium through `@vitest/browser-playwright` as `apps/indusk-admin` uses it, including only `templates/**/*.test.ts`; excluded from the node suite; run by the package's `test` script after the node suite. Dev dependencies: the OpenTelemetry web packages the template imports, and the browser runner
  - Done: devDependencies `@opentelemetry/sdk-trace-web` ^2.12.0, `instrumentation` ^0.214.0, `instrumentation-fetch` ^0.214.0, `instrumentation-document-load` ^0.60.0, `instrumentation-user-interaction` ^0.60.0 (the already-present `api`/`sdk-trace-base`/`exporter-trace-otlp-http`/`resources`/`semantic-conventions` cover the rest), `@vitest/browser` + `@vitest/browser-playwright` ^4.1.11 (matching the root's vitest 4.1.11; a 4.1.4 browser package with 4.1.11 vitest loaded two vitest versions into the page and hung every run), `playwright` ^1.59.1. The node suite excludes `templates/**`; `tsc` already includes only `src/`, so no tsconfig change was needed. `optimizeDeps.include` lists the template's imports so Vite does not reload the page mid-run.
- [x] A1, A2, A3 in `templates/instrumentation.web.test.ts`: before importing the template, replace `window.fetch` with a recorder; stub the env (`vi.stubEnv`) per case and import the template fresh (`vi.resetModules`); a button whose click handler fetches the case's URLs; assert on the recorded request headers, and that a request's `traceparent` trace id is the click span's (read through an in-memory exporter the test registers). RED for A2 and A3 today (no setting, no header cross-origin); A1 passes (Regression Guards)
- [x] A5, A6, A7 in `src/__tests__/init-browser-telemetry.test.ts`: `init` through `helpers/cli.ts` on three temp projects (a Vite React app's `package.json`, a Next.js app's, a Node service's); read every file it wrote and its stdout. RED for A5 (prints `@dash0/sdk-web`) and A7 (no instructions) today; A6 passes (Regression Guards)
- [x] A8 in `src/lib/trajectory/audit.test.ts`: a row whose mitigation reads "dashboards in dash0, reviewed by the on-call" is not `telemetry-alert`. RED today
- [x] Confirm each red test fails on its own assertion rather than on a missing import
  - Confirmed 2026-10-10: A2 `named origin carries traceparent: expected null not to be null`; A3 `plan-a.dev.example.com carries traceparent: expected null not to be null`; A5 `react-spa: init prints a vendor name: expected ['dash0'] to deeply equal []`; A7 `react-spa: names the setting: expected '  create: src/instrumentation.ts (Rea…' to contain 'VITE_OTEL_PROPAGATE_TO'`; A8 `expected 'telemetry-alert' not to be 'telemetry-alert'`. A1 and A6 pass.
  - **Finding for Build Phase 1, not in its items:** the shipped `templates/instrumentation.web.ts` throws `provider.addSpanProcessor is not a function` at import against `@opentelemetry/sdk-trace-web` 2.x (what its own install line fetches; the repo uses 2.x throughout), and `process.env.NEXT_PUBLIC_*` throws `process is not defined` in a Vite page when the `VITE_` value is unset. A1 therefore does not "pass today" against the template as shipped: `templates/instrumentation.web.test.ts` carries a marked TEMPORARY SHIM (a no-op `addSpanProcessor` on the provider's prototype) and a `process` stub so the template loads and A1-A3 assert on propagation. Build Phase 1 must fix the template (constructor `spanProcessors`; no bare `process`) and delete the shim.

#### Deferred to Build Phase 1

- **A4** — a live check against a real scaffolded project with a separate API and the local Jaeger; run once the template carries the setting, and recorded there.

#### Regression Guards

- **A1** — same-origin propagation is OpenTelemetry's default and works today; the row pins that the setting added in Build Phase 1 does not break it.
- **A6** — the templates have been vendor-free since v1.6.0 (research finding 1); the row pins that they stay so.

#### Test Phase 1 Verification

- [x] A1–A3 and A5–A8 authored; A2, A3, A5, A7, A8 fail on their own assertions; A1 and A6 pass (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.templates.config.ts && pnpm exec vitest run src/__tests__/init-browser-telemetry.test.ts src/lib/trajectory/audit.test.ts`)
  - Ran 2026-10-10: templates project 3 tests, 1 passed (A1), 2 failed (A2, A3); node files 16 tests, 13 passed (incl. A6), 3 failed (A5, A7, A8) — failure messages under the confirm item above. `pnpm exec tsc --noEmit` clean; `biome check` clean on the 6 changed files.
- [x] The deferred entry above reviewed: A4 needs only what Build Phase 1 produces
  - Reviewed 2026-10-10: A4 is a live check (scaffolded Vite app + separate Node API + local Jaeger), needs the propagation setting and the template load fix from Build Phase 1, and nothing from this phase; it stays deferred. Note A4 also depends on the template fix named above.
- [x] Shape (`apps/indusk-mcp/templates/instrumentation.web.test.ts`) — removed an unused runner-request passthrough on the fetch recorder (an earlier hang theory that the real cause, mismatched vitest versions, disproved); rule: a unit does one job, and the recorder's job is recording (one reason to change). Other changed files (`init-browser-telemetry.test.ts`, `audit.test.ts`, the two vitest configs) reviewed, left as-is: each has one named job and a seam the tests already reach.

### Build Phase 1: The setting, the truth, the keyword

**Tier**: med — the work step's default

**Goal**: the template propagates to named origins and patterns, `init` says what it wrote and what to configure, and the audit stops counting a vendor's name.

- [x] `templates/instrumentation.web.ts`: read `VITE_OTEL_PROPAGATE_TO` / `NEXT_PUBLIC_OTEL_PROPAGATE_TO`; each comma-separated entry an exact origin, or — when it contains `*` — a RegExp anchored at both ends where `*` matches one or more characters other than `/` and `.`-escaped literals elsewhere; pass the list as `propagateTraceHeaderCorsUrls` to `FetchInstrumentation` (and `XMLHttpRequestInstrumentation` if the template gains it); document the setting and the CORS requirement in the file's header comment
- [x] `templates/instrumentation.web.ts` loads against what its own install line fetches: span processors passed to `new WebTracerProvider({ spanProcessors })` (`addSpanProcessor` is gone in `@opentelemetry/sdk-trace-web` 2.x), and no bare `process` read in a Vite page (guard `typeof process`); then delete the temporary shim and `process` stub from `templates/instrumentation.web.test.ts`, so A1 passes against the template as shipped (found by Test Phase 1)
- [x] `src/bin/commands/init.ts`: the React SPA branch's comment and printed line name the OpenTelemetry Web SDK; both browser branches print the propagation setting and the `traceparent` CORS requirement
- [x] `src/lib/trajectory/audit.ts`: `"dash0"` out of `TELEMETRY_KEYWORDS`
- [x] A4, the live check: `indusk init` a Vite React app and a small Node API on separate ports in a temp folder, with this worktree's build; name the API's origin; click; record here the trace id, its root span and the server spans it holds in local Jaeger
  - Recorded 2026-10-10: `indusk init` (this worktree's `dist/`) on a Vite app (`:5199`, `VITE_OTEL_PROPAGATE_TO=http://localhost:3101`) and a plain Node API (`:3101`, auto-instrumented, CORS allowing `traceparent`), headless Chromium click, local Jaeger. Trace `7e25854ea8d7ca2cc00073924854e79d`: `web` `click` (root) → `web` `GET` → `a4-api` `GET`, one trace across both services. A first run with the API un-instrumented (ESM import of `node:http`, no loader) showed `click` + `GET` only — the API side, not propagation.
  - Note: the browser's preflight `OPTIONS` appears as its own `a4-api` trace (`82760908…`), as it carries no `traceparent` by design.
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Reviewed 2026-10-10 (`instrumentation.web.ts`, `init.ts`, `audit.ts`, the template test): nothing found. The pattern parser is its own named function with one job and a seam the tests reach through the template; the init lines share one helper rather than two copies; the test lost its shim and stub.

#### Build Phase 1 Verification

- [x] A2, A3, A5, A7, A8 pass, A1 and A6 still pass, A4 recorded (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.templates.config.ts && pnpm exec vitest run src/__tests__/init-browser-telemetry.test.ts src/lib/trajectory/audit.test.ts && pnpm exec vitest related src/bin/commands/init.ts src/lib/trajectory/audit.ts --run`); tsc and biome clean on changed files
  - Ran 2026-10-10: templates project 3/3; init-browser-telemetry + audit 16/16; `vitest related` 10 files, 105/105; `tsc --noEmit` clean; biome clean on templates and audit.ts. `init.ts` has one pre-existing biome error (`noIndex` unused, line 467, present at HEAD before this phase) left alone — not this plan's.

#### Build Phase 1 Context

- [x] `apps/indusk-mcp/extensions/otel/skill.md` (the area's own rules for instrumentation): the browser sends `traceparent` only to its own origin and to the origins or patterns named in `*_OTEL_PROPAGATE_TO`, and the named API must allow `traceparent` in its CORS settings

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/tools/otel.md`: the propagation setting, its patterns, and the CORS requirement; changelog: Fixed — "`indusk init` no longer claims to write a vendor SDK, and a browser click's trace reaches the project's API on another origin when the origin is named"

### Build Phase 2: Falsification — what the setting does with the entries and the handlers real apps write

**Tier**: med — the work step's default

**Goal**: verify whether the attested state holds against four failure modes found by reading Build Phase 1's code: an exact origin spelled the way a person writes it but not the way the browser reports it; an entry that matches more than it says (bare `*`) or never matches and stays silent (no scheme); a click handler that awaits before it fetches; and a second vendor word left in the audit's keyword list. Each trajectory row (A9–A12) captures one hypothesis; each item is the fix the code needs if it confirms. Rows are authored RED at the start of this phase, in the files that already hold A1–A3 and A8.

- [x] `templates/instrumentation.web.ts`: an entry with no `*` is normalized through `new URL(entry).origin` (lower-case host, default port dropped) before it is compiled; an entry with `*` compiles case-insensitively; (A9)
- [x] `templates/instrumentation.web.ts`: an entry must begin `<scheme>://` or `*://`; one that does not is dropped with a single `console.warn` naming the entry and the setting, so a bare `*` propagates nowhere and a scheme-less origin says why it does nothing (A10); the header comment says entries are origins with a scheme
- [x] (none needed — option (b) chosen, no zone context manager is added; asked: "A11 cannot pass: zone.js does not follow native await, so ZoneContextManager would not make a click handler that awaits stay in the click's trace. Which way out: (a) keep it and narrow A11 to .then chains, (b) leave the gap honest and defer A11, or (c) tell users to down-level await?" — user: "b") was: `provider.register({ contextManager: new ZoneContextManager() })` (`@opentelemetry/context-zone`, which needs `zone.js`), so a fetch after an `await` in a click handler stays in the click's trace (A11); if zone.js cannot follow the handler in the test, record that under this item and stop with a `blocker:` line rather than weakening the row
  - **Blocked 2026-10-10 (A11):** zone.js cannot follow this handler. Registered `ZoneContextManager` from `@opentelemetry/context-zone` with `zone.js` loaded first, and ran A11 against the template: the request after `await Promise.resolve()` carried a `traceparent` in a *different* trace from the click's. The same handler written as `Promise.resolve().then(go)` passed (6 of 6), so the manager works and the limit is native `async`/`await`, which zone.js does not patch (it needs the code down-levelled below ES2017, and Vite's default target is not). The template as left has no zone code; A11 stays as authored, red, in `state: blocked`.
  - What each way out costs: (a) keep `ZoneContextManager` and restate A11 as "after a promise `.then()` chain / timer", which covers promise-chain and callback code but not `async` functions — a narrower promise than the row says; (b) leave A11 as the honest gap: record in the brief that a click's trace does not follow native `await` until AsyncContext lands, and move A11 to a Deferred Verification row; (c) down-level `await` in the user's build (a build-config instruction in `init`, not a template change). Not chosen here: the row is not mine to weaken.
  - Decision 2026-10-10: option (b), by the user. A11 is deferred below; the template, `init` and dependencies carry no zone code.
- [x] (none needed — option (b) chosen, nothing new to install; asked: "A11 cannot pass: zone.js does not follow native await, so ZoneContextManager would not make a click handler that awaits stay in the click's trace. Which way out: (a) keep it and narrow A11 to .then chains, (b) leave the gap honest and defer A11, or (c) tell users to down-level await?" — user: "b") was: `src/bin/commands/init.ts` and the header comment's Install line: add `@opentelemetry/context-zone zone.js` to both browser install commands; `apps/indusk-mcp` devDependencies gain the same two so the template's test project resolves them
- [x] `src/lib/trajectory/audit.ts`: `"grafana"` out of `TELEMETRY_KEYWORDS` (A12)
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Reviewed 2026-10-10 (`instrumentation.web.ts`, its test, `audit.ts`, the templates config): nothing found. `parsePropagateTo` kept one job (entries → patterns) with `normalizeOrigin` split out as a named seam; the test's `clickAndFetch` lost its exporter and now reads the click's trace id from the active span, one reason to change.

#### Deferred Verification

- **A11 — a click's trace follows a native `await` in the handler**
  - reason: zone.js, the only context manager that follows browser async code today, does not patch native `async`/`await`; a handler compiled to ES2017+ loses the click's context at the first `await`. Observed in a live run, trace `8b81734602d8b978506ec248620706c5`.
  - would require: the TC39 AsyncContext proposal in the browsers the project targets, or the user down-levelling `await` in their build
  - mitigation: the limit is documented in the otel skill and `reference/tools/otel.md`; the A11 test stays in `instrumentation.web.test.ts` as `it.skip` with this reason, to be unskipped when a browser context carrier exists (AsyncContext); no other plan owns it today

#### Build Phase 2 Verification

- [x] A9, A10, A12 authored first and failing on their own assertions, then passing; A11 authored, red on its own assertion (expected trace id differs), then `it.skip` with its reason and deferred below by the user's choice; A1–A8 still pass (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.templates.config.ts && pnpm exec vitest run src/__tests__/init-browser-telemetry.test.ts src/lib/trajectory/audit.test.ts`); tsc and biome clean on changed files
  - Ran 2026-10-10: templates project 5 passed, 1 skipped (A11, deferred); audit 14/14; init-browser-telemetry unchanged.
- [x] The live check again with the click handler `async () => { await fetch("/warm"); fetch("http://localhost:3101/api/seats") }`: one trace holds `click`, both `GET`s and the API's span; record the trace id here
  - Recorded 2026-10-10 (this worktree's template, same Vite + Node API setup as A4): the handler's first request (`/warm`) is in the click's trace `b7f992451a543fefd6e9f761175a14a1` (`click` → `GET`); the request after the `await` is in its own trace `8b81734602d8b978506ec248620706c5` (`web GET` → `a4-api GET`) with no click root. The server's work is linked to the page's request, not to the click — the gap A11 states, observed.

#### Build Phase 2 Context

- [x] `apps/indusk-mcp/extensions/otel/skill.md`: entries are origins with a scheme; a request made after a native `await` in a click handler is in its own trace, not the click's (no AsyncContext yet; zone.js cannot follow native `async`/`await`)

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/tools/otel.md`: entries need a scheme and are compared as the browser spells them (case, default port); the limit on handlers that `await` before a request; changelog line extended

### Build Phase 3: The audit's findings — XHR, the Node and Python scaffolds, the promises' wording

**Tier**: med — the work step's default

**Goal**: act on the cold audit's findings that belong to this plan: the template propagates XHR requests (the code did not do what promise 1's sentence says), the Node and Python scaffolds print the SDK they wrote (the second half of promise 2 held for two of four scaffolds), the two promise sentences say what is proven, and the plan's own records are accurate. Findings that are new features go to the backlog, not here. A13 and A14 are authored red first.

- [x] A13 and A14 authored red in the two existing test files, each failing on its own assertion (XHR carries no traceparent; the Node and Python `create:` lines name no SDK)
- [x] `templates/instrumentation.web.ts`: register `XMLHttpRequestInstrumentation` with the same `propagateTraceHeaderCorsUrls` as fetch; header comment and both browser install lines in `init.ts` gain `@opentelemetry/instrumentation-xml-http-request`; devDependency for the template test project (A13)
- [x] `src/bin/commands/init.ts`: the Node scaffold's three `create:` lines and the Python scaffold's line name the OpenTelemetry SDK each file uses (A14)
- [x] Promise 1's sentence, through `indusk promises change browser-telemetry-leftovers --plan browser-telemetry-leftovers`: every `fetch` or XMLHttpRequest the browser makes in the click's call to the project's own services (own origin, or a named origin or pattern) carries the click's trace; a request made after a native `await` is not promised. The archived brief's Promises section and its Not promised list say the same
- [x] Promise 2's sentence, the same way: nothing `indusk init` writes into an application's source names or imports an observability vendor (a destination to send telemetry to), and what it prints names the file and the SDK it wrote. The brief says the same and names `@vercel/otel`, an OpenTelemetry distribution, as not a vendor in this sense
- [x] `cleanup_reason` in the frontmatter says what the diff stat shows (15 files: 12 code and docs, plus the lockfile, the phase-boundary ledger and the impl); the retrospective carries A4's trace ids and the A11 owner
- [x] The backlog (`.indusk/planning/known-issues.md`): two entries — `update` and `init` leave an existing project on its old browser template; the AsyncContext follow-up for a click's trace across a native `await`
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Reviewed 2026-10-11 (`instrumentation.web.ts`, `init.ts`, the two test files): nothing found. The install list is now one constant used by both browser branches (it was two copies), the Node file purposes are a named map, and the test's XHR recorder sits beside the fetch recorder as one setup function.

#### Build Phase 3 Verification

- [x] A13 and A14 pass; A1–A12 still pass (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.templates.config.ts && pnpm exec vitest run src/__tests__/init-browser-telemetry.test.ts src/lib/trajectory/audit.test.ts && pnpm exec vitest related src/bin/commands/init.ts --run`); `indusk promises check` clean after the two sentences change; tsc and biome clean on changed files
- [x] The live check once more with an XMLHttpRequest from the Vite page to the Node API: one trace holds `click`, the XHR's `GET` and the API's span; record the trace id here
  - Recorded 2026-10-11: XHR from the Vite page to the Node API, `VITE_OTEL_PROPAGATE_TO=http://localhost:3101`, trace `c8ec8e35dd477999567ab3fa05ae539e`: `web` `click` → `web` `GET` → `a4-api` `GET`.

#### Build Phase 3 Context

- [x] `apps/indusk-mcp/extensions/otel/skill.md`: the browser template instruments `fetch` and `XMLHttpRequest`

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/tools/otel.md`: the install line, and "fetch and XMLHttpRequest" where the page says requests; changelog line extended

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/templates/instrumentation.web.ts` | the propagation setting |
| `apps/indusk-mcp/templates/instrumentation.web.test.ts` | new — A1–A3 |
| `apps/indusk-mcp/vitest.templates.config.ts`, `package.json` | the templates' browser test project, dev dependencies |
| `apps/indusk-mcp/src/bin/commands/init.ts` | true output, instructions |
| `apps/indusk-mcp/src/__tests__/init-browser-telemetry.test.ts` | new — A5–A7 |
| `apps/indusk-mcp/src/lib/trajectory/audit.ts`, `audit.test.ts` | the keyword, A8 |
| `apps/indusk-mcp/extensions/otel/skill.md`, `apps/docs/src/reference/tools/otel.md`, changelog | context and docs |

## Dependencies

- None.

## Notes

- If the browser runner proves too heavy for the everyday suite, the templates' project moves to the system tier (`vitest.tiers.ts`) and A1–A3 run at landing — named here so it is a decision, not a drift.
