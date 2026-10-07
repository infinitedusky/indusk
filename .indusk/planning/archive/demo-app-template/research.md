---
title: "Demo app template — Research"
date: 2026-10-07
status: complete
---

# Demo app template — Research

## Question

What small app shows InDusk's promise loop fastest: a promise held, broken
on cue, and caught by telemetry, in a form people can try themselves?

## Background

Sandy, 2026-10-07: the telemetry promise loop is what InDusk does that
nothing else does, a difference of kind; gates, rituals and the plan workflow
are differences of degree. The master's new order ("Now — show the promise
loop") puts this plan second, after a small-fixes plan and before
incident-recording, the VS Code extension and the cockpit. It is for a
recorded demo, for showing at Lazer, and for the public launch, where GitHub
attention matters to Sandy.

This plan's first draft (2026-10-04, revised 2026-10-05) is part of the
[indusk-demo](../indusk-demo/master.md) path, step 4 in its build order and
script steps 1 and 6. It said: a minimal Node service with no promises, an
env-var fault switch, a Fly config beside the always-on server's, delivered
as a repository to clone. Two of those changed in the 2026-10-07
conversation (below).

What exists today, which the app only has to use:

- **The promise mark** is plain OpenTelemetry, no InDusk code in the app
  (day-monitor ADR): on the span that does the work,
  `indusk.promise = <name>`, `indusk.promise.outcome = upheld | violated`, and
  on a violation an `indusk.promise.violated` event with
  `indusk.promise.symptom`. The exporter is pointed at an OTLP endpoint the
  ordinary way (`OTEL_EXPORTER_OTLP_ENDPOINT`), with
  `deployment.environment` on the resource. — `apps/docs/src/guide/always-on.md`
  "Adopting it in an application".
- **The local daemon** (Jaeger + otelcol, `indusk telemetry start`) is the
  local source; `indusk promises status` and the admin's promise page read it
  and show local and production side by side (promise-sources,
  promise-timeline).
- **The always-on server** on Fly is the production source and announces a
  violation to Slack (day-always-on).
- **What does not exist:** an app that marks a promise. Today only the
  evaluator (`every-commit-evaluated`) and the everyday suite
  (`everyday-suite-stays-fast`) mark promises.

## Findings

### How developer tools ship demo apps

The common pattern (Next.js, Prisma, tRPC, the Vercel AI SDK) is an
`examples/` folder in the main repository: each example a small, complete
app, tested with the package so it does not rot, copied out with one command
(`npx create-<tool> --example <name>`, or `npx degit owner/repo/examples/<name>`),
and linked from a "try it in two minutes" section at the top of the README.
Stars and attention land on one repository. Separate demo repositories are
known to go stale. Later additions are common: a GitHub template-repo
mirror, a hosted live instance, an "Open in Codespaces" button.

### What makes a good demo promise

It has to be understood by a stranger in one sentence, break visibly, and be
timed so the break appears quickly. A seat that is held and not booked must
be released within 30 seconds is all three: the fault switch delays the
release, the release span is marked `violated`, and the break shows within
the hold window.

## Decisions

- **The app is seat holds** (Sandy, 2026-10-07): hold a seat, release it
  after a timeout, book it. Close to numero, so Sandy speaks to it from
  experience.
- **It has a small web page** (Sandy, 2026-10-07): something the audience
  watches break, and the target promise DevTools needs later.
- **It ships with one promise, marked and tested; the planner adds more live**
  (Sandy, 2026-10-07). This reverses the 2026-10-05 decision to ship none: a
  break must be showable in the first two minutes.
- **Local first, with the Fly config included and tried once** (Sandy,
  2026-10-07); a production break is the demo's second act.
- **It lives in this repository under `examples/`, with a one-command start**
  (Sandy, 2026-10-07: "follow that setup"), replacing the draft's separate
  repository to clone. This assumes this monorepo is what goes public; that is
  still open.

## Open Questions

- Is this monorepo the repository that goes public, under which name?
- What the one-command start is called (`indusk demo`, an `npx` command, or
  `degit`), and whether it also starts the daemon and the admin.

## Sources

- `apps/docs/src/guide/always-on.md`, `apps/docs/src/guide/promises.md`
- `.indusk/planning/indusk-demo/master.md` (the script)
- Next.js `examples/`, Prisma `prisma-examples`, tRPC `examples/`
