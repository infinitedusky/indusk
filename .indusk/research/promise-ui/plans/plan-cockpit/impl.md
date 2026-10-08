# Impl: plan-cockpit

Tests are written first in each phase and fail until the phase makes them pass.

## Phase 1: read the project
- A reader that turns the `.indusk` folder (or the API, per open question 1) into plans, Paths, stages, promises and tests.
- Fixture project for tests: the ten sample plans and three Paths from the mockup.
- Tests: C1, C3, C4, C5, C14.

## Phase 2: nav and plan pages
- Shell: sidebar with Needs you, Promises and the Paths tree; collapse on desktop; drawer on phones.
- Plan page: header with Path breadcrumb, Planning and Release lists, stage detail.
- Tests: C2, C6, C7, C8, C9, C10.

## Phase 3: decisions
- The decision card: accept, reject (opens a reply with the choice filled in), "Maybe…".
- Answers written back to the agent; history shown under "What happened".
- **Your choice**: how answers reach the agent (open question 4). The build stops here if it's still open.
- Tests: C11, C12, C13.

## Phase 4: promises
- Dashboard with grouping, sorting and filter; promise pages with tests, triggers, chart and history.
- Broken promises counted in the nav and sorted first; "Start a fix plan".
- Tests: C15–C22.

## Done when
All of C1–C22 pass (or C21 is deferred with its reason), falsification finds no unfixed break, and the mockup's flows all work against a real project.
