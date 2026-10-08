# Brief: plan-cockpit

A web UI where you see every plan in a project, organised by Paths, answer the decisions plans are waiting on, and follow each promise from declaration to production.

Mockup: `../../mockups/plan-cockpit.html`

## Promises

1. **every-plan-is-one-click-away**: every active plan in a project is one click away from any page.
2. **paths-keep-their-order**: the nav shows Paths and their plans in the order the Path declares, nested as deep as the Paths are.
3. **the-nav-fits-a-phone**: below 760 px the nav is a drawer, closed by default, and no page scrolls sideways. Above it, the nav can collapse to a strip and remembers that choice.
4. **workflows-are-separate**: each plan shows Planning (Brief → Test plan → Decision → Impl) and Release (Build → Falsify → Cleanup → Review → Release) as two vertical lists, each with its own progress.
5. **decisions-wait-in-one-place**: when a plan needs you, its current stage shows a single decision with accept, reject and "Maybe…" (reply in words). Your answer is recorded in the plan's history.
6. **every-promise-is-listed**: the promise dashboard lists every promise in the project, can be grouped by status, plan or Path, sorted, and filtered by text.
7. **a-promise-page-shows-its-proof**: each promise page shows its tests and their state, its eval triggers and whether they're armed or failing, 30 days of evals held and broken, and its history.
8. **broken-promises-come-first**: a broken promise is counted in the nav, listed first on the dashboard, and its page offers to start a fix plan.

## Kept from earlier work

- a-review-shows-its-evidence (admin-plan-authoring)

## Out of scope

- Editing plan documents in the UI. The cockpit reads them and records decisions; writing a plan stays where it is today.
- Running evals. The cockpit shows results; producing them belongs to the telemetry layer.
- Multi-user accounts and permissions.

## Open questions (need the repo)

1. **Where does the cockpit read from?** Options: a small local server over the `.indusk` folder, or the same API the agents use. This decides most of phase 1.
2. **What are the real stage names and order?** The mockup uses Brief, Test plan, Decision, Impl, Build, Falsify, Cleanup, Review, Release. Adjust promise 4 to match.
3. **Where do eval results live today?** Promise 7's 30-day chart needs a source. Without one, phase 4 shows "Not watched yet" and ships anyway.
4. **How does a decision get back to the agent?** A file write the agent watches, or an API call?
