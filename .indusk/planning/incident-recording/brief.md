---
title: "Recording never waits for a person to think of it"
date: 2026-10-08
status: draft
workflow: feature
---

# Recording never waits for a person to think of it — Brief

What came out of the planning conversation with Sandy on 2026-10-08. The problem, what runs today and the decisions on the way are in [research.md](research.md); the first draft of these items, written 2026-10-02 in day-always-on-deploy's brief, is superseded by this one.

## Expectations

1. **The demo's step 6 runs with nothing typed between the break and the reopened plan.**
   - Measure: the rehearsal recording, from the production break to the owner's Maintenance phase on screen; every command typed in that stretch is counted, and the count must be zero.
   - Look: at the rehearsal (demo step 6 of [the demo master](../indusk-demo/master.md)).
2. **Incidents get fixed sooner once they stay loud.**
   - Measure: days from `opened` to `fixed` on every incident opened after this lands, read from the registry, against the two before it (`i-2026-10-03-every-commit-evaluated` took a day; `i-2026-10-05-every-commit-evaluated` was open five days when this plan started).
   - Look: a month after landing.

## Promises

### This plan makes

1. **`a-production-break-is-recorded-unasked`** (behaviour). While the admin is running, a promise broken in production becomes an incident, committed on the trunk, and reopens the plan that owns it with a Maintenance phase, within a minute and with nobody running a command; a recording pass that cannot read the server or cannot write the incident marks itself broken in the local telemetry.
2. **`catchup-records-what-it-finds`** (state). When catchup finds a production violation no incident records, it records it itself and reports what it opened, instead of telling the person to run `watch`.
3. **`an-open-incident-stays-loud`** (state). Every reader — catchup, `promise_health`, `promises status`, the admin — shows each open incident with its age and its owner's Maintenance phase, ahead of the roadmap; one open longer than a day is announced again, once a day, until it is fixed.
4. **`a-reopened-plan-can-be-worked`** (state). A plan reopened from the archive gets a worktree like any other: `indusk worktree create` and `assign` find it, and the admin and the plan tools read it from there.
5. **`a-break-reaches-the-working-agent`** (state). A promise broken in production reaches the agent in every running session on the project at its next turn, naming the promise, the incident and the reopened plan, without waiting for a catchup.
6. **`the-admin-keeps-what-it-heard`** (state). The admin records every production violation its recorder sees, with when it happened and the incident it belongs to, and the promise page shows them counted over time, whether or not a page was open when they happened.

### Existing promises

**Must not break**

- **`the-demo-break-is-caught-locally`**. A break seen only by the local daemon is work in progress: it is never recorded unprompted and reopens nothing (demo step 5). Only a production violation is.
- **`indusk-leaves-main-clean`**. The recorder commits what it writes; nothing it writes sits uncommitted in a checkout.
- **`an-incident-names-its-tests`**. The unprompted recorder is `watch`'s own writer, so every incident it opens names the tests that proved the promise.
- **`a-project-has-one-contract`**. The recorder reads the registry through the same resolver as every other reader, never a copy of its own.

**Changes**

None.

**Replaces**

None.

### Not promised

- **The always-on server recording incidents itself**, as a pull request to the plan repository: it needs the GitHub connection, which stays with [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md). Until then the server announces, and the developer's admin records.
- **Multi-developer recording** — who records when two admins watch one project, checkout of incidents, per-person credentials: deferred 2026-10-04 until after the demo.
- **The server pushing to the laptop**: the admin asks the production Jaeger on its own refresh interval (five seconds by default) instead (the reasons are in the research's decisions); a held connection would be no sooner and would still need the asking after a disconnect.
- **The bar chart of checks per time bucket** on the promise page (Sandy's design, in `known-issues.md`): plan-cockpit's promise page, step 5 of the demo sequence; this plan keeps the record it will draw from.
- **A desktop notification or Slack from the laptop**: the agent's inbox, catchup, the admin and the server's Slack are the channels promised here; a desktop channel is the VS Code extension's, step 4.

## Depends On

- [watcher-heartbeat](../archive/watcher-heartbeat/brief.md) (closed): a recorder must not count a blind watcher's silence as a quiet window.
- [watch-reopen-collision](../archive/watch-reopen-collision/brief.md) (closed): a scheduled `watch` must not silently fail to reopen an owner.
- [promise-sources](../archive/promise-sources/brief.md) (closed): the `production` source the recorder reads.
- [bookkeeping-lives-where-it-is-read](../archive/bookkeeping-lives-where-it-is-read/brief.md) (closed): the trunk bookkeeping commit the recorder extends.

## Blocks

- The demo's step 6 and its rehearsal ([indusk-demo](../indusk-demo/master.md)).
- The VS Code extension (step 4 of the demo sequence): it reads the agent's inbox and the admin's record rather than Jaeger itself.
- plan-cockpit (step 5): its bar chart draws from the record this plan keeps.
- [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md): the server's own recording PR reuses the recorder's writer and commit.
