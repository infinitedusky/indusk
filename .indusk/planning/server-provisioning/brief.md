---
title: "Server provisioning — one command gives a project its server"
date: 2026-10-08
status: draft
workflow: feature
---

# Server provisioning — Brief

## Expectations

1. **A new project is watched from its first day.**
   - Measure: at the demo rehearsal, the time from creating the project to the first production read in the admin, and the number of commands it took (one).
   - Look: at demo-rehearsal, step 7 of the demo.

2. **The cost of one server per project is known before people are asked to pay it.**
   - Measure: Fly's bill for the demo app's server after a month — one machine, a 3 GB volume, a dedicated IPv4 at $2.
   - Look: 2026-11-08.

## Promises

### This plan makes

1. **`a-project-gets-its-server-in-one-command`** (state). One command gives a project its own always-on server, reachable at a public address, and the project's config names it as the production source before the command returns.

2. **`provisioning-never-prints-a-secret`** (state). The server's password and the Slack webhook never appear in the command's output, in the project's config, or in anything committed; the config names the variable, and the value lives in the machine's secrets.

3. **`a-second-run-updates-not-duplicates`** (state). Running the command again for a project that has a server updates it, and never creates a second app, volume or address.

4. **`provisioning-refuses-what-it-cannot-do`** (state). Without the Fly CLI signed in, or when the server's name is taken by something that is not this project's server, the command refuses by name before creating anything.

5. **`a-new-server-is-read-back-before-the-command-ends`** (state). The command ends only after it has sent a mark through the new server's intake and read it back through the public address, and otherwise says what is missing.

### Existing promises

**Must not break**

- **`the-demo-app-starts-with-its-promise-holding`**. The demo app will name a server this command made; its local source must still show the promise holding.
- **`the-demo-break-is-caught-locally`**. A production source beside the local one must not hide a local break.

**Changes**

None.

**Replaces**

None.

### Not promised

- A GitHub connection for the server to write its recording PR through — [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md).
- Tearing a server down; `fly apps destroy` by hand until a plan wants it.
- Any provider but Fly; the server itself runs anywhere with a volume, two ports and TLS, and that stays documented, not commanded.

## Depends On

- [day-always-on-deploy](../archive/day-always-on-deploy/brief.md) — the server, its image and its Fly reference, deployed and smoked by hand.
- [watcher-heartbeat](../archive/watcher-heartbeat/brief.md) — the probe that reads a server back.
- [promise-sources](../archive/promise-sources/brief.md) — a project's `promises.jaeger` as its production source.

## Blocks

- demo-rehearsal, step 7 of [indusk-demo](../indusk-demo/master.md), if the recording wants a fresh server rather than the one that exists.
- [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md).
