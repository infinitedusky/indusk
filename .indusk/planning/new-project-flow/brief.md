---
title: "New project flow"
date: 2026-10-13
status: draft
workflow: feature
---

# New project flow — Brief

A person starts a new project from the admin by saying what they want to
build; the agent asks what the idea leaves open, recommends the right way and
runs every command. Background, the vision and the Homework Gate walkthrough
are in [research.md](research.md).

**Looks are not named yet.** The New project button, the text box and the
summary screen are visual; their looks are named once the in-flight mockup
work (`storybook-components`) lands, and this brief is not accepted before
then.

## Expectations

1. **A person gets from an idea to a project with its first plan in one sitting.**
   - Measure: time from opening the text box to the project existing with its founding brief and master plan, from a span the admin emits per creation.
   - Look: after the first three projects created this way.

2. **The agent asks little when the person brings a document.**
   - Measure: questions asked before the proposal, counted per creation and split by whether a document was attached; with one, expect five or fewer.
   - Look: after the first three projects created this way.

3. **Most recommendations are kept.**
   - Measure: the share of recommended practices declined, read from the declines recorded in each project's config. A high share means the defaults or their explanations are wrong.
   - Look: after five projects.

4. **People start projects here rather than with `indusk init`.**
   - Measure: projects registered through the admin flow against projects registered by a bare `indusk init` or `indusk setup`, from the project registry.
   - Look: 30 days after release.

## Promises

### This plan makes

1. **`a-project-starts-as-a-conversation`** (state). A person starts a new project from the admin by describing it, and may add documents for the agent to write the brief from, with nothing asked of them first; the agent proposes its name, location and shape for the person to accept.

2. **`a-new-project-is-made-by-the-agent`** (state). Accepting the proposal creates the workbench, the project's repository inside it and its worktrees folder, and installs InDusk, with no command typed by the person.

3. **`a-new-project-has-the-standard-layout`** (state). Every project created this way has the same layout — the workbench at the root, the repository inside it, a worktrees folder beside it, all declared in the project's config — and the project's own checks report it healthy.

4. **`a-project-keeps-its-founding-brief`** (state). Every project created this way opens with a founding brief the person accepted, written from the conversation and any documents they gave, and its milestones become the master plan's order; a document they gave is kept unchanged beside it.

5. **`a-new-version-of-the-founding-brief-shows-what-changed`** (state). When the person gives a newer version of their document during the conversation, the agent shows what changed and works from the new one.

6. **`a-recommendation-can-be-declined`** (state). Every practice the agent recommends — a docs site, telemetry, deployment, a remote repository — can be declined, and a declined one is recorded in the project's config with the person's reason.

7. **`the-core-is-always-kept`** (state). A project created this way always plans with a brief that makes promises and a test plan; the other planning documents can be turned off.

8. **`a-new-project-publishes-nothing-unasked`** (state). Creating a project sends nothing off the machine; a remote repository is created only after the person confirms it.

9. **`a-new-project-is-written-only-under-its-parent`** (state). The admin creates a project only inside the parent directory the person configured.

10. **`an-unkept-project-conversation-leaves-nothing-on-disk`** (state). A project conversation that is abandoned before acceptance creates no directory and registers no project.

### Existing promises

**Must not break**

- **`a-plan-starts-as-a-conversation`**. The project conversation is built on the plan conversation; a new plan must still start the same way.
- **`a-conversation-that-is-not-kept-leaves-nothing-in-the-repository`**. The project-level version of the same rule; the plan-level one must still hold.
- **`a-plan-can-start-from-the-admin`**. The new flow reuses the admin's planning session; starting a plan in an existing project must not change.
- **`a-session-can-be-stopped`**. A project-creation session is an admin session; it must be stoppable and not outlive the admin.
- **`a-project-has-one-contract`**. A created workbench must resolve to one contract like any other.
- **`init-writes-no-vendor-into-an-app`**. The flow runs `indusk init`; the walkthrough found init dropping telemetry files at a workbench root.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Contributed scaffolds** (Next, React Native, Swift, …), as thin recipes over official generators. Wanted, but a later plan once a real project needs a second stack.
- **Recommendations that resurface when they start to matter** (a declined docs site raised when a second contributor joins). Recording the decline is promised here; raising it again is a later plan.
- **Asking only what the input leaves open.** The quality of the agent's questions is judged by expectation 2, not promised.
- **Adopting an existing repository** through this flow. `indusk setup` covers it today; the conversation detecting it is a later plan.
- **Where premises (a project's scored aim) live.** The founding brief holds the aim for now; `plan-premises` decides its home.

## Depends On

- `.indusk/planning/brief-as-the-contract/` — the plan conversation this builds on.
- `.indusk/planning/storybook-components/` — the looks this brief names before acceptance.

## Blocks

None.
