---
title: "The nav says where a plan is — Test Plan"
date: 2026-10-16
status: draft
---

# The nav says where a plan is — Test Plan

## Purpose

This document lists the behavioural assertions that, taken together, mean a
plan's row in the nav says what its page says. Each names its level — the
smallest that can prove it — and so when its test runs. They are grouped by
the promise in the brief they prove.

Every assertion is a `unit` test. What a row reads is a rule over facts the
admin already holds for every plan (where it stands, whether it waits on the
person, whether a release shipped it), so each is proven by building a plan's
facts and reading the row or the rule, with no server and no browser beyond
the component tests' own. Positions are built with the package's real
`derivePlanPosition`, as the package's step tests do, so the row and the page
cannot be tested against two different ideas of where a plan stands.

## Behavioral Assertions

### `the-nav-says-where-a-plan-is` — A plan's row in the nav names the same step its page shows; it reads Released only once a release has shipped it, and Closed once the plan is archived without one.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | At every point between its first document and its release, a plan's nav row names the step its page shows as being worked on or waiting on the person, or, between steps, the next one; a plan whose build is finished but not yet falsified reads *Falsify*, never *completed*. | unit |
| A2 | A plan no release has shipped reads *Released* never: one whose build is finished carries the in-progress mark and names its step, and one that is archived with no release found reads *Closed* with the finished mark. | unit |
| A3 | Which step a plan is at is decided once, in the package: the plan page's steps, the nav and Needs you all ask the same rule, and the admin defines none of its own. | unit |

### `decisions-wait-in-one-place` — When a plan is waiting on the person it is listed under Needs you, and its page shows the one decision with accept, the alternative and a reply in words; the answer reaches the agent and is recorded in the plan's history.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | A plan waiting on the person reads the step it waits at and carries the needs-you mark, ahead of whatever step it is at and ahead of *Released*. | unit |

### `a-master-plan-tells-its-story` — A master plan's page says what the master is for, then lists each of its plans in the declared order by title, with its description and how far along it is.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | A master plan's page reads each of its plans at the same stage the nav row reads it: a plan whose build is finished but not falsified reads *Falsify* on both, a released one *Released* on both. | unit |

### `paths-keep-their-order` — The nav shows Paths and their plans in the order the project declares them, nested as deep as they are declared, each Path with how many of its plans are released.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | A plan a release shipped reads *Released* with the finished mark, whether or not it is archived, and each Path's count of released plans is unchanged. | unit |

## Notes

- A4 and A6 pass today: they are regression guards over the two readings the
  fix must keep, a released plan and a plan waiting on the person. A1, A2, A3
  and A5 are red today: the row reads the impl's `status:` word, which `/work`
  sets to `completed` the moment the build checklist is done.
- A2's archived case changes what 45 of this project's 140 archived plans read
  (counted 2026-10-16 with the package's `readHealthNames`): they read their
  status word with the finished mark today, and will read *Closed*, keeping the
  finished mark (Sandy, 2026-10-16: *Released* is a release record; *Closed*
  is a plan done without one). Some are recent landings waiting for the next
  release; some are closed spikes and older plans whose release the
  release-date reader cannot place.
- The nav renders a row for every plan. The rule reads only facts the
  planning reader already holds for each plan (its position, documents and
  skipped rituals), so the fix adds no file read to the nav.
