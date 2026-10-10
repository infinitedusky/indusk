---
title: "display-names"
date: 2026-10-10
---

# display-names — Retrospective

## What We Set Out to Do

The editor showed promises by their kebab-case handles and plans by their folder names, with no sense of when anything happened. The brief promised that promises read as words (`a-promise-reads-as-words`), plans by their brief's title (`a-plan-reads-by-its-title`), each plan with when it started, landed and which release shipped it (`a-plan-shows-when-it-shipped`), all worked out once in the package (`display-names-are-defined-once`) and carried on the health line so the editor never names anything itself. It is the module plan-cockpit is to reuse.

## What Actually Happened

Shipped across a test phase and five build phases: two planned, a falsification phase (Build Phase 3), a cleanup phase (Build Phase 4) and a phase the audit produced (Build Phase 5). 30 commits; 26 files outside `.indusk/` (+1,035/−28); 17 trajectory rows passing, A10 a live check in real VS Code.

- **`lib/promises/display.ts`**: `promiseWords` (hyphens to words, product names spelled their way, `display.words` in config), `planTitle` (the brief's title up to " — ", else the folder), `planDates`, and `readHealthNames`, built once per health line and carried on it as `title`, `planTitle`, `planDates`.
- **The editor** (`core/panel`, `panel-html`, `activity`, `hover`) shows the words and titles with handles as fallback, and each plan group's "started …, landed …, released X.Y.Z (date)" or "not released yet"; the marker keeps the handle.
- **A10, live**: 19 plan groups titled (16 from briefs), all dated; 71 of 71 cards and rows in words.

## Getting to Done

- **Falsification measured instead of guessing.** Run against this repository's 111 archived plans, `planDates` read 80 as never landed: their retrospectives predate the "Landed on main at" line (written from 2026-09-18), and the release lookup ran only for landed plans. A plan with no brief (spikes, parents) had no start date. Both fixed (A14, A15); never-landed fell to 17.
- **The cleanup** moved `display.ts` off a private frontmatter regex onto `gray-matter`, the YAML reader the plan page's parser uses; every title and date across 124 plans was dumped before and after: 0 differences.
- **The audit found the biggest gap.** 79 of 94 landed plans still read "not released yet": a release was found only when a changelog entry named the plan as `(plan-name)`, and only 52 of 347 entries are written that way; the tests passed because their fixture used that exact form. Build Phase 5 reads the release from the trunk's `chore(release):` commits — the first after the plan's landing — and made the landing date one function shared with `after-close.ts`'s `closedAt`, which had its own copy (A16, A17).
- **A false fact surfaced in the measurement itself.** With release commits as the source, every plan older than the first such commit (1.36.1) read "released 1.36.1" — the earliest release on record, not the one that shipped it. Fixed as discovered work: when the commits cannot place a release and the changelog records older ones, the changelog's history decides (`dawn-verify` 1.36.0, `cleanup-ritual` 1.32.0). 94 of 94 landed plans now show a release.

- **The everyday suite at landing caught one more**: `display.ts`'s product words spelled `"ADR"` inline, which `lifecycle-single-definition.test.ts` A26 forbids outside `workflow-types.ts`; it now reads `DOCUMENT_LABELS.adr`. No phase ran that pin — it runs only in the whole suite, as it did for the previous plan's `rev-parse HEAD`.

## What We Learned

- **Measure against the real data, not the fixture.** Every date bug in this plan passed its tests and failed on the repository: the fixtures were written in the format the code expected. A one-line script over the repo's own plans found 80, then 79, then the 1.36.1 error, in seconds.
- **A source of truth that only covers recent history needs a rule for what predates it.** Release commits began at 1.36.1; landing lines began 2026-09-18. Each new source silently produced a wrong answer — "not landed", "released in the first release we can see" — for everything older. Wrong is worse than unknown, and "not released yet" is a wrong answer, not an unknown one.
- **A single-definition pin scoped to the consumers misses a duplicate inside the provider.** The pin scanned the admin and the extension; the second landing reader was in the package itself.

## What We'd Do Differently

- Run each date rule against the repository's own plans in the phase that writes it, before falsification has to.
- Ask, for every new data source, "what does this say about things older than the source?" in the ADR.

## Insights Worth Carrying Forward

- plan-cockpit reuses `promises/display` (the brief's reason for this plan) — names, titles and dates come from the health line or `readHealthNames`, never a second rule; the single-definition pin now covers the package too.
- `readHealthNames` re-reads every plan folder and runs one `git log --first-parent` per health line (~60 ms on this repo, every 5 s). The cockpit's planning should decide whether to cache.
- 17 archived plans still read no landing date: nothing on disk dates them. A backfill of landing lines is possible from `git log` but was not in scope.

## Quality Ratchet

No recurring lint or type errors; no Biome rule is warranted. Shape: 0 findings raised across the phases (6 entries, each "reviewed, nothing found"), 0 judged wrong. The previous plan reported 5 findings and 0 judged wrong, so no streak of wrong findings.

## Metrics

- 30 commits; 26 files outside `.indusk/`, +1,035 / −28.
- 17 trajectory rows passing (A10 live in VS Code).
- On this repository: landed plans reading a release 15 → 94 of 94; archived plans reading as never landed 80 → 17.
