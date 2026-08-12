# The Shape check — craft feedback at the phase boundary

**Status**: accepted · **Shipped**: 2026-08-10 · [Full ADR](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/archive/lifecycle-rebalance/adr.md)

## What was decided

An agent that writes badly-shaped code should hear about it in the phase that wrote it, not four phases later at plan close. `/work`'s per-phase order gains a **Shape** step between Verification and Context: the executing agent reviews the files *that phase* changed against the craft rules of the project's enabled extensions, and findings append as ordinary unchecked checklist items to the same phase.

The motivating case is concrete. In `dawn-verify`, report rendering written inline at Phase 2 surfaced at **Phase 7**, where it had to be extracted before the fix could be tested at all.

## The four decisions that matter

**Executor behavior, not plan structure.** No `#### Phase N Shape` heading, no validator rule, nothing retrofitted into 51 existing impls. Gate vocabulary is defined in four independent places and an unrecognized `####` heading **fails silently** — it misclassifies its items rather than erroring. A step costs none of that.

**The executing agent performs the judgment.** In this lane the executor is already a model, so the review needs no extra call. Heuristics were rejected on a specific failure: the motivating case was ~15 lines and crossed no line-count threshold. More decisively, extension craft rules are *prose*, and a heuristic engine cannot read prose without re-expressing every rule as machine config — duplicating knowledge the extensions own.

**Shape is intra-unit; `/cleanup` stays inter-file.** The division follows from what each check can *see*, not from taste: the second copy of a helper usually does not exist until a later phase writes it, so a phase-scoped review structurally cannot be responsible for cross-file duplication. Pinned from both sides in the suite — Shape declines duplication *and* cleanup's scan still returns those files, so "Shape reviewed it" never comes to mean nobody looks again.

**Findings append rather than block.** A craft judgment is fuzzier than the structural gates; a false positive halting an unattended run is worse than an extraction landing one phase late. An unchecked item is non-ignorable without being fatal — the existing machinery already refuses to close a phase with outstanding items.

## Tradeoffs accepted

- **The agent reviews its own work.** Author bias is real; the mitigation is that the rules come from *outside* the agent.
- **Judgment quality has no test and cannot have one.** Calibrated by observation instead: every retrospective records the plan's finding and false-positive counts, and two consecutive plans of human-judged-wrong findings reopens calibration as a falsification hypothesis. First data point: 2 raised, 0 judged wrong — recorded with the caveat that author, reviewer and judge were the same agent on hours-old diffs.
- **Per-phase review costs tokens** on every code-touching phase.
- **Claude Code lane only.** `atdawn run` gets Shape in a later plan, where the extra model call is a real cost paid deliberately.
- **One new piece of machine state** — the phase-boundary record, which turned out to have obligations of its own (below).

## What the build taught, beyond the decision

**A newly tracked artifact must be registered with every "what changed" detector and given a merge strategy in the commit that first writes it.** Committing `.indusk/phase-boundary.jsonl` silently disabled `verify`'s phantom detection — the same trap the verify ledger sprang, repeated. The detector list is maintained by hand (`phantom.ts`'s `isMachineState`, `shape/changed.ts`'s `isNotCode`, `cleanup/oversized.ts`, `.gitattributes`), and those predicates are deliberately **not** shared: `shape` excludes all of `.indusk/` including plan docs, `phantom` cannot, because `impl.md` is exactly the file it needs to see.

**A row asserting "Shape ran" cannot live in its own phase's Verification gate** — Shape refuses until verification is green, and the row is part of verification. Dogfood evidence belongs in the next phase.

## See also

- [The Shape check](/guide/shape) — how it runs, what it reviews, the scope's edges
- [Cleanup ritual](/guide/cleanup-ritual) — the inter-file half
- [Lessons from lifecycle-rebalance](/lessons/lifecycle-rebalance)
