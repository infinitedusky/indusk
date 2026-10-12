# UI promises — mockups on a DTCG foundation, approved in the cockpit, held by value

**Decided 2026-10-10.** Full ADR: `.indusk/planning/archive/ui-promises/adr.md`.

**Amended 2026-10-11.** Decision 3 said the record is committed on `main`. It is committed on the branch of the checkout the person was shown — a plan's worktree commits on the plan's branch — so an approval is made where the work is and merges with it. A person can approve several proposed mockups at once; each is its own entry.


## Goal

**An app's look is held by mockups a person approved: every visual value comes from one foundation of tokens, every screen is covered, and the running app is checked against the approved values.**

Today the only reference for how a screen should look is a mockup nobody
checks: plan-cockpit passed every test and looks nothing like
`plan-cockpit.html`, which itself defines its colours as tokens and types over
400 raw sizes. After this, a mockup with a raw value is refused, an uncovered
screen is reported, and a token changed in the app alone shows broken on the
dashboard.

## Y-Statement

**In the context of:**
an app built by agents whose work cannot be taken on trust, where how the app looks has had no contract at all — only mockups held in research folders and a person's judgement at the end.

**Facing:**
that appearance does not compose from behavioural promises, that a check cannot be allowed to approve its own reference, that the admin styles with Tailwind utility classes rather than its own CSS, and that the project will not take on a vendor it cannot leave.

**We decided for:**
a foundation of design tokens in the W3C DTCG format as the one source of every visual value; mockups as plain HTML in `.indusk/mockups/<app>/`, built only from that foundation and opened in the cockpit at each reference device; approval as a record the cockpit writes and commits, bound to the content hash of the mockup and foundation it approved; the no-raw-value rule enforced by stylelint on CSS and by Tailwind's theme reduced to the foundation alone; the running app held by value in a real browser through two checks — the app's token values equal the approved foundation, and every rendered visual value is a member of it; and looks reported as spans read by the one health reader, beside promises.

**And against:**
a promise file per screen in `.indusk/promises/`; screenshots as the reference in this plan; Storybook components as mockups; a token format of our own; reading which variable an element used through the browser's debugging protocol; and any hosted design or review service.

**To achieve:**
a look that cannot drift silently — a raw value refused where it is written, an uncovered screen named, a changed token caught in the running app — with every artefact in an open format in git and the approval only a person can give.

**Accepting:**
a value check that knows *that* a value is outside the foundation but not always *which* token an element meant; two places a raw value is refused (CSS and Tailwind classes); Chromium as a dependency of the slow tier; and a redrawn cockpit mockup before the cockpit can be held.

**Because:**
the value check is exact without reading the browser's internals, DTCG and stylelint are the open standards for tokens and style rules, binding approval to a content hash makes a hand-edited mockup unapproved by construction, and keeping looks beside promises in one reader keeps every surface's health the same.

## Context

Research: [research.md](research.md) — appearance is not behaviour, the
accumulating mockup, the open-tool survey, reference devices, other platforms,
animation, no undefined values, promises = mockup. Brief:
[brief.md](brief.md), six promises. Test plan: [test-plan.md](test-plan.md),
27 assertions. Plan 2, [mockup-matching](../mockup-matching/brief.md), adds the
pixel comparison on top of this.

Found while writing this ADR: `apps/indusk-admin` styles with Tailwind 4
utility classes (`border-amber-300 bg-amber-50 p-4`) over the stock palette;
its `globals.css` declares two colours and a font. A rule only on CSS would
pass every class in the admin.

## Decision

1. **The foundation is DTCG JSON.** `.indusk/mockups/<app>/foundation.tokens.json`
   in the Design Tokens Format Module 2025.10: colour, dimension (spacing,
   size, radius), font family, font weight, shadow, duration, cubic Bézier.
   Style Dictionary (Apache-2.0) generates CSS custom properties from it, and
   for a Tailwind app the `@theme` block — the app and its mockups load the
   same generated file. The first mockup of an app cannot be approved without
   a foundation, so it defines one.

2. **A mockup is plain HTML in the project.** `.indusk/mockups/<app>/screens/<screen>.<state>.html`,
   loading only the generated tokens CSS; components are marked
   `data-component="<name>"` in mockups and in the app, the same attribute
   family promise-devtools proposes (`data-promise`). Reference devices are
   declared once per app, `.indusk/mockups/<app>/devices.json` — name, width,
   height, pixel ratio.

3. **Approval is a committed record bound to a hash.** The cockpit's Approve
   writes `.indusk/mockups/<app>/approved.json` — each entry the mockup, the
   foundation's and the mockup's content hashes, who and when — committed on
   `main` through the notes writer plan-cockpit's decisions use. A mockup whose
   hash does not match its entry reads *proposed*; so does a foundation. A
   PreToolUse hook refuses an agent's write to `approved.json`, the
   infrastructure tier's job; a hand edit by a person is theirs to make.
   Amended 2026-10-11 (Build Phase 6): an entry also binds the declarations the
   check trusts (`declarationsHash` over devices, `ignore`, `sources`; an entry
   without it reads proposed), Approve sends the mockup's hash as well as the
   foundation's and a differing one is refused, the hook also refuses an
   agent's Bash write and a shell call to the route, and the route requires
   the browser's `Sec-Fetch-Site: same-origin`.

4. **No raw values, in two places.** stylelint (MIT) with
   `stylelint-declaration-strict-value` (MIT) refuses a raw colour, length,
   shadow, font or timing in mockup HTML and app CSS. For a Tailwind app, the
   generated `@theme` resets every namespace (`--color-*: initial;` and the
   like) to the foundation, so a stock class such as `bg-amber-50` has no
   value to compile, and a source scan refuses arbitrary values (`p-[13px]`).
   Both report file, line and value.

