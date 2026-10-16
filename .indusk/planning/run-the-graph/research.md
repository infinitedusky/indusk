---
title: "Run the graph — Research"
date: 2026-10-16
status: in-progress
workflow: feature
---

# Run the graph — Research

A start, not the whole background: this plan had no research document until a
conversation on 2026-10-16 produced one decision that belongs to its runner.
The brief's own background is in [brief.md](brief.md) and `promise-core`'s
master ("Phases are units of work", "Earlier plans go first", "Phases branch
off the plan"). More is written here as the planning conversation continues.

## Question

When the runner starts a phase's session, what decides how that session
thinks — its model and how hard it reasons — and where is that decided?

## Background

Today a phase is built by an agent on the model its tier names. The tier comes
from the phase's own `**Tier**:` line in the impl, else the step's default
tier in `.indusk/config.json`; the tier's model comes from `workflow.tiers`
(for this project: `strong` is opus, `med` is sonnet, `weak` and `baby` are
haiku; steps `plan` and `falsify` default to `strong`, `work` and `cleanup` to
`med`, `retrospective` to `weak`). `indusk plans model <plan> --phase "Build
Phase N"` prints `<tier> <model>` (`apps/indusk-mcp/src/lib/models/phase-model.ts`,
`lib/models/tiers.ts`), the `/work` skill hands the phase to an agent on that
model, and a phase that fails three times names the next tier up
(`nextTier`; promises `each-phase-runs-on-its-model`, `a-model-override-says-why`
and `a-struggling-phase-asks-for-a-stronger-model`).

Nothing in that chain mentions how hard the session reasons. A model's
reasoning effort is a separate setting (the agent tool and the workflow script
both accept an `effort` of low, medium, high, xhigh or max; left out, it is the
spawning session's), so a phase on `strong` runs at whatever effort the session
that launched it happened to be at. Seen on 2026-10-16: three batches of
background agents in one day ran on three different models and, by the same
rule, whatever effort each launch inherited, with nobody having chosen either.

## Findings

### Model and effort are one decision, not two

A tier is one word a person can read. A strong model at low effort and a weak
model at high effort are both defensible and pull in different directions, so
exposing both as free settings doubles the ways two runs can differ. The
alternative is to make effort part of the tier: a tier names a model and a
level, for example `strong` is opus at extra high, `med` is sonnet at high,
`weak` is haiku at medium — the pair printed by `indusk plans model` and
passed together when a session is started. Which tier gets which level is
Sandy's to set.

### The runner is where it is applied

`run-the-graph` is the part that starts each phase's session once its
dependencies are done and its files are free (the brief's
`ready-phases-start`). A phase already declares what it depends on and what it
touches; the tier is the third thing it declares for the same decision — how
to run it — and the runner reads all three when it launches the session. A
phase that fails and moves up a tier moves up in effort too, through the same
`nextTier`. Everything that starts a phase's session through the runner
passes the tier's model and effort; the manual `/work` path reads the same
answer from `plans model`.

### What changes in the package

The pair is carried by `lib/models/tiers.ts` and `phase-model.ts`, the config
schema (`workflow.tiers` entries become a model and a level), the `/work`
skill's "Running a Phase on Its Model" section, and the build runner's step
model (`lib/build/step-model.ts`). A single-definition test pins it, as for
the other single-definition rules in `apps/indusk-mcp/CLAUDE.md`. The agent
tool's own rule is to set an effort only when instructions ask for one; a
config that declares a level per tier is such an instruction.

## Proposed shape (not decided)

A promise beside `the-work-runs-as-a-graph`: every phase's session starts on
the model and effort its tier names, with two clauses — a split that the
session is launched with both (`ready-phases-start` extended by one argument),
and a limit that no path starts a phase's session without them, so a run's
model and effort never depend on who launched it. It shares code with the
runner (`lib/build/`, `lib/models/`), so it belongs in this plan, not its own.
It would cost one config change for existing projects: a tier given as a bare
model keeps working and means the session's own effort, as today.

## Decisions

- **Settled (Sandy, 2026-10-16):** the decision about how a phase's session
  thinks belongs with the run-the-master analysis of every phase, "where we're
  already doing analysis to figure out order of operations for every phase" —
  here, not a plan of its own.
- **Not yet decided:** that effort is part of the tier (the shape above) rather
  than its own axis; which level each tier gets.

## Open Questions

- Whether a phase may name its own effort in its `**Tier**:` line with a
  reason, as it may name its own tier, or only a tier.
- Whether a workflow's agents read the tier too, so that a script never picks
  an effort by hand.
- Whether the effort belongs in the phase's record (`indusk plans model`'s
  output and the build record) so a review can see what a phase ran on.

## Sources

- `apps/indusk-mcp/src/lib/models/{tiers,phase-model,tier-names}.ts`,
  `lib/build/step-model.ts`; `.indusk/config.json` `workflow.tiers` and
  `workflow.steps`
- `apps/indusk-mcp/skills/work.md`, "Running a Phase on Its Model"
- `.indusk/promises/each-phase-runs-on-its-model.md`,
  `a-model-override-says-why.md`, `a-struggling-phase-asks-for-a-stronger-model.md`
- `../run-the-master/master.md` and `../promise-core/master.md` ("Phases are
  units of work")
