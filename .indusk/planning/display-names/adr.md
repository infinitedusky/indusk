---
title: "Display names — promises and plans read as words"
date: 2026-10-09
status: accepted
---

# Display names — promises and plans read as words

## Goal

**The editor names every promise in words and every plan by its title, from one definition in the package that the admin can use too.**

Today the Promises panel shows `a-break-reaches-the-editor` and groups under `vscode-extension`. After this plan it shows "A break reaches the editor" under "VS Code extension", and plan-cockpit can name things the same way without a second rule.

## Y-Statement

**In the context of:**
The Promises panel, which names promises by their kebab-case handle and plans by their folder, and plan-cockpit, the next step, which will name both on the admin's pages.

**Facing:**
A rule for turning a handle into words must exist once (A8), product names must keep their capitals (A2, A3), and the editor must not read plan files itself (A7): it only reads the health line.

**We decided for:**
A package module, `promises/display`, with two pure functions: `promiseWords(name, words)` (first letter capitalised, hyphens as spaces, known product words spelled their way) and `planTitle(title, folder)` (the brief's title up to " — ", else the folder). The product words are a short built-in list extended by `display.words` in `.indusk/config.json`. `healthLine` takes the project's names as an input and puts `title` on each promise and `planTitle` beside its `plan`; `promises health` reads the plan titles and the config once per line. The extension shows `title` and `planTitle`, falling back to the handle when an older CLI sends neither.

**And against:**
A `title` field on every promise (a third name that drifts, 53 files to change; the brief rules it out). Computing words in the extension (a second definition, and the admin would write a third). Reading plan briefs from the extension (the editor would become a second reader of plans).

**To achieve:**
A panel a person reads without decoding handles, and one naming rule the editor and the admin share.

**Accepting:**
A health line a little larger per promise; a built-in word list someone must extend when a product name reads wrong.

**Because:**
The handles are already written as short claims, so most read well once the hyphens go; the brief titles exist for every plan; and the health line is already the editor's only input, so naming belongs on it.

## Context

- [Research](research.md): 111 of 111 briefs have titles; 53 promise names, most reading well as words.
- [Brief](brief.md): three promises; the marker keeps the handle.
- [Test plan](test-plan.md): A1–A10.

## Decision

1. **`apps/indusk-mcp/src/lib/promises/display.ts`**, exported as `@infinitedusky/indusk-mcp/promises/display`: `promiseWords(name: string, words?: Record<string, string>): string` and `planTitle(title: string | undefined, folder: string): string`. Built-in words: `indusk` → InDusk, `fly` → Fly, `jaeger` → Jaeger, `claude` → Claude, `vscode` → VS Code, `otel` → OTel, `mcp` → MCP, `cli` → CLI, `ui` → UI, `api` → API, `adr` → ADR.
2. **`display.words`** in `.indusk/config.json`, a map from the lowercase word to its spelling, merged over the built-in list.
3. **On the health line**: each promise gains `title` (its words) and `planTitle`. `healthLine(registry, reads, now, names?)` takes `{ planTitles, words }`; `promises health` builds them each line from the plan parser and the config.
4. **In the extension**: cards, rows, activity lines and hover headings show `title`; group headings and a card's plan show `planTitle`; the end-of-line marker keeps the handle.
5. **Plan dates (added 2026-10-09 with `a-plan-shows-when-it-shipped`).** `planDates(planDir, changelog)` in the same module reads three facts that exist today: `started`, the brief's `date`; `landed`, the date in the retrospective's `Landed on main at <sha>, <date>.` line; `released`, the version and date of the earliest `## [X.Y.Z] — <date>` changelog section with an entry naming the plan in parentheses, as every entry does (`(vscode-extension)`). They travel on the health line as `planDates` beside `planTitle`, read once per line with the titles. A plan with no landing line has no `landed`; a landed plan in no release has `released: null`, shown as "not released yet". Against: a release ledger the changelog would duplicate, and git history, which a fresh clone has but a published package does not.
6. **A8**: a single-definition pin refuses a function turning a handle into words, or a title into its short form, anywhere under the admin or the extension.

## Alternatives Considered

### A `title` field on promises
A third name beside the handle and the sentence, free to drift from both. Rejected in the brief.

### Words computed in the extension
Fails A8 the day the admin names a promise.

### The extension reads plan briefs
The editor would read plan files beside the line; A7 puts the title on the line instead.

## Consequences

### Positive
- The panel reads as prose; plan-cockpit inherits the rule.

### Negative
- One more input to `healthLine`.

### Risks
- **A product name reads wrong.** Mitigation: `display.words` in the project's config.

## Documentation Plan

### Pages
- Update: `guide/promises-in-your-editor.md` — names in the panel.
- Update: `reference/cli/promises.md` — the line's `title` and `planTitle`.
- Update: the config reference — `display.words`.

### Diagrams
- None.

### Changelog
- Changed: the Promises panel names promises in words and plans by title.

### ADR in Docs
- Yes: `decisions/display-names.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- [vscode-extension](../archive/vscode-extension/adr.md)
