# Display Names — promises in words, plans by title, with their dates

**Decided 2026-10-09; closed 2026-10-10.** Full ADR: `.indusk/planning/archive/display-names/adr.md`.

## What was decided

The editor used to show promises by their kebab-case handles and plans by their folder names. Now a person reads words, worked out once, in the package:

- **`promises/display`** is the one module:
  - **`promiseWords`** turns a handle into a sentence: hyphens become spaces, the first letter is capitalised, and product names keep their spelling. A project adds its own product words under `display.words` in `.indusk/config.json`.
  - **`planTitle`** gives the brief's title up to " — ", or the folder name when there is no title.
  - **`planDates`** gives when a plan started, landed and was released.
- **The health line carries them.** `indusk promises health` puts `title`, `planTitle` and `planDates` on every promise, so the editor never names anything itself and the admin reads the same module.
- **Each date comes from facts already in the repository:**
  - **Started:** the date of the brief, or of the first lifecycle document that has one.
  - **Landed:** the retrospective's landing line. A plan in the archive with no such line is dated by its retrospective.
  - **Released:** the first `chore(release):` commit on the trunk after the plan landed. For plans older than the first release commit, the changelog's history is used instead.
- **A single-definition test** fails the build on a second definition of any of these, in the admin, the extension or the package itself.

## Tradeoffs accepted

- **The changelog stays only as a fallback.** Only 52 of 347 changelog entries name their plan as `(plan-name)`, so reading releases from the changelog alone left 79 of 94 shipped plans reading "not released yet". The release commits are authoritative.
- **When a plan landed on a release day, it is read as shipped that day.** Commits place a landing exactly, but older plans fall back to dates, and a date alone can't settle that case.
- **Names are rebuilt on every health line:** the plan folders are re-read and one `git log` runs, about 60 ms every 5 s on this repository. Caching is the cockpit's call.

## What hardened it

Every gap this plan closed was found by running it against the repository's own 111 archived plans, not by its tests, whose fixtures matched the code's assumptions:

- **Falsification:** 80 plans read as never landed, and plans with no brief had no start date.
- **The audit:** the changelog-only release lookup was wrong for most plans.
- **The fix's own measurement:** every pre-1.36.1 plan was being given the release 1.36.1.
