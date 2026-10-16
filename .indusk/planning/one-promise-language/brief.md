---
title: "One promise language"
date: 2026-10-15
status: accepted
workflow: feature
description: "Every page, record and signal says a promise or clause is upheld or broken — holding, broken or no signal when live — and never failed, passed or violated."
---

# One promise language — Brief

The words of promises, settled with Sandy on 2026-10-15 (`promise-core`'s
master, "The words" and "Signal, not mark"). Today InDusk mixes three
vocabularies: the admin says *held*/*broken*, a mark reports
`upheld`/`violated`, and the registry's state is `known-violated`. First of the
three plans that split the merged `mark-first`'s first cut; the cheapest, and
the words every later plan uses.

## Expectations

None — this plan changes words, not behaviour; whether it worked is whether the
words are right, which its promise holds.

## Promises

### This plan makes

1. **`a-promise-is-upheld-or-broken`** (state). Every signal, record and page says a promise or a clause is upheld or broken — holding or broken when live, no signal when unknown — and never failed, passed or violated.

Its clauses — written here as prose until `plans-are-promises` teaches the
brief to hold clauses: **the old word is still read** — a signal written with
`violated` counts as broken, so applications already instrumented keep
working; **no signal is never shown as holding** — a promise or clause nothing
has reported on reads no signal; **signal, not mark** — what people read calls
the telemetry a signal, while the attributes underneath (`indusk.promise.*`)
may keep their names.

### Existing promises

**Must not break**

- **`a-production-break-is-recorded-unasked`**. A signal saying broken becomes an incident exactly as `violated` does today.
- **`the-thirty-days-say-only-what-was-seen`**. The thirty days keep counting held, broken and neither the same way; only the words change.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Renaming the telemetry attributes** (`indusk.promise.outcome` values beyond reading both words) — the attributes stay; only what people read changes.

## Looks

### This plan makes

1. **`promise-row.no-signal`**. A promise in the list that is enforced but whose signal has never reported: a grey dot, not green, and "no signal yet" where the last report would be — holding only once a signal says so (added 2026-10-15 from the review: the green dot contradicted this plan's own clause).

### Existing looks

**Must not break**

- **`promise-row.enforced`**. An enforced promise whose signal has reported keeps its green dot.

**Changes**

None.

**Replaces**

None.

Otherwise only words change on the promise pages, not their layout or tokens.

## Depends On

None.

## Blocks

- `.indusk/planning/plans-are-promises/` and `.indusk/planning/mark-first/` — they use these words.
