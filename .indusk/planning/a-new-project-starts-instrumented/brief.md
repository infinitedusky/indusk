---
title: "A new project is fully wired for telemetry"
date: 2026-10-16
status: accepted
workflow: feature
clauses: required
description: "A project InDusk scaffolds sends its spans, named and placed, to the local daemon from its first run, writes its promise signals from a small helper it owns in the one vocabulary every InDusk reader reads, and is told the truth about how."
---

# A new project is fully wired for telemetry — Brief

The second of seven children of
[telemetry-from-day-one](../telemetry-from-day-one/master.md), after
[daemon-found-not-guessed](../daemon-found-not-guessed/) and before Signal
first ([mark-first](../mark-first/)), which reads what this plan's helper
writes. Write before read (Sandy, 2026-10-16). The findings — the scaffold at
the workbench root, the service named in a comment, spans going nowhere a
reader reads, no way for an app to write a signal — are in
[research.md](research.md).

## Expectations

1. **Homework Gate reports on its first run.**
   - Measure: from `indusk update` in Homework Gate's code repo after `create-next-app`, the time until a `homework-gate` service appears in the local Jaeger, and the number of files edited by hand on the way; expect the first `next dev` and none.
   - Look: the day Homework Gate's code repo gets its app.

2. **Every signal an app writes is one a reader recognises.**
   - Measure: of spans in the local daemon carrying `indusk.promise` from scaffolded projects, the share the promise readers parse into a holding or broken report; expect all.
   - Look: 30 days after Homework Gate's first plan with server code lands.

## Promises

### This plan makes

1. **`a-new-project-reports-from-its-first-run`** (state). A project InDusk scaffolds sends its spans, named after the project and carrying where they ran, to the local daemon from its first run, with no file edited by hand.
   - **`the-scaffold-sits-where-the-app-runs`** (split). The instrumentation is written in the declared code repo for the runtime found there, never at a workbench root; a repo with no app yet is told so, and `indusk update` scaffolds it once one appears.
   - **`the-service-is-named`** (split). Every template sets the service name in code to the project's name.
   - **`the-spans-reach-the-daemon`** (split). With nothing set, a scaffolded app exports to the daemon's fixed ports; a set endpoint still wins.
   - **`every-span-says-where-it-ran`** (split). Every span carries the project and its environment, development unless set.
   - **`a-newer-template-is-offered-not-forced`** (limit). `indusk update` never overwrites a template file a project has changed; a newer version is written beside it.

2. **`an-app-writes-its-signal-from-a-helper-it-owns`** (state). A scaffolded project carries a small signal helper it owns, with no InDusk dependency, that writes a promise's or a clause's signal in the one vocabulary every InDusk reader reads.
   - **`one-vocabulary`** (limit). The keys a signal carries are defined once, in the package's vocabulary; the helper is pinned to it, and a key changed in one and not the other is refused.
   - **`a-signal-names-its-promise-and-clause`** (split). The helper writes a promise, an optional clause, upheld or broken, a symptom when broken, an optional measured value and bound, and, when given, the plan and phase that added it.
   - **`a-test-run-says-so`** (split). Every span a project's test run makes carries the test-run marker.

3. **`a-new-project-is-told-the-truth`** (state). What `indusk init` prints and the skills it installs name commands that exist, the daemon the promise loop reads, and the difference between a signal and a log line.
   - **`next-steps-exist`** (split). Every command and file `init` tells a person to use exists.
   - **`the-skills-name-the-daemon`** (split). The otel, testing and local-telemetry skills send a person to the local daemon, never to a vendor.
   - **`a-log-line-is-not-a-signal`** (limit). No skill or template presents a log line as a promise's signal; a signal is a span.

### Existing promises

**Must not break**

- **`init-writes-no-vendor-into-an-app`**. The helper and the templates name OpenTelemetry and the daemon's ports, never a vendor.
- **`a-click-and-its-server-work-share-a-trace`**. The browser template is moved and renamed, not rewired; a click still carries its trace to the server.
- **`a-new-project-has-the-standard-layout`**. Placement follows the layout the project declares; this plan reads it, never changes it.
- **`a-recommendation-can-be-declined`**. A declined telemetry recommendation is still recorded with its reason, and now also turns the telemetry extensions off.
- **`a-clone-without-an-mcp-config-gets-the-keep-list`**. A code repo in a workbench gets an `.mcp.json` the way a checkout does, so the evaluator can score its first commit.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Signals from the browser** — the later cut (Sandy, 2026-10-15); a browser-felt clause is reported from the server.
- **An attribute allowlist or redaction** — [production-keeps-only-what-it-should](../production-keeps-only-what-it-should/)'s, one home for the privacy rule.
- **The app's exporter in production** — [production-is-heard](../production-is-heard/)'s.
- **Reading a signal, standing per clause, closing on signals** — Signal first's ([mark-first](../mark-first/)). This plan writes; that one reads.
- **A tracer for InDusk's own commands, and the `new_project.create` span** — Signal first's, which needs it for its own clauses.
- **Policy signals for the three promises held only by the agent's prompt** — still in `known-issues.md`; they need a signal written inside the new-project agent, which neither this plan's templates nor Signal first's readers touch.
- **Templates for runtimes beyond Node, Next.js, a browser app and Python** — another language emits plain OTLP with the same keys, from the docs.

## Looks

None — this plan changes the files `init` writes, its printed text and the skills; no screen of the admin or the editor is laid out differently.

## Carried

- **The demo writes through the helper.** The seat-holds demo's hand-written telemetry becomes the helper, its dead second scaffold is removed, and its two tests that expect the old words are fixed, with the root cause written into the two open demo incidents.
- **`init` prints `indusk editor install` once.**

## Depends On

- `.indusk/planning/daemon-found-not-guessed/` — the daemon's fixed ports are where a scaffolded app sends. When that plan's promise `the-daemon-readers-follow-is-the-one-running` reaches the trunk at its approval, the first promise here gains a clause resting on it (`the-daemon-is-the-one-running`), re-declared then; the registry refuses a resting clause on a promise it does not hold.

## Blocks

- `.indusk/planning/mark-first/` — it reads the keys this plan defines.
- `.indusk/planning/production-is-heard/` — it hands the same app its production endpoint.
- Homework Gate's `indusk init`.
