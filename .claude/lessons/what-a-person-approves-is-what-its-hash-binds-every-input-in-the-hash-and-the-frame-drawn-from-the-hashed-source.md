# What a person approves must be exactly what its hash binds — every input to the rendered look is in the hash, and the frame draws from the hashed source, never from a second build of it

**Rule:** for anything a person approves by looking at it, (1) list what the look depends on and put each input in the hash the approval binds, and (2) draw the frame the person sees from the very bytes the hash covers — one source per look.

**Why:** storybook-components first framed a story from the admin's served Storybook build (ADR decision 6) while Approve bound the selected checkout's snapshot hash, so a person could approve what they did not see. Falsification then found five more holes of the same family, every one an input to what the person saw that the hash did not cover: the component's stylesheet, the standing of the stories a mockup composes, the frame's source, CSS freshness of the build, and an optional `componentsHash`. The fix bound `stylesheetHash` beside `snapshotHash`, made a mockup read proposed while any story it composes is not approved, drew the frame from the checkout's snapshot, and made `componentsHash` required.

**How to apply:**
- At the ADR, before any code, ask: "what does this look depend on, and is each in the hash?" Write the list into the decision. Five of six falsification findings would have been found there.
- The frame and the hash must read one file. If the page can show a second build of the same thing (a dev server, a served bundle), it will, and the approval will bind something the person did not see.
- A hash input a request may omit is not bound: make it required and refuse the request without it.

See `.indusk/planning/storybook-components/adr.md` decisions 5, 6 and 10, and `apps/indusk-mcp/src/lib/looks/CLAUDE.md`.
