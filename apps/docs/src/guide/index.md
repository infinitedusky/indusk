---
title: What InDusk Is
---

# What InDusk Is

InDusk is a development system for building software with AI agents. It is not a
framework you import — it is a set of documents, gates, and rituals that live in
your repo and constrain how an agent works in it.

The premise: **an agent left to its own judgment will report success it did not
earn.** Not from dishonesty — from the ordinary failure of checking its own work
against its own expectations. So InDusk supplies expectations the agent cannot
quietly move, and checks it cannot quietly skip.

## The shape of it

```
your-project/
├── .indusk/
│   ├── planning/{plan}/     research → brief → test-plan → adr → impl → retrospective
│   ├── config.json          project profile: mode, extensions, worktree topology
│   └── current.md           per-agent operational state, one section per session
├── .claude/
│   ├── skills/              the process: /planner /work /verify /falsify /cleanup …
│   ├── hooks/               the enforcement: gates that run on every file write
│   └── lessons/             durable rules, accumulated from retrospectives
└── CLAUDE.md                living project memory, hard 60 KB budget
```

Everything below is one of those four things.

## 1. Plans are documents, and they are the contract

Work happens inside a plan. A plan is a folder of documents written in order:
research, brief, test plan, ADR, implementation, retrospective. You do not skip
to code — [`/planner`](/reference/skills/plan) authors them, and each one has to
be accepted before the next is written.

The implementation document is a checklist of phases. Each phase carries **gates**:
implementation items, verification items, context updates, and documentation. A
phase is not done until all of them are.

→ [Plan Lifecycle](/guide/plan-lifecycle)

## 2. Tests are planned before they are written

Every implementation opens with a **Test Trajectory** — a table naming each test,
what it asserts, the earliest phase it could be authored, and the phase it must
pass by.

This exists because deferral is the default failure. "We'll add tests after" is
always true and never happens. The trajectory makes it structural: a row that
should be written at phase 3 blocks the close of phase 3, enforced by a hook, not
by discipline.

→ [Test Trajectory](/guide/test-trajectory)

## 3. Hooks enforce what discipline won't

Seven hooks ship. Four are PreToolUse gates that run before a write or a
commit and refuse; three are PostToolUse and act after the fact:

| Hook | Refuses |
|---|---|
| `validate-impl-structure` | an implementation missing required sections |
| `check-gates` | closing a phase whose gates or trajectory rows are open |
| `claude-md-budget` | a CLAUDE.md write past the 60 KB ceiling |
| `trunk-guard` | code edited or committed on `main` — an Edit/Write, or a `git commit` whose paths (staged, `-a`/`-am`, or named as pathspecs), fall outside `.indusk/`, `.claude/lessons/`, settings, `CLAUDE.md` and `AGENTS.md` while the repository is on a protected branch. The commit gate reads `git -C … commit`, a preceding `cd`, `bash -c "…"`, `$(…)` and backticks; a script that commits inside itself is out of its sight |
| `eval-trigger` | *(PostToolUse)* — nothing; on every `git commit` it spawns the evaluator that scores the diff, and in a multi-repo workbench it refuses to guess which repo the commit belongs to |
| `workbench-sync` | *(PostToolUse)* — nothing; commits workbench context after edits |
| `gate-reminder` | *(PostToolUse, advisory)* — nothing; when an edit closes a phase it puts the next phase's tests-to-author in front of the agent as additional context |

These are not linting. They block the edit. An agent that wants to mark a phase
done with a red test simply cannot.

**The trunk guard** (2026-09-17) closes the last gap in "one plan, one branch,
one landing": nothing had stopped an agent from editing code straight on
`main` when the change felt small, and one afternoon saw a skill step, a guard
fix, a feature and another session's WIP land on trunk with no plan behind any
of them. The hook refuses the packaged edit at the source. It has two matchers
because the edit gate alone is not enough — an edit made through `sed`, a
heredoc or a script never passes through Edit or Write, so the `git commit`
gate judges what is actually staged. What stays editable on trunk is exactly
what a plan writes before it has a worktree (its brief) or after it landed (the
compaction, the landing note), plus what the eval agent writes: plan documents,
lessons, settings, `CLAUDE.md`, `AGENTS.md`. A `chore(release):` commit is the
one packaged edit that belongs on trunk and is exempt. Two off switches, both
deliberate and visible: `worktree.trunk_guard.enabled: false` in
`.indusk/config.json` for a project that wants trunk work, and
`INDUSK_TRUNK_GUARD=off` in the environment for one call. In a versioned
workbench the branch judged is the declared code repository's; the workbench
repository holds plan documents and is allow-listed by path.

Where they run from matters. Claude Code runs a hook command in the session's
*current* directory, which moves with every Bash call that ends in a `cd`, and
a hook that fails to load exits 1 — which the host treats as non-blocking, so
the edit proceeds and nothing says the gate was off. For that reason every hook
is registered by the project root, as
`node "${CLAUDE_PROJECT_DIR:-.}"/.claude/hooks/<name>.js`, never by a path relative
to the cwd; `indusk update` rewrites the older relative form in place. The one
thing the registration cannot fix is a session launched from a subdirectory,
where `${CLAUDE_PROJECT_DIR}` *is* that subdirectory — launch at the root.

## 4. Three rituals run before a plan closes

Each one asks a question the author is worst placed to ask themselves.

- **[Shape](/guide/shape)** — after each phase, review the code *that phase* wrote
  for craft. Intra-unit: does this have one job, a name, a seam?
- **[Falsify](/guide/falsification-ritual)** — before close, flip the goal. Not
  "does it work" but "what specific input breaks it?" Findings become a new phase.
- **[Cleanup](/guide/cleanup-ritual)** — then look across files: duplication, the
  rule of three, boundaries that settled somewhere wrong.

Only then does [`/retrospective`](/reference/skills/retrospective) close the plan,
publish its decisions and lessons to this site, and archive it.

## 5. The system learns from itself

A background **eval agent** fires on every commit, scores the work, and turns
durable moments into **lessons** — rules that load in every future session, in
every project. The working agent flags moments with `/highlight`; it never writes
lessons itself.

→ [Agent Roles](/guide/agent-roles) · [Evaluation](/guide/eval)

## 6. Context is a budget, not a bucket

`CLAUDE.md` loads into every session, so every byte is paid forever. It has a hard
60 KB ceiling enforced at write time, and every plan close compacts as much as it
adds.

→ [Context Budget](/guide/context-budget)

## 7. Workbenches, for working across repos

A **workbench** wraps one or more repos: it holds the shared `.indusk/` context
while the repos live beside it or inside it. The workbench is itself a git repo
with its own remote, so your planning history, skills, and lessons move between
machines instead of living on one laptop.

→ [Workbenches & Worktrees](/guide/worktree-setup) · [Sharing a Workbench](/guide/workbench-sharing)

## 8. Extensions carry tool knowledge

InDusk core hardcodes nothing about your stack. 21 extensions carry
language patterns, observability wiring, environment management and review
tooling. Only `local-telemetry` is on by default — it is the daemon InDusk runs
itself.

→ [Extensions](/guide/extensions) · [Extension reference](/reference/extensions/)

## Where to go next

| You want to | Read |
|---|---|
| Set it up | [Getting Started](/guide/getting-started) |
| See a plan end to end | [Walkthrough](/guide/walkthrough) |
| Know why something is the way it is | [Decisions](/decisions/) |
| Avoid a mistake already made | [Lessons](/lessons/) |
| Look up a command | [CLI reference](/reference/cli/) |
| Know where this is going | [Roadmap](/strategy/) |
