---
title: "Dawn v1 — Maxims"
date: 2026-07-26
status: draft
---

# Dawn v1 — Maxims

The founding principles of Dawn — the next form of the InDusk development system, pared to its durable core. These maxims are the **selection function**: every candidate piece of Dawn is kept only if it serves a maxim, and cut if it doesn't. Where two maxims pull against each other, the tension is named, not hidden.

## The Maxims

**1. Dawn is a methodology and discipline for AI and agentic software development.**
Specifically, the discipline that makes cheap, fast, parallel agentic output *trustworthy*. It governs what generation produces; it does not do the generating.

**2. Own the discipline; rent the runtime.**
Interface (Cursor), orchestration (Factory), compute (RDEs — Bitrise, HopX, and the like) are commoditized and funded. Dawn never builds them — it rides on top of whatever is rented.

**3. Optimize for the tenth task, not the first.**
Value compounds through structure and memory: Dawn costs you on task one and pays on task ten. Never measured by speed-to-first-green — that measures only its price. The quality of a solution owes more to the forty decisions before it than to how fast the last one was made.

**4. Every discipline must earn its weight.**
At velocity, tolerance for process is near zero. Each ritual, gate, and artifact justifies its friction against the pain it prevents, or it is cut. Lean is the feature, not the compromise.

**5. Evidence over assertion; falsify before you trust.**
Every discipline is a hypothesis that earns its place by beating real alternatives, measured over time. Dawn turns its own falsification ritual on itself.

**6. The substrate is files in the repo.**
Plans, lessons, and context version with the code, travel with the worktree, and merge with git. No database, no CRDT. Portability is why Dawn runs on any rented box, in any IDE, from any device.

**7. Mechanism in Dawn, content in the project.**
Dawn owns the slots and hooks — worktree-create, extension dispatch, gates. Each project fills them with its own tools (Doppler or not, docker or not, its own env build). Nothing project-specific lives in the core.
*Corollary: generate what is derivable; author only genuine judgment.*

**8. Prove it for yourself first.**
Dawn's only metric is "is this the best way for *me* to build *my* software." Adoption is downstream evidence; a business is a distant maybe. Never ship what you have not verified on your own work.

**9. Work follows one loop — enforced in order, scaled to the task.**

```
research → plan → decide → test → build → challenge → refactor → remember → monitor
```

Tests come before build; challenge (falsify) before you trust it; *monitor* feeds the next cycle's *research* and *remember*. It is a loop, not a line. A one-line fix collapses most stages; a system change runs them all — nine ceremonies for a typo is exactly the heavyweight process maxim 4 forbids. `monitor` is the one stage not yet a ritual today (it lives in telemetry extensions) — the piece Dawn adds.

## Tensions held on purpose

- **9 vs 4** — the lifecycle is enforced but *proportional*. The loop must scale down to the work, or it violates "earn its weight."
- **6 vs shared team state** — sharing comes from a shared git repo and/or a shared always-on box, not a hosted store. The only genuinely-central piece is *live presence*; everything else merges through git.

## How these are used

These maxims are the criterion for what Dawn v1 keeps from InDusk and what it sheds. Operate by them: build against real friction, cheapest evidence first (Remote Control before a rented box). When a decision is unclear, decide it against the maxims — and if none applies, that's a signal to add one.

---

*Origin: distilled 2026-07-26 from a working session that traced the AI-dev landscape (Cursor, Factory Missions, Bitrise/HopX RDEs) and concluded the runtime layers are commoditized while the discipline layer is unowned. See [research.md](research.md) and the dawn-project-architecture research for the fuller argument.*
