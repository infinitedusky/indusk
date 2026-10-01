---
title: "Context tiers — Test Plan"
date: 2026-10-01
status: draft
---

# Context tiers — Test Plan

## Purpose

These are the things that must be true, seen from outside, for a rule to reach
an agent where and when it applies, with nothing lost on the way out of the
root file. Each assertion names the kind of test that will check it. They
become the rows of the impl's Test Trajectory; the ADR that follows is
constrained by "what makes all of these true?"

## Behavioral Assertions

### A rule reaches the session that needs it (tier 3)

| ID | Assertion (what an observer sees) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | A session started at the repo root that opens a plan's `impl.md` has the planning rules in its context — and those rules are not in the root file | e2e (`pnpm e2e`): headless `claude -p` against a fixture holding a codeword in `.indusk/planning/CLAUDE.md`, the real loading path, the probe from research Finding 4 |
| A2 | A session that never opens a file under `apps/indusk-admin/` does not have the admin rules in its context; one that opens an admin component does | e2e, same probe: two sessions, one codeword, opposite answers |
| A3 | The planning rules in this repository's own `.indusk/planning/CLAUDE.md` reach a session that edits an impl — the real file, not only a fixture | e2e against this repository's checkout, the codeword being a sentence the file actually carries |
| A4 | A consumer project that runs `indusk update` gets `.indusk/planning/CLAUDE.md`, byte-identical to the one the package ships, and a second `update` changes nothing | vitest integration: `runCli` on a temp project, then the parity check beside `skill-sync-parity` |

### A broken rule names its lesson when it fails (tier 2)

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A5 | When a guarded test goes red, its failure message names the lesson that explains the rule (`lesson: <name>`), and that name is a real lesson file | vitest integration: run a single-definition pin against a fixture holding a second definition, read the failure text |
| A6 | When a guarded hook refuses, its refusal names the lesson the same way, in the same form — one grammar for test messages and hook messages | vitest over the hook boundary (`runHook`): trigger trunk-guard and one gate hook, read stderr |
| A7 | `list_lessons` reports each lesson as **guarded** or **advisory**; adding the token to a test makes that lesson guarded on the next call, and removing it makes it advisory, with nothing else written | MCP tool through `helpers/tool-call.ts` over a fixture project |
| A8 | A lesson whose name appears only in documentation — the guide that explains the token, the lesson file itself, a changelog — is still advisory; only an enforcer's message makes it guarded | vitest integration, same fixture; the scanner run against the repository that documents its own marker, per the day-promises lesson |
| A9 | `/catchup`'s summary states how many lessons are guarded and how many advisory, and its title skim is limited to the advisory ones | vitest over the skill text (the skill is prose), plus one manual run recorded in the retrospective |

### Nothing is lost, and the pointers hold

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A10 | Every entry the root file held when this plan started appears in the classification register with a destination — a nested file, a test or hook carrying a token, `current.md`, or deleted with a reason — and the check fails naming any entry with none | vitest: parse the root file at the plan's baseline commit (`git show`), parse the register, compare |
| A11 | `indusk context check-pointers` resolves every pointer in **every** context file, including `lesson:` tokens, and fails naming the file and the pointer for any that does not resolve | vitest over the CLI, fixture with a dangling pointer in a nested file |
| A12 | The root file has no Current State section; what it held is in `current.md`'s shared region, and nothing in the repository reads it from the root any more | vitest: section absent from root, present in `current.md`; grep for readers of the old heading |

### The ratchet holds the smaller file

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A13 | The root file is at least 20 % under its new, lower budget at close, and the budget value lives in `.indusk/config.json` with its reason written beside it | vitest: file size against the configured value; the reason key present |
| A14 | A write that would push the root past the new budget is refused, and so is one that would push a **nested** context file past its own | vitest over `claude-md-budget.js` (`runHook`) with both paths |
| A15 | A Context gate item written by `/planner` names its tier and destination, and an item that targets the root says why it must be always-on | vitest over the planner and `/claude-md` skill texts and their installed copies (skill-sync parity) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Nested loading keeps working in future Claude Code versions | The behaviour is observed, not documented (research Finding 4); no test here can see a future release | A1–A3 stay in `pnpm e2e` as a standing probe, run at every plan close that touches context files and before each release; a red probe is a release blocker |
| U2 | Agents actually act on a rule delivered by a nested file or a lesson pointer, rather than merely having it in context | Behaviour of the model, not of the system | The retrospective reports any case in the plan's own sessions where a tier-2 or tier-3 rule was broken while delivered; the eval agent's scorecards are the running signal |

## Notes

- **One grammar for the token** (open question from the brief): A6 forces it —
  the same scanner must read a vitest message and a hook's stderr. The ADR picks
  the form; the test plan only requires that there is one.
- **`claude` in CI** (open question from the brief): A1–A3 run where `pnpm e2e`
  runs today — locally, with a `claude` binary — and are not added to
  `pnpm test`. U1's control makes them a gate at close and before release.
- **The citing rule as a tier-1 conversion** (open question from the brief) is a
  register row, not an assertion here; if the register converts it, its test is
  added to the impl's trajectory then.
- A10 is the plan's "no rule lost" guarantee. Its baseline is the root file as
  it stood when the impl started, read from git — not a copy taken by hand,
  which is the kind of second home this plan exists to remove.
