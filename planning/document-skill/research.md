---
title: "Document Skill — Research"
date: 2026-03-20
status: complete
---

# Document Skill — Research

## Question

How should documentation and retrospective auditing be integrated into the plan/work lifecycle, and what tooling should power them?

## Findings

### Current Lifecycle Gaps

The impl template currently has three per-phase gates: implementation items, verification, and context. Two things are missing:

1. **Documentation** — Plans like codegraph-context, verify-skill, and code-quality-system completed without producing any user-facing documentation. The knowledge exists in planning docs and CLAUDE.md, but not in a browsable, publishable format.

2. **Retrospective enforcement** — The plan skill says "write the retrospective" but doesn't enforce what it covers. No audit of docs accuracy, test coverage gaps, or quality ratchet. No structured knowledge handoff from planning artifacts to published docs.

### The Retrospective as a Closing Gate

The retrospective is fundamentally different from work execution — it's an audit and handoff process:

- **Docs audit** — are the docs accurate and complete for what was actually built?
- **Test audit** — are there coverage gaps? Were edge cases missed?
- **Quality audit** — should new Biome rules be added based on mistakes made?
- **Context audit** — is CLAUDE.md still accurate after all the changes?
- **Knowledge handoff** — distill planning artifacts into the docs site, then archive

This warrants its own skill (`retrospective`) separate from the document skill, but planned together since they're tightly coupled.

### Documentation Lifecycle Across the Plan

Documentation happens at three points:

1. **During impl phases** (document skill) — per-phase gate writes docs as features are built. Reference docs, how-to guides, API docs.
2. **During retrospective** (retrospective skill) — reviews docs for accuracy against what was actually built (not what was planned). Fixes gaps.
3. **During archival** (retrospective skill) — distills planning artifacts into the docs site. ADR decisions become entries in a "Decisions" section. Retrospective insights become part of relevant feature docs. Raw planning moves to `planning/archive/`.

Archival is a **knowledge handoff**, not just filing.

### Documentation Methodology

Evaluated several methodologies:

**Diataxis** — Four quadrants: Tutorials (learning), How-to Guides (tasks), Reference (information), Explanation (understanding). Clear structure but can feel rigid for small projects.

**The Good Docs Project** — Templates for common doc types. Similar categories to Diataxis but template-driven.

**README-driven development** — Write the README first. Lightweight, doesn't scale.

**ADR-centric** — We already have this via the plan skill. Good for "why" but weak for "how."

For our system, a simplified Diataxis fits best for v1:
- **Reference** — what tools/skills exist, API docs, configuration
- **How-to** — task-oriented guides for common workflows
- **Decisions** — surfaced from ADRs during archival (the "Explanation" quadrant)

Skip Tutorials for v1 — those come when there are external users.

### VitePress as Documentation Engine

VitePress is a Vue-powered static site generator built on Vite. Key properties:

- **Markdown-native** — docs are `.md` files, aligns with existing planning doc format
- **Fast** — Vite-powered dev server with HMR, static builds near-instant
- **Monorepo-friendly** — supports `srcDir`, route rewrites for monorepo structures, multi-sidebar for per-app sections
- **Zero Vue knowledge needed** — works as pure markdown docs out of the box
- **Theming** — default theme is clean. Dark mode built-in (matches zinc-950 aesthetic)

### Documentation Structure in a Monorepo

Two viable approaches:

**Option A: Single docs site at repo root**
```
docs/
├── .vitepress/config.ts
├── guide/           # How-to guides
├── reference/       # Skills, tools, API
│   ├── skills/
│   └── apps/
├── decisions/       # Distilled from ADRs during archival
└── retrospectives/  # Lessons learned, distilled from retros
```
One `pnpm docs:dev` command, one build, one deploy. Multi-sidebar separates concerns.

**Option B: Per-app docs directories**
Each app owns its docs. A root VitePress config uses rewrites to aggregate. More decoupled but harder to cross-reference.

### What Gets Documented Per Phase

Not every phase produces documentation. The document gate asks: "Does this phase change something a user or future developer needs to know?" If yes:

- **New feature/tool** → usage docs, API reference
- **Architecture change** → updated architecture page
- **New convention** → updated conventions page
- **Configuration change** → updated setup/config page
- **Nothing user-facing** → no docs needed (the gate asks the question but doesn't always produce output)

### Relationship to CLAUDE.md (Context Skill)

CLAUDE.md is agent-facing memory — terse, structured, optimized for AI consumption. Documentation is human-facing — narrative, examples, explanations. They serve different audiences:

- CLAUDE.md: "Biome over ESLint: single binary, no plugin config hell"
- Docs: "We use Biome for linting and formatting. Here's how to configure it, what rules are active, and how to add new ones..."

The context skill updates CLAUDE.md. The document skill updates the docs site. They run in parallel during phase completion.

### Alternatives to VitePress

- **Nextra** (Next.js-based) — would match the indusk-portfolio stack but adds a second framework dependency. Heavier.
- **Starlight** (Astro-based) — excellent docs framework, but introduces Astro as a third framework.
- **Docusaurus** — React-based, heavier, more opinionated. Good for large projects, overkill here.
- **Plain markdown in repo** — no build step, but no search, no nav, no publishable site.

VitePress is the lightest option that produces a real docs site. Doesn't conflict with Next.js portfolio since it's a separate build target.

## Open Questions

- Should the docs site be deployed alongside the portfolio, or separately?
- When the MCP dev system ships as a package, should it generate docs scaffolding during `init`?
- Should the retrospective skill enforce a minimum test coverage threshold?

## Sources

- VitePress docs: https://vitepress.dev
- VitePress GitHub: https://github.com/vuejs/vitepress
- Diataxis: https://diataxis.fr
- The Good Docs Project: https://thegooddocsproject.dev
- Context7 library docs for VitePress
