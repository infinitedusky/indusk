---
title: "Visual Planning — Diagrams as Source of Truth"
date: 2026-04-15
status: notes
---

# Visual Planning — Research Notes

## Idea

During the research and brief phases, the agent builds Mermaid diagrams that accurately describe the architecture being proposed. The diagram isn't an illustration — it IS the plan. The brief references it. The impl is derived from it. Changes to architecture mean changing the diagram first.

## Current State

- The document skill already gates documentation with Mermaid diagrams
- VitePress docs site supports Mermaid + FullscreenDiagram component
- Excalidraw extension available for informal sketches
- But diagrams are currently optional and illustrative, not structural

## Incremental Path

1. **Near-term:** Planner skill requires a Mermaid diagram in research or brief output. validate-impl-structure hook checks for its presence. Diagram is still illustrative but always present.

2. **Medium-term:** Diagram becomes machine-readable. Components in the diagram map to impl phases. The planner could derive the checklist from the diagram's nodes and edges. "This component connects to that service" → "Phase 1: build the component, Phase 2: build the service, Phase 3: wire the connection."

3. **Long-term:** Diagram-as-source-of-truth. Code divergence from the diagrammed architecture is detectable. The eval agent could compare actual code structure (via LSP/graph) against the diagram and flag drift. Developers who think visually can plan entirely through diagrams — the system translates to impl.

## Key Questions

- What Mermaid diagram types are most useful for planning? (flowchart for architecture, sequence for workflows, C4 for system context?)
- Can Mermaid diagrams be reliably parsed to extract components and relationships?
- How does this interact with the semantic graph? Could diagram nodes become graph entities?
- Would Excalidraw (hand-drawn) or Mermaid (structured) be better as the source of truth? Mermaid is parseable but rigid. Excalidraw is flexible but opaque.

## Related Plans

- document skill already does per-phase diagram guidance
- graph-knowledge-architecture defines entities/relationships that diagrams could map to
- dusk-v2 could make visual planning a core feature
