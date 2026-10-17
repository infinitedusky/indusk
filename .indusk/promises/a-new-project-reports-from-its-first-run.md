---
name: a-new-project-reports-from-its-first-run
kind: state
lifetime: holds
state: enforced
domain: scaffold
owner: a-new-project-starts-instrumented
sites:
  - apps/indusk-mcp/src/lib/scaffold/apply.ts
  - apps/indusk-mcp/src/lib/scaffold/plan.ts
tests:
  - apps/indusk-mcp/src/__tests__/init-scaffold-placement.test.ts
  - apps/indusk-mcp/src/__tests__/init-scaffold-runtimes.test.ts
  - apps/indusk-mcp/src/__tests__/unknown-service-gone.test.ts
  - apps/indusk-mcp/src/__tests__/telemetry-settings.test.ts
  - apps/indusk-mcp/src/__tests__/app-port-4318-gone.test.ts
  - apps/indusk-mcp/src/__tests__/update-scaffold-refresh.test.ts
  - apps/indusk-mcp/src/lib/scaffold/plan.test.ts
  - apps/indusk-mcp/src/__tests__/demo-signal-helper.test.ts
  - examples/seat-holds/src/telemetry.test.ts
  - apps/indusk-mcp/src/__tests__/otel-health-packages.test.ts
incidents: []
clauses:
  - name: the-scaffold-sits-where-the-app-runs
    kind: split
    statement: "The instrumentation is written in the declared code repo for the runtime found there, never at a workbench root; a repo with no app yet is told so, and `indusk update` scaffolds it once one appears."
  - name: the-service-is-named
    kind: split
    statement: "Every template sets the service name in code to the project's name."
  - name: the-spans-reach-the-daemon
    kind: split
    statement: "With nothing set, a scaffolded app exports to the daemon's fixed ports; a set endpoint still wins."
  - name: every-span-says-where-it-ran
    kind: split
    statement: "Every span carries the project and its environment, development unless set."
  - name: a-newer-template-is-offered-not-forced
    kind: limit
    statement: "`indusk update` never overwrites a template file a project has changed; a newer version is written beside it."
  - name: the-daemon-is-the-one-running
    kind: rests-on
    rests_on: the-daemon-readers-follow-is-the-one-running
---

A project InDusk scaffolds sends its spans, named after the project and carrying where they ran, to the local daemon from its first run: a Next.js app's server with no file edited by hand, any other app once it adds the one line `init` prints for it.

## History
- 2026-10-17 — declared (a-new-project-starts-instrumented), from its planning conversation.
- 2026-10-17 — enforced, confirmed for a-new-project-starts-instrumented: proven by row T1, row T2, row T3, row T4, row T5, row T6, row T7, row T8, row T9, row T10, row T25, row T27, row T28, row T29, row T30, row T31.
- 2026-10-17 — links updated, confirmed for a-new-project-starts-instrumented: tests apps/indusk-mcp/src/__tests__/init-scaffold-placement.test.ts, apps/indusk-mcp/src/__tests__/init-scaffold-runtimes.test.ts, apps/indusk-mcp/src/__tests__/unknown-service-gone.test.ts, apps/indusk-mcp/src/__tests__/telemetry-settings.test.ts, apps/indusk-mcp/src/__tests__/app-port-4318-gone.test.ts, apps/indusk-mcp/src/__tests__/update-scaffold-refresh.test.ts, apps/indusk-mcp/src/lib/scaffold/plan.test.ts, apps/indusk-mcp/src/__tests__/demo-signal-helper.test.ts, examples/seat-holds/src/telemetry.test.ts, apps/indusk-mcp/src/__tests__/otel-health-packages.test.ts; sites apps/indusk-mcp/src/lib/scaffold/apply.ts, apps/indusk-mcp/src/lib/scaffold/plan.ts.
