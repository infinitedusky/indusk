---
title: "Display names — Research"
date: 2026-10-09
status: complete
workflow: feature
---

# Display names — Research

## Question

How should the editor (and later the admin) name promises and plans so a person reads them as words, not as kebab-case handles?

## Background

After vscode-extension landed, Sandy read the Promises panel and asked for "a descriptive title, not just the handle" for promises and plans (2026-10-09). The panel shows `a-break-reaches-the-editor` and plan groups headed `vscode-extension`.

## Findings

### Plans already have titles

- Every brief carries `title:` in its frontmatter: 111 of 111 briefs, active and archived.
- The package's plan parser reads it (`apps/indusk-mcp/src/lib/plan-parser.ts`, `title` on each plan).
- Titles are long: the five longest run 79–97 characters, e.g. "Plan authoring from the admin — plan, build, review and release, through your own Claude Code". Most follow the shape "Short name — what it does"; the part before the dash reads as a name.
- The health line names each promise's owning plan by folder (`plan`), not its title.

### Promises have a name and a sentence, no title

- 53 promises in dusk's registry. Each has a kebab-case name and a one-sentence statement.
- The names are written as short claims, so most read well as words: `a-break-reaches-the-editor` → "A break reaches the editor"; `every-commit-evaluated` → "Every commit evaluated".
- A few lose a capital: `a-fly-deploy-is-one-command` → "A fly deploy…" (Fly), `indusk-leaves-main-clean` → "Indusk leaves…" (InDusk), `dusk-installs-its-own-build` → "Dusk…" (dusk is lowercase by convention).

## Decisions

- **No new `title` field on promises** (proposed by Claude, agreed by Sandy 2026-10-09): it would be a third name beside the handle and the sentence, free to drift from both, and would change 53 files and the declare/change/replace commands. Revisit only if names read as words turn out wrong too often.
- **Plans use their brief's title**, cut at the first " — " for the short form.
- **A small plan of its own, before plan-cockpit** (Sandy, 2026-10-09: "land it and do the small follow up"), so the admin's pages can use the same names.

## Open Questions

- Whether the end-of-line marker keeps the handle (it sits beside the token that spells it) or shows words too.
- How product names keep their capitals: a short list in config, or the project's own.

## Sources

- `.indusk/planning/archive/vscode-extension/` — the panel this changes.
- `apps/indusk-mcp/src/lib/plan-parser.ts`, `apps/indusk-mcp/src/lib/promises/health-line.ts`.
