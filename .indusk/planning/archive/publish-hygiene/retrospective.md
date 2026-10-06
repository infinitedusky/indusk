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

## What We Learned

- **A test that relies on the model's choice is testing the model.** The
  contract test's subject was Claude Code's permission exchange, but its
  setup let the model decline before reaching it. From inside a Claude Code
  session the model always tried; from a plain terminal it sometimes did not.
  That is why it passed for the agent and failed for the person.
- **Output that hides the failure is itself a failure.** The release's real
  error was readable all along; nobody could see it.

## What We'd Do Differently

- **Run the release's own command from a plain terminal before handing it
  over.** Both failures happened only outside an agent's environment.

## Quality

- Shape: 0 findings across two phase reviews; none judged wrong.
- Falsification and cleanup were skipped, with the reasons recorded in the
  impl's frontmatter.
