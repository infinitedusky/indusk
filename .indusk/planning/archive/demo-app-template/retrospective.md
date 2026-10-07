---
title: "Demo app template — Retrospective"
date: 2026-10-07
---

# Demo app template — Retrospective

## What We Set Out to Do

Show InDusk's promise loop, the difference of kind, as fast as possible: an
app with a promise a stranger understands, broken on cue, and caught by
telemetry. For a recorded demo, for the Lazer showing, and for the launch.
Two expectations: people who see it understand the loop, and the break shows
in under two minutes.

## What Actually Happened

Four build phases. The seat-holds example (`examples/seat-holds/`): seat rules
with the clock as an input, one OpenTelemetry mark per release, a 100-line
`node:http` server, one page with a Break it switch, its own registry and the
archived plan its promise came from. `indusk demo` copies it from the
installed package, makes it a project and starts it with the local daemon.
It ships in the tarball and deploys to Fly (`seat-holds.fly.dev`), where its
spans reach the always-on server.

Sandy ran the start and the break live: "I definitely got the violation";
"overall the demo seems to hold".

## Getting to Done

- **InDusk's own registry check refused the example.** The scan read the
  example's promise tokens as the repository's. A folder with its own
  `.indusk/config.json` is now its own project to the scan; that is a real
  InDusk fix any repository with an example inside it needed.
- **A copy may carry only its own tokens.** The example's tests first named
  InDusk's promises too, which the example's own check then refused. So the
  example names only its own promises, and the deploy promise moved into the
  example's registry: the code that keeps it is the example's Dockerfile and
  `fly.toml`.
- **A promise's owner must be a plan.** The example ships the archived plan
  its promises came from, which also shows a newcomer where a promise starts.
- **npm 10 could not install the tree** in `node:22-slim`; the image builds
  on Node 24.
- **The live check changed a promise.** "Fix it" and this plan's own promise
  said the promise holds again once the fault stops. Sandy: a promise that
  says "never" stays broken until the break is recorded and fixed. InDusk
  already models it (unrecorded, open, fixed); the demo now matches.
- **The root `CLAUDE.md` is full.** Its 20 % margin refused the Key Decisions
  line; the tree line carries the pointer.

## What We Learned

- A demo is the fastest way to find what the model says that the product does
  not: the "Fix it" button contradicted InDusk's own violation states.
- An example inside the repository is a second InDusk project, with its own
  registry and its own tokens; anything that scans the repository has to know
  where one project ends.
- "Promise outcomes, not causes; start broad and split on evidence" came out
  of the deploy promise's conversation.

## What We'd Do Differently

- Decide which registry a promise belongs to before writing its rows: two of
  this plan's promises moved, one into the example.
- Name the fault switch for what it does from the start.

## Insights Worth Carrying Forward

- The bar chart of checks (green held, red broken, purple fixed) is what the
  promise page needs; it is in `known-issues.md` for the cockpit.
- The next demo work is more promises and features added live through the
  planner (`known-issues.md`, The demo).

## Quality Ratchet

No recurring lint or type errors suggested a rule. Shape raised no findings
across four build phases; a human judged none wrong.

## Metrics

- Promises: two in InDusk's registry, two in the example's.
- Rows: ten, all terminal.

Landed on main at da70eada, 2026-10-07.
