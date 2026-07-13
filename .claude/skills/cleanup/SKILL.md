---
name: cleanup
description: Run the cleanup ritual against a plan whose /work (and /falsify) have completed. Review the plan's changed files for decomposition opportunities, apply the enabled domain extensions' best practices, and author a Cleanup Phase in the plan's impl.md capturing the extractions/refactors as checklist items. The ritual authors; /work executes. Runs after /falsify, before /retrospective.
argument-hint: "{plan-name}"
---

You are about to run the **cleanup ritual** against a plan whose `/work` and `/falsify` have completed. The code is correct and its coverage is hardened. Your job now is to make the code **as good as it can be** — to look at what this plan actually produced and decompose what has grown unwieldy, guided by best practices.

This is a goal-flip, not a persona switch. Same agent, different question. Instead of "does this work?" — "what cohesive unit here should be lifted into its own file, and what do best practices say to do about it?"

The ritual's output is **a new phase appended to the plan's `impl.md`** — not a refactor performed inline, not a separate log. You investigate the changed files, form specific recommendations, author a Cleanup Phase capturing the extractions/refactors as checklist items (and any new units as trajectory rows), and you leave. `/work` picks up the phase later and actually does the decomposition. `/retrospective` waits for the phase to close before the plan archives.

Why this shape: cleanup phases are **visible** (admin UI renders all phases), **deferrable** (you don't have to refactor right now to preserve the discipline), and **traceable** (the plan's story shows normal work → falsification → cleanup → close). It is the exact shape `/falsify` uses — cleanup is its twin.

## Runs after falsification

The close-out sequence is: `/work` → `/falsify` → `/work` → **`/cleanup`** → `/work` → `/retrospective`. Cleanup runs AFTER falsification deliberately — you refactor under the maximal green coverage falsification just hardened. Never restructure code whose correctness hasn't been proven.

## How to investigate

This is best-practice-guided decomposition, not blanket extraction. **Extraction is not universally good** — forcing it produces 8-line "components", prop-drilling, and the wrong abstraction (which costs more than the duplication it removes). Recommend only what best practices actually warrant.

1. **Find the changed files that deserve scrutiny.** The threshold is a focus tool, not a cap. Use `listOversizedChangedFiles(planRoot, baseRef)` from `apps/indusk-mcp/src/lib/cleanup/oversized.js` (invoke via `tsx` or shell out) — it diffs the plan's branch against its merge base and returns the changed files over their resolved cleanup cap, with `{ path, loc, cap, scope, isNew }`. The caps come from the `cleanup` config block in `.indusk/config.json` (`max_file_loc` + per-scope overrides). A file being flagged means "look here", not "this fails".
2. **Apply the enabled domain extensions' best practices.** What counts as a cohesive unit is domain-specific — it comes from the enabled extensions, not from this skill. Read the skills of the project's enabled domain extensions (via `extensions_status` / `get_skill_summaries`):
   - **`nextjs`** — "minimize `"use client"` boundaries, push them as deep as possible"; "server components can't use hooks/event handlers". The concrete move on a Next.js project is often *pull the interactive `"use client"` island out of a big server component into its own file*, splitting server and client concerns.
   - **`react`** — "one component per file for non-trivial components".
   - On a library/CLI with neither extension enabled, the move is *extract a function or module*.
   The extraction *patterns* compose from whatever domain extensions the project has on. Do not hardcode framework assumptions.
3. **Form specific recommendations.** For each flagged file (and any duplication you spot via `find_code`), name the exact unit to extract and the best-practice basis: "the `Chip` markup (lines X–Y) is repeated N times and is a self-contained presentational unit → extract to `components/chips/Chip.tsx` per react's one-component-per-file." Or conclude, with reasoning, that a file is cohesive and should be left as-is (see below).
4. **Capture each recommendation as an impl item** — one checklist item per concrete extraction/refactor. If a new public unit is created (a component, a hook, an exported function), add a Test Trajectory row for it (behavior-parity or a focused test).

Prompts to ask yourself while investigating:

- **What repeats?** Repeated markup/logic across the changed files is the strongest extraction signal (the rule of three).
- **What has a single responsibility that's currently tangled with others?** A seat that owns its card + bet + badges is a component; lift it.
- **Is there a server/client boundary being crossed inline?** (Next.js) — that's a principled split, not arbitrary line-shuffling.
- **Would extracting this make the code HARDER to follow?** If yes, don't. Note why you left it.

## "Leave as-is" is a first-class decision

