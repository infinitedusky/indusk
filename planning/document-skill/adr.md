---
title: "Document & Retrospective Skills"
date: 2026-03-20
status: accepted
---

# Document & Retrospective Skills

## Y-Statement

In the context of **maintaining accurate, publishable documentation alongside a plan/work lifecycle**,
facing **the gap where features ship without docs and retrospectives are unstructured templates with no audit enforcement**,
we decided for **two separate skills — document (execution gate) and retrospective (closing audit) — backed by a VitePress docs site using simplified Diataxis**
and against **a single combined skill, inline docs in CLAUDE.md, or skipping formal documentation entirely**,
to achieve **documentation that stays current with code, structured retrospective audits, and a knowledge handoff from planning artifacts to published docs**,
accepting **an additional per-phase gate that slows execution slightly, and a VitePress dependency alongside the existing Next.js stack**,
because **documentation written during execution is more accurate than documentation written after the fact, and a structured retrospective audit catches gaps that a freeform writeup misses**.

## Context

The plan/work lifecycle has four execution gates: implement, verify, context, document. The first three exist and are stable. Document is the fourth — it asks "does this phase change something a user or developer needs to know?" and writes/updates the relevant docs page.

The retrospective was previously a freeform template at the end of the plan lifecycle. It captured lessons but didn't enforce auditing docs accuracy, test coverage, quality ratchet, or knowledge handoff. The retrospective skill formalizes this as a structured checklist.

See `planning/document-skill/research.md` for documentation methodology analysis and `planning/document-skill/brief.md` for the accepted direction.

## Decision

### Two Skills, One Plan

**Document skill** (`.claude/skills/document/SKILL.md`):
- Per-phase gate during impl execution, after context
- Full phase order: implement → verify → context → document → advance
- Asks: "Does this phase change something a user or developer needs to know?"
- If yes: write or update the relevant page in `docs/`
- If no: skip — not every phase produces docs
- Impl template gains `#### Phase N Document` section

**Retrospective skill** (`.claude/skills/retrospective/SKILL.md`):
- Invoked after impl completion, replaces the freeform retrospective template
- Structured audit checklist:
  1. Docs audit — review docs against what was actually built
  2. Test audit — identify coverage gaps
  3. Quality audit — propose new Biome rules if warranted
  4. Context audit — verify CLAUDE.md accuracy
  5. Knowledge handoff — distill ADR decisions and retro insights into docs site
  6. Archival — move planning artifacts to `planning/archive/`

### VitePress for Documentation

Single docs site at repo root:
```
docs/
├── .vitepress/config.ts
├── index.md
├── guide/           # How-to guides
├── reference/       # Skills, tools, API, configuration
├── decisions/       # Distilled from ADRs during archival
└── lessons/         # Distilled from retrospective insights
```

Simplified Diataxis: Reference + How-to for execution-phase docs, Decisions + Lessons populated during retrospective/archival.

### Updated Plan Lifecycle

```
research → brief → ADR → impl → retrospective → archive
                          │              │            │
                    per-phase gates:   audit:      handoff:
                    verify             docs        ADRs → decisions/
                    context            tests       insights → lessons/
                    document           quality     move to planning/archive/
                                       context
```

### Archival as Knowledge Handoff

Archival is no longer just filing. When a plan is archived:
1. ADR decisions get a summary entry in `docs/decisions/`
2. Retrospective insights that are broadly useful get entries in `docs/lessons/`
3. Raw planning artifacts move to `planning/archive/{plan-name}/`
4. The docs site becomes the published knowledge; the archive holds process history

## Alternatives Considered

### Single Combined Skill
One skill handling both documentation and retrospective. Rejected because the two operate at different points in the lifecycle — document is per-phase during execution, retrospective is once at the end. Combining them muddies the mental model.

### Documentation in CLAUDE.md Only
CLAUDE.md is agent-facing memory, not human-facing documentation. It's terse and structured for AI consumption. Docs need narrative, examples, and navigation. Different audiences require different artifacts.

### Skip Formal Documentation
Rely on planning docs and CLAUDE.md. Rejected because planning docs are process artifacts — they capture how we got here, not how to use what we built. They also get archived, making the knowledge harder to find.

### Nextra / Starlight / Docusaurus
Nextra matches the Next.js stack but is heavier. Starlight introduces Astro as a third framework. Docusaurus is overkill. VitePress is the lightest option that produces a real docs site with search, navigation, and dark mode.

## Consequences

### Positive
- Documentation stays current — written during execution, not retroactively
- Retrospective becomes a structured audit, not a formality
- Knowledge survives archival — published in docs, not buried in archive
- New developers can onboard by browsing the docs site
- Quality ratchet includes documentation as a dimension

### Negative
- Additional per-phase gate adds overhead to impl execution
- VitePress is a Vue-based tool in a React/Next.js monorepo (no conflict, but different ecosystem)
- Two new skills increase the cognitive load of the system

### Risks
- **Docs drift** — documentation could still fall out of date between plans. Mitigation: retrospective audit catches this for active plans; periodic docs review for everything else.
- **Over-documentation** — the gate could produce low-value docs for trivial changes. Mitigation: the gate explicitly allows skipping when nothing user-facing changed.

## References

- `planning/document-skill/research.md` — documentation methodology and tooling research
- `planning/document-skill/brief.md` — accepted brief
- `planning/context-skill/adr.md` — context skill as the model for per-phase gates
- `planning/verify-skill/adr.md` — verify skill as the model for per-phase gates
- Diataxis: https://diataxis.fr
- VitePress: https://vitepress.dev
