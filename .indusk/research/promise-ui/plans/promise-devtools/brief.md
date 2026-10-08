# Brief: promise-devtools

A browser DevTools extension that runs a page's promises against the live UI while you use it. It shows which held and which broke, outlines what each promise covers, and pins failures to the element that broke.

Mockup: `../../mockups/promise-devtools.html`

## Promises

1. **promises-run-while-you-click**: with DevTools open on a dev build, each promise's check runs when its trigger fires, and the result appears in the Promises panel within a second.
2. **hover-shows-coverage**: hovering a promise outlines every element it covers on the page; hovering a log row outlines the element that check looked at.
3. **failures-point-at-the-element**: a failed check records expected and actual values, pins a marker to the offending element, and offers "Reveal in Elements".
4. **every-element-says-what-covers-it**: selecting an element in the Elements tab shows the promises covering it in a sidebar pane, or says that nothing covers it.
5. **checks-never-change-the-page**: a check can read the page and app state but can't change either; a check that tries is reported as broken, not run.
6. **no-false-alarms-while-rendering**: checks wait for the page to settle after a trigger, so a slow render doesn't count as a failure.
7. **costs-nothing-when-closed**: with DevTools closed, the extension adds no listeners and runs no checks.

## Builds on

- plan-cockpit: promise pages (the target of "Start a fix plan") and the promise reader.

## Out of scope

- Production results in the panel. That needs the eval backend and is a follow-up plan.
- Firefox and Safari. Chromium browsers only (Chrome, Edge, Brave, Arc).
- Writing checks in the UI.

## Decisions to make (the decision stage)

1. **How a promise names what it covers.** Recommended: `data-promise="<id>"` attributes added by the agent when it builds a feature, with CSS selectors as a fallback. Class-name selectors break on refactors.
2. **How checks see app state.** Recommended: a small dev-only hook the app exposes (like React DevTools' global hook) with read-only getters.
3. **Where the declaration format lives.** Recommended: next to the promise in `.indusk`, extending what plan-cockpit reads, so both plans share one source.

## Cheap first step

Phase 1 hand-writes the checks for the three left-nav promises, so the panel, overlay and sidebar can be tried before the format is designed.
