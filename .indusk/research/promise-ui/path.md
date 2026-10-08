# Path: promise-ui

Make promises visible: first where plans are run, then in the running product.

| # | Plan | Depends on | Delivers |
|---|------|------------|----------|
| 1 | plan-cockpit | — | Paths nav, Planning and Release workflows per plan, promise dashboard, promise pages |
| 2 | promise-devtools | plan-cockpit (promise pages, promise data reader) | DevTools panel that runs promise checks against the live page, highlights coverage and pins failures |

## Why this order

- The extension's failure flow ends on a promise page, which the cockpit builds.
- Both read the same promise declarations. The cockpit plan defines how they're read. The DevTools plan adds the UI fields (what a promise covers, its triggers and its checks).
- The cockpit is useful alone. The extension isn't useful until promises declare what they cover.
