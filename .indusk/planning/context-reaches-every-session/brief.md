---
title: "Context reaches every session"
date: 2026-10-06
status: draft
workflow: feature
---

# Context reaches every session — Brief

*Opened 2026-10-06, after planner-promises landed. The nested-context probe
(context-tiers' e2e) went red on Claude Code 2.1.289. Sandy: "Can we trigger
the context then if it's not automatic?" and "do the hook, write the plan
brief". A draft from that conversation, to be reworked in the planner's
conversation before it is accepted; nothing is declared. What was measured is
in Background below and moves to research when the plan starts.*

## Background (moves to research)

- **The documentation says nested files load.** Claude Code's memory page
  (code.claude.com/docs/en/memory) says subdirectory `CLAUDE.md` files "are
  included when Claude reads files in those subdirectories". It makes no
  exception for any mode and offers no setting.
- **Headless runs never load them.** Measured 2026-10-05 in a scratch project
  with a root and a subdirectory `CLAUDE.md`. On 2.1.288 and 2.1.289, plain
  `-p`, streamed input (the editor's mode) and a read and question split across
  two turns all saw only the root file; the subdirectory's never appeared in
  the event stream. The same failure showed in this repository, a trusted
  workspace, on `.indusk/planning/`. Removing every inherited `CLAUDE*`
  environment variable changed nothing.
- **The editor session that ran those tests did receive them**, on 2.1.288,
  when it read files under `.indusk/planning/`.
- **A PostToolUse hook did not run at all in those headless runs.** It was
  passed with `--settings` and logged nothing, in a scratch folder and in this
  repository. Whether the project's own hooks (the gates Dawn relies on) fire
  in headless runs is not known. It must be measured first, because the
  delivery proposed here is a hook.

## Expectations

1. **Every session that touches a directory gets that directory's rules.**
   - Measure: the rebuilt probe, run in the editor's mode and in headless
     mode, sees each nested file's codeword after a read beneath it.
   - Look: when this plan closes, and at every landing that touches a
     `CLAUDE.md`.
2. **Headless agents stop breaking rules that only a nested file states.**
   - Measure: evaluator findings that cite a rule from a nested `CLAUDE.md`
     the run did not follow, over the next five plans, against the last five.
   - Look: when the fifth plan closes.

## Promises

### This plan makes

1. **`nested-rules-reach-every-session`** (state). A session that reads,
   writes or edits a file beneath a directory with a `CLAUDE.md` has that
   file's rules in context, in the editor, in the terminal and headless.
2. **`the-context-probe-measures-real-sessions`** (structure). The
   nested-context probe drives Claude the way a real session does, and says
   which mode it ran in.

### Existing promises

**Must not break**

- **`gates-ran-at-every-checkoff`**. A new hook joins the chain; the gates
  must still run on every checkoff.

**Changes**

None.

**Replaces**

None.

### Not promised

- Fixing Claude Code. If headless runs contradict the documentation, the
  report goes upstream; this plan delivers the rules either way.
- Shrinking what is delivered. A file delivered twice in an editor session
  (once by Claude Code, once by the hook) is accepted for now.

## Depends On

- context-tiers (archived): the nested files and the probe this plan repairs.

## Blocks

- None.
