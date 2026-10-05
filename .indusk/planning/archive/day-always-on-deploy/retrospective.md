---
title: "Always-on deploy — Retrospective"
date: 2026-10-04
status: completed
---

# Always-on deploy — Retrospective

## What We Set Out to Do

`day-always-on` built the always-on server and proved its loop on this laptop.
It left two artifacts nobody had run: the image (`docker/Dockerfile.always-on`)
and the Fly configuration (`docker/fly.always-on.toml`). This plan was meant to
be the smallest one that turns those two written artifacts into verified ones:

- build the image and check it refuses a missing setting by name;
- deploy it to Fly and run the guide's smoke procedure, including a violation
  sent after an idle hour (the step people skip);
- record what was observed, and take the "unrun" marking off the docs;
- set the server's gRPC query port, so two servers can start on one host.

## What Actually Happened

61 commits on `plan/day-always-on-deploy` (52 on its first-parent line, plus
four merges of main back in after each mid-plan release). 32 files, +1,505 /
−108; the package and `docker/` are 23 files, +1,157 / −56.

- **The image built on its first try.** A1, the test that builds the image and
  runs it once per required setting left out, passed 7/7 when written. It was
  the first time the image had been built anywhere.
- **The gRPC port was a security fix, not just a port.** Left unset, Jaeger
  served its gRPC query API on `0.0.0.0:16685` with no basic auth. Fly exposes
  only the two declared services, so the reference deployment never leaked
  through it, but a server on a VPS with that port open would have handed its
  traces to anyone. The port now comes from `INDUSK_SERVER_GRPC_PORT` and binds
  to loopback. It shipped on its own as **1.58.1**, ahead of the deploy, so
  the deployed server never ran the open version.
- **Deployed** to the Fly app `indusk-always-on` in the personal org: one
  `shared-cpu-1x` machine in `iad`, a 3 GB volume. The written configuration was
  wrong in five ways:
  - `fly launch --copy-config` rewrote the config file and destroyed every
    comment in it, including the one explaining why the machine must never
    auto-stop.
  - Fly now spells auto-stop `"off"`, not `false`.
  - Fly runs two machines unless told `--ha=false`. Badger is a single-writer
    store, so the server must be one machine.
  - A first deploy gets **no public IP**.
  - The query port, 16687, needs a **dedicated IPv4** ($2/month), because Fly's
    shared IPv4 routes only 80 and 443.
- **The smoke found three server bugs**, each released and redeployed during
  the plan:
  - **1.58.2, durable record writes.** A `fly machine restart` thirty seconds
    after a pass left `announced.json` at zero bytes. The record was written by
    rename without `fsync`, and the rename reached the disk before the data.
    From then on every pass refused to announce, by design, while the heartbeat
    still said *listening*. `writeFileDurably` fixes it, and new row A10 checks
    both records over `fly ssh` after a restart.
  - **1.58.3, a public query URL for Slack links.** The link read
    `http://127.0.0.1:16686/trace/…`, the server's own address for its own
    Jaeger. The new setting `INDUSK_SERVER_PUBLIC_QUERY_URL` fixes it, guarded
    by row A11.
  - **1.58.4, a query door with a login challenge.** Jaeger's basic auth
    refuses with a bare 401 and no `WWW-Authenticate` header, so a browser never
    offers a login and a clicked link shows "no basic auth provided". The server
    now answers the public query port itself and adds the challenge; Jaeger is
    still the only thing that checks a password. Guarded by row A12, and
    confirmed by Sandy logging in from the Slack link.
- **The idle hour passed.** Nothing reached the machine from 23:42 to 00:43
  UTC. It wrote 63 heartbeats in that window, exactly 60 s apart, with no gap.
  A violation sent at 00:43:54 was announced at 00:44:47, 53 s later. Auto-stop
  is genuinely off.
- **Falsification found four more**, in code the live smoke had already
  exercised. All four are fixed on the branch, unreleased until 1.58.5:
  - A13: a taken query port left an orphaned Jaeger holding the intake and the
    volume's lock, so every restart failed too. The door now binds first.
  - A14: the door did not tie its two connections together. Jaeger dropping
    mid-response left the browser's response open forever.
  - A15: the public URL was only trimmed. A URL carrying a password would have
    posted it into every Slack message.
  - A16: `writeFileDurably` ignored a short write. On a nearly full volume, a
    truncated record replaced the good one, which is 1.58.2's failure arriving
    by a different route.
- **Cleanup** found one cross-file duplicate: three identical loopback port
  pickers. The two in tests now import `freeLoopbackPort`. Seven other
  candidates were reviewed and left, with reasons in the impl.
- **Scope moved out twice.** Items 6–14 (heartbeat, incident recording,
  workbench provisioning) left for their own plans on 2026-10-02. The promise
  timeline left for `promise-timeline` on 2026-10-04, which became step 2 of a
  new demo track, the master plan `indusk-demo`, created on trunk alongside
  this plan.

## Getting to Done

- **Four releases inside one plan.** Each server bug had to reach the deployed
  machine before the smoke could continue, and the image installs the published
  package. So the fixes went out from `release/1.58.x` branches off main, with
  `SKIP_RELEASE_GUARD=1` (the guard objected to this branch's unmerged test
  files), and main was merged back each time. That works, but it is four trips
  through a 2FA publish and four merges for one plan.
