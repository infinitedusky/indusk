---
name: document
description: Per-phase documentation gate during impl execution. Writes and updates docs in the VitePress site. Encourages Mermaid diagrams for architecture, flows, and relationships.
argument-hint: "[what to document or 'check']"
---

You know how to maintain documentation in this project.

## What Document Does

Document is a per-phase gate during impl execution, alongside verify and context. The full phase order is:

```
implement → verify → context → document → advance
```

After context items are done, the document gate asks one question:

**"Does this phase change something a user or developer needs to know?"**

To answer this accurately, **REQUIRED: call `query_dependencies`** on the key files changed in this phase. If the change affects files with many dependents, it likely needs documentation. If it's internal with no downstream consumers, it might not.

- If **yes**: write or update the relevant page in `apps/indusk-docs/src/`
- If **no**: skip — not every phase produces documentation. The gate asks the question but doesn't always produce output.

## Where Docs Live

Documentation lives in a VitePress site at `apps/indusk-docs/`:

```
apps/indusk-docs/src/
├── guide/           # How-to guides (task-oriented)
├── reference/       # Skills, tools, API, configuration (information-oriented)
│   ├── skills/      # One page per skill
│   └── tools/       # One page per tool (Biome, CGC, composable.env)
├── decisions/       # Distilled from ADRs during retrospective/archival
└── lessons/         # Distilled from retrospective insights during archival
```

### What Goes Where

| What changed | Where to document | Doc type |
|---|---|---|
| New feature or tool | `reference/` | Reference page |
| New workflow or process | `guide/` | How-to guide |
| Configuration change | `reference/` (update existing page) | Reference update |
| Architecture change | `reference/` + diagram | Reference + diagram |
| Nothing user-facing | Skip | — |

### Decisions and Lessons

The `decisions/` and `lessons/` directories are **not** populated during normal impl work. They are populated during the retrospective/archival process by the retrospective skill. Don't write to them during `/work`.

## Mermaid Diagrams

**Prefer diagrams over long prose for architecture, flows, and relationships.** A well-labeled diagram communicates structure faster than paragraphs of text.

### When to Use Which Diagram Type

| Scenario | Diagram Type | Example |
|----------|-------------|---------|
| System architecture, data flow | `flowchart` | How services connect |
| API calls, request/response sequences | `sequenceDiagram` | Auth flow between client and server |
| Code structure, class relationships | `classDiagram` | Package dependencies |
| Lifecycle, state machines | `stateDiagram-v2` | Plan lifecycle stages |
| Data models, entity relationships | `erDiagram` | Database schema |
| Timelines, project phases | `timeline` | Release milestones |

### Diagram Best Practices

- **One concept per diagram.** Don't cram the entire system into one chart. Break complex systems into focused diagrams.
- **Meaningful labels.** Use full words, not abbreviations. `Plan Skill` not `PS`.
- **Use `classDef` for visual grouping.** Color-code related nodes to show categories at a glance.
- **Dark-mode friendly.** Avoid hardcoded light colors (white, light gray). Use the mermaid `dark` theme (already configured in VitePress). If you must customize colors, use high-contrast pairs.
- **Keep diagrams small enough to read inline** but detailed enough to be useful when expanded.

### Always Use FullscreenDiagram

Every Mermaid diagram in the docs **must** be wrapped in the `<FullscreenDiagram>` component. This provides expand-to-fullscreen with pan and zoom controls.

```markdown
<FullscreenDiagram>

```mermaid
flowchart TD
  P[Plan] --> W[Work]
  W --> V{Verify}
  V -->|pass| CX[Context]
  CX --> D[Document]
  D --> W
  W -->|complete| R[Retrospective]
  R --> A[Archive]
```

</FullscreenDiagram>
```

**Never** use bare ` ```mermaid ` blocks without the wrapper. The diagrams are often too small to read inline, and the FullscreenDiagram gives users zoom and pan controls.

## Shaping Impl Documents

When writing an impl (via the plan skill), every phase should consider documentation:

```markdown
#### Phase N Document
- [ ] {Specific docs page to write or update}
```

The agent writing the impl must answer: **"What does a user or developer need to know about what this phase built?"** If the answer is "nothing user-facing" — no document items needed. Not every phase produces docs. But the question must be asked.

### Document Items Are Blocking

During execution (via the work skill), document items are checked off alongside implementation, verification, and context items. The per-phase completion order is:

```
implementation items → verification items → context items → document items → advance
```

A phase is not complete until its document items are done.

## Running the Docs Site

```bash
# Local dev server
pnpm turbo dev --filter=indusk-docs

# Build static output
pnpm turbo build --filter=indusk-docs
```

## Important

- Documentation is human-facing. CLAUDE.md is agent-facing. They serve different audiences — don't duplicate between them.
- Link, don't duplicate. If something is fully documented in a skill file or ADR, link to the docs page for it rather than copying content.
- Keep reference pages focused and scannable. Use tables and diagrams over paragraphs.
- The `decisions/` and `lessons/` sections are populated during retrospective only, not during normal impl work.