5. **Coverage from declared screens and rendered components.** An app
   declares its screens and states (`.indusk/mockups/<app>/screens.json`; a
   web extension may derive routes, e.g. Next's `app/`); every
   screen × state needs an approved mockup. Every `data-component` name the
   running app renders must appear in an approved mockup. The missing ones are
   listed *uncovered*.

6. **The running app is held by value, in Chromium.**
   `indusk looks check <app>` opens each declared screen at each reference
   device (Playwright,
   Apache-2.0, already the admin's browser driver) and runs two checks:
   (a) each foundation token's runtime value on `:root` equals the approved
   value — names the token, approved and actual; (b) every rendered element's
   visual properties — colours, lengths, radius, shadow, font, transition
   duration and timing function — are members of the approved foundation —
   names the element, property and actual value, with the nearest token. The
   verdict is a pure function of approved values and measured values, so it is
   unit-tested without a browser; the browser half is the slow tier's.

7. **Looks report as spans, read beside promises.** Each check run emits one
   span per screen × state × device, held or broken, to the local telemetry
   daemon — the same plain-OTel mark promises use. The one health reader the
   admin and the editor share lists looks beside promises; a broken look is
   counted and listed first. As built it runs on demand (`indusk looks check`);
   running it at landing and on the admin's watcher pass was decided and not
   wired — until it is, a drift is caught when someone runs the check.

8. **All of it is one package module.** `lib/looks/` — foundation, mockups,
   approvals, coverage, verdict — exported as subpaths the CLI, the admin and
   the editor read, under the single-definition pin the cockpit already has.

## Alternatives Considered

### A promise file per screen
Rejected. A promise is a claim with sites and tests linked by a token; a
screen's look is a picture and its values. One file per screen would duplicate
every mockup into the registry, and a kind beside `behaviour`, `state` and
`structure` would describe a different thing than how a claim breaks. The six
promises are about the system; mockups are the app's own.

### Screenshots as the reference now
Rejected for this plan, kept for [mockup-matching](../mockup-matching/brief.md).
Pixels need one pinned renderer before they mean anything; values do not. The
value check catches the demo's case — a token changed — on any machine today.

### Storybook components as mockups
Rejected for now (research, "Mockups render in the cockpit"). Real components
cannot drift from the app but are code; HTML keeps design ahead of code and is
something a person or an agent can draw before anything is built.

### Reading the declared variable per element through the debugging protocol
Rejected. Chromium's DevTools protocol can say which rule and variable an
element matched, but it ties the check to one browser's internals. Checking
the token values at `:root` plus membership of every rendered value gets the
same verdicts with standard APIs; the cost is naming the nearest token rather
than the intended one.

### A hosted service (Chromatic, Figma tokens sync)
Rejected by the lock-in rule (research, "Tools, against lock-in").

## Consequences

### Positive
- A raw value is refused where it is written, in a mockup or the app.
- A changed token is caught in the running app on any machine, no pixels.
- An agent's ordinary attempt to approve is refused, and a changed mockup un-approves
  itself. Enforced (Build Phase 6): the guard hook refuses an agent's Write, Edit or
  Bash write to `approved.json` and a shell call to the approve route; the route
  answers only a browser on the admin's page (`Sec-Fetch-Site: same-origin`); and an
  entry binds the hashes of the mockup and the foundation the person was shown and
  of the declarations the check trusts (devices, `ignore`, `sources`). The residual,
  by nature: the hook is a tripwire, not a boundary — a script that builds the path
  passes it, and a process running as the person can send any header. Nothing on the
  person's machine is unforgeable by something running as them; what holds is that a
  forged entry must carry the true hashes and lands in git as a visible commit.
- Every artefact is open: DTCG JSON, HTML, CSS, a JSON approval record, in git.

### Negative
- The cockpit must be restyled onto a foundation before it can be held — the
  mockup redrawn, the admin's stock Tailwind palette removed.
- Membership cannot tell two tokens with the same value apart.
- Chromium joins the slow tier's dependencies.

### Risks
- **Tailwind's namespace reset misses a namespace** and a stock class compiles.
  Mitigation: the membership check in the running app catches the value
  regardless of where it came from.
- **Declared screens drift from real routes.** Planned mitigation, not built:
  the web extension derives routes and reports a route with no declared screen.
  As built, coverage reads only the screens `screens.json` declares and the
  components marked `data-component`; an undeclared route is not reported.
- **The watcher pass costs too much on a large app** (when it is wired).
  Mitigation: it checks one device per pass and rotates; landing checks them all.

## Documentation Plan

### Pages
- New: `guide/ui-promises.md` — the foundation, mockups, approval, coverage, the check.
- New: `reference/cli/looks.md` — `indusk looks check`, its output.
- Update: `reference/admin-ui/overview.md` — mockups in the cockpit, Approve, looks on the dashboard.

### Diagrams
- Mermaid in the guide: foundation → mockups → approval → app check → span → dashboard.

### Changelog
- Added — "UI promises: an app's look is held by mockups a person approves in the cockpit, built on one foundation of design tokens, and the running app is checked against them."

### ADR in Docs
- Yes: `decisions/ui-promises.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- [mockup-matching](../mockup-matching/brief.md), [promise-devtools](../../research/promise-ui/plans/promise-devtools/brief.md), [plan-cockpit](../plan-cockpit/brief.md)
- [Design Tokens Format Module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)
- `/decisions/day-promises`, `/decisions/day-monitor`, `/decisions/plan-cockpit`
