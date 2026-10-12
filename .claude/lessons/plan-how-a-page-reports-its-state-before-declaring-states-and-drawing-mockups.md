# Declaring a UI state is cheap and making the page report it is the work — plan per screen how a page says which state it drew before declaring the state or drawing its mockup

**The rule.** A look check can hold a screen state only if the running page can say which state it rendered (`data-look-state`). Before a state goes in `screens.json` and a mockup is drawn for it, the plan names how that page will report the state and which data makes it appear (an empty registry, a broken promise, a collapsed nav). A state with no way to be reported stays out of the declared list, or is declared knowing it will read `unchecked`.

**Why.** ui-promises declared eleven cockpit screen states and drew eleven mockups. The admin could report only two of them (dashboard default/empty and Looks default/uncovered), because it ignores `?state=` and one page shows many promises or one plan at a time. After the check learned to report unchecked rather than held, 54 of the 66 admin looks (11 states × 3 devices × 2 schemes) read unchecked; the plan closed with the cockpit held in two states of eleven. Its audit and retrospective both name this as the plan's largest gap (`.indusk/planning/archive/ui-promises/audit.md`, `retrospective.md`).

**How to apply.** In the ADR or impl for any UI-holding plan, add a table: screen × state → how the page reports it → what fixture or data makes it render. Put the report in the same phase that draws the mockup, not after the check exists. If a state cannot be made reachable, say so in the brief's expectation so 'every state held' is not promised.

Related: `a-value-check-that-says-held-has-not-seen-the-layout`.
