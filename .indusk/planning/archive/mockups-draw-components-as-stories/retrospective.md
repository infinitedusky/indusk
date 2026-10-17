---
title: "Mockups draw components as their stories do"
date: 2026-10-17
---

# Mockups draw components as their stories do — Retrospective

## What We Set Out to Do

Close the two incidents the 1.71.0 release raised on 2026-10-16:
`mockups-render-in-the-cockpit` (a component placed in a mockup drew
differently from its story, and `message.you` overflowed its frame) and
`a-mockup-composes-approved-components`. The brief promised that a person
approving a mockup sees the components as they will be built, measured by the
composition check and the story-frame check that `plan/storybook-components`
had fixed but not yet landed.

## What Actually Happened

The cause the research named held: a component's mockup stylesheet carried its
classes but not the app's element resets, so a link-based card drew in link
blue and the prompt box's textarea in the browser's monospace. Build Phase 1
wrote those resets into one sheet, `_reset.css`, scoped to components with
`:where(...)` so it adds no specificity and touches no page, and loaded it under
every mockup and every story. Build Phase 2 fixed the project card's spacing,
Message's wrapping (`wrap-anywhere`) and the frame fitting of an end-aligned
story, and changed the promise's sentence.

The plan then grew past its brief. Comparing the home mockup with the real home
page showed the card's badges were the page's, not the card's, and the look
check held anyway, so the card was redrawn to own them, with two new stories.
Falsification (Build Phase 3) found two real defects: an approval was blind to
the element rules its look was now drawn under, and a story centred by `auto`
margins was never fitted narrower than its frame. Cleanup (Build Phase 4) made
one rule say what an approval is bound to, and taught the look check and
`looks status` to use it.

The cold audit found the rest. The composition check ran at one width and
skipped every box holding a mockup's own words; the reset tests checked text,
not drawing; the spacing fix had been a class rename with nothing stopping the
next collision; and two changes (approvals binding the element rules, the card
redesign) were in no brief line. The brief was amended and re-approved, and
Build Phase 5 closed them: a mockup's own style rules are now scoped to its page
(`pageOnly`, the inverse of the reset's scope), the composition check runs at
every reference device and measures the story given the mockup's words, and the
22 current approvals that history shows were drawn under today's element rules
record them.

46 files changed, +2019/−249 (apps: 24 files, +963/−191), 97 commits.

## Getting to Done

- **The spacing cause was a page rule, not a component one.** `home.default`'s
  own `.grid` rule, meant for the card container, matched the card root's
  `grid` utility class. Renaming it fixed one mockup; only Build Phase 5's
  page-only scoping fixed the class of bug.
- **The composition check at phone width failed with 611 lines**, from one real
  defect and two flaws in the check. The defect: a later component sheet's
  `.flex` overrode an earlier sheet's `max-[759px]:hidden`, because each sheet
  carried its own variants. The cockpit document now loads every variant rule
  after every plain one. The flaws: elements inside a `display: none` ancestor
  were measured as negative sizes, and stories were read at a 900 px viewport
  height while mockups used the device's.
- **Re-approval was refused twice.** It first refused because the amendment
  listed two new card story states as looks of their own; a brief's looks name
  mockups only, so they were folded into `project-card.default`'s change. The
  re-approval from the admin did not land at all and had to be run from the
  terminal.
- **The approval binding protected nothing on arrival.** None of the admin's 193
  current approvals recorded the rules hash; 22 were stamped from git history,
  and 171 stay unbound until a person approves them again (declared in the
  brief's Not promised).

## What We Learned

- A reset that reaches components and a page rule that must not are the same
  move inverted: `:where(<scope>)` to add a rule only inside components,
  `:not(:where(<scope>))` to keep a rule outside them, each placed before any
  pseudo-element. One helper (`pseudoElementAt`) serves both.
- Component stylesheets loaded side by side need their variant rules after all
  plain rules. Within one sheet Tailwind orders them; across sheets nothing
  does, so a later sheet's plain utility wins over an earlier sheet's media
  variant.
- A check that skips the hard case reports the easy one as proof. The
  composition check's own-words skip and single width meant the promise's
  "at each reference device" was never measured; the cold reader found it, the
  builder did not.
- A new binding on an approval record protects nothing until existing records
  carry it. Absence-is-a-rule keeps old entries readable, but it also means the
  protection starts empty; say how many are bound when the field lands.

## What We'd Do Differently

- Declare the card redesign in the brief when it was discovered (Build Phase 2),
  not after the audit. It changed two looks and added two stories; the amendment
  machinery exists for exactly that and was only used at the end.
- Write the composition check's device loop before trusting it as the
  measure. The brief named it as the expectation's measure while it measured at
  one width.
- Reach for the structural fix (scope the page's rules) instead of the local one
  (rename the class) when a page rule leaks into a component: the rename was
  correct and proved nothing about the next mockup.

## Insights Worth Carrying Forward

- Run the audit before the retrospective as a real gate on wording, not on
  existence: every substantive gap in this plan between promise and proof came
  from the cold read.
- When a plan's fix changes how every look draws, ask at once what it does to
  every standing approval.

## Quality Ratchet

No Biome rule would have caught these: the defects were CSS cascade and
measurement, not code shape. The looks lint gained a narrower message instead:
an arbitrary `overflow-wrap`/`word-break` class now names the standard wrapping
utility, which is where the wrap rule lives since the admin's `CLAUDE.md` is
over its budget.

Shape findings: 2 raised, 0 judged wrong by a human. Build Phase 1 named the
element-selector predicate once (`isElementSelector`); Build Phase 5 extracted
`withPageOnlyStyles` from `mockupDocument`. Every other phase reviewed and found
nothing.

## Metrics

- Phases: Test Phase 1, Build Phases 1–5 (falsification at 3, cleanup at 4,
  audit findings at 5)
- Files touched: 46 (24 under `apps/`)
- Lines added/removed: +2019 / −249
- Trajectory: 15 rows (A1–A6, T1–T9), all passing
- Composition check: every admin mockup at three devices, 203 s
- Approvals bound to the element rules: 22 of 192 looks
