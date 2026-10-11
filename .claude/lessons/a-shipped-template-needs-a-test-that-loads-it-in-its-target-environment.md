# A template shipped into user projects needs a test that actually loads it in the environment it targets — the browser template threw at import for months because only its text was ever read

`apps/indusk-mcp/templates/instrumentation.web.ts` threw `provider.addSpanProcessor is not a function` at import against `@opentelemetry/sdk-trace-web` 2.x (what its own install line fetches) and read a bare `process` in a Vite page. No test loaded it, and the plan's own research audit judged it "already vendor-neutral and working" by reading it. It was found only when Test Phase 1 built a headless-Chromium vitest project (`vitest.templates.config.ts`) and imported the template.

**Why:** templates are copied into projects and never compiled or run in this repo, so type-check, lint and unit tests of the CLI pass while the artifact is broken. Reading a template is not evidence it loads.

**How to apply:** any file under `templates/` that runs in a runtime other than the CLI's (browser, Next, a service) gets a test that imports it in that runtime, with the install line's dependency versions. Run it when changing the template or bumping the OTel SDK dependency. When a plan's research claims a shipped artifact works, load it before relying on the claim.

See `.indusk/planning/archive/browser-telemetry-leftovers/retrospective.md`.
