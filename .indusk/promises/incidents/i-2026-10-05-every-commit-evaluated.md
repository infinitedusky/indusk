---
id: i-2026-10-05-every-commit-evaluated
promise: every-commit-evaluated
source: local
status: open
date: '2026-10-03'
opened: '2026-10-03T21:01:44Z'
last_seen: '2026-10-05T03:12:00Z'
traces:
  - 'b12b34de4cda21c3f061681bd4e886d0'
  - '93fbcf634976be116ca0b96cb1838928'
  - 'fe23131a23e456049dc0f08089d8266f'
  - 'b998e34c64d236fe981b6e8a6d6a2b23'
  - '073d5f4ec4dc9f7560dd89462ebc5715'
  - '789f8ea3d19b36a001555b50bb8a30d6'
  - 'f692579cf6ca86dbb3387366e00ae74b'
  - '7315213c8c9b54063915d98dfb35fc9d'
  - '08d033cd94cc5348bb4e904e560e64f3'
  - '566f2f576251552f35b0ba03c500a325'
  - '8ddb09c5785d807d279ed9a4656cc675'
---

## Symptom

claude exited with code 1: {"type":"result","subtype":"success","is_error":true,"api_error_status":429,"duration_ms":517,"duration_api_ms":0,"num_turns":1,"result":"API Error: Server is temporarily limiting requests (not your usage limit) · Rate limited","stop_reason":"stop_sequence","session_id":"cc1ae46f-ec5d-40f9-bcfc-4d502541371a","total_cost_usd":0,"usage":{"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0,"server_tool_use":{"web_search_requests"

## Root cause

Written 2026-10-05, from `.indusk/eval/system.log` and the violations' own
traces. Three causes, one of which produced most of the others.

**1. A commit made in a plan worktree was evaluated as the trunk's HEAD.**
`eval-trigger.js` resolves the repository from the hook event's `cwd`, the
session's directory. A commit written `cd <worktree> && git commit …` lands in
the worktree, but the event's `cwd` is still the trunk, so the evaluator was
handed the trunk's HEAD. During a plan, every commit in its worktree was
evaluated against one unmoving trunk commit: `14ca58b3` 14 times, `1cd8e0fa`
11 times, `9aa2317f` 10 times. At `2026-10-05T02:11:31Z` the resumed
evaluator answered in prose — "HEAD is confirmed unchanged across all seven
requests … a stuck loop" — instead of a scorecard, and the run failed parsing
it (`b998e34c…`). `trunk-guard.js` already reads where a commit lands — a
preceding `cd`, `git -C` — in its own `commitAnchor`; the trigger never used
it.

**2. Those runs, started in bursts, were rate limited, and a fresh start is
never retried.** Nine violations are `api_error_status: 429` ("Server is
temporarily limiting requests (not your usage limit)"), each within seconds of
a run of commits: a landing (merge, archive, landing note, release bump), or a
phase close. Every commit starts its own evaluator; with cause 1, several were
duplicates. `runPersistentEval` retries only a *resumed* session that fails
(clearing it and recursing); a fresh start that fails is marked violated and
the commit is never graded.

**3. A resumed session was pinned to a retired model.** At
`2026-10-03T21:01:44Z` (`8ddb09c5…`, grading `2f59f955`) the resumed session
answered `404 not_found_error — model: claude-sonnet-4-20250514`: a session
created long before still named the model it was started with. The
clear-and-retry path ran as designed and the fresh start used `sonnet`, but
that start also exited 1, and the trace does not record why. The violation
carries the first failure's text. Not reproduced; recorded here so a second
occurrence is recognised.

## Fix

Day-monitor Build Phase 10, 2026-10-05, on `plan/day-monitor`.

- **Cause 1.** `hooks/_commit-anchor.js` holds trunk-guard's reading of where a
  commit lands (`COMMIT_RE`, `commitAnchor`), now imported by both hooks.
  `eval-trigger.js` filters with it, so `git -C <dir> commit` is recognised,
  and evaluates the repository the commit landed in; the event's `cwd` stays
  the state path, where results and logs belong. A32
  (`eval-trigger-commit-anchor.test.ts`) reproduces both paths;
  `hook-shared-modules.test.ts` counts one definition.
- **Cause 2.** `persistent-evaluator.ts` retries a run whose JSON says
  `api_error_status: 429` up to three times, after 15 s, 45 s and 90 s, before
  marking it violated. A33 (`monitor-mark.test.ts`) runs a `claude` that is
  rate limited once and requires the commit graded and the promise upheld.
  With cause 1 fixed, a burst of worktree commits also stops starting
  duplicate evaluations of one trunk commit.
- **Cause 3.** No change. The clear-and-retry path already handles a resumed
  session that fails; the fresh retry's own failure left no reason in its
  trace to fix against. A second occurrence should be traced from the
  evaluator's stderr, which the span keeps (`exit.stderr_tail`).

The fixes reach the live evaluator with the next release and `indusk
update`; until then the installed evaluator still has both defects. The
quiet window is what confirms them.
