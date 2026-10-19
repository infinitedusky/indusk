# A component's visible content must be drawn by the component, not passed through an `extra` slot, or its story and the look check will not see it

On 2026-10-17 Sandy compared the `home.default` mockup with the real home page and found the project cards differed, yet `looks check admin --only home.default --all` held (6 held). The page's badges and last-seen line came through `ui/ProjectCard`'s `extra` slot, which the look treats as not part of the component's look. The fix gave `ui/ProjectCard` real props (`shape`, `inProgress`, `lastSeen`), removed `extra`, and gave the component three stories that the mockup places. Sandy: "Do it in this plan."

Why it matters: a story and a mockup can only hold what the component draws itself. Content that a page injects through a slot is invisible to the held look, so the mockup can drift from the page with every check green.

How to apply: when a component's page usage shows visible content arriving through a slot or children that the story does not draw, give the component a prop for it and a story for each state. Record: .indusk/planning/mockups-draw-components-as-stories/impl.md, Build Phase 2.