Sometimes best practices say *leave it*: the file is cohesive, the touch was tiny, or extracting would create a worse abstraction. That is a legitimate outcome — **record it with its reasoning** as a checklist item (e.g. `- [ ] (reviewed \`page.tsx\` — left as-is: the 260 lines are one cohesive route handler; extracting would scatter tightly-coupled logic)`), not a silent skip. The recorded decision is reviewable in the authored phase and scored by the eval agent. Do not manufacture extractions just to shrink a number — there is no LOC gate; the number is attention-focus only.

## What the Cleanup Phase contains

When you've formed one or more recommendations, **append a new phase to the plan's `impl.md`** with this shape:

```markdown
### Phase N: Cleanup — {short summary of the decomposition theme}

**Goal**: decompose {one-sentence description of what this plan grew} per {the best-practice basis}. Each item below is a concrete extraction/refactor (or a reasoned leave-as-is); each new unit gets a trajectory row.

- [ ] Extract {unit} from {file} into {new file} — {best-practice basis}
- [ ] {next extraction / refactor}
- [ ] (reviewed {file} — left as-is: {reason})
- ...

#### Phase N Verification
- [ ] T{M}: {new unit has a focused test / behavior-parity holds}
- [ ] (no tests flip at this phase — reason: refactor)  ← only if purely structure-preserving with existing coverage

#### Phase N Context
- [ ] {CLAUDE.md edit noting the new component/module structure, or "(none — internal decomposition)" with proof}

#### Phase N Document
- [ ] {docs update if the public surface changed, or "(none — internal decomposition)" with proof}
```

Add any new-unit trajectory rows to the plan's `## Test Trajectory` table (`Writable at`/`Passes at: Phase N`). **The phase title must START with "Cleanup"** (`### Phase N: Cleanup — {summary}`) — the retrospective gate's `isCleanupComplete` detects the ritual phase by a title *beginning* with "cleanup" (case-insensitive), NOT a substring anywhere. A substring match would misdetect a topic-named phase like "The /cleanup skill" as the ritual phase.

**What you do NOT do in the skill:**

- You do not perform the refactor. That's `/work`'s job when it picks up the phase.
- You do not run tests. The skill's output is the modified `impl.md`, nothing else.
- You do not extract for the sake of hitting a number. Recommend what best practices warrant; leave the rest, with reasons.

The plan's impl status stays `in-progress` because the Cleanup Phase is unchecked. `/work` picks it up next.

## Loop exit (hybrid)

Continue until you genuinely cannot name another warranted extraction or refactor — not "I've flagged enough files", but "I have reviewed the changed files and every remaining one is either under threshold or cohesive-and-correctly-shaped." Present the user with a summary: files flagged + recommended, files reviewed-and-left-as-is (with reasons), files under threshold (untouched). The user confirms termination or points at a file you under-scrutinized.

## If there is nothing to clean up

If after investigation there is genuinely nothing worth decomposing — every changed file is under threshold or cohesive — **do not author an empty Cleanup Phase**. Instead add to the plan's `impl.md` frontmatter:

```yaml
cleanup: skipped
cleanup_reason: "reviewed changed files X, Y, Z; all under threshold or cohesive; nothing warrants extraction"
```

This is a confession, not a bypass — it is visible in the retrospective audit and records what you reviewed. Use it when there is truly nothing to do, or for trivial plans (typo, changelog) where the ritual cost exceeds the value.

The retrospective skill's Step 0 gate accepts either a terminal Cleanup Phase (`isCleanupComplete(planRoot)`) OR the `cleanup: skipped` + `cleanup_reason` pair (`isCleanupSkipped(implContent)`). See `apps/indusk-mcp/src/lib/cleanup/gate.js`.

## Output

By the time you hand off to `/retrospective`, one of these must be true:

- A Cleanup Phase has been appended to the plan's `impl.md` (extractions + any trajectory rows + gates); `/work` will later close it. Impl status stays `in-progress`.
- The plan's impl frontmatter contains `cleanup: skipped` + `cleanup_reason` with a real reason.

The `/retrospective` skill's Step 0 hard-blocks without one of these (alongside the falsification requirement). Don't bypass.

## Important

- Same agent, flipped goal. No persona, no separate session. The you that built the plan, asking "how do I make this well-shaped?"
- Best-practice-guided, not blanket extraction. Over-extraction is a failure mode; "leave as-is" with a reason is a valid, recorded outcome.
- **What to extract comes from the enabled domain extensions** (nextjs/react/…), not this skill. Read their skills for the project's decomposition idioms.
- The threshold is attention-focus, never a blocking cap. There is no mechanical LOC gate anywhere.
- **Never refactor during the ritual.** The skill's output is the modified `impl.md`. `/work` does the decomposition later.
- Runs AFTER `/falsify` — refactor under green coverage.
- The user's input is: $ARGUMENTS
