---
title: "UI promises — Test Plan"
date: 2026-10-10
status: accepted
---

# UI promises — Test Plan

## Purpose

The behavioural assertions that, taken together, mean an app's looks are held
by approved mockups: built on a defined foundation, covering every part of the
UI, every token held exactly in the running app, and a break reported like any
promise's. Grouped by the promise in the [brief](brief.md) each proves. They
become the impl's Test Trajectory rows.

Levels: the decisions — is this value raw, is this screen covered, did these
values match, may this actor approve — are rules fed inputs, so `unit`. What
only a real browser can say — what an element actually renders with, at what
size — is a `contract` with Chromium, in the slow tier
(`everyday-tests-never-wait`).

## Behavioral Assertions

### `a-mockup-is-approved-by-a-person` — A mockup, and the foundation it defines, becomes the reference only when a person approves it in the cockpit; an agent can draw and propose one and never approve it.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A mockup an agent has drawn shows in the cockpit as proposed, and nothing is checked against it. | unit |
| A2 | Approving a mockup in the cockpit makes it the reference, recording who approved it and when. | unit |
| A3 | An approval from anywhere but the cockpit's approve action — an agent's session, a command, a hand edit of the record — is refused, or reads as not approved. | unit |
| A4 | A change to an approved mockup returns it to proposed until a person approves the change; the app is held to the last approved version meanwhile. | unit |

### `a-mockup-leaves-nothing-undefined` — Every colour, size, space, radius, shadow, font and motion value in a mockup or in the app comes from a defined token, so the first mockup defines the foundation and no later one can add a raw value.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | A mockup with a raw colour, size, space, radius, shadow, font or duration is refused, naming the file, the line and the value. | unit |
| A6 | The app's styles are held to the same rule: a raw value there is refused the same way. | unit |
| A7 | A mockup that uses a token the foundation does not define is refused, naming the token. | unit |
| A8 | A later mockup may add a token only by declaring it new; an undeclared one is refused. | unit |
| A9 | The cockpit's mockup, redrawn on its foundation, passes with no raw value. | unit |

### `every-part-of-the-ui-is-covered` — Every screen the app has, in each declared state, and every component it uses, is covered by an approved mockup; whatever is not is reported uncovered, never passed.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A10 | A screen the app has with no approved mockup is reported uncovered, by name. | unit |
| A11 | A declared state of a screen with no mockup for that state is reported uncovered. | unit |
| A12 | A component the app uses that no approved mockup shows is reported uncovered. | unit |
| A13 | The cockpit shows an uncovered part as uncovered, never as held. | unit |

### `mockups-render-in-the-cockpit` — Each mockup opens in the cockpit at each reference device, drawn with the foundation's tokens.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A14 | Each mockup, proposed or approved, opens in the cockpit with a choice of the project's reference devices. | unit |
| A15 | Opened at a reference device, a mockup is drawn at that device's width and height. | contract |
| A16 | A mockup in the cockpit is drawn with the foundation's tokens: a changed foundation value shows in the mockup. | contract |

### `tokens-are-held-exactly` — Every element in the running app that claims a token, including a duration or an easing, renders with the value the approved foundation gives it; a mismatch names the element, the token, and the approved and actual values.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A17 | Given the approved values and what elements rendered with, the verdict is held when they agree and broken when they do not, naming element, token, approved and actual. | unit |
| A18 | An element of the running app that renders with its token's approved value is held. | contract |
| A19 | A token changed in the app alone, not in the approved foundation, makes every element using it broken. | contract |
| A20 | A duration or an easing that differs from its approved value is broken like a colour or a size. | contract |
| A21 | The cockpit run end to end: its mockup redrawn and approved, the cockpit restyled to match and held; one token changed in the app, and the dashboard shows it broken. | live check |

### `a-look-reports-like-any-promise` — Each check of the app's looks is recorded held or broken through the same telemetry promises use, and a broken one is counted and listed first with the rest.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A22 | Each run of the look check is recorded held or broken in the local telemetry, the way a promise's run is. | unit |
| A23 | A broken look is counted in the nav's broken count and listed first on the dashboard beside broken promises. | unit |
| A24 | The editor shows a look's state as the admin does. | unit |

### Existing promises

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A25 | The everyday suite runs no look check that opens a browser; the look checks run in the slow tier. | unit | `everyday-tests-never-wait`, `everyday-suite-stays-fast` — this plan adds browser checks |
| A26 | The dashboard still lists every promise, with looks added beside them, none hidden. | unit | `every-promise-is-listed` |
| A27 | The demo's fault switch still shows its promise broken in the admin, with looks present. | unit | `the-demo-break-is-caught-locally` |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The redrawn cockpit mockup is the design `plan-cockpit.html` meant, now on tokens. | A person's judgment of a design | The approval itself (A2): the person approves it in the cockpit before anything is held to it |
| U2 | The demo watcher sees the power. | A viewer's judgment | Expectation 1, read at demo-rehearsal |

## Notes

- A15, A16 and A18–A20 need Chromium and run in the slow tier, at landing.
  Whether they share mockup-matching's pinned renderer is that plan's; here the
  checks read values, not pixels, so the machine does not change the verdict.
- A3's "a hand edit of the record" depends on where approvals are kept — the
  ADR's question. The assertion holds whichever it picks.
- Screens and states come from where the app declares them — routes, plus
  declared states — also the ADR's.
