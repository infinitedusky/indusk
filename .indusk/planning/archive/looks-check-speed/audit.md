---
plan: looks-check-speed
audited: 2026-10-16
model: claude-opus-5-5
---

# Looks check speed — Audit

A reader who did not build the plan, over the approved impl, the trajectory as
it stands, and the diff from `667151d6a`. Each finding is a scenario unless it
says it was observed: "nothing prevents" means the code allows it, not that it
has happened.

## Does each row prove its promise's sentence, or something narrower?

- .indusk/planning/looks-check-speed/impl.md:69 — A4, the trajectory row saying a look last broken or unchecked is reopened, is proven only on `reuseOf` with a hand-made record whose state is `broken`; `keepHeld` never writes such a record, it deletes the look. The real path, a look held at five device × scheme pairs and broken or unchecked at the sixth being dropped rather than kept, has no test (`check-run.test.ts` has no broken or partial case). Narrower.
- .indusk/planning/looks-check-speed/impl.md:71 — A6, the row saying a page-code edit reopens every screen and no story, is proven on `reuseOf` without a served build. In a real run the served-build judgement (`reuse.ts:203`) reopens every story after a page-code edit, because the sources hash moved and a Storybook build that does not import page code is byte-identical, so it reads as "served build not rebuilt". `reuse.test.ts:341-342` encodes exactly that: a page-code edit with an unchanged build reopens the story. The row's sentence does not hold end to end.
- .indusk/planning/looks-check-speed/impl.md:75 — A10, the contract row "a second run requests no page", still says "requests no page" while its test now expects one request for the app's root (`["/"]`). The test proves "requests only the root"; the row text was left stale on purpose (Build Phase 3 note) and should be corrected.
- .indusk/planning/looks-check-speed/impl.md:84 — A19, the row saying a changed foundation reopens every look, proves the foundation half of `tokens-are-held-exactly`'s must-not-break sentence ("reusing a result must never hide a token change"). It does not cover a change to the checker itself (the measured properties, the verdict): a release that starts measuring a property no earlier run measured is reused past on every look until `--all`. Narrower than the sentence.
- .indusk/planning/looks-check-speed/impl.md:77 — A12, the row saying in-place measuring reads what a fresh load does, covers a CSS colour transition and a pixel-ratio media query. A page that reads its viewport or scheme once on mount in script, with no listener, is not covered; the ADR names this risk and its mitigation is only these two CSS cases. Narrower.
- .indusk/planning/looks-check-speed/impl.md:88 — A27, the full-check row ("holds every look"), passes with about 40 looks unchecked; it proves no measured look is broken, not that every look holds. Already carried to `looks-as-promises` ("Carried here": the 57-second floor), nothing new to move.

## What does the diff change that no row touches?

- apps/indusk-mcp/src/lib/looks/check.ts:1012 — `keepHeld` records a look opened against a server judged "served build not rebuilt" as held, with that stale build; the next run against the same server reuses it. No row covers what is kept after a stale-server run (the served-build tests have no trajectory row at all).
- apps/indusk-mcp/src/lib/looks/check.ts:943 — `planReuse` rewrites the recorded build of every reused look to the build served now (`rebuilt`), including when that build is stale. No row.
- apps/indusk-mcp/src/lib/looks/check.ts:996 — `keepHeld` writes the whole record it read at the start of the run; a concurrent check of the same project (another worktree, another URL) that removed a look in between has the removal overwritten. No row.
- apps/indusk-mcp/src/lib/looks/check.ts:770 — the root read uses a plain `fetch` with no timeout; a server that accepts the connection and never answers hangs the check before any look opens. No row, and it contradicts the clause "a slow look never ends the run" in spirit.
- apps/indusk-mcp/src/lib/looks/check.ts:793 — the build and dev-server read go to the origin's `/`, not the base URL's path; a base URL with a path reads another page. No row.
- apps/indusk-mcp/src/lib/looks/mockups.ts:531 — `configHashOf` (Tailwind/PostCSS config, `.storybook`, lockfile) and `mockups.ts:499` `servedBuildOf` are tested in `reuse.test.ts` but carry no trajectory row.
- apps/indusk-mcp/src/lib/looks/check.ts:616 — screens three at a time and the seeded-after ordering have no row.

