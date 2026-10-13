# A page draws what its approved mockup draws and nothing else — a section the mockup lacks is removed, not kept beside it

When a plan adds or redraws a screen, the built page is held to its approved mockup in both directions: everything the mockup shows must be on the page, and nothing the mockup does not show may remain. Adding the new parts above or below an existing page's old sections (stage strip, phases, document sections) passes the value check and the tests, but the person who reviews the live page sees content nobody approved.

Why: found by Sandy watching the live check (A17) of brief-as-the-contract on 2026-10-13: "there shouldn't be stuff there that isn't in the mockup". Build Phase 4 had drawn the plan page's new parts and left `PlanDetail`'s old sections beneath them. The `looks check` by value only verifies approved looks hold; it does not see extra markup around them.

How to apply: when building a page for an approved mockup, diff the page's sections against the mockup's, remove what the mockup omits, and change the tests that asserted the removed sections in the same item. If a section is still wanted, it goes into the mockup and is approved first (admin CLAUDE.md: a new screen, state or component needs its mockup approved first). See `.indusk/planning/brief-as-the-contract/impl.md` Build Phase 4 and `/decisions/ui-promises`.
