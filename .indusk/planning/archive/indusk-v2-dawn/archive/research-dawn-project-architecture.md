---
title: Dawn project architecture — app/codebase split, worktree inheritance, emission direction
date: 2026-05-02
status: research-note
companion: research-fde-and-extraction.md
---

# Dawn project architecture

Sharpens the architecture sketched in [research-fde-and-extraction.md](research-fde-and-extraction.md). The fork-and-extract document framed the question as "how do we keep dev tooling out of the client's codebase?" This document reframes it as the more general principle: **the Dawn app and the codebase are two distinct surfaces**. Forking is one mechanism for maintaining that separation in long FDE engagements; for your own projects, no fork is needed, but the same surface split applies.

---

## The split: Dawn app vs codebase

A Dawn project consists of two distinct surfaces:

```
Dawn project (one per application)
│
├─ Dawn app  (system surface — runs OUTSIDE the codebase)
│   Graphiti · Jaeger · admin UI · planning · lessons
│   skills + hooks library · memory · feedback
│   Persistent across all worktrees of this project.
│
└─ Codebase (the application — what the user is building or editing)
    Production code · test suites · OTel rules
    Optionally: a thin gitignored `.dusk/` pointer (project ID,
    parent worktree). No durable Dawn state in the codebase.
```

The **codebase** holds only what's intrinsic to the application: production code, the tests that exercise it, and the OTel rules that describe what to instrument. The **Dawn app** holds everything else — and crucially, holds it *outside* the codebase, where it persists across every worktree, every fork, every rebase.

This is a stricter discipline than "system Dawn vs worktree Dawn." There is no per-worktree Dawn install. Worktrees never have a Dawn install. The Dawn app discovers them; they don't announce themselves.

---

## Worktrees as execution surfaces

Within a codebase, worktrees are where actual execution happens. Worktrees:

- Branch off other worktrees (or main)
- **Inherit tests + OTel rules** from their parent worktree
- Can override or add — but start with the parent's full inheritance
- Can diverge meaningfully from siblings (different feature branches with different test concerns)
- **Don't write Dawn-specific files.** No `.indusk/` per worktree. No skill files. No planning. Nothing.
- **Emit signals OUT** to the Dawn app

The inheritance is **tree-shaped, not flat**. A worktree branched off `feat/autoops-reschedule` starts with that worktree's tests + OTel rules in effect. It can override or extend, but it doesn't start from nothing. When you cut a sub-worktree off a feature worktree, you carry the feature's instrumentation forward without re-authoring it.

The Dawn app holds the inheritance graph. Worktrees just *are*; the Dawn app knows what each one inherits from.

---

## Direction: emission only

The flow between the codebase and the Dawn app is **one-way**:

```
Worktree (executes) → emits OTel spans, test results, logs
                    → Dawn app receives → correlates → memory + UI
```

- **Worktrees emit.** Tests run, code executes, OTel spans fire, logs are written.
- **The Dawn app receives.** It accumulates spans into Jaeger, episodes into Graphiti, scorecards into the admin UI.
- **The Dawn app reads** the codebase via git / filesystem (to render plans, parse trajectories, walk diff state). But it does **not write to the codebase** as part of normal operation. Code changes happen because the agent (driven by the user) edits the codebase — not because the Dawn app reaches in.

This is the principle that makes fork-and-extract clean: the codebase stays pristine, the Dawn app accumulates state outside it, and PR extraction only needs to walk the production-code delta.

---

## The signal-correlation loop in practice

Concrete example of the architecture in motion. This is what makes the abstract claim/evidence model from A1 + the three-agent architecture from A2 *real*:

1. User says to Dawn: *"let's run the autoOps reschedule test"*
2. Test executes in the worktree's codebase
3. Test emits an OTel error span
4. The Dawn app receives the span and correlates against:
   - **Test history** — *"this test passed last week; what changed?"*
   - **Plan in place** — *"the user is mid-feature on autoOps reschedule; did this work touch the path?"*
   - **Graphiti memory** — *"have we seen this error shape before? What did we conclude then?"*
5. The Dawn app produces a hypothesis: *"this looks like we missed a case the test should have covered"* or *"the test was written wrong — the assertion doesn't match the new contract."*
6. User decides: fix the code, fix the test, or accept the finding.

