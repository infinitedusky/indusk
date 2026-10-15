---
title: "One promise language — Test Plan"
date: 2026-10-15
status: draft
---

# One promise language — Test Plan

## Purpose

The behavioural assertions that, taken together, mean every word a person
reads about a promise is upheld or broken — holding or broken when live, no
signal when unknown — while the words already written (`violated` in running
applications' signals, `known-violated` in promise files) keep working. Each
names the smallest level of test that proves it. They are grouped by the
promise in the brief they prove; the two promises this plan must not break
have their own headings. The rows become the impl's Test Trajectory.

## Behavioral Assertions

### `a-promise-is-upheld-or-broken` — Every signal, record and page says a promise or a clause is upheld or broken — holding or broken when live, no signal when unknown — and never failed, passed or violated.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A signal reporting a promise broken with the word `broken` is read as broken wherever InDusk reads signals — the promise's status, its health, its timeline, its looks standing, and the helper applications' tests use to check their own signals. (Today such a signal is dropped and reads as nothing.) | unit |
| A2 | A signal written with the old word `violated` is still read as broken everywhere A1 names, so an application instrumented before this change keeps working unchanged. | unit |
| A3 | This release, the signals InDusk sends about its own promises — the evaluator's, the recorder's, the commit-to-trunk check's and the looks check's — and the demo app's still write `upheld` or `violated`, so no reader older than this plan meets a word it cannot read; and every reader reads `broken` as broken. (Switching the writers to `broken` is `mark-first`'s, next release — Sandy, 2026-10-15.) | unit |
| A4 | A promise whose file says `known-violated` is read as known-broken: the registry check accepts it under the same rules, and the admin and the editor show it as known broken. | unit |
| A5 | When an incident opens on an enforced promise, its file is written `known-broken`; when the last open incident is fixed — whether the file said `known-broken` or `known-violated` — the promise returns to enforced. | unit |
| A6 | The admin's promise chips, timeline cells, health lines and plan-list warning say upheld, holding, broken, held, broke or no signal — never violated, violation, unverified, not seen or no runs. | unit |
| A7 | A promise nothing has reported on reads "no signal" in the admin, the command line and the editor, and is never drawn green or called holding. | unit |
| A8 | The command line's promise output — `indusk promises status`, `watch`, `check`'s summary and refusals, the always-on server's messages, and the help of every promise command — says broken, held or no signal, never violated or violation. | unit |
| A9 | The editor's promise labels say known broken and no signal, and its activity says held or broke for a signal written either way. | unit |
| A10 | The pages people use — the docs' guide and reference, the shipped skills, the planning rules template, the server's deploy files, and the MCP tool descriptions — carry no *violated*, *violation*, *known-violated*, and call the telemetry behind a promise its signal, not its mark; attribute names such as `indusk.promise.violated` are the only exception. | unit |

### `a-production-break-is-recorded-unasked` — must not break

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | A production signal saying `broken` becomes an incident, with its owning plan reopened, exactly as a `violated` one does today. | unit |
| A12 | The always-on server announces a production signal saying `broken` exactly as it announces one saying `violated`. | unit |

### `the-thirty-days-say-only-what-was-seen` — must not break

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A13 | A promise's thirty days count held, broken and neither the same way whether its signals said `broken`, `violated` or a mix of both. | unit |

## Notes

- Every assertion is `unit`: each is decided by a rule — what a value means,
  what a label says — fed with inputs the test chooses. The server announcement
  (A12) is tested with a stubbed Jaeger answer, not a running server; the
  system-tier `always-on-pass.test.ts` keeps covering the real one.
- A10 is a scan of files people read, with a short, named list of what may
  still say the old words (attribute names, and the history pages — changelog,
  decisions, lessons, strategy — which record what was said when).
- No assertion covers the approved looks: they are held by value, not by text,
  and the brief names none.
