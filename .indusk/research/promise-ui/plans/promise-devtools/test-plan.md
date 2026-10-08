# Test plan: promise-devtools

Levels: unit (functions), contract (extension loaded in Chromium against a fixture page, driven by Playwright), e2e (against concierge-web's dev server).

| ID | Promise | Assertion | Level |
|----|---------|-----------|-------|
| D1 | promises-run-while-you-click | Clicking a covered plan link runs one-click-away and logs "held" | contract |
| D2 | promises-run-while-you-click | Resizing across 600 px runs the-nav-fits-a-phone | contract |
| D3 | promises-run-while-you-click | A result appears in the panel within 1 s of the trigger | contract |
| D4 | hover-shows-coverage | Hovering a promise draws one outline per covered element, aligned within 2 px | contract |
| D5 | hover-shows-coverage | Outlines follow the page through scrolling and resizing | contract |
| D6 | failures-point-at-the-element | A stale plan link fails one-click-away with expected and actual titles | contract |
| D7 | failures-point-at-the-element | The failure pin sits on the failing element; "Reveal in Elements" selects it | contract |
| D8 | every-element-says-what-covers-it | The sidebar pane lists covering promises for a selected element | contract |
| D9 | every-element-says-what-covers-it | An uncovered element shows "No promise covers this element" | contract |
| D10 | checks-never-change-the-page | A check that writes to the DOM is stopped and reported, and the DOM is unchanged | unit |
| D11 | no-false-alarms-while-rendering | A route that renders after 400 ms still passes | contract |
| D12 | no-false-alarms-while-rendering | A page that never settles reports "timed out", not "broke" | unit |
| D13 | costs-nothing-when-closed | With DevTools closed, no listeners are added to the page | contract |
| D14 | promises-run-while-you-click | Declarations load from `.indusk` via the dev server | e2e |

## Deferred, with reasons

- D14 waits for phase 3, because phase 1 uses hand-written checks on purpose (see brief, "Cheap first step").