This loop only works because the Dawn app sits **outside** the codebase, persists **across worktrees**, and has accumulated correlation surface that no single test or worktree could have. The codebase only ever sees what's relevant to the current execution; the Dawn app sees everything across history and across siblings.

The hypothesis in step 5 is what differentiates this from "just run tests + observe." Test runners produce pass/fail. The Dawn app produces *why* — and *why now* — by joining test history × plan context × memory. That join is the product.

---

## FDE engagements as a special case

For FDE work against a client's repository, the codebase is a **fork** that's continuously rebased against upstream. Otherwise the architecture is identical:

- Dawn app sits outside the fork
- Worktrees branch off the fork; emit signals to Dawn app
- PR submission = AST-driven extraction of production-code delta
- Reviewer access to dev-layer artifacts via Dawn-served signed URLs (not via commits in the upstream repo)

For your own projects, there's no fork — the Dawn app sits next to the codebase locally. **Same architecture, different deployment shape.** The fork-and-extract complexity is purely a function of the upstream relationship, not of the Dawn architecture itself.

This is why "fork-and-extract" is a *special case*, not the central pattern. The central pattern is the codebase/Dawn-app split, applied with discipline regardless of whether the codebase is yours or someone else's.

---

## What lives in the codebase, strictly

Two rules:

1. **No durable Dawn state in the codebase.** No planning artifacts. No lessons. No Graphiti episodes. No skill files. No memory. All durable state is in the Dawn app, which lives outside the codebase.

2. **Optional thin pointer at most.** A gitignored `.dusk/` (or `.dawn/`) directory containing only:
   - The Dawn project ID this codebase belongs to
   - The parent worktree pointer (which worktree this branched off, for inheritance lookup)
   
   This is an **optimization**, not a requirement. The Dawn app can also discover identity via git remote URL, project config, or explicit user assignment.

Worktrees in the codebase don't even need to be gitignored, because **nothing Dawn-specific lives in them**. The codebase is pristine production code + tests + OTel rule declarations. Period.

---

## Implications for the existing ledger

This architecture sharpens or supersedes several existing entries:

- **U1** ("OTel-as-extension → signal-petal-as-extension") gets the missing detail: petals are *emission points* in the codebase that send signals to the Dawn app. The petal is where it leaves; the Dawn app is where it lands.

- **A8** ("agent-neutral skills & hooks via `.dawn/`") needs revision. `.dawn/` *in the codebase* should not be source-of-truth for skills or hooks — those live in the **Dawn app**, not the codebase. The codebase's `.dusk/`, if present, is a thin pointer at most. The skill/hook library is Dawn-app-side and gets projected to whichever agent adapter the user is currently driving (Claude Code, Cursor, etc.).

- The fork-and-extract pattern from [research-fde-and-extraction.md](research-fde-and-extraction.md) is reframed as a special case of the codebase/Dawn-app split, applicable to long FDE engagements.

These imply new ledger items: codebase-only-holds-prod-code-tests-rules; worktree-tree inheritance; emission-only direction; AST rule engine for OTel; `apps/dawn-test-target/` for iterating the rule engine.

---

## Open questions

Carried forward from [research-fde-and-extraction.md](research-fde-and-extraction.md), with one reframed:

1. Rule-engine syntax — TypeScript decorators? AST-visitor functions? DSL? Configuration files?
2. AST-library choice — TypeScript compiler API (most accurate, TS-only) vs Babel (broader, JS-first) vs Tree-sitter (multi-language, faster, less idiomatic for TS)?
3. Conflicts between Dawn's instrumentation and human-authored OTel already in upstream — detect, defer, or warn?
4. Reviewer-access UI — signed URLs, ephemeral preview deploys, GitHub bot comments?
5. Conflict resolution during upstream rebases — automated, semi-automated, manual?
6. **How does the Dawn app discover a codebase's identity?** (Reframed from "how does worktree-level Dawn discover its parent system Dawn?" — there is no worktree-level Dawn install.) Candidates: git remote URL match, gitignored thin pointer file, explicit user assignment via Dawn UI, or some combination.
