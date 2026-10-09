---
title: "Server provisioning — Retrospective"
date: 2026-10-08
---

# Server provisioning — Retrospective

## What We Set Out to Do

Give a project its own recording server in one command ([brief](brief.md)).
The first draft drove Fly from inside the product. Sandy's reading turned it:
InDusk is released on GitHub and people run their own server, so a deployer
inside the product looked like the start of a hosted service. The plan became
three pieces ([ADR](adr.md)): `indusk server connect`, provider-free, which
reads a server back and then names it; `indusk server deploy`, one command
into the person's own Fly account, which ends by connecting; and the server
image published with each release, for anyone running it elsewhere. Seven
promises, none of them hosted.

## What Actually Happened

63 commits on `plan/server-provisioning`; 43 files changed, +2,790/−158, of
which code and its tests are 29 files, +2,195/−73. New: `lib/server/` (connect,
deploy, the Fly seam and state reader, a pure planner, the redacting writer,
the secrets file, the image builder), `bin/commands/server.ts`, the package's
`templates/server/` (Dockerfile, fly.toml), `scripts/release-image.sh`, the
guide "run your own server" and the `server` reference page.

Six build phases where four were planned: the falsification phase (Build
Phase 5) and the cleanup phase (Build Phase 6) followed the four in the impl.
All 27 test rows ended `passing`.

Changed outside the new module, each found while building:

- **Nothing loaded `~/.indusk/config.env`.** The deployed dusk server worked
  only because the shell exported its variable. Found reviewing Test Phase
  1's register, when A3's body had to read production with the variable
  absent. Production now reads the secrets file when the environment lacks it.
- **The recording server refused to start without a Slack webhook**, a
  day-always-on decision ("a server that cannot say anything is not
  watching"). A7, which Sandy accepted, reversed it: without one the server
  records and nothing is posted. The reversal is written where the rule was.
- **`--version` on a subcommand** was taken by the CLI's own version flag; the
  option is `--server-version`.

## Getting to Done

The live check was the plan's real test. Four runs of A8 against Fly; each of
the first three found a defect no unit test could:

1. Fly's CLI could not see OrbStack's Docker daemon, so `--local-only` failed
   after the local build. `--build-from` now pushes to the app's own Fly
   registry.
2. An Apple Silicon build is arm64 and Fly runs amd64; and a reused tag
   deployed the previous build, because Fly's registry outlived the destroyed
   app. `--build-from` builds amd64 with a fresh tag each time, and the
   release builds both architectures through its own buildx builder.
3. A new app's address and certificate come up a minute or two after the
   deploy, the two ports not together. Deploy waits up to five minutes.

The fourth run passed in about six minutes. A4 then read the demo app's
promises from the new server. The scratch app was destroyed after each run.

Falsification found four more, all confirmed: a failed Fly read taken for
"none" (a second volume, a second $2 IPv4), a webhook dropped on a second run,
a stale credential that sent the person round a five-minute loop, and two
projects in same-named folders sharing a credential variable.

At landing, the everyday suite's never-wait guard flagged the fake clocks'
`sleep(ms)` methods as real waits; they are written as arrow properties now.
The root context file was 136 bytes past its margin from this plan's Key
Decisions line; the periodic pass moved the promise-timeline line to the
admin's file, and corrected the admin file's stale "identity = port" note on
the way.

Still open, in known-issues: the release's two-architecture push could not be
run from an agent session (the macOS keychain refused one with no screen), so
the first release that publishes the image is untested past the build.

## What We Learned

- **A live check against a provider finds what fakes cannot, and finds it one
  defect per run.** Three runs, three Fly behaviours: a daemon it could not
  see, an architecture it would not run, a registry that outlived its app.
  Each was invisible to a recorded fake because the fake answered the way we
  believed Fly does.
- **Reviewing a deferred test body against the real code is where a missing
  piece shows.** "Nothing loads config.env" was not in research, the ADR or
  any test; it surfaced only when A3's body had to be written to compile and
  assert, at Test Phase 1's review.
- **An image built on Apple Silicon is arm64 unless told**, and a host that
  runs amd64 refuses it. Anything that builds an image to run elsewhere names
  its platform.
- **"Could not be reached" covers two different states**: not up yet, which is
  worth waiting for, and up and refusing the login, which is not. A read that
  answered 401 must not be retried as if the server were coming up.

## What We'd Do Differently

- **Run the live check before writing the Fly code's unit tests**, or at least
  before trusting them: the fake encoded our model of Fly, and three of its
  assumptions were wrong.
- **Ask the five design questions one at a time.** They were answered "looks
  good" as a set, and the defaults had to be written into research and
  corrected later (three Fly organisations, not one).

## Insights Worth Carrying Forward

- A command that creates paid resources should read everything first, plan
  purely, refuse before writing, and treat a failed read as a refusal — never
  as "nothing there".
- Credentials named by a project must be unique to where the project lives,
  not to its folder name.

## Quality Ratchet

No recurring lint or type error suggests a Biome rule: the lint findings were
unused imports after a refactor, fixed by the formatter. One near-miss is not
Biome's to catch: a regular expression written with literal line-separator
characters instead of escapes broke a file's parse, caught at once by the
test run.

Shape findings: 1 raised (Build Phase 2, the server block written twice in
`deploy`, named once as `recordServer`), 0 judged wrong by a human. Every
other phase recorded "nothing to change".

## Metrics

- Sessions spent: 1 (with the planning conversation)
- Files touched: 43 (+2,790 / −158)
- Test rows: 27, all passing (21 planned, 4 from falsification, 2 from cleanup)
- Live runs on Fly: 4 for A8 (3 found defects), 1 for A4
- A Fly server: about 6 minutes to deploy and connect; about $8 a month by
  Fly's price list (machine $5.70, volume $0.45, dedicated IPv4 $2)
