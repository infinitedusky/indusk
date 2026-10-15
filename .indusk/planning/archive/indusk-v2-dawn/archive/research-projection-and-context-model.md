---
title: Projection layer + connection-based context (thread capture)
date: 2026-05-07
status: research-note
companion: research-fde-and-extraction.md, research-dawn-project-architecture.md, decisions.md
catalyst: CGC version-comparison thread surfaced two related architectural questions
---

# Projection layer + connection-based context

Captured from a session-long thread on 2026-05-07. Not yet ratified — distilling here so the thinking doesn't evaporate before the next decisions-ledger pass. Two threads converged: how context is *modeled and retrieved*, and how Dawn-managed artifacts physically *live in the worktree*.

---

## Trigger

Asked CGC upstream whether the npm-import-as-Module-node bloat had been addressed in 0.3.1 → 0.4.7. Answer: no, same code, and upstream direction is opposite (more dependency-as-graph-nodes, not less). Confirmed CGC's design isn't aligned with what we want long-term — this is one reason [D2 in the decisions ledger](decisions.md) (CGC as required → optional petal) is correct.

The conversation then drifted into "what *is* the right context model for Dawn," surfacing two distinct questions that I had been conflating.

---

## Thread 1 — Connection-based context, reaffirmed

### The pushback

Sandy: pump the brakes on a "code documentation context model." Reasoning: a lot of context applies to multiple things at the same time. A document-centric model ("one md file per topic, attached to a path") forces duplication of context across N files. Inefficient.

Original Indusk thesis was correct: every piece of context connects to every file/function/concept it applies to. When working on a file, the agent walks direct + indirect connections to assemble what's relevant. Context-beam is the existing implementation of this.

### The agreement

