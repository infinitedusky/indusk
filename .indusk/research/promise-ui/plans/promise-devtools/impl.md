# Impl: promise-devtools

## Phase 1: the panel with hand-written checks (about a week)
- Manifest V3 extension: a DevTools page, a Promises panel, a content script, and a script in the page that listens for triggers and runs checks.
- Checks for the three left-nav promises written by hand in the extension.
- Panel: promise list, detail, log. Overlay: hover outlines and failure pins.
- Tests: D1, D2, D3, D4, D6, D7.
- **Stop and review**: is seeing promises live actually useful? If not, stop the plan here.

## Phase 2: Elements sidebar, settling and safety
- Promises sidebar pane in the Elements tab, with the "nothing covers this" state.
- Settle step: wait for DOM changes to stop and routing to finish, plus a short quiet period, before checking. Time out as "timed out", not "broke".
- Read-only checks: run against a frozen view of state; report attempted writes.
- Nothing attached while DevTools is closed.
- Tests: D5, D8, D9, D10, D11, D12, D13.

## Phase 3: the declaration format
- **Your choice**: the format (brief, decisions 1–3). The build stops here for it.
- Promises declare what they cover, their triggers and their checks next to the promise in `.indusk`. The dev server serves them; the extension loads them.
- The agent adds `data-promise` attributes when it builds covered features.
- Replace the hand-written checks with loaded ones.
- Tests: D14, plus re-run D1–D13 against loaded declarations.

## Done when
D1–D14 pass in Chrome against concierge-web's dev server, falsification finds no unfixed break, and the mockup's bug scenarios (stale link, overflow on phones, nav stuck open, stale proof count) are each caught.
