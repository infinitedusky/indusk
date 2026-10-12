---
title: "Storybook components"
date: 2026-10-12
status: accepted
---

# Storybook components

## Goal

**The admin is built from components defined once, each with an approved story per state, and every mockup is composed of those components rather than drawn around them.**

Today the eleven approved admin mockups are whole screens that write a badge out
55 times, the running admin does not look like them, and ten of the nineteen
components they name have no marked implementation at all. After this, a badge
exists once — in the app, in its stories and in every mockup that shows it —
and changing it puts every screen that uses it back in front of a person.

## Y-Statement

**In the context of:**
an app whose look ui-promises holds by value to approved whole-screen mockups, where the next step toward a demo is making the running admin match those mockups and keeping every later screen consistent with them.

**Facing:**
mockups that redraw each component per screen so nothing makes them agree, an admin that implements fewer than half the components its mockups name, a value check that cannot see layout, and Storybook's real limits on this stack — its MCP is preview and needs a running server, its stories do not run inside the Next app, and its only documented visual testing is hosted.

**We decided for:**
Storybook 10.6 with `@storybook/nextjs-vite` in the admin, a CSF story per component per state, each component's one implementation marked by `data-component` in its own file; each story rendered once to a static HTML snapshot that is the component's approved artefact; mockups that place components by name (`<indusk-component name state>`) and are composed from those snapshots before they are linted, shown, hashed and checked; a mockup's approval binding the snapshot hashes of the components it uses; the static Storybook build served by the admin at `/storybook` and framed on the Looks page; and a catalog file the build writes, with the MCP as an optional convenience over it.

**And against:**
mockups that keep drawing components and a lint that compares the drawing with the story (detects, does not compose); framing a live Storybook story inside a mockup (needs script, which the sandboxed frame forbids); an in-app gallery rendering stories in the Next runtime (unsupported); Storybook's webpack framework (deprecated in 11); Ladle or Histoire (lighter, but without the components manifest and agent tooling); and the MCP as the catalog the loop depends on (preview, server-bound).

**To achieve:**
one definition per component across mockups, stories and the app; a changed component that reopens exactly the mockups that use it; a cockpit that shows each story beside its mockups with nothing else running; and an agent that can list what exists before it builds.

**Accepting:**
a render step (stories → snapshots) that must run before a composed mockup can be shown or checked; Storybook's churn (11 is in alpha; the admin pins Next 16.2 until storybookjs#36720 is fixed); a snapshot that is static HTML, so a component's look is approved without its interactions; and the rebuild of every admin screen inside this plan.

**Because:**
the token rule already proves the shape — a mockup uses only what is defined and declares what is new, and an approval binds the hash of what was approved — and the same shape one level up gives reuse by construction instead of by inspection, while a static snapshot keeps mockups self-contained, which is what ui-promises' approval binding requires.

## Context

[research.md](research.md) records the mockups (eleven files, 286 KB, 19
components), the admin (9 of 19 marked), Storybook on Next 16.2 / React 19.2 /
Vitest 4.1, the MCP's status, and why stories do not run in the app.
[brief.md](brief.md) makes five promises and changes three of ui-promises';
[test-plan.md](test-plan.md) holds 29 assertions. ui-promises' ADR
([archive](../archive/ui-promises/adr.md)) set the foundation, the approval
record bound to content hashes, the sandboxed mockup frame, and the value check
this plan builds on.

## Decision

1. **Storybook in the admin, Vite framework.** `storybook@10.6.x` with
   `@storybook/nextjs-vite`, `@storybook/addon-vitest`, and
   `features.componentsManifest: true`; `.storybook/preview.ts` imports the
   admin's `globals.css` (the generated foundation and Tailwind theme). Next is
   pinned at 16.2.x until storybookjs#36720 (`useRouter` under 16.4) is fixed.
   Story tests are a `storybook` project in the admin's `vitest.tiers.ts`,
   listed in the system tier.

2. **A component is one file, marked once.** Each component the mockups name
   lives in `apps/indusk-admin/src/components/ui/<Name>.tsx` (or its area
   folder), its root element carrying `data-component="<name>"`. That marker
   appears in exactly one non-test file; a story imports its component from
   that file. A screen renders components and never carries a component's
   marker itself. `component-reuse-audit.test.ts` grows into this check.

3. **A story per state, rendered to a snapshot.** `<Name>.stories.tsx` (CSF)
   has one story per state the mockups show, named for the state. A render
   step — `indusk looks stories <app>`, a node script composing each story
   with Storybook's portable stories and rendering it to static markup — writes
   `.indusk/mockups/<app>/components/<name>.<state>.html`. The snapshot is the
   story's approved artefact: it is what a person approves, what a mockup is
   composed from, and what the hash binds. A change to the component changes
   its snapshot with no edit to the story.