- **The system tier had doubled to 231 s.** Sandy noticed. Most of the time came
  from this plan's and watcher-heartbeat's timed files running one at a time.
  They ran alone only because of the 16685 clash, which A8 fixed, so they
  rejoined the parallel group and the tier went back to about 130 s.
- **The fix prevents the damage but does not undo it.** On 1.58.2 the deployed
  record was still zero bytes. Repairing it (removing the file over `fly ssh`)
  became a documented procedure in the reference.
- **The close-out's own verification collided with another session.** The
  first `pnpm test:system` here passed all 116 tests, but the leak guard counted
  three Jaeger/otelcol processes that a concurrent `promise-sources` system run
  had started. The second run failed watcher-heartbeat A7 on timing while that
  run was live, with one more of its daemons in the guard's count. The file
  passed alone, and the full tier passed 32/32 once no other vitest was
  running. Nothing in this plan was red.

## What We Learned

- **Contact with a provider finds what local tests cannot, and every finding
  was a gap in what the tests asserted, not in what they ran.** Before the
  deploy, all three server bugs sat in code covered by green tests. None of
  those tests restarted a machine mid-write, read a Slack link as a person
  would, or opened one in a browser.
- **"Rename is atomic" is a claim about a dying process, not a stopped
  machine.** The comment in `pass.ts` said the write was safe, and the code did
  what the comment said. The comment's model of failure was wrong. This is the
  root Known Gotcha again ("a safety argument written in a comment is not
  enforced by the code around it"), from a new direction.
- **A default listener is a public listener.** An unset Jaeger endpoint bound
  every interface without the auth the declared doors carry. A port left to its
  default is shared between instances (now a guarded lesson) and, it turns out,
  open to the world.
- **An auth layer that never sends a challenge works for programs and fails for
  people.** Jaeger's `basicauth` is correct for exporters and useless behind a
  link, and no programmatic test notices.
- **Smoke and falsification find different things.** The smoke found what the
  environment breaks: a restart, a link, a browser. Falsification, run after,
  found four more in the same code that the environment had not yet triggered:
  start order, connection pairing, an unchecked URL, a short write.
- **Provider tools rewrite your config.** `fly launch --copy-config` is a
  generator, not a reader. Its output kept the settings and dropped the
  reasoning.

## What We'd Do Differently

- **Write the person's experience as a test row before deploying.** A3 asserted
  the Slack message's content. Nobody wrote "the link opens the trace from a
  browser" until it failed twice. A row that names what a person does with the
  output (click it, log in) would have found 1.58.3 and 1.58.4 on the laptop.
- **Restart under load before the first deploy.** A local test that kills the
  server right after a pass writes would not have reproduced ext4's ordering,
  but asking "what does a stopped machine leave on disk?" at write time would
  have put `fsync` in the first version.
- **Run falsification on new server code before it is released, not after.**
  The query door shipped in 1.58.4, and two of falsification's four findings
  were in it. That was a reasonable call, since the deployment needed the door
  to continue the smoke. But it means 1.58.5 exists to fix a release that was
  one day old.
- **Use `fly apps create` and `fly config validate` from the start**, instead of
  letting `fly launch` touch a hand-written file.

## Insights Worth Carrying Forward

- `e2e/deployed-smoke.e2e.test.ts` reads its target from the environment, so
  `workbench-watch-provisioning`'s per-workbench servers run the same checks.
- A deployment that needs a non-80/443 port on Fly costs a dedicated IPv4. That
  belongs in the provisioning plan's cost estimate.
- The deployed server runs 1.58.4. The four falsification fixes need a 1.58.5
  release and a redeploy to reach it. None is urgent on Fly: one machine, a
  fixed public port, a URL without a credential, a 3 GB volume far from full.
- Concurrent sessions sharing one machine collide in the system tier: the
  global leak guard, and timing-sensitive heartbeat tests. Check `ps` for other
  vitest runs before reading a red there.

## Quality Ratchet

- No recurring lint or type errors. `daemon.ts` carries two unused-import errors
  from day-monitor, which this plan did not touch. No Biome rule fits any of
  this plan's bugs: each was a behaviour under a failure the code did not
  model.
- **Shape**: 1 finding across 7 phases, 0 judged wrong. The finding was in
  Build Phase 4: `QUERY_URL_ENV`'s docblock sat on the wrong constant after A11
  inserted a new one between them. Build Phase 4's Shape also deferred one
  cross-file duplicate to cleanup, which extracted it. No streak.

## Metrics

| | |
|---|---|
| Trajectory rows | 16 (A1–A16), all passing; A3 and A5 by a person reading Slack |
| Commits | 61 on the plan branch, 4 of them merges of main |
| Releases during the plan | 1.58.1, 1.58.2, 1.58.3, 1.58.4 |
| `pnpm test` | mcp 1,694 / 5 skipped, admin 346, `promises check` clean, guard all-clear |
| `pnpm test:system` | 32 files, 116 tests, 128 s, guard all-clear (run with no other session's vitest live) |
| Idle hour | 63 heartbeats, no gap; violation announced 53 s after the send |

## Release

The four falsification fixes change packaged paths since 1.58.4. A patch,
**1.58.5**, is bumped on main after landing (Step 11). It is not published:
that is Sandy's call, followed by a redeploy with `VERSION=1.58.5`.

Landed on main at 6c77f0a6, 2026-10-05.
