---
title: "Server provisioning — run your own recording server, connected in one command"
date: 2026-10-08
status: accepted
workflow: feature
---

# Server provisioning — Brief

## Expectations

1. **A new project is watched from its first day.**
   - Measure: at the demo rehearsal, the time from creating the project to the first production read in the admin, and the number of commands it took (one on Fly; a server start plus one anywhere else).
   - Look: at demo-rehearsal, step 7 of the demo.

2. **The cost of one server per project is known before people are asked to pay it.**
   - Measure: Fly's bill for the demo app's server after a month — one machine, a 3 GB volume, a dedicated IPv4 at $2.
   - Look: 2026-11-08.

3. **People who run InDusk from GitHub run their own server, on whatever they already run.**
   - Measure: of the servers people name in their projects, how many are on Fly and how many elsewhere — asked in the first conversations after the launch, since a project's config is its own.
   - Look: a month after the launch.

## Promises

### This plan makes

1. **`a-project-connects-to-its-server-in-one-command`** (state). One command points a project at a recording server the person runs, wherever it runs: the project's config names it as the production source, the credential is stored on the machine and never in the project, and the admin shows the server's promises on the next read.

2. **`a-fly-deploy-is-one-command`** (state). One command creates a project's recording server in the person's own Fly account, reachable at a public address, and connects the project to it, with nothing to do between the command and the first production read.

3. **`provisioning-never-prints-a-secret`** (state). The server's password and the Slack webhook never appear in either command's output, in the project's config, or in anything committed; the config names the variable, and the value lives in the machine's secrets.

4. **`a-second-run-updates-not-duplicates`** (state). Running the Fly command again for a project that has a server updates it, and never creates a second app, volume or address; running connect again for a project replaces what it named before.

5. **`provisioning-refuses-what-it-cannot-do`** (state). Without the Fly CLI signed in, or when the server's name is taken by something that is not this project's server, the Fly command refuses by name before creating anything.

6. **`a-server-is-read-back-before-the-command-ends`** (state). Either command ends only after it has sent a mark through the server's intake and read it back through the address the project will use, and otherwise says what is missing.

7. **`the-recording-server-runs-from-a-published-image`** (state). Every release publishes the recording server's image to a public registry, and that image runs with a volume, two ports and its secrets, with no InDusk checkout and no build on the person's side.

### Existing promises

**Must not break**

- **`the-demo-app-starts-with-its-promise-holding`**. The demo app will name a server these commands made or connected; its local source must still show the promise holding.
- **`the-demo-break-is-caught-locally`**. A production source beside the local one must not hide a local break.
- **`dusk-installs-its-own-build`**. Publishing the image joins the deliberate publish, never the landing.

**Changes**

None.

**Replaces**

None.

### Not promised

- A deploy command for any provider but Fly. Anywhere else is the published image and the guide: what the server needs, then connect.
- A GitHub connection for the server to write its recording PR through — [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md).
- Tearing a server down; `fly apps destroy` by hand until a plan wants it.
- A server InDusk operates for other people. Every server is the person's own.

## Depends On

- [day-always-on-deploy](../archive/day-always-on-deploy/brief.md) — the server, its image and its Fly reference, deployed and smoked by hand.
- [watcher-heartbeat](../archive/watcher-heartbeat/brief.md) — the probe that reads a server back.
- [promise-sources](../archive/promise-sources/brief.md) — a project's `promises.jaeger` as its production source.

## Blocks

- demo-rehearsal, step 7 of [indusk-demo](../indusk-demo/master.md), if the recording wants a fresh server rather than the one that exists.
- [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md).
