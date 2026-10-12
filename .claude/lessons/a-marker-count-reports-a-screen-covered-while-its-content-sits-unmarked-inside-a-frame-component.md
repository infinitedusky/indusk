# A component-marker coverage count reads a screen covered while the content inside a frame component (Shell, Nav) is drawn by no storied component — a screen is rebuilt only when it has been compared whole against its mockup

**Rule.** Do not call a screen "rebuilt from its mockup" because `indusk looks coverage`, A2/A22/A23-style row tests or the value check read green. Coverage counts `data-component` markers; whatever a page draws *inside* a frame component (the plan page's header, lifecycle and phase bars, "Read from" line, Details section inside `Shell`; the old master-plan tree inside `Nav`) is counted as that frame, so unrebuilt content reads covered. A whole-screen comparison against the approved mockup is the only check that sees it.

**Why.** storybook-components closed Build Phases 5-8 with every row passing and coverage reading "every part covered"; Sandy's side-by-side comparison (Deferred Verification U1, 2026-10-12) found the plan page "looks nothing like" `plan.*`, and the running admin carried parts no mockup draws (breadcrumbs, checkout choice, theme switch, page header, Planning section). The plan page and nav had been *framed* by components, not rebuilt from their mockups. The brief's first expectation (the cockpit looks like its approved mockups) was recorded as not met and the whole-screen comparison was carried to the mockup-matching plan. Companion lesson: `a-value-check-that-says-held-has-not-seen-the-layout`.

**How to apply.**
- A rebuild item names what it compares against, and the comparison (a person's side-by-side at each device, or mockup-matching's machine comparison) is part of closing it, not a later nicety.
- List what the page does that the mockup does not (links, states, controls, breadcrumbs) in the rebuild item; a rebuild that hides a product state (retired promise, skipped/missing step) or drops a link has regressed the page, whatever the mockup shows.
- When a frame component takes children, the children need their own components and stories or the screen's coverage claim is only about the frame.

See `.indusk/planning/storybook-components/impl.md` (Build Phase 8, the U1 pause) and `/decisions/storybook-components`.
