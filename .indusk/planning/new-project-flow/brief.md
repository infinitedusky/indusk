---
title: "New project flow"
date: 2026-10-13
status: accepted
workflow: feature
description: "Start a new project from the admin by saying what you want to build. The agent asks only what your idea leaves open, recommends the right way to build it, and creates the workbench, repository and founding brief for you."
---

# New project flow — Brief

A person starts a new project from the admin by saying what they want to
build; the agent asks what the idea leaves open, recommends the right way and
runs every command. Background, the vision and the Homework Gate walkthrough
are in [research.md](research.md).

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

5. **The person reads the agent's replies, not its working.**
   - Measure: per project conversation, the words in each agent reply and how often the person opens what was folded. Long replies or frequent opening means the prompt or the fold is wrong.
   - Look: after the first three projects created this way.

## Promises

### This plan makes

1. **`a-project-starts-as-a-conversation`** (state). A person starts a new project from the admin by describing it, and may add documents for the agent to write the brief from, with nothing asked of them first; the agent starts at once and proposes its name, location and shape for the person to accept.

2. **`a-new-project-is-made-by-the-agent`** (state). Accepting the proposal creates the workbench, the project's repository inside it and its worktrees folder, and installs InDusk, with no command typed by the person.

3. **`a-new-project-has-the-standard-layout`** (state). Every project created this way has the same layout — the workbench at the root, the repository inside it, a worktrees folder beside it, all declared in the project's config — and the project's own checks report it healthy.

4. **`a-project-keeps-its-founding-brief`** (state). Every project created this way opens with a founding brief the person accepted, written from the conversation and any documents they gave, and its milestones become the master plan's order; a document they gave is kept unchanged beside it.

5. **`a-new-version-of-the-founding-brief-shows-what-changed`** (state). When the person gives a newer version of their document during the conversation, the agent shows what changed and works from the new one.

6. **`a-recommendation-can-be-declined`** (state). Every practice the agent recommends — a docs site, telemetry, deployment, a remote repository — can be declined, and a declined one is recorded in the project's config with the person's reason.

7. **`the-core-is-always-kept`** (state). A project created this way always plans with a brief that makes promises and a test plan; the other planning documents can be turned off.

8. **`a-new-project-publishes-nothing-unasked`** (state). Creating a project sends nothing off the machine; a remote repository is created only after the person confirms it.

9. **`a-new-project-is-written-only-under-its-parent`** (state). The admin creates a project only inside the parent directory the person configured.

10. **`an-unkept-project-conversation-leaves-nothing-on-disk`** (state). A project conversation that is abandoned before acceptance creates no directory and registers no project.

11. **`a-project-conversation-is-a-back-and-forth`** (state). A project conversation reads as a back-and-forth: the person's messages and the agent's replies alternate as "you" and "agent" bubbles, each reply formatted as Markdown, and the person answers in the same thread. Everything the agent did between replies is folded inside its bubble behind "See more", one click from view.

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
- **Folded working in the other agent conversations** (a plan's conversation, a build, Fix with Claude). The project conversation goes first; the others follow in a later plan once this fold has been used.
- **Short replies.** The agent is told to answer concisely and ask as little as it can; how short is judged by expectation 5, not promised.

## Looks

### This plan makes

1. **`home.default`**. The project grid with a New project button.
2. **`new-project.start`**. One text box — "What do you want to build?" — and a way to add documents to write the brief from; nothing else asked.
3. **`new-project.conversation`**. Mid-conversation: the person's messages and documents, "you" and "agent" bubbles alternating, each agent reply formatted with its working folded inside it, a box to answer in, and what the agent knows so far (why, what, how and where, name and place).
4. **`new-project.proposal`**. The proposal: name, location and shape, the planning workflow with the core kept, each recommendation kept or declined, the founding brief, the private GitHub repository as a separate confirm, and Create.
5. **`new-project.creating`**. The creation running as steps, ending with a way into the new project.
6. **`recommendation.kept`**. A new component: a recommended practice, one line on why, and Decline.
7. **`recommendation.declined`**. The same component declined, with the person's reason and a way to keep it after all.
8. **`project-card.default`**. A new component: one project on the home grid — name, path, active plans.
9. **`message.you`**. A new component: the person's message in the conversation, with any attached documents.
10. **`message.agent`**. The same component as the agent's message, holding its open questions.
11. **`file-chip.default`**. A new component: an attached document, by name.
12. **`prompt-box.default`**. A new component: the "What do you want to build?" box with a way to add documents.
13. **`knowledge-list.default`**. A new component: what the agent knows so far — why, what, how and where, name and place — each settled, asking or open.
14. **`workflow-strip.default`**. A new component: the planning documents in order, the core marked kept and a declined one struck through.
15. **`layout-tree.default`**. A new component: the project's directory layout as it will be created.
16. **`message.agent-folded`**. The agent's bubble (`message.agent`) holding a formatted reply, with one "See more ›" line standing for the working before it.
17. **`message.agent-open`**. The same bubble opened: the working listed above the reply, and "See less".
18. **`message.agent-working`**. The agent's bubble while it works: shown the moment the conversation starts, pulsing, with "Working…" and its working so far behind "See more ›", until its reply arrives.

### Existing looks

**Must not break**

None.

**Changes**

None.

**Replaces**

None.

## Depends On

- `.indusk/planning/brief-as-the-contract/` — the plan conversation this builds on.

## Blocks

None.
