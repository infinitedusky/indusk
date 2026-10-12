---
title: "Storybook components"
date: 2026-10-12
status: complete
workflow: feature
---

# Storybook components — Research

## Question

How does the admin go from eleven approved whole-screen mockups to components
defined once, each with a story per state, the screens rebuilt from them so the
running app matches its mockups — and how is that held, so the next mockup and
the next screen reuse what exists instead of redrawing it?

## Background

ui-promises (closed 2026-10-11, [archive](../archive/ui-promises/)) holds the
admin's look by value: every colour, size, radius, font and timing comes from
one approved DTCG foundation, and a changed token shows broken on the
dashboard. It does not hold layout or structure. After it closed, Sandy
observed that **the running admin does not look like its approved mockups**:
Build Phase 5 restyled the existing components onto the foundation's tokens;
it did not rebuild the screens to the redrawn designs. A value check says held
for an app built wholly from the right tokens that looks nothing like its
mockup (ui-promises' lesson `a-value-check-that-says-held-has-not-seen-the-layout`).

The conversation (Sandy, 2026-10-11) settled the model this plan builds:

- **Mockups are evaluated and approved**; they carry more than looks — layout,
  which parts are components, the states.
- **Stories break a mockup apart into composable blocks**, a component per
  state.
- **Implementation is built from those components**; one component is reused
  everywhere it appears, which is what makes the design consistent.
- **Implementation is validated against the mockups** — the validator is
  [mockup-matching](../mockup-matching/brief.md), the next plan.
- **Future mockups are composed of the components**, and declare any new one —
  the token rule ("a mockup uses only defined tokens; a new one is declared")
  one level up.
- A side effect Sandy named: every app that goes through this ends with a
  design system — a foundation and approved components — without anyone
  setting out to build one.

The series is now four plans (master reordered 2026-10-11): ui-promises
(done) → **storybook-components** → mockup-matching → demo-scenarios → the
demo. Sandy chose "do it right" over a demo-path shortcut, and Storybook first
over a CSF-without-Storybook start.

## Findings

### The mockups today

`.indusk/mockups/admin/screens/` holds eleven files (nav ×2, dashboard ×2,
promise ×2, plan ×3, looks ×2), 286 KB in all (~26 KB each), generated once
from one stylesheet so the components agree. Each is a whole screen: a
component's markup is written out wherever it appears. `data-component`
occurrences across the eleven:

| component | uses | component | uses |
|---|---|---|---|
| plan-row | 55 | stat | 8 |
| badge | 55 | button | 8 |
| view-link | 22 | box | 7 |
| step | 18 | rail-group | 6 |
| chip | 17 | promise-row | 6 |
| shell | 11 | look-row | 5 |
| nav | 11 | decision-card | 4 |
| tag | 9 | timeline | 2 |
| | | summary-bar, device-frame, device-choice | 1 each |

Nineteen components; nothing makes the eleven screens share one badge.

### The admin today

- 67 non-test `.tsx` files; the largest are `PlanList.tsx` (459 lines),
  `Promises.tsx` (385), `SessionPanel.tsx` (365), `PlanDetail.tsx` (352),
  `looks/Looks.tsx` (333).
- Primitives live in `src/components/ui/`: `Badge`, `Button`, `CollapsibleSection`,
  `CopyButton`, `FullscreenDiagram`, `Sidebar`, `Table`.
- **Only 9 of the 19 mockup components carry a `data-component` in the admin's
  source** (view-link, shell, nav, look-row, device-frame, device-choice,
  decision-card, chip, button). The other ten — plan-row, badge, step, tag,
  stat, box, rail-group, promise-row, timeline, summary-bar — have no marked
  implementation. `indusk looks coverage admin` still reads "every part
  covered" because coverage asks the other direction: every component the app
  *renders* has an approved mockup, not every component a mockup *names* has an
  implementation.
- `src/__tests__/component-reuse-audit.test.ts` (T16 of an earlier plan) is a
  grep that refuses a raw `<button className=` or `<table className=` outside
  `components/ui/` when a primitive exists — the seed of a one-implementation
  rule, by pattern, for two elements.
- No in-app gallery exists. It was proposed in conversation as a place stories
  render with the app's real providers; see "Rendering stories inside the app"
  below.
- Stack: `next` 16.2.4, `react` 19.2.4, Tailwind 4 through
  `@tailwindcss/postcss` (object-form `postcss.config.mjs`), `vitest` 4.1 with
  `@vitest/browser` (Playwright). The admin's tests are split in
  `vitest.tiers.ts` into a node project, a browser project and the system tier.

### Storybook against this stack

From the official docs, npm and the GitHub tracker (2026-10-11):

- **Latest stable is 10.6.1** (2026-09-29); 11.0 is in alpha.
- **The framework is `@storybook/nextjs-vite`.** Its peers accept Next ^14.1 ||
  ^15 || ^16 and React 19. The webpack framework `@storybook/nextjs` is
  deprecated in 11 alpha (removal planned for 12) — do not start on it.
- **Next's modules are stubbed**: `next/navigation` and `next/router`
  automatically (App Router with `parameters.nextjs.appDirectory: true`,
  per-story overrides in `nextjs.navigation`); `next/font/google` works,
  `next/font/local` needs `src`. Server components are experimental
  (`features.experimentalRSC`, async components under Suspense); Server
  Actions are unsupported and pages importing Node-only modules break the Vite
  build — keep components presentational and pages as thin wrappers, which is
  Storybook's own guidance for page stories.
- **Tailwind 4**: import the global CSS in `.storybook/preview`. The admin's
  object-form PostCSS config is the form Vite accepts (the array form is
  rejected, storybookjs#31373). Classes used only in story files may need an
  `@source` — community report, unverified.
- **Open issues that touch this repo**: #36720 `useRouter()` throws under Next
  **16.4** (the admin is on 16.2.4 — it blocks an upgrade, not this plan; a
  workaround is posted); #35873 strict-pnpm `styled-jsx` resolution error on
  every start (matches this monorepo); #35871 `next/image` stories crash
  (likely two React copies).
- **Tests**: `@storybook/addon-vitest` runs each story as a Vitest browser test,
  added as a separate `storybook` entry in `test.projects` with
  `storybookTest()`; peers accept Vitest ^4 and `@vitest/browser-playwright`
  ^4. It needs a Vite framework (so `nextjs-vite`). It does not do snapshots.
  The old test-runner is "superseded by the Vitest addon".
- **Visual tests**: Storybook documents only Chromatic, which is hosted and
  excluded by the lock-in rule. The self-hosted route is Vitest 4's
  `toMatchScreenshot` inside the Storybook project (undocumented by Storybook;
  the third-party `storybook-addon-vrt` does it per story). That is
  mockup-matching's ground, not this plan's.
- **Portable stories** (`composeStories`, from `@storybook/nextjs-vite`) render
  stories in Vitest outside Storybook; the docs recommend the Vitest addon
  over them now.

### Storybook MCP

- **Preview** ("the API may change"); since 10.6.0 versioned with Storybook.
- Tools: development (`stories-changed`, `get-storybook-story-instructions`,
  `stories-preview`, `stories-find-by-component`, `review-create`), docs
  (`docs-list`, `docs-show`, `docs-show-story`), testing (`test-run`).
- The docs tools need the **components manifest** (`features:
  { componentsManifest: true }`), which supports `nextjs` and `nextjs-vite`.
- Connects over HTTP at `http://localhost:6006/mcp` and **needs the dev server
  running**. The 11 alpha reworks the skills so they no longer need the addon.
- Storybook's recommended agent rule: list components and read the relevant
  one before using it; use only documented props; fetch the story instructions
  before writing a story; run `test-run` after.

### Rendering stories inside the app

Not documented: Storybook's Next mocks are wired through its Vite plugin, and
`composeStories` is described for test environments only. An in-app gallery
route rendering CSF stories inside the running Next app is a risk, not a
supported path. The admin has few providers to fake (no auth, no wallet; its
data comes from the package's readers on the server), so the fidelity argument
for an in-app gallery is weaker here than for an app like the wallet example.

### How others map design components to code

- **Figma Code Connect** maps a design-library component to its code
  implementation (file path, props, variants), and feeds that mapping to agents
  through Figma's MCP so generated code uses the mapped component.
- **Builder.io** moved from hand-mapping design components to code components
  to automatic **component indexing** — evidence that the agent should propose
  the mapping and a person correct it, not draw it by hand.
- No open-source tool was found that flags one-off components in React code;
  commercial ones exist (Buoy). A reuse check here is ours: a static scan plus
  the rendered check.

## Decisions

- **Storybook first, in this plan** (Sandy, 2026-10-11): "let's just do it
  right" — Storybook before the validator, the scenarios and the demo; the
  admin's screens are rebuilt to their mockups inside this plan.
- **Stories in CSF** (conversation, 2026-10-11): the open story format, so a
  story is a file any tool can read.
- **The token rule one level up** (Sandy, 2026-10-11): a future mockup composes
  approved components and declares any new one.
- **The validator is mockup-matching's**, not this plan's: this plan produces
  the components, the stories and the rebuilt screens it will hold.
- **The design system is a side effect, not a goal** (Sandy, 2026-10-11) — no
  separate design-system deliverable.

## Open Questions

- **How does a mockup reference a component?** A custom element
  (`<x-component name="badge" state="broken">`) the cockpit resolves to the
  story's render, or `data-component` regions whose markup the lint checks
  against the component's story. The first composes; the second only detects.
- **Where do approved stories render in the cockpit?** A built Storybook
  (`storybook build`, static) served beside the admin and framed on the Looks
  page, or the Storybook dev server. A static build needs no running server.
- **Does an agent's catalog need the live MCP**, or is the components manifest
  (a JSON file the build writes) enough to read before building? The MCP is
  preview and needs a dev server; the manifest is a file.
- **Do story tests join the slow tier?** They start a browser
  (`everyday-tests-never-wait`); the admin already runs browser-project tests
  in its everyday suite, so the line needs drawing.
- **One mockup per component, or components cut from screen mockups?** The
  approved artefact today is the screen; a component's reference could be its
  region of an approved screen, or its own mockup file.
- **Pin Next at 16.2.x** until storybookjs#36720 is fixed?

## Sources

- Storybook — Next.js (Vite) framework: https://storybook.js.org/docs/get-started/frameworks/nextjs-vite
- Storybook — Vitest addon: https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
- Storybook — portable stories: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest
- Storybook — visual testing: https://storybook.js.org/docs/writing-tests/visual-testing
- Storybook — test-runner: https://storybook.js.org/docs/writing-tests/integrations/test-runner
- Storybook — MCP overview: https://storybook.js.org/docs/ai/mcp/overview
- Storybook — AI: https://storybook.js.org/docs/ai
- Storybook — Tailwind recipe: https://storybook.js.org/recipes/tailwindcss
- Storybook — build pages: https://storybook.js.org/docs/writing-stories/build-pages-with-storybook
- Storybook — decorators: https://storybook.js.org/docs/writing-stories/decorators
- Storybook — mocking modules: https://storybook.js.org/docs/writing-stories/mocking-data-and-modules/mocking-modules
- Releases: https://github.com/storybookjs/storybook/releases
- Issues: storybookjs#36720, #35873, #35871, #31373
- storybook-addon-vrt: https://storybook.js.org/addons/storybook-addon-vrt
- Vitest 4: https://main.vitest.dev/blog/vitest-4
- Figma Code Connect: https://developers.figma.com/docs/code-connect
- Builder.io component indexing: https://www.builder.io/c/docs/cli-mapping
