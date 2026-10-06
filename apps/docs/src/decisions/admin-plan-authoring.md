# Admin plan authoring — plan, build, review and release from the admin

**Status:** accepted (2026-10-06) · version 1.63.0
**Full ADR:** `.indusk/planning/archive/admin-plan-authoring/adr.md`

## What was decided

The admin can start a plan, hold its planning conversation, build it unattended to review, show the evidence, and release it once a person accepts. It does this with the developer's own Claude Code and through the same commands the skills and the terminal use.

- **D1. One session module drives the developer's `claude`.** It runs `claude -p` over its stream protocol with `--permission-prompt-tool stdio`, which `claude --help` does not list. A contract test watches that protocol. Planning sessions run in permission mode `default`, so writes are asked about; builds run in `acceptEdits`, and their other requests are decided in code. A write outside the plan's worktree is refused.
- **D2. The admin daemon owns sessions, one at a time.** It records them so `indusk ui stop` and a restart after a crash end them. Every route answers only on the admin's own hosts, and every `POST` also checks its `Origin`.
- **D3. Four plan commands, one definition each:** `indusk plans start | approve | accept | land`.
  - A plan is started on its own branch and worktree.
  - Approval merges its documents and declared promises to `main`, after the brief check.
  - Acceptance is recorded in the impl.
  - Landing refuses a plan that was not accepted.
- **D4. The build is orchestrated in code.** `nextBuildStep` is a pure function of the plan as it stands and the last two steps' outcomes. Each step is a fresh session. The build stops at review, at a judgement the plan declared, or when it cannot continue, and it never starts the retrospective.
- **D5. A build may skip a gate item only with its reason.** Its sessions run under `INDUSK_GATE_POLICY=auto`. `check-gates.js` refuses a bare `(none needed)` under that policy.
- **D6. The review is assembled by one function** (`buildReview`). It shows:
  - each promise with the tests that prove it;
  - what falsification looked for and fixed;
  - the files changed and every skip;
  - any uncommitted work on `main` where the plan will land.
- **D7. One built-in release workflow.** Acceptance (by the person, or by `release.auto_accept`) starts a session that runs the retrospective, which lands the plan with `indusk plans land`.
- **D8. A plan written on `main` is marked, not refused.** A non-merge commit on `main` that changes an active plan's documents is recorded as a violation of `a-plan-is-written-on-its-own-branch`.
- **D9. New lifecycle positions:** `approved`, `in review` and `accepted`, rendered on the plan bar.

## Rejected

- **The Agent SDK.** It is not the developer's own Claude Code: the developer's settings, plugins and login would not come with it.
- **Dawn's loop as the build engine.** It exits silently on a gate question.
- **One long session for the whole build.** Its context degrades over a long build, and nothing would decide each step in code.
- **Refusing plan documents on `main`.** Kept a convention, with violations recorded.
- **A separate session daemon.** The admin daemon already runs.

## What the build and its rituals changed

- **The live check added a phase.** The unattended release found InDusk's own notes uncommitted on `main`. Approving and landing now commit that bookkeeping in a commit of its own. Anything else uncommitted on a path the plan touches is refused and shown at review. Where bookkeeping should be written at all is a follow-on brief, `bookkeeping-lives-where-it-is-read`.
- **Falsification found four hypotheses; three confirmed and were fixed:**
  - DNS rebinding let another site's page drive the admin, because `Origin` and `Host` agreed. Every route now checks the host first.
  - A build step could accept and land its own plan. `accept` and `land` now refuse under `INDUSK_BUILD_STEP`.
  - A staged rename on `main` crashed approval with a raw git error. The status is now read with `-z`.
  
  The fourth, that a planning session writes unasked when settings allow it, was dropped by decision: an allow rule is the developer's explicit choice.
- **Cleanup gave four rules one definition each:**
  - the trunk's branch;
  - a branch's changed files;
  - a panel's POST;
  - the rate-limit rule the build and the evaluator share (`api_error_status: 429`, retried after 15, 45 and 90 s).

See [sessions](/reference/admin-ui/sessions), [`indusk plans`](/reference/cli/plans) and [the plan lifecycle](/guide/plan-lifecycle).
