---
title: "New project flow — Test Plan"
date: 2026-10-14
status: accepted
---

# New project flow — Test Plan

## Purpose

The behavioural assertions that, together, mean a person can start a project
from the admin by talking, and get a correctly laid-out, InDusk-installed
project with its founding brief — and nothing they did not ask for. Grouped by
the brief's promises; each names the smallest level that proves it.

## Behavioral Assertions

### `a-project-starts-as-a-conversation` — A person starts a new project from the admin by describing it, and may add documents for the agent to write the brief from, with nothing asked of them first; the agent proposes its name, location and shape for the person to accept.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | New project on the home page opens a page with only the "What do you want to build?" box and a way to add documents — no field to fill first, and no project needed. | unit |
| A2 | The first message, with any documents added, starts a conversation with the agent that holds both. | unit |
| A3 | Once the agent has written its proposal, the page shows the proposed name, location and shape, each of which the person can change before accepting. | unit |

### `a-new-project-is-made-by-the-agent` — Accepting the proposal creates the workbench, the project's repository inside it and its worktrees folder, and installs InDusk, with no command typed by the person.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | Accepting a proposal creates the workbench folder, a git repository inside it with one commit, a worktrees folder beside it, and InDusk installed, and the project appears on the home page. | unit |
| A5 | The creation shows each step as it runs and ends with a way into the new project. | unit |

### `a-new-project-has-the-standard-layout` — Every project created this way has the same layout — the workbench at the root, the repository inside it, a worktrees folder beside it, all declared in the project's config — and the project's own checks report it healthy.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | A created project's config declares its repository with its worktrees folder, and listing its worktrees reports the repository and folder with nothing unattributed or unusual. | unit |

### `a-project-keeps-its-founding-brief` — Every project created this way opens with a founding brief the person accepted, written from the conversation and any documents they gave, and its milestones become the master plan's order; a document they gave is kept unchanged beside it.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | A created project opens with the founding brief from the conversation, and a master plan whose order lists its milestones. | unit |
| A8 | Each document the person added is in the created project byte for byte, beside the founding brief. | unit |

### `a-new-version-of-the-founding-brief-shows-what-changed` — When the person gives a newer version of their document during the conversation, the agent shows what changed and works from the new one.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | Adding a document with the same name as one already added tells the agent what changed between the two, and the newer one is the one kept. | unit |

### `a-recommendation-can-be-declined` — Every practice the agent recommends — a docs site, telemetry, deployment, a remote repository — can be declined, and a declined one is recorded in the project's config with the person's reason.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A10 | Declining a recommendation with a reason creates a project whose config records that recommendation declined, with the reason in the person's words. | unit |

### `the-core-is-always-kept` — A project created this way always plans with a brief that makes promises and a test plan; the other planning documents can be turned off.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | A proposal that turns off the brief or the test plan is refused, naming the document. | unit |
| A12 | In a project with decision records turned off, a feature plan does not ask for one, and its page reads the ADR as skipped, not missing. | unit |

### `a-new-project-publishes-nothing-unasked` — Creating a project sends nothing off the machine; a remote repository is created only after the person confirms it.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A13 | Creating a project without confirming the remote repository runs no GitHub command and leaves the repository with no remote. | unit |
| A14 | Creating a project with the remote confirmed creates one private repository, once, and pushes the first commit to it. | unit |

### `a-new-project-is-written-only-under-its-parent` — The admin creates a project only inside the parent directory the person configured.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A15 | A proposal whose location is outside the configured parent directory is refused and nothing is created. | unit |
| A16 | With no parent directory configured, creation is refused, naming the command that sets one. | unit |

### `an-unkept-project-conversation-leaves-nothing-on-disk` — A project conversation that is abandoned before acceptance creates no directory and registers no project.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A17 | Discarding a project conversation removes everything it held, and nothing exists under the parent directory or in the project registry because of it. | unit |
| A18 | A project conversation left open, at any point before acceptance, has created nothing outside its own draft folder. | unit |

### `a-project-conversation-is-a-back-and-forth` — A project conversation reads as a back-and-forth: the person's messages and the agent's replies alternate as "you" and "agent" bubbles, each reply formatted as Markdown, and the person answers in the same thread. Everything the agent did between replies is folded inside its bubble behind "See more", one click from view.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A23 | A session's events read as alternating "you" and "agent" turns: each agent turn's reply is its last text, and the tools and text before it are its working. | unit |
| A24 | In the conversation, an agent reply written in Markdown shows formatted, its working is hidden until "See more" is clicked, and "See less" hides it again. | unit |
| A25 | A question or permission the agent is waiting on is never folded away. | unit |
| A26 | Reopening a project conversation with no agent running shows the same turns it had; discarding it removes them. | unit |
| A27 | The project conversation's prompt tells the agent to reply in a few sentences of Markdown and ask at most three questions at a time. | unit |
| A28 | Starting a project conversation starts its agent: the conversation opens with the agent working, with no second click. | unit |
| A29 | Every agent turn carries one status: working while its agent runs without a reply, done once it has replied, stopped when its agent ended before replying. | unit |

### `a-plan-starts-as-a-conversation`, `a-conversation-that-is-not-kept-leaves-nothing-in-the-repository`, `a-plan-can-start-from-the-admin` — must not break

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A19 | Starting a new plan in an existing project from the admin works exactly as before. | unit |

### `a-session-can-be-stopped` — must not break

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A20 | A project conversation's agent can be stopped from its page, and none is left running when the admin stops. | contract |

### `a-project-has-one-contract` — must not break

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A21 | A created project resolves to exactly one contract. | unit |

### `init-writes-no-vendor-into-an-app` — must not break

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A22 | A created project's repository holds no telemetry vendor files written by installation. | unit |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The agent asks only what the person's input leaves open. | Question quality is a model's judgement. | Expectation 2 counts questions per creation; a live check in the plan records one real run. |
| U2 | The agent's replies are short enough to read without opening the working. | How short is enough is a judgement. | Expectation 5 records words per reply and folds opened on each creation's span; the live check records one real run. |

## Notes

- Creation is tested through the package command the admin calls, with a
  temporary `INDUSK_HOME`, a temporary parent directory and a fake `gh` on
  `PATH` — no network, no daemon.
- A20 drives a real spawned session, so it sits in the system tier with
  `admin-session-lifecycle.test.ts`.
