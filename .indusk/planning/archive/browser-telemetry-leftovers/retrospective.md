---
title: "Browser telemetry leftovers — retrospective"
date: 2026-10-11
---

# Retrospective — browser-telemetry-leftovers

## What We Set Out to Do

Two promises from the brief: a click and its server work share a trace in a project `indusk init` scaffolded (the browser template carries the trace to the project's own services on any origin or pattern it names), and `indusk init` writes and says nothing vendor-specific.

## What Actually Happened

- **Template**: `VITE_OTEL_PROPAGATE_TO` / `NEXT_PUBLIC_OTEL_PROPAGATE_TO` feed `propagateTraceHeaderCorsUrls`. Entries are origins with a scheme; `*` is one or more characters other than `/` and `.`. The template also loads again: it threw `addSpanProcessor is not a function` at import against the `sdk-trace-web` 2.x its own install line fetches, and read a bare `process` in a Vite page. Test Phase 1 found both only because a browser test project finally loaded it.
- **`init`**: the React SPA line no longer says `@dash0/sdk-web`; both browser branches print the setting and the `traceparent` CORS requirement; the Next.js logger line names OpenTelemetry.
- **Audit**: `dash0` and, after falsification, `grafana` left `TELEMETRY_KEYWORDS`.
- **Live check (A4)**: Vite app + Node API on separate ports, one trace in local Jaeger: `click` → `web GET` → `a4-api GET`.
- **Falsification (Build Phase 2)**: exact entries are normalized as the browser spells URLs (A9); a bare `*` no longer matches every URL and a scheme-less entry warns (A10); `grafana` out (A12). A11 — a request after a native `await` — cannot pass: zone.js does not patch native `async`/`await`. The user chose to leave the gap honest: the row is `it.skip`, carried in Deferred Verification, and the limit is documented in the otel skill and `reference/tools/otel.md`.
- **Cleanup**: skipped with reasons; **audit**: written by a cold reader.
- Diff: 12 code/doc files, +469 / −20 before Build Phase 3 (plus plan documents, lockfile and the phase-boundary ledger).

## Getting to Done

- A browser test project (`vitest.templates.config.ts`) had to be built first; a `@vitest/browser` 4.1.4 package against vitest 4.1.11 loaded two vitest versions into the page and hung every run.
- The test's own provider pre-registered a context manager, which would have hidden whether the template installs one; the cases now start from an empty OTel API.
- The confirm step refused the first time: no code carried a promise's token, and A11's `For` cell had prose after the promise name.

## What We Learned

- zone.js is the only browser context manager and cannot follow native `async`/`await`; `.then()` chains work. Handlers compiled to ES2017+ lose the click's context at the first `await`.
- A template nobody loads rots silently. The sdk-trace-web 2.x break shipped for months.

## What We'd Do Differently

- The brief promised "every request"; the rows proved a synchronous `fetch` in the handler. The async gap and the missing XHR instrumentation were found by falsification and the cold audit, not by the brief. Write the promise from what its rows can prove, or add the widest case as a row before accepting.

## Audit findings — what was done (Build Phase 3, 2026-10-11)

The cold audit's findings were acted on before acceptance rather than left as advisory text.

- **XHR (done):** `XMLHttpRequestInstrumentation` registered with the same propagation list; row A13; install lines and docs updated. Live check: trace `c8ec8e35dd477999567ab3fa05ae539e`, `click` → `web GET` → `a4-api GET`.
- **Promise sentences (done):** both changed through `indusk promises change`, History keeps the old sentences. Promise 1 now says `fetch` or XMLHttpRequest, in the click's call, and excludes a request after a native `await`; promise 2 says application source, destination vendors, and every scaffold (browser, Node, Python). The brief says the same and lists the two exclusions under Not promised.
- **Node and Python scaffolds (done):** their printed lines name the OpenTelemetry SDK; row A14 covers both.
- **`@vercel/otel` (not done, on purpose):** it was not added to the vendor list. It is an OpenTelemetry distribution that exports OTLP anywhere, not a destination; listing it would fail the Next.js scaffold, which this plan did not own. The promise sentence says so.
- **Records (done):** cleanup reason says 15 files; A4's trace id (`7e25854ea8d7ca2cc00073924854e79d`) is recorded in the impl and here.
- **Backlog (done):** `known-issues.md` carries the old-template-on-existing-projects entry and the AsyncContext entry that owns A11.
- **Still open, by design:** no row asserts "promise marks" end to end (the A4 API had none); the Next.js build-time inlining of the guarded `process.env` read is asserted only by comment; the skills installed into `.claude` still name Dash0 (outside application source). Build Phase 3 was not itself falsified or audited by a second reader.

## Shape numbers

Shape raised 1 finding across all phases (Test Phase 1: an unused fetch passthrough on the test recorder); 0 judged wrong by a human. Build Phases 1, 2 and 3: reviewed, nothing found.

## Release

Nothing published. This project installs its own build at landing (`pnpm install:local`); a publish is deliberate and not decided here.
Landed on main at 86ed8bd0, 2026-10-11.