Document-centric retrieval was a drift in the recent Dawn product-definition docs (`index.md`, `5x-on-day-1.md`, `out-of-scope.md` all describe Dawn as holding "plans, lessons, decisions" as if they're discrete addressable docs). The framing should be:

- Context lives as **nodes in a graph** in the Dawn app
- Each node has **edges to every file/function/concept it applies to**
- Retrieval at use-time is **graph traversal with distance decay** (like the existing context-beam)
- Documents (ADR narratives, postmortems, lessons) still exist — they're node *types* in the graph, not the primary access shape

CGC + Graphiti + the knowledge-graph machinery is **one petal** in the petal model — specifically the *knowledge-graph context petal*. Other petals: OTel runtime signals, test results, compiler output, annotations, preferences/flags. The product's value is **correlation across petals**, not the contents of any single petal.

### Nuance worth keeping

Connection-based isn't anti-document. Documents stay; they're graph nodes connected to their applicable files. The duplication being avoided is "the same context fact stored in 5 file-attached docs," not "documents shouldn't exist."

The implicit cost: connection-based requires authoring discipline that document-centric doesn't. Edges have to come from somewhere. Today they're implicit (plans link to files they touch; lessons name files in their text; OTel rules pattern-match function shapes). Implicit edges are fragile across renames, file moves, refactors. **Authoring story for explicit edges is a real product question.**

---

## Thread 2 — Projection as the universal artifact-placement mechanism

### The tangent that got rejected

Earlier discussion (offline, before this session) had explored: OTel rules are projected onto a codebase via AST patterns rather than committed inline. Could the same projection work for *context*? Could context be projected onto files via declarative patterns?

After reflection: no. The OTel projection earns its weight specifically because **OTel must live in code at runtime to instrument**. Context has no such constraint — it can stay external in the graph. Projecting context onto code re-creates the duplication problem connection-based solves.

So: **don't generalize the OTel-projection pattern to context**. Context lives external; OTel rules live as projection. They're different mechanisms for different reasons.

### The deeper insight (separate from the rejected tangent)

But there's a different generalization that *does* work: **projection is the right pattern for any artifact Dawn manages that lives in the worktree but shouldn't commit upstream.**

Dawn could project lots of stuff onto the codebase that is NOT context:
- OTel rules (already in [A10](decisions.md#new-decisions))
- Tests (richer than upstream wants)
- Dev admin pages
- Scratch utilities
- Trace dumps, memory snapshots, observability fixtures
- Anything "overly robust" the engineer wants locally but never in production

These artifacts:
- Physically live in the worktree (engineer/agent works against them seamlessly)
- Are tagged/marked as projection (Dawn knows they're hers)
- Don't get committed upstream
- Have their own commit history *inside Dawn*
- Accrue across the engagement
- Survive rebases against upstream

This is the **generalization of fork-and-extract (A9)** from "long FDE engagements against external codebases" to "the universal artifact-placement model for everything Dawn touches in the worktree."

### Distinguishing from the rejected tangent

| Rejected | Affirmed |
|---|---|
| Context encoded INTO code (annotations, comments, inline metadata) | Artifacts physically in worktree, tagged as Dawn-managed |
| Context lives *in* code | Artifacts live *alongside* code |
| Violates connection-based retrieval | Doesn't touch retrieval at all — it's about file-system placement |
| OTel-projection symmetry argument | Generalization of fork-and-extract |

The first stays rejected. The second is the architecture.

### Why this is load-bearing for the FDE wedge

This is the **team-multiplicative property made concrete**. The projection layer IS the engagement's institutional artifacts:

- Two FDEs share a projection layer
- When one rotates out, the next pulls upstream + Dawn's projection for that engagement
- The next FDE's worktree is *physically the same* as the previous engineer's, including dev tools they built
- Day-1 visibility isn't "I read the docs" — it's "my filesystem matches my predecessor's"

This is a stronger version of the FDE-MVP promise than the current [5x-on-day-1](../../apps/indusk-docs/src/dawn/5x-on-day-1.md) doc captures. Worth surfacing explicitly when that doc gets a sharpening pass.

---

## How this maps onto existing decisions

| Existing decision | Status after this thread |
|---|---|
| A9 (fork-and-extract for FDE) | **Generalize** — projection layer is universal; fork-and-extract is the model applied to external repos |
| A10 (AST-driven OTel rule engine) | Unchanged — OTel rules are one *type* of projected artifact |
| A12 (emission-only direction) | Unchanged — Dawn app receives signals; doesn't write to codebase |
| A13 (codebase = only prod code + tests + OTel rules) | **Refine** — distinguish *codebase* (committed upstream) from *worktree* (codebase + projection layer) |

Proposed new entries (not yet ratified):

- **A15** — Projection layer with its own history. Artifacts in the projection layer accrue over time and have their own commit history within Dawn. Dawn's history is durable across rebases of the upstream codebase.
- **A16** — Projection promotion + reconciliation. Dawn supports `extract` (projection → upstream codebase, commit) and `reconcile` (detect upstream gained a file Dawn was projecting, reconcile).

Proposed open questions to queue:

- **O16** — Projection mechanism: gitignored path, `.dawn/projected/` overlay directory, file-by-file manifest, or hybrid?
- **O17** — Conflict policy when upstream and projection both touch the same file: merge, override, refuse, warn? Per artifact type?
- **O18** — Promotion UX: engineer-driven `extract` command, automated detection of "this should ship," or both?
- **O19** — Reconciliation when upstream adopts a file Dawn was projecting: remove projection silently, warn, or require engineer confirmation?

---

## Implications for the public Dawn docs

The Dawn docs at `apps/indusk-docs/src/dawn/` drift toward document-centric framing in places. When the next sharpening pass happens (deferred), four edits are queued:

1. Tighten the framing to make graph-based-connection-retrieval explicit (drop the document-centric drift)
2. Add a `context-model.md` page naming the connection-based thesis
3. Refine A1 in the decisions doc with a sibling that names graph traversal as the read shape
4. Add a PICK in `pick-defer-cut.md` memorializing the rejection of context-as-projection-into-code (with kill condition for revisiting)

Plus, if A15/A16 ratify:

5. New page or section explaining the projection layer + extract/reconcile operations
6. Promote the FDE-rotation team-multiplicative angle in `why.md` and `5x-on-day-1.md` — projection layer IS the institutional artifact substrate

None of these landed in this session — Sandy chose to capture the thinking and defer the edits.

---

## Open questions for follow-up sessions

- **Authoring story for explicit edges in the connection-based context graph.** Implicit edges are fragile across renames/moves/refactors. Plans, lessons, and OTel rules each have a different implicit-edge mechanism today. What's the cohesive story?
- **What does the projection layer feel like in practice?** Concrete worked example: an FDE on Avoca-next, what's projected on day 1, what they author into the projection over the engagement, what gets extracted to upstream, what stays projected forever.
- **Two-VCS mental model.** Engineers will need to internalize: my worktree state = upstream commit + Dawn projection state. The cognitive cost of that needs to be measured against a real engagement before declaring it acceptable.
- **Tooling integration.** IDE/linter/type-checker see the projection (read worktree). CI doesn't (pulls upstream only). Tests run locally with projection-augmented assertions; tests in CI run against upstream only. This is *probably* a feature (local correctness vs production correctness become separately testable) but the testing strategy doc that confirms it doesn't exist yet.
- **Where does AGENTS.md / `.claude/` skills sit?** Per A8, skills are Dawn-app source of truth, projected into the codebase per active agent. That's already projection-shaped — A15/A16 just generalize and name what's already happening for skills.

---

## Status

Research-note. None of the proposed decisions ratified yet. Captured to preserve thinking before context evaporates.

When ratified, decisions migrate to `decisions.md`; doc updates land in `apps/indusk-docs/src/dawn/`; this file moves to `archive/` or stays as the captured-thread record.
