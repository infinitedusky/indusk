# Cockpit redraw — the nav from the original cockpit, a width you can drag, re-approval a person's

**Decided 2026-10-13.** Full ADR: `.indusk/planning/archive/cockpit-redraw/adr.md`.

## Goal

**The cockpit looks as Sandy meant it — the nav from the original cockpit mockup, a width you can drag, the brief page and plan page drawn — each look approved once, and re-approving a brief is a person's alone.**

brief-as-the-contract built the brief page and the plan's description by working the page live, so the admin no longer drew what its approved mockups drew; the approved nav was a smaller redraw of the one Sandy remembers, and plan names truncated in it. And an agent could run `indusk plans reapprove` from a terminal, which the audit found.

## Decision

1. **The nav is redrawn from the original cockpit mockup.** `nav.expanded` holds the project, Needs you, the views (Scorecards, Promises, Looks), then every plan under its Paths with its stage, Archived folded. The plan tree is drawn, so it is held like the rest. `nav.wide` draws it dragged wider; `nav-handle` is a component drawn on its own.
2. **The nav's width is the person's, per browser.** `CockpitFrame` keeps it in `localStorage` beside the collapse choice, clamps it between `--size-nav` and the new foundation size `--size-nav-max`, and draws no handle below 760 px (`the-nav-fits-a-phone`).
3. **The brief page and plan page are drawn as built.** `brief.writing`, `brief.approved` and the four plan screens are matched, and `a-plan-page-shows-the-parts-of-its-brief` is changed to the sentence the brief states.
4. **Re-approval joins the looks guard.** An agent's `plans reapprove`, or a call to the re-approve route, is refused as an agent's look approval is; the person's Approve on the amendment card is unchanged.

## Alternatives rejected

- **The width in `.indusk/config.json`** — a width is a person's preference on a screen, and a config write from the page would be the admin's first write outside its routes.
- **Refusing `reapprove` when an agent's environment variable is set** — a person's own terminal inside an editor can carry the same variable; the guard reads the agent's tool call, which is what is in question.
- **Approving the pages as drawn** — the nav did not fit the cockpit's look and the brief page was never drawn.
- **A second guard hook** — one guard already holds what only a person approves.

## Consequences

- The cockpit reads as one look, approved once; plan names are read whole.
- The guard reads a command's text; a script that builds the command is not seen, as with look approval.

## As built

- **A page says which look it draws.** The value check counts a state only when the page reports it (`data-look-state`), and a page opened with `?state=` drew the same thing for every state. So the nav, the brief page and the plan page each report the state they really draw from their own data, and `screens.json` lists one path per state; A10 serves a fixture plan in each condition. The nav's width can be asked for with `?nav=<px>` for one page (nothing is kept), so a check that opens a fresh browser can reach `nav.wide`.
- **`nav.wide` is not drawn below 760 px.** There the nav is a drawer with no edge, so the page does not report it and A10 does not count that as a finding.
- **A test's `next dev` builds into `.next-tests`**, so it runs beside a person's admin.
- **The plan and brief screens are held against fixture plans.** Their `screens.json` paths name `looks-fixture-*` plans that exist only in A10's throwaway project; `indusk looks check admin` against a real project records a look whose page answers 404 as unchecked and checks the rest (a 500 or a refused connection still ends the run).
- **`brief.empty`** was drawn during the build: a plan with no brief file shows its three parts at 0, as plain rows.
- **Falsification** tightened the guard (substitutions under a reader, `reapprovePlan` through an interpreter), ended a drag the browser cancels, and counted a waiting amendment as the plan page's `needs-you`. The nav's *Needs you* group does not count amendments yet — a follow-up.

## References
- Full ADR: `.indusk/planning/archive/cockpit-redraw/adr.md`
- [Brief as the contract](/decisions/brief-as-the-contract) — the pages this redraws
- [UI promises](/decisions/ui-promises) — the look check and the foundation
- [The admin overview](/reference/admin-ui/overview#the-nav), [`indusk plans`](/reference/cli/plans)
