---
title: "Release checks run once — Retrospective"
date: 2026-10-08
---

# Release checks run once — Retrospective

## What We Set Out to Do

Two things the brief promised. `slow-checks-run-once-per-tree`: the slow test tier runs at most once for the same code, so a plan that landed green is released without running six to eight minutes of system tests a second time on code that differs only by the version bump. `landing-and-release-name-the-projects-commands`: the landing and release steps every InDusk project installs name the project's own commands from its config, never dusk's `pnpm test:system`, `release-guard.sh` and changelog path. The ADR chose a content key over the covered files (never the commit, since the bump is a commit of its own), a record of green runs in the project's home, `indusk checks slow [--unless-covered]` and `indusk checks show`, and a `workflow.steps` section held to facts, never logic.

## What Actually Happened

The product half shipped as designed, and then dusk's own use of it was cut in half by a decision taken during the last build phase. Sandy, watching an eight-minute slow run go red on an API rate limit that had nothing to do with the code: "I would be much happier with InDusk having some failure because we didn't run every test every time, than what we currently are doing." And: "it's going slower because we're also trying to figure out how to make it less slow." So dusk declares no slow tests at landing and runs none at release; the tier is to run after release, in the background, as a promise whose breaking is an incident (known-issues.md, Releases). The product keeps `checks slow` at landing as the default for projects whose releases really go public. The skip logic this plan built is therefore exercised by other projects, not by dusk.

40 commits; 36 files, +1030/−245 (18 in the package's source, hooks and skills, +740/−88). New: `lib/checks/` (`steps`, `key`, `record`), `bin/commands/checks.ts`, `workflow.steps` in the config type, a reference page and a decisions page.

## Getting to Done

- **The one live check never passed.** A6 was to run `checks slow` green on this repository and watch the release form skip. The run went red on `session-protocol-contract`, a contract test that drives the real `claude`, which Anthropic's API rate-limited (429). The command correctly recorded nothing. Then the decision above made the row moot for dusk; it is skipped with the reason, and A1–A5 prove the behaviour in fixtures.
- **Two tests on `main` were already red** when this plan's first full run found them: `installed-hook-drain` and `pending-repo-attribution` wrote the evaluator's pending queue into the checkout, where the 1.66.0 hooks (synced into `.claude/hooks/` after the release) no longer read it. Fixed here; `main` stays red until this lands.
- **A pinned skill test named a dusk path.** `release-ritual-skill.test.ts` asserted the bump step says `package.json`, which the second promise rules out; it now expects "the declared version file".
- **Falsification found four**, all red before the fix: a typo in `covers` keyed nothing and so was covered by every green run — the exact quiet failure the ADR warned of, under "a key that misses something"; a `./`-prefixed changelog was counted, so the bump changed the key and release would never have skipped; a non-fact value crashed with a stack trace instead of D5's one-line refusal; a script's executable bit was not in the key. The fourth's test passed on its first run by accident: changing only the index's mode left the working file different, so the "after" key was null for dirt rather than different. Changing both made it honestly red.
- **This session's MCP server is still 1.65.1**, started before the upgrade; its writes land in `main`'s `.indusk/` the old way. Promises went through the CLI; the highlights and `current.md` section it wrote are migrated or committed at landing.

## What We Learned

- **The suite is not slow; the schedule is.** 2,000 fast tests in two minutes and 220 system tests in six to eight is ordinary for a project this size. What was wrong is that dusk has no CI, so the retrospective skill made the laptop do CI's job, in the foreground, at the moment of closing. The five test levels already say when each runs; one row's "when" needed changing, not a new mechanism.
- **A key over nothing is covered by every run.** Any "skip if already covered" scheme needs a proof that the key covers *something*; a misdeclared scope must give no key at all, never an empty one.
- **A test that passes on its first run is suspect** when it was written to be red. A14 passed because the fixture made the tree dirty, not because the key changed. Read the reason a red test went green.
- **Configuration holds facts, never logic.** Written into the ADR as D5 so the next plan that wants a condition in `workflow.steps` argues against it by name. The alternative is the configuration complexity clock.

## What We'd Do Differently

- **Ask "where does the wait belong?" before "how do we run it once?"** The brief's frustration was the wait at landing and release; this plan optimised the duplication and left the wait where it was. A ten-minute conversation about what the slow tier is *for* in a project whose releases are its own development loop would have produced a smaller plan: the portability half, plus the background run.
- **Grep `main`'s suite before building on it.** The two drain tests were red on `main` from the moment the hooks were synced; finding that inside this plan's first full run cost a detour.

## Shape

Shape raised nothing across four build phases; a human judged nothing wrong. Phases 1, 2 and 4 reviewed and found one job per unit; phase 3 wrote configuration only.

## Quality

No recurring lint or type error. One Biome warning (`noTemplateCurlyInString`) on a shell script written as a string in a test; suppressed with its reason, no rule change.

## Release

Packaged paths changed (the package's source and skills); the plan adds capabilities (`indusk checks`, `workflow.steps`), so it is a minor: 1.67.0.

## Insights Worth Carrying Forward

- A step that a skill tells an agent to run by hand ("run `pnpm test:system`") has no record and cannot be trusted later; a command that runs it and records it can be. `indusk checks slow` exists so landing's run means something at release.
- Sandy's standing preference, now in memory: never put a waiting test back in the landing or release path; failures found later are the cheaper error while dusk's author is nearly its only user.
