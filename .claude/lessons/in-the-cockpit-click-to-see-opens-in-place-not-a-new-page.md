# In the cockpit, "click it to see it" means the content opens in place under the row — never a link to another page

When the person says a thing on a cockpit page should be clickable "to see" or "to read" it, the row is a disclosure that opens to the content on the same page, one click, with the page still there. Do not turn each row into a link to its own page, and do not add a route for it.

Why: in brief-as-the-contract (2026-10-13) Sandy said of the plan page's documents "click on any of them and see them"; the agent drew link rows opening `/doc/[doc]`, and Sandy corrected: "I thought that those documents we would just open it up and you would be able to read them". It cost a mockup, an approval, a built route and a redraw. It is the same rule as her UI principle (names and state first; detail one click at a time) read at the interaction level: the detail appears where the name is.

How to apply: draw the row as a disclosure (the `part-section` / `history-panel` pattern) whose open state shows the content rendered through `<Markdown>`; if the content is long, still open in place. Only navigate to another page when the person asks for a page. See `.indusk/planning/brief-as-the-contract/impl.md` Build Phase 4 (Documents) and `/decisions/ui-promises`.
