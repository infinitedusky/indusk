# Test plan: plan-cockpit

Each line is the smallest test that proves part of a promise. Levels: unit (component or function), contract (against real `.indusk` fixtures or the real API), e2e (browser).

| ID | Promise | Assertion | Level |
|----|---------|-----------|-------|
| C1 | every-plan-is-one-click-away | The nav lists every active plan in a fixture project | unit |
| C2 | every-plan-is-one-click-away | Clicking a plan opens its page and marks it current | e2e |
| C3 | every-plan-is-one-click-away | A plan added on disk appears without a reload | contract |
| C4 | paths-keep-their-order | A Path nested two deep renders in declared order, numbered | unit |
| C5 | paths-keep-their-order | Reordering a Path on disk reorders the nav | contract |
| C6 | the-nav-fits-a-phone | At 400 px the nav is a closed drawer; the menu button opens it | e2e |
| C7 | the-nav-fits-a-phone | No horizontal scroll at 400 px with 40 plans on any page | e2e |
| C8 | the-nav-fits-a-phone | Collapsing the nav survives a reload | e2e |
| C9 | workflows-are-separate | Planning and Release render as separate lists with their own done counts | unit |
| C10 | workflows-are-separate | A plan in Build shows Planning approved and Release in progress | unit |
| C11 | decisions-wait-in-one-place | A plan waiting on a decision shows one decision with three answers | unit |
| C12 | decisions-wait-in-one-place | Accepting records the answer in the plan's history and advances the stage | contract |
| C13 | decisions-wait-in-one-place | "Maybe…" sends the typed reply and shows Claude's revised proposal | contract |
| C14 | every-promise-is-listed | The dashboard lists every promise across fixture plans | unit |
| C15 | every-promise-is-listed | Group by status, plan and Path each put every promise in exactly one group | unit |
| C16 | every-promise-is-listed | Filtering by text matches promise text, ID and plan | unit |
| C17 | a-promise-page-shows-its-proof | The page lists the promise's tests with their states | unit |
| C18 | a-promise-page-shows-its-proof | Triggers show armed, failing or armed at release correctly | unit |
| C19 | a-promise-page-shows-its-proof | The 30-day chart marks broken days, and an unreleased promise says "Not watched yet" | unit |
| C20 | broken-promises-come-first | A broken promise is counted in the nav and sorted first on the dashboard | unit |
| C21 | broken-promises-come-first | "Start a fix plan" creates a plan that links back to the promise | contract |
| C22 | a-review-shows-its-evidence (kept) | The review link's proof count equals passing tests | unit |

## Deferred, with reasons

- C21 depends on open question 4 (how decisions and new plans reach the agent). If that isn't settled by phase 4, C21 moves to the next plan and the button is hidden.
