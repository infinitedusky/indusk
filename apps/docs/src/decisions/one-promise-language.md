# One promise language — upheld or broken, everywhere a person reads

**Decided 2026-10-15.** Full ADR: `.indusk/planning/one-promise-language/adr.md`.

## Goal

**Every word InDusk shows about a promise is upheld or broken — holding or broken when live, no signal when unknown — and every reader is ready for a signal that says `broken`, while the old words already written keep working.**

Before this, the admin's red chip said *violated*, an incident's promise read *known-violated* in its file and in every test summary, a promise nothing had reported on read *unverified* or *not seen*, and the docs called the telemetry a *mark*. A signal saying `broken` was silently dropped by the one parse every read goes through, so the settled word could not be written anywhere without the promise going dark.

## What was decided

- **Words people read.** Live chips say *holding* or *broken*; past cells *held* or *broke*; a state *upheld* or *broken*; the unknown *no signal*; the telemetry a *signal*. This holds in the admin, the command line and its help, the MCP tool descriptions, the editor, the docs, the shipped skills, the planning rules and the server's deploy files.
- **One reading rule for a signal's outcome.** `upheld` is upheld; `broken` and `violated` are broken. Every reader uses it, and the always-on server asks Jaeger for both values.
- **The registry state is `known-broken`.** A file still saying `known-violated` is read as it, and nothing rewrites it.
- **Writers keep `violated` this release.** InDusk's own signals, the demo app and the docs snippets still write `violated`, so a recording server older than this plan never meets `broken`. The switch is the next release's, in the plan that reworks signals (`mark-first`).
- **A word scan** — a unit test over the pages, skills, templates and descriptions people read — refuses *violated*, *violation*, *known-violated* and the promise sense of *mark*, reporting `file:line`, outside a short named list (attribute and event names, the attribute value in a snippet that sets it, and the sentence saying it is read as broken).

## What was rejected

- **Writing `broken` in the same release** — version skew: an older server would read every such signal as no signal.
- **Relabelling only, keeping `known-violated` stored** — the promise file and the test summary would still print the old word.
- **Renaming every internal identifier** — about 60 files of churn no reader sees, colliding with the plans that touch the same modules next.
- **Rewriting old `known-violated` files**, and **rewriting history pages** — they record what was said when.

## Consequences

For one release the attribute value written is `violated` while everything people read says broken; nobody reads the attribute value, programs do, through the one rule. Internal names (`violations`, `violationState`) still disagree with the words shown.
