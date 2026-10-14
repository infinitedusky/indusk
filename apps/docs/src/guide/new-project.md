# Starting a project

A new project starts as a conversation in the admin. You say what you want to
build; the agent asks only what that leaves open, then proposes the project's
name, location and shape. Nothing is made until you accept the proposal.

## The proposal

When the agent has settled why, what, and how and where, it writes a proposal
and the admin's `/new/<id>` page becomes that proposal. Every part of it is
yours to change before you create anything:

| Part | What you can do |
|------|-----------------|
| **Name** | Rename the project. It is a folder name: lower-case words joined by hyphens. |
| **Location** | Change where the workbench goes. Creation accepts only a place under the parent directory you configured (`indusk new-project parent <dir>`). |
| **Shape** | Change the repositories the workbench holds. The layout shown is the one that will be created: the workbench, each repository inside it, a `worktrees/` folder beside them. |
| **How you'll plan** | See which planning documents the project writes, in order. |
| **Recommendations** | Each practice the agent recommends (a docs site, telemetry, deployment) is kept unless you decline it. |
| **Founding brief** | Read the brief the conversation produced; the documents you gave are kept unchanged beside it. |
| **Private GitHub repository** | A separate confirm, off by default. It is the only step that sends anything off your machine. |

**Keep talking** goes back to the conversation; the proposal is kept and you
can return to it.

## What can be turned off

A project always plans with a **brief** that makes promises and a **test
plan**: they are how you know the project does what you asked. The other
planning documents (research, the decision record, the retrospective) can be
turned off. A proposal that turns off the brief or the test plan is refused,
naming the document, and so is a config that does.

A turned-off document is recorded in the project's config:

```json
{ "planning": { "documents_off": ["adr"] } }
```

A plan in that project then reads the document as **skipped**, never
**missing**, the planner does not write it, and the plan's next step does not
ask for it.

## Declining a recommendation

Declining asks for your reason, in your words, and records both in the
project's config under `recommendations`:

```json
{ "recommendations": [{ "name": "adr", "kept": false, "reason": "Solo project for now" }] }
```

Declining a recommendation named for a planning document (the decision
records) also turns that document off. **Keep it after all** takes the decline
back, and the document with it.

## See also

- [`indusk new-project`](/reference/cli/new-project) — the commands behind the page.
- [Workbenches & Worktrees](/guide/worktree-setup) — the layout a created project has.