4. **Mockups compose components by name.** A mockup writes
   `<indusk-component name="badge" state="broken"></indusk-component>` where
   the component appears. Before a mockup is linted, shown, hashed or checked,
   `looks/compose` replaces each reference with the approved snapshot. The lint
   refuses a `data-component` element written directly in a mockup's source
   unless the mockup declares it new (`<meta name="indusk-new-components">`,
   as `indusk-new-tokens` does for tokens), and refuses a reference to a
   component or state with no approved snapshot.

5. **Approval binds the components a mockup uses.** A story is approved like a
   mockup: an entry in the app's `approved.json` with kind `story` and its
   snapshot hash, written only by the cockpit's Approve (the guard hook
   already covers the file). A mockup's entry gains `componentsHash`, the hash
   of the snapshot hashes it composes; a changed snapshot reopens every mockup
   whose `componentsHash` no longer matches, and the status names the
   component.

6. **The cockpit serves Storybook.** `storybook build` runs in the admin's
   build; its output is served by the admin at `/storybook` (copied into the
   bundled admin by `bundle-admin.js`, as `public/` is). The Looks page lists
   components beside screens, frames each story's `iframe.html` at its
   component's own size — a reference device is chosen on request, and sets
   the frame's width — and approves its snapshot. The page has two views: a
   list scrolling beside a stable stage, and a cascade drawing every look one
   after another with Approve beside each. Nothing runs beside the admin.
   *(Amended 2026-10-12 at Sandy's direction while approving Build Phase 5: a
   story framed at each device's full size showed a badge in a blank screen.)*
   *(Amended 2026-10-12, Build Phase 9 falsification: the Looks page frames a
   story from its snapshot, as the checkout the page reads holds it, drawn as
   `mockupDocument` draws a composed mockup — the foundation's tokens, then the
   component's stylesheet — not from the admin's `/storybook` build. Approve
   binds the selected checkout's snapshot and stylesheet hashes; a frame drawn
   from another build — the landed daemon's, or one older than a hand-edited
   snapshot — is not what the hash binds. `/storybook` stays for browsing and
   for `indusk looks check`.)*

7. **The catalog is a file.** The render step writes
   `.indusk/mockups/<app>/components.json` — each component's name, file,
   properties (from Storybook's components manifest) and states with their
   approval — read by an agent before it writes a component; the admin's
   `CLAUDE.md` names it. The Storybook MCP may be added to a session for
   browsing; nothing depends on it.

8. **Coverage and the value check reach components.** Coverage counts each
   component state a mockup shows and reports one with no approved snapshot
   uncovered. `indusk looks check` checks each story in the served Storybook
   against the foundation as it checks a page.

9. **The admin is rebuilt from the components**, screen by screen, so the
   running app is composed as its mockups are. The eleven mockups are rewritten
   to reference components and re-approved by Sandy.

10. **A composed mockup carries its components' styles.** A snapshot is
   markup whose look comes from the app's compiled utility classes, and a
   mockup frame is sandboxed with only the foundation's `tokens.css`, so a
   composed mockup drew its components unstyled. The render step writes
   `.indusk/mockups/<app>/components/<name>.css` for each component, the app's
   compiled rules for exactly the classes that component's snapshots use,
   resolved to the foundation's tokens; `mockupDocument` inlines, after
   `tokens.css`, the stylesheet of each component the mockup names; the value
   check reads each by the rule it reads a mockup's own styles by; and its hash
   joins that component's entry in `componentsHash`, so a changed component
   style reopens the mockups that use it, naming the component, as a changed
   snapshot does. The stylesheet is generated, never written
   by hand, and emitted **unlayered**: a mockup carries its own unlayered
   resets (`button { padding: 0 }`), and an unlayered rule beats every layered
   one whatever its specificity, so Tailwind's `@layer utilities` wrapper made
   the components lose to the mockup around them. The sheet also carries the
   rules the app writes on a component's own marker (`[data-component="x"] p`),
   which name no class and are part of how it draws. A composed component must
   draw as its story does; a browser comparison of the two (A30) holds that,
   not the presence of the rules. *(Added 2026-10-12, found in Build Phase 6 when the eleven composed
   mockups were rewritten: decisions 4 and 6 composed the markup and not the
   look. Sandy asked that it be a visible part of the plan, not a patch.)*

11. **A person can take an approval back.** The cockpit's Unapprove, on an
   approved mockup or story, appends a `{ kind: "withdrawn", subject, name, by,
   at }` entry to the same record; the record stays append-only and its history
   is the git history. A mockup or story reads proposed (never approved, no
   reference to be held to) after its latest withdrawal until a person approves
   it again, and an approval made earlier than a withdrawal never counts. Like
   Approve it is written only by the cockpit's route, through the notes writer,
   and the guard hook refuses an agent's write; `indusk looks unapprove` exists
   only to refuse, naming the cockpit. *(Added 2026-10-12: Sandy approved a
   look by mistake; deleting the entry from the record by hand is what the
   guard exists to stop, and there was no other way back.)*

## Alternatives Considered

### Detect instead of compose
Mockups keep drawing components inline; a lint compares each drawn component
with its story. Rejected: the badge stays written out per screen, so two
mockups can still disagree until a lint notices; composing makes the
disagreement impossible to draw, and it is what lets a changed component reopen
exactly its mockups (A11).

### A live story framed inside the mockup
The mockup frames `/storybook/iframe.html?id=badge--broken` where the badge
sits. Rejected: a story needs script, and the mockup frame is `sandbox=""` so a
mockup cannot post to the approve route; a frame per component also breaks the
mockup's own layout and its hash binds nothing of what it shows.

### An in-app gallery
Stories rendered by a route inside the running admin with its real providers.
Rejected: Storybook documents portable stories for test environments only, its
Next mocks live in its Vite plugin, and the admin has no auth or wallet to fake.

### Storybook's webpack framework (`@storybook/nextjs`)
Rejected: deprecated in 11.0 alpha, removal planned for 12; the Vitest addon
needs a Vite framework.

### Ladle or Histoire
Lighter story runners. Rejected: no components manifest and no agent tooling,
which is half of why the person chose Storybook; the CSF files would carry over
if this is revisited.

### The Storybook MCP as the catalog
Rejected as a dependency: preview, versioned with an 11 that is reworking it,
and answers only while a Storybook server runs. It is offered over the catalog
file, not instead of it.

### Link the app's own stylesheet from the mockup frame
Rejected: the frame is `sandbox=""` and a mockup is hashed as bytes, so a
linked sheet would change what a person approved with nothing reopening it;
inlining a generated, hashed sheet keeps the mockup self-contained.

### One mockup file per component, drawn by hand
Rejected: the approved artefact would be a drawing of the component, not the
component; the snapshot is rendered from the real component, so A6 holds.

## Consequences

### Positive
- A component exists once across the app, its stories and every mockup.
- Changing a component reopens exactly the mockups it appears in.
- The cockpit shows components and screens side by side with nothing else running.
- Every app taken through this leaves a foundation and a component library behind.

### Negative
- A render step sits between a story and a composed mockup; a stale snapshot shows a stale component until it reruns.
- Storybook joins the admin's build and the system tier's dependencies.
- A snapshot is static HTML: interactions are not in what is approved.

### Risks
- **Portable stories do not render to static markup for some component** (a hook needing the browser, a Next module). Mitigation: components stay presentational, data passed as props from the page; a component that cannot snapshot is refused by name and rendered from the browser by the check instead.
- **Storybook breaks on a Next or pnpm change** (storybookjs#36720, #35873). Mitigation: Next pinned at 16.2.x; Build Phase 1 proves the setup before any component moves.
- **Rebuilding eleven screens is larger than a phase.** Mitigation: the rebuild runs screen group by screen group, each its own phase, each held by the value check and lint before the next.

## Documentation Plan

### Pages
- New: `guide/components.md` — components, stories, snapshots, composed mockups, the catalog, with the cockpit as the worked example.
- Update: `reference/cli/looks.md` — `indusk looks stories`, `indusk-component`, `indusk-new-components`, coverage of component states.
- Update: `reference/admin-ui/overview.md` and `component-conventions.md` — the Looks page's components, `/storybook`, one file per component.
- Update: `guide/ui-promises.md` — the series now runs components before matching.

### Diagrams
- Mermaid in `guide/components.md`: mockup → stories → snapshots → composed mockup → approval; a changed component reopening its mockups.

### Changelog
- Added — components and stories: each component the admin's mockups name is implemented once with a story per state; mockups place components by name; a changed component reopens the mockups that use it; Storybook served by the cockpit.

### ADR in Docs
- Yes: `decisions/storybook-components.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- ui-promises: [archive](../archive/ui-promises/)
- [mockup-matching](../mockup-matching/brief.md), [demo-scenarios](../demo-scenarios/brief.md)
- Storybook — Next.js (Vite): https://storybook.js.org/docs/get-started/frameworks/nextjs-vite
- Storybook — portable stories: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest
- Storybook — MCP: https://storybook.js.org/docs/ai/mcp/overview
