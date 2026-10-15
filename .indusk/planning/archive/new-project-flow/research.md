---
title: "new-project-flow"
date: 2026-10-13
status: complete
workflow: feature
---

# new-project-flow — Research

How a person starts a new project from the admin: a **New project** button, a
text box, a conversation, and an agent that runs every command. Researched by
doing it once by hand — Sandy's Homework Gate project, 2026-10-12, with Claude
playing the agent — and logging where it felt natural and where it dragged.
The result: `~/code/sandbox/homework-gate-workbench`.

## The vision (Sandy, 2026-10-12)

- **New project → a text box:** "What do you want to build?" Brainstorm, or
  paste/attach an idea or a document you already have.
- **The agent runs everything:** workbench, project repo, scaffold,
  `indusk init`, founding documents.
- **The right way, no corners cut.** InDusk tells a newcomer what building an
  application properly takes — a GitHub repository, deploy, telemetry, a docs
  site with a changelog so others can join — explains each in place ("What's a
  GitHub repository?"), and **never forces**. Refusals are allowed.
- **The non-negotiable core** is what makes InDusk InDusk: brief, promises,
  test plan. Other documents are refusable (e.g. no ADRs, straight to impl);
  the exact line is open.
- **Two registers.** A newcomer gets the defaults in plain words ("keep a
  record of decisions?"). Someone who knows what they're doing can ask to shape
  the planning workflow and gets it explained document by document, with a
  comfort check before dropping one.
- **Scaffolds** (Next, React Native, Swift…), possibly contributed by others.

## Positions reached in the conversation

- **Scaffolds are thin recipes over official generators** (`create-next-app`,
  `create-expo-app`, SwiftPM) plus the InDusk layer — never template files,
  which rot. Third-party scaffolds fit the existing extension system (one
  system, built-in + third-party sources) rather than a new registry.
- **Ask only what the input leaves open.** A fixed questionnaire is the name
  form again — the thing conversation-first planning rejected.
- **Every question has a default; the conversation ends on one summary
  screen** (shape, workflow diagram, release target), editable, then it runs.
  Answers land in `config.json` — `workflow.steps` already makes workflow and
  release configuration, so the gap is the questions, not the config system.
- **Build options when a real project needs them**, not ahead (consistent with
  the 2026-10-07 "flexibility after adoption" call).
- **Sequence the requirements, don't front-load them:** each arrives when the
  project first needs it. "InDusk doesn't hide the work, it schedules it."
- **A refusal is recorded** in config and resurfaces once, when it starts to
  matter (no docs site → raised when a second contributor joins).
- **Repo shape:** every app has a docs site, so every project is a monorepo;
  Turbo everywhere, non-JS apps (Swift, .NET) behind thin `package.json`
  scripts so every project has the same entry points (moderate confidence).
- **The admin already writes and already runs agents.** The read-only
  objection raised early in the conversation is out of date: admin-plan-authoring
  made the admin start plans and host agent sessions (`a-plan-can-start-from-the-admin`,
  `a-session-can-be-stopped`, the session manager in
  `apps/indusk-mcp/src/lib/session/`). Creating a project is one more write
  through that path, not a new exception.
- **Conversation-first "New plan" is already brief-as-the-contract's**
  (`a-plan-starts-as-a-conversation`, `a-conversation-that-is-not-kept-leaves-nothing-in-the-repository`).
  This plan builds the project-level version on top of it rather than
  absorbing it.

## Walkthrough log

Each entry is something the real feature has to handle.

1. **The text box must take an attachment or paste**, not only a sentence.
   People arrive with documents; "I have a brief" shouldn't need a second turn.
2. **The person's document arrived richer than an InDusk brief** —
   architecture, threat model, milestones. The flow absorbs it rather than
   re-asking.
3. **What was typed and what was attached disagreed** ("desktop and mobile" vs
   "a Windows laptop"). Catching that is the agent's job.
4. **Not everything is code.** Milestone 1 was a device-lockdown runbook — a
   docs-site deliverable.
5. **A project brief is not a plan brief.** It sits above the plans; its
   milestones become plans, each writing its own small brief.
6. **The founding document splits three ways:** why (goals, success criteria)
   → premises (`plan-premises`, the draft brief for a scored project aim);
   what/when (milestones) → master plan; how/where (architecture) → seed
   material for plans' ADRs and research.
7. **Organize the interview by why / what / how-where** and ask only the
   categories the input left empty. Homework Gate's brief answered why and
   what; every remaining question was how/where.
8. **People think in parts before stack.** "Enforcement" and "learning" were
   both the repo layout and the project's promise domains. Ask "what are the
   parts?" early.
9. **The founding document changed mid-conversation** (a newer version was
   pasted). The flow must accept a new version, show the difference, and
   update what it already derived. The agent didn't, and reasoned from the old
   one.
10. **When the founding document needs a change, the agent drafts it in the
    person's voice and the person owns the edit** — brief-as-the-contract's
    rule ("the brief is the person's document") at project level.
11. **"Anything else?" is where the right-way voice belongs:** check the
    document against standard concerns — failure modes, security, data,
    updates, cost, the user's recourse — and state each gap plainly. Homework
    Gate gained: grading disputes, a calendar, data retention and COPPA,
    offline enforcement, server security, enforcer updates, API cost.
12. **The person's answers to the gaps are policy.** Turn them into the
    document in one pass, not a round of follow-ups.
13. **`indusk init` output is stale and misplaced:** its next steps say
    `indusk infra start` (retired with Graphiti), and it drops `instrumentation.ts`,
    `logger.ts`, `filtering-exporter.ts` at a workbench root where no app runs.
14. **"Standard layout" has two definitions.** Docs and `indusk setup` make the
    trunk a symlink to a sibling clone; `worktree list` calls a real clone
    "unusual". Sandy's standard (numero's) is the clone inside the workbench
    plus a `worktrees/` folder. `indusk setup` can't produce it; it was built
    by hand: `git init` the repo inside, then
    `indusk init --workbench --wrapped-repo <name> --sibling-parent <workbench>`.
15. **`init --workbench` writes the legacy single-repo config**
    (`wrapped_repo`); declaring `worktrees/` needed a hand rewrite to the
    `repos[]` form.
16. **The workbench-sync hook ran `git init` and committed the agent's writes
    by itself.** A manual commit was redundant, and the behaviour surprises
    anyone who doesn't know the hook exists.
17. **No home for a project brief.** It went in `planning/project-brief.md`
    with `kind: project-brief`, which nothing reads. Premises (`aim.md`) is not
    built.

## Open questions

- Who runs the agent? Answered: the admin's existing session manager.
- Where may it write — a configured parent directory only?
- The exact line between the non-negotiable core and refusable documents.
- Where the project brief lives, and whether this flow is where premises gets
  built (a project's first conversation is the one moment the aim is stated
  fresh).
- Adopting an existing repo: detect it in the conversation and init in place.

## Related

- [brief-as-the-contract](../brief-as-the-contract/brief.md) — owns
  conversation-first "New plan" (`a-plan-starts-as-a-conversation`); this plan
  is the project-level version on top of it.
- [plan-premises](../plan-premises/brief.md) — the draft brief for a project's
  scored aim.
