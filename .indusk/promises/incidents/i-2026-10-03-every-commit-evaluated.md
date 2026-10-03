---
id: i-2026-10-03-every-commit-evaluated
promise: every-commit-evaluated
source: local
status: fixed
date: '2026-10-02'
opened: '2026-10-02T20:22:50Z'
last_seen: '2026-10-03T01:21:43Z'
traces:
  - '11f09ff430990c8fa3809905dacb7c93'
  - 'd231d0b6d7fcf495614bd8c9fd1e8e97'
  - '0ec8c0c29c4e61e8c2b872a0ebe2856a'
  - '4738e3f2bcc8bdf8b0d11696f1fb9bfb'
  - '0244686b900e5486a09812651a620a55'
  - '0e507b1f04fbe1ec79bd78e6ae3387a6'
  - 'e293af9c823434f83a8ed2b4ee6154ad'
  - '1406d71575148b0f5b5dcc7405784456'
  - 'b4223ed0cb75e3abc51d537493b9df3b'
  - 'a7cc46ba6ef53771b2f2faf77797c757'
  - '1664618aa81ace6ef39bd89be4dcb77e'
---

## Symptom

claude exited with code 1: Ignoring 234 permissions.allow entries from .claude/settings.json: this workspace has not been trusted. Run Claude Code interactively here once and accept the trust dialog, or set projects["/Users/the_dusky/code/sandbox/dusk"].hasTrustDialogAccepted: true in /Users/the_dusky/.claude.json.

## Root cause

Two causes behind the eleven traces; the symptom above is only the newest.

**Five runs (2026-10-02 20:22–21:31): a scorecard the extractor could not find.** The model answered with a sentence of prose and then the scorecard in a ```` ```json ```` fence — a shape `extractScorecardJson` (`lib/eval/scorecard-extractor.ts`) exists to handle. Two things together defeated it. The fence match is non-greedy, so when the scorecard's own evidence strings quote a code fence (common for this repository's commits) the match ends inside the JSON and the fenced text does not parse. The fallback then scans from the *first* `{` in the reply — and this repository's prose is full of braces (`{kind, number}`, `{plan, phase}`); the first balanced object it found was prose, did not parse, and the extractor returned nothing rather than trying the next `{`. Either condition alone is survived; together they lose the scorecard. Reproduced against the shipped function before the fix.

**Six runs (2026-10-02 21:34 – 2026-10-03 01:21): a workspace Claude Code had not trusted.** The evaluator runs `claude` from the project root; `~/.claude.json` had `hasTrustDialogAccepted: false` for `/Users/the_dusky/code/sandbox/dusk`, so the CLI ignored the project's permissions and exited 1. An environment setting on one machine, not a code defect — but a real violation all the same: the commit went unscored.

## Fix

- **The extractor** (`day-monitor` Build Phase 9): `extractScorecardJson`'s brace scan tries each `{` in turn and returns the first balanced object that parses, instead of giving up on the first. A31 (`lib/eval/__tests__/scorecard-extractor.test.ts`) reproduces the lost scorecard — prose with its own braces, then a fenced scorecard quoting a fence — red before, green after. Ships in 1.57.2; the evaluator runs from the installed package, so it holds once that version is installed.
- **The workspace** (2026-10-03, the operator's machine): `hasTrustDialogAccepted: true` for `/Users/the_dusky/code/sandbox/dusk` in `~/.claude.json`. Seen upheld at 2026-10-03T05:40:57Z, the first evaluation after the change.
- **Found alongside**: the promise's owner was recorded as `semantic-graph-eval` and corrected to `day-monitor` (see the promise's History); and `promises-cli` A15, which demanded every promise in the repository be `enforced`, now holds a promise `known-violated` with its incident recorded, so recording this incident no longer turned the trunk red.