## What does the code do that the brief never promised?

- apps/indusk-mcp/src/lib/looks/check.ts:793 — every run with a look to consider, including one that reuses everything, makes a plain HTTP request to the app's root; the brief's clause is that an unchanged look is reported "without a browser opening it", which still holds, but the server is always asked.
- apps/indusk-mcp/src/lib/looks/mockups.ts:531 — a lockfile change reopens every look; the brief lists snapshot, foundation, declarations and devices.
- apps/indusk-mcp/src/lib/looks/reuse.ts:197 — a look whose every input is unchanged is reopened when the server was rebuilt from the same sources ("served build"), or when the sources changed and the server was not ("served build not rebuilt"); the brief's clause says such a look is not reopened.
- apps/indusk-mcp/src/lib/looks/check.ts:974 — notices for an unreadable build and for stories not rendered from the current sources.

## Which rejected ADR alternative does the code quietly take?

- apps/indusk-mcp/src/lib/looks/reuse.ts:203 — "Hashing all of the app's sources into every look" (rejected: any edit reopens everything). The served-build judgement compares the all-sources hash for every look, so an edit whose rebuild leaves the root page's or the Storybook frame's assets unchanged (page code for stories; a script-only edit to a component not on `/` for screens) reopens every look of that kind. The ADR's amendment rejected the build identity in the key but this reintroduces the all-sources dependency outside it.
- apps/indusk-mcp/src/lib/looks/mockups.ts:499 — "Fingerprinting what each page loaded" is taken for the build identity (script and stylesheet URLs of the root page), declared in the Build Phase 3 amendment; not quiet, recorded here for completeness.

## Which skip reason would you not accept?

- .indusk/planning/looks-check-speed/impl.md:597 — the served-build and configuration work ships its tests with "no trajectory row"; both decide whether a look is reported held without opening it, which is the plan's strong-tier risk. They should be rows.
- .indusk/planning/looks-check-speed/impl.md:597 — leaving A10's Asserts text reading "requests no page" while its test expects a request: a row whose sentence and test disagree misleads every later reader.
- The two timing rows (A22 under 15 s after one component, A23 under 60 s for `--all`) skipped as information: accepted; the floor is carried to `looks-as-promises`.

## What else would have to change for each promise to hold?

- `tokens-are-held-exactly` — apps/indusk-mcp/src/lib/looks/check.ts:1012 — a look opened against a server still serving the build from before an edit must not be kept as held, or it is reused, held, until the server is rebuilt, though its change was never measured.
- `tokens-are-held-exactly` — apps/indusk-mcp/src/lib/looks/component-styles.ts:307 — a story's key holds its class slice and nothing else: element and universal rules (`a`, `h2`, `*`) and the `_base.css` body rules are in no story's key, so a change to them is reused past on every story (screens reopen on it as page code). `indusk looks lint` refusing raw values in `globals.css` lowers but does not close this.
- `tokens-are-held-exactly` — apps/indusk-mcp/src/lib/looks/reuse.ts:26 — the key has no checker identity; a change to `MEASURED_PROPERTIES` or the verdict is reused past.
- `tokens-are-held-exactly` — apps/indusk-mcp/src/lib/looks/check.ts:541 — a page that reads the viewport or scheme once on mount is measured in place at the first device's drawing; nothing prevents a raw value drawn only at mount at another device from being reported held. Not observed in the admin (its `matchMedia` uses have listeners; `readBounds` reads sizes once but only for the nav's width).
- `a-look-check-costs-what-changed` — apps/indusk-mcp/src/lib/looks/dev-server.ts:20 — a marker anywhere in the HTML refuses, and a Next page carries its rendered data in inline scripts, so a production page whose content mentions `react-refresh` or `hmr-client` (this plan's own documents do) is refused. Markers belong in asset URLs.
- `a-look-check-costs-what-changed` — apps/indusk-mcp/src/lib/looks/check.ts:770 — the root read needs a timeout.
- `a-look-check-costs-what-changed` — .indusk/planning/looks-check-speed/adr.md:70 — the Accepting paragraph should name code outside `sources` that the app imports (the admin reads `@infinitedusky/indusk-mcp`'s parsers) as outside every key, like the data it shapes.
- `everyday-tests-never-wait` — nothing.
