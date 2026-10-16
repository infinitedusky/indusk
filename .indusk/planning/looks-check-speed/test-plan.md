---
title: "Looks check speed — Test Plan"
date: 2026-10-16
status: draft
---

# Looks check speed — Test Plan

## Purpose

This document lists the behavioural assertions that, taken together, mean a
look check costs what changed. Each names its level — the smallest that can
prove it — and so when its test runs. They are grouped by the promise in the
brief they prove, and under the plan's one promise by the clause of it they
prove (the brief writes the clauses as prose).

The browser is something this package does not own, so every assertion that
needs a real Chromium and a served page is a `contract` test, in the system
tier (`lesson: everyday-tests-never-wait`). Every decision the check makes —
whether a look is reused, which looks `--only` selects, whether a server is a
development one, what a slow look reports — is a rule fed facts, so it is a
`unit` test through a seam: the check takes what it would open and what it
last held as inputs (`lesson: code-that-decides-takes-its-clock-and-its-reads`).
The two timings the brief expects, and one refusal against a real `next dev`,
are `live check`s, run once and recorded in the plan.

## Behavioral Assertions

### `a-look-check-costs-what-changed` — A look check takes time in proportion to what changed, not to how many looks there are.

**An unchanged look is not reopened**

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A second check with nothing changed opens no page, starts no browser, and reports every look as reused, naming when it last held. | unit |
| A2 | Changing one look's snapshot (a story's markup or its component's stylesheet; a mockup or a component it composes) reopens that look and every screen that composes it, and every other look is reported reused. | unit |
| A3 | Changing the reference devices, the ignored tags or the app's source folders reopens every look. | unit |
| A4 | A look whose last check was broken or unchecked is reopened, never reported reused. | unit |
| A5 | After an edit to the app's sources that the stories were not rendered from, nothing is reused, and the check says to render the stories to check only what changed. | unit |
| A6 | An edit to the app's page code — any source that is not a component, a story or a test — reopens every screen and no story; a screen whose mockup still draws its components inline is never reused; a seeded screen whose seed command changed is reopened. | unit |
| A7 | `--all` reopens every look, whatever was held. | unit |
| A8 | What the check held is kept in the project's home outside the checkout: a run writes nothing under the checkout, and a run from another worktree of the same project reuses the same results. | unit |
| A9 | A reused look sends one signal per device and scheme saying upheld, marked as reused with the time it was really measured; a look measured this run sends its held or broken signal with no reused mark. | unit |
| A25 | A look reported only as reused, run after run, keeps reading holding in its standing and never decays to no signal. | unit |
| A10 | Against a real browser and a served app, the second of two runs requests no page from the server, prints one reused line per look, and counts reused looks beside held ones in its summary, exiting 0. | contract |

**A page loads once per look**

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | Each look's page is requested from the server once, and the check still reports the look at every device and scheme under the names it uses today (`phone`, `phone/dark`). | contract |
| A12 | A page measured in place reads the same values as a fresh load at every device and scheme, including a page whose colours transition and a page with a pixel-ratio media query, so neither is reported broken. | contract |

**The check refuses a dev server**

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A13 | Given the page a development server answers (Next's HMR client, webpack's refresh runtime, Vite's client), the check refuses before opening any look, naming the command the app declares for building and serving it, or how to declare one; a production page is not refused. | unit |
| A14 | Against a served page carrying a development marker, `indusk looks check` exits 1 with that refusal and reports no look held. | contract |

**A slow look never ends the run**

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A15 | A look that times out twice is unchecked with the reason, a page answering 404 is unchecked at once, and any other failure still ends the run (shipped in storybook-components as `openWithinTime`). | unit |
| A16 | With one load per look, a look that does not load or draw in time is unchecked at every device and scheme with the reason, and every other look is still judged. | unit |

**One look can be asked for**

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A17 | `--only <name>` checks just the looks of that name — a screen state, a story, or both when both are named so — at every device and scheme, measured even when they could be reused; no other look is opened or reported. | unit |
| A18 | `--only` with a name no look has is refused, naming it, before any page opens. | unit |

### `tokens-are-held-exactly` — Every element in the running app that claims a token renders with the value the approved foundation gives it; a mismatch names the element, the token, and the approved and actual values.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A19 | A changed foundation — one token's value — reopens every look; no result held on the old foundation is reported. | unit |
| A20 | The check still reports a page with a raw value as broken, naming the element and the approved and actual values, once it measures in place. | contract |
| A27 | The full check of the admin, every look opened, against its production build holds every look; a broken one fails the slow tests that run in the background after landing and at release, and is recorded as a broken promise. | contract |

### `everyday-tests-never-wait` — The everyday suite never starts a server and never waits on the wall clock.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A21 | The new browser tests run in the system tier; the everyday suite starts no browser and no server. | unit |

### Not for a promise

The brief's two expectations and the refusal against the real development
server are each run once, by hand, and recorded with their result. They prove
no promise on their own: a timing on one machine is information, not a test
that can break.

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A22 | After a change to one component, with the stories rendered, `indusk looks check admin` against a production build finishes in under 15 seconds and names every look it skipped as reused. | live check | the brief's first expectation, measured when the build closes |
| A23 | `indusk looks check admin --all` against a production build finishes in under 60 seconds. | live check | the brief's second expectation, measured when the build closes |
| A24 | Against a running `next dev` of the admin, `indusk looks check admin --url <it>` refuses, naming the admin's build-and-serve command, without opening a look. | live check | the dev-server clause against the framework itself, whose markers this plan reads but does not own |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | A held page whose data changed (new plans, new promises) but whose code and snapshots did not still holds. | The admin's data is not in any key; a new element with a raw value that was never on screen before is reused past in a plan's phases. | The slow tests after every landing and at every release run the full check with every look opened (A27), so the residual lasts at most until the next landing. |

## Notes

- A12 and A20 pass today, because today's check loads every device and scheme
  fresh; they are written first as tripwires for the in-place measuring, which
  is where a mid-transition colour or the wrong pixel ratio would read broken.
- A27 is the full check landing and release get (Sandy, 2026-10-16): it is a system-tier test, so it runs in the background after landing and at release and never blocks either (the 2026-10-08 rule); a broken look is recorded as an incident on `tokens-are-held-exactly`. Plan phases use the fast default.
- A15 is the storybook-components test that already holds the slow-look clause
  (`looks-check-timeout.test.ts`); A16 is the same clause once a look is one
  load, so a timeout costs the look's six results, not one.
- A22 depends on how a change reaches the stories: the snapshots must be
  rendered (`indusk looks stories admin`) before the check can reuse them
  (A5). The render's own time is not the check's and is recorded beside it.
