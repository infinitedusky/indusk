---
title: "Every workbench is watched from its first commit"
date: 2026-10-02
status: draft
workflow: feature
---

# Every workbench is watched from its first commit — Brief

*Moved verbatim on 2026-10-02 from [day-always-on-deploy's brief](../archive/day-always-on-deploy/brief.md), where it was written, so each piece can run at its own size; item numbers restarted.*

## Problem and direction

Found during the local smoke on numero-workbench (Sandy, 2026-10-02): a workbench is watched only from whenever someone remembers to deploy an always-on instance for it, and a deployed instance has no sanctioned way to write back to the plan repository.

1. **Every workbench gets its own always-on instance, provisioned when the
    workbench is created** (Sandy, 2026-10-02). `indusk init --workbench`
    (and its equivalents) stands up the instance — volume, secrets, the
    announce + recording schedule — and writes `promises.jaeger` (URL +
    `credential_env` name, never the credential) into the new workbench's
    config, so a workbench is watched from its first commit rather than from
    whenever someone remembers to deploy. One instance per workbench keeps
    each one's traces, announcements and recording PRs scoped to one plan
    repository.
2. **The instance reaches the plan repository through a GitHub connection
    made at workbench creation** (Sandy, 2026-10-02: "connect to GitHub").
    Creation includes a connect-to-GitHub step that grants the instance access
    to that workbench's plan repository and nothing else; the instance opens
    its recording PR through that connection, never through a person's token.
    The permissions are the minimum a PR needs — push its own recording
    branch, open/update a pull request, read metadata — and because a GitHub
    write permission cannot be narrowed to one branch, the plan repository's
    protected branches must refuse a direct push from the connection, so the
    PR stays its only path in.

Open for the test plan: the connection's shape (a GitHub App installation,
whose short-lived tokens and per-repo install fit "this repo only", vs. a
fine-grained token), how
creation behaves without a Fly account or Slack workspace (refuse by name vs.
create the workbench unwatched and say so), and the cost of one instance per
workbench.

## Success criteria

- Creating a workbench provisions its always-on instance and points the new
  workbench's `promises.jaeger` at it.
- The instance's GitHub connection can open and update its recording PR on
  its own workbench's plan repository, and a direct push to a protected branch
  through that connection is refused.

## Depends on

- [day-always-on-deploy](../archive/day-always-on-deploy/brief.md) — one instance
  deployed and smoked by hand before provisioning automates it.
- [watcher-heartbeat](../watcher-heartbeat/brief.md).
