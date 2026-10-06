---
title: "publish-hygiene — Retrospective"
date: 2026-10-06
---

# publish-hygiene — Retrospective

## What We Set Out to Do

Get `pnpm release` for 1.63.0 to run clean, with output that can be read. It
failed twice, and the reason was buried under a thousand lines of npm's file
listing.

## What Actually Happened

Three fixes, one build phase, and three rows, all passing:

- **The session contract test** asked the model to write a file and offered
  it a way out ("If you are not allowed, say DENIED"). Started from a plain
  terminal, the model sometimes took that way out without trying (2 of 9
  runs), so the test failed with no defect in the product. It now names the
  `Write` tool, retries a run that tried nothing, and says so when the model
  never tries. Three of three runs passed from a clean environment.
- **The tarball** dropped 160 source maps, Next's build trace and its
  generated types. It went from 1,170 files, 41.5 MB unpacked and 10.7 MB
  compressed, to 939 files, 14.5 MB and 4.1 MB. The trimmed admin was started
  by hand and served pages.
- **The publish** now runs with `npm_config_loglevel=warn`, which hides the
  per-file listing. npm prints the 2FA prompt unconditionally, so it still
  shows.

The plan was started, approved and landed with the `indusk plans` commands
that 1.63.0 ships.

**Build Phase 2, after the first landing run.** The plan was archived when
that run timed out a second contract test, A24 (`build-session-gates`, from
admin-plan-authoring: a build session's checkoff is judged by the project's
gates), at 300 s. It was reopened. Instrumenting that test turned up three
defects in its setup, none in the product:
- it never declined a question, so a session that asked one waited forever;
- its prompt never asked the model to read the file first, and Claude Code
  refuses an `Edit` on an unread file. That could also let the
  "bare `(none needed)` is refused" case pass for the wrong reason;
- after a hang it judged only the last attempt.

It also kept a third copy of the rate-limit rule, which the previous plan's
cleanup missed. Now:
- questions are declined as a build declines them;
- sessions have a two-minute deadline;
- the model reads before editing;
- the shared rule decides rate limits.

Four of four clean-environment runs passed.

The verification runs found two more problems, both fixed:
- **Model judgement, not the hook, refused a checkoff.** With the file read
  first, the model judged that checking off unbuilt work would misrepresent
  it, and refused before the hook could decide. Both contract prompts now
  say plainly that they are tests.
- **The admin's Promises-page test timed out on `next dev`'s first-request
  compile** (A20), twice under load. It now warms the page in its setup.

`promise-sources` A9 failed once when a test-started Jaeger was slow to start
under a load average of 21, and passed twice after. Both tiers were finally
green from a clean environment: `pnpm test` 1,965, and `pnpm test:system`
158 + 56.

## What We Learned

- **A test that relies on the model's choice is testing the model.** The
  contract test's subject was Claude Code's permission exchange, but its
  setup let the model decline before reaching it. From inside a Claude Code
  session the model always tried; from a plain terminal it sometimes did not.
  That is why it passed for the agent and failed for the person.
- **A contract test against a live model is only as good as the protocol it
  speaks back.** A24 answered permissions but not questions, so a session
  could wait for a reply that never came. A test that drives `claude` has to
  answer everything a real caller answers, and has to bound every wait.
- **Output that hides the failure is itself a failure.** The release's real
  error was readable all along; nobody could see it.

## What We'd Do Differently

- **Run the release's own command from a plain terminal before handing it
  over.** Both failures happened only outside an agent's environment.
- **Treat every system-tier failure as a lead until it is explained.** Calling
  the first A20 timeout a flake left it in place for the release to hit.
- **A prompt to a model under test says it is a test.** A model asked to do
  something that looks wrong without that context may refuse on its own
  judgement, and the contract under test never gets to answer.

## Quality

- Shape: 0 findings across three phase reviews; none judged wrong.
- Falsification and cleanup were skipped, with the reasons recorded in the
  impl's frontmatter.

Landed on main at b1e5f64e, 2026-10-06, by `indusk plans accept` and `indusk plans land`.
