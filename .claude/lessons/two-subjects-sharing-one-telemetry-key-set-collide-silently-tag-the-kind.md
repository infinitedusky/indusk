# Two kinds of subject reporting through one telemetry key set collide silently — give the second kind its own attribute the day it starts reporting, and let absence mean the first kind

**Rule:** when a second kind of subject starts reporting through spans (or any record) keyed by the same fields as the first, add a kind attribute in the same change, and read a record without it as the original kind.

**Why:** storybook-components checked each story and each screen with the same four keys (`app`, `screen`, `state`, `device`). The admin has a `nav` screen and a `nav` component whose states are both `expanded` and `collapsed`, so a held `story nav.expanded @ phone` could stand for a broken `screen nav.expanded @ phone` — the dashboard and the nav's broken count would read held while a screen was broken. Nothing failed; the readers matched on the shared keys and the newest run won. The plan's audit found it, not a test. The fix was `indusk.look.kind = story` on a story's span, carried by the run reader, and `newestRunSince` counts only runs of the look's own kind.

**How to apply:**
- Before adding a second subject to an existing report, list the fields the reader matches on and ask whether the two subjects can share all of them. If they can, add the discriminator now.
- Absence of the attribute is a rule (the original kind), so no recorded run needs rewriting. The cost to name: runs recorded for the new subject before the attribute existed read as the original kind until they age out of the read window.
- A row proving it must put a held run of one kind beside a broken run of the other and assert the standing (A41 in storybook-components: `look-standing.test.ts`).

See `.indusk/planning/storybook-components/audit.md` ("What does the diff change that no row touches?") and `apps/indusk-mcp/src/lib/looks/CLAUDE.md`.
