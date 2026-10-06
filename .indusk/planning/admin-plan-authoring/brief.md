---
title: "Plan authoring from the admin — plan, build, review and release, through your own Claude Code"
date: 2026-10-06
status: draft
workflow: feature
---

# Admin plan authoring — Brief

*Rewritten 2026-10-06 in the brief shape, from the planning conversation of
that day. The first brief, its spike and what the admin lacks are in
[research](research.md).*

## Expectations

1. **The admin becomes a way plans are made and built.**
   - Measure: of the next five plans, how many use the admin at some step
     (planning, building, review or release); mixing it with the editor is
     fine.
   - Look: when the fifth one starts.
2. **A build interrupts the person only for what the plan declared.**
   - Measure: the stops in those five builds, before review, that were neither
     a judgement item the plan declared nor a "cannot continue".
   - Look: when the fifth reaches review.
3. **The demo writes its first plan and builds it on camera, without a
   terminal.**
   - Measure: the rehearsal runs script steps 2 and 3 in the admin alone.
   - Look: at `demo-rehearsal`, the demo's last plan.

## Promises

### This plan makes

1. **`a-plan-can-start-from-the-admin`** (state). A plan can be started from
   the admin as well as from the editor or a terminal: in the admin, the person
   has the planning conversation, answers its questions in the panel and
   accepts its promises, and either way it is the same plan in the same files.
2. **`a-plan-is-written-on-its-own-branch`** (state). Starting a plan, with its
   type and name, creates its own branch and worktree; its documents and
   promises are written there and reach `main` when the plan is approved, and
   its build continues on the same branch.
3. **`a-build-runs-to-review-unasked`** (state). An approved plan's
   implementation runs through its phases, falsification and cleanup without
   asking for approval, and stops only when it is ready for review, for a
   judgement the plan declared, or when it cannot continue.
4. **`a-review-shows-its-evidence`** (state). When a build stops for review,
   the panel shows what was built and the evidence: each promise with the
   passing tests that prove it, what falsification found and fixed, and the
   files changed.
5. **`nothing-ships-until-accepted`** (state). A plan's build does not merge
   to `main`, publish or deploy until it is accepted, by the person or by a
   workflow set to accept automatically; then the release workflow runs the
   retrospective, the merge and the rest of the release.
6. **`a-session-can-be-stopped`** (state). A session started from the admin can
   be stopped from the panel, and none is left running when the admin stops.

### Existing promises

**Must not break**

- **`a-briefs-promises-are-in-the-registry`**. A plan started in the admin
  saves its promises through the tools, never by writing a file.
- **`gates-ran-at-every-checkoff`**. The gates fire in the sessions the admin
  starts.
- **`everyday-tests-never-wait`**. A test that starts a real Claude session
  belongs in the system tier.
- **`one-definition-per-shared-rule`**. The admin drives sessions through the
  package's code and does not re-spell its rules.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Configuring the release workflow** (which checks, merge, publish, deploy,
  auto-accept): `release-checks-run-once`, widened. This plan builds one
  release workflow in.
- **Choosing a plan's workflow** (which documents and rituals):
  `workflow-builder`, in the promise-core master.
- **Approvals of the planning documents.** The test plan and the ADR keep
  their steps.
- Editing documents in place, hosting the admin, more than one session at a
  time.

## Depends On

- [planner-promises](../archive/planner-promises/brief.md) (closed
  2026-10-05): the conversation step, the promise tools and confirmation at
  close.

## Blocks

- [indusk-demo](../indusk-demo/master.md), build-order step 3; script steps 2
  and 3.
