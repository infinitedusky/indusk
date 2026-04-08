# InDusk Semantic Graph

The InDusk Semantic Graph bridges structural code intelligence (what exists) with semantic memory (what it means). It's an event-sourced system that projects code structure from CGC into a persistent graph, then attaches decisions, lessons, and context as edges on top.

## The Core Idea

Two systems already know things about your code:

- **CGC** (CodeGraphContext) knows the structure — files, functions, classes, imports
- **Graphiti** knows the narrative — decisions, corrections, lessons, ADRs

Neither talks to the other. The semantic graph connects them:

```mermaid
graph LR
    CGC["CGC<br/><i>structural truth</i>"]
    SG["Semantic Graph<br/><i>unified view</i>"]
    G["Graphiti<br/><i>semantic memory</i>"]

    CGC -->|"sync pipeline<br/>(adapter)"| SG
    G -->|"capture wrapper<br/>(edges)"| SG

    style CGC fill:#1e3a5f,stroke:#4a90d9,color:#fff
    style SG fill:#3d1f00,stroke:#d4a017,color:#fff
    style G fill:#1a3d1a,stroke:#4caf50,color:#fff
```

## Architecture

```mermaid
graph TB
    subgraph Sources["Data Sources"]
        CGC_DB["cgc-{project}<br/>FalkorDB graph"]
        Skills["Planner / Work /<br/>Retrospective skills"]
    end

    subgraph Pipeline["Sync Pipeline"]
        Adapter["CGC Adapter<br/><i>snapshot + identify + fingerprint</i>"]
        Engine["Sync Engine<br/><i>diff + create/move/tombstone</i>"]
        Wrapper["Capture Wrapper<br/><i>dual-write to log + Graphiti</i>"]
    end

    subgraph Storage["Canonical Storage"]
        Log["semantic-graph.log<br/><i>append-only JSONL</i><br/><i>tagged with jj change IDs</i>"]
    end

    subgraph Runtime["Disposable Runtime"]
        FDB["semantic-{project}<br/>FalkorDB graph"]
    end

    CGC_DB --> Adapter
    Adapter --> Engine
    Engine --> Log
    Skills --> Wrapper
    Wrapper --> Log
    Log -->|"replay()"| FDB

    style Sources fill:#1e3a5f,stroke:#4a90d9,color:#fff
    style Pipeline fill:#2d2d2d,stroke:#888,color:#fff
    style Storage fill:#3d1f00,stroke:#d4a017,color:#fff
    style Runtime fill:#1a3d1a,stroke:#4caf50,color:#fff
```

## Key Concepts

### Anchors

Anchors are graph nodes synced from an authoritative source. Each anchor represents a real structural record — a file, function, class, or interface. Anchors are **never hand-edited**; they're created, moved, and tombstoned by the sync pipeline.

```mermaid
graph LR
    F1["📄 src/app.ts<br/><i>file anchor</i>"]
    F2["📄 src/utils.ts<br/><i>file anchor</i>"]
    FN1["⚡ handleRequest<br/><i>function anchor</i>"]
    FN2["⚡ formatDate<br/><i>function anchor</i>"]

    F1 -->|contains| FN1
    F2 -->|contains| FN2
    F1 -->|imports| F2

    style F1 fill:#1e3a5f,stroke:#4a90d9,color:#fff
    style F2 fill:#1e3a5f,stroke:#4a90d9,color:#fff
    style FN1 fill:#2a4a6f,stroke:#4a90d9,color:#fff
    style FN2 fill:#2a4a6f,stroke:#4a90d9,color:#fff
```

### Edges (Semantic Overlay)

Edges are the "flesh" on the structural "skeleton." They carry meaning — decisions, lessons, facts — and attach to anchors. Edges survive renames (the anchor moves, edges follow) and deletions (the anchor tombstones, edges remain for historical context).

```mermaid
graph TB
    F["📄 src/auth.ts"]
    D["💡 Decision<br/><i>'Use JWT not sessions<br/>— ADR-007'</i>"]
    L["📝 Lesson<br/><i>'Token refresh race<br/>condition fixed in v1.3'</i>"]
    T["🔍 Trace<br/><i>'p99 latency spike<br/>on 2026-04-01'</i>"]

    D -->|attached_to| F
    L -->|attached_to| F
    T -->|attached_to| F

    style F fill:#1e3a5f,stroke:#4a90d9,color:#fff
    style D fill:#3d1f00,stroke:#d4a017,color:#fff
    style L fill:#3d1f00,stroke:#d4a017,color:#fff
    style T fill:#3d1f00,stroke:#d4a017,color:#fff
```

### Event Log

The event log is the **canonical source of truth**. Every mutation is one JSONL line tagged with a jj change ID. The FalkorDB runtime is a disposable projection — delete it and rebuild from the log at any time.

Six event types:

| Event | Purpose |
|-------|---------|
| `anchor.created` | New structural record appeared |
| `anchor.moved` | Record renamed/moved (UUID preserved) |
| `anchor.tombstoned` | Record deleted (edges preserved) |
| `edge.attached` | Semantic knowledge linked to an anchor |
| `edge.invalidated` | Knowledge superseded or retracted |
| `sync.completed` | Bookmark marking a completed sync cycle |

### Adapter Interface

The sync engine is **adapter-agnostic** — it doesn't know what data source it's syncing. CGC is the first adapter. The interface:

```mermaid
graph LR
    subgraph Adapters
        CGC_A["CGC Adapter<br/><i>files, functions,<br/>classes, interfaces,<br/>internal imports</i>"]
        Future1["Future: Plaid<br/><i>transactions,<br/>accounts</i>"]
        Future2["Future: Calendar<br/><i>events,<br/>attendees</i>"]
    end

    subgraph Engine["Sync Engine"]
        SE["snapshot → diff → events<br/><i>adapter-agnostic</i>"]
    end

    CGC_A --> SE
    Future1 -.-> SE
    Future2 -.-> SE

    style CGC_A fill:#1e3a5f,stroke:#4a90d9,color:#fff
    style Future1 fill:#333,stroke:#666,color:#888
    style Future2 fill:#333,stroke:#666,color:#888
    style Engine fill:#3d1f00,stroke:#d4a017,color:#fff
```

Each adapter implements three methods:
- **`snapshot()`** — return all current records from the source
- **`identify()`** — stable identity string for cross-sync matching
- **`contentFingerprint()`** — content hash for rename detection
- **`edges()`** *(optional)* — relationships discovered during snapshot

### Jj Change IDs

Every event is tagged with the jj change ID active when it was written. This enables:

- **Branch safety** — replay filters by ancestry, so events from abandoned branches don't pollute the graph
- **Rebase survival** — jj change IDs are stable across rebase/amend/split/abandon (unlike git commit SHAs)
- **Time travel** — the log records which change introduced each structural mutation

## Data Flow

### Sync (structural → graph)

```mermaid
sequenceDiagram
    participant A as CGC Adapter
    participant S as Sync Engine
    participant L as Event Log
    participant R as FalkorDB Runtime

    A->>A: snapshot(projectRoot)
    A->>S: AdapterRecord[] + AdapterEdge[]
    S->>R: queryAnchors(active)
    R-->>S: existing anchors
    S->>S: diff by identity + fingerprint
    loop Each delta
        S->>L: append(event)
        S->>R: applyEvent(event)
    end
    S->>L: append(sync.completed)
```

### Capture (semantic → graph)

```mermaid
sequenceDiagram
    participant Skill as Planner / Work / Retro
    participant W as Capture Wrapper
    participant G as Graphiti
    participant L as Event Log

    Skill->>W: capture(content, filePath)
    W->>G: add_memory(episode)
    G-->>W: ok
    W->>L: append(edge.attached)
    Note over L: Dual-write: Graphiti<br/>extracts entities/facts,<br/>log records the attachment
```

### Rebuild (log → runtime)

```mermaid
sequenceDiagram
    participant L as Event Log
    participant E as Replay Engine
    participant R as FalkorDB Runtime

    R->>R: clearGraph()
    L->>E: stream events
    loop Each event
        E->>E: validate + filter by ancestry
        E->>R: applyEvent(event)
    end
    E-->>E: { total, applied, skipped, errors }
```

## What Gets Projected

### From CGC (via sync)

| CGC Source | Anchor Kind | Import Edges |
|------------|-------------|--------------|
| `File` nodes | `file` anchors with `git hash-object` fingerprint | Internal imports (`./`, `../`) projected as `imports` edges |
| `Function` nodes | `function` anchors (child of file) | — |
| `Class` nodes | `class` anchors (child of file) | — |
| `Interface` nodes | `interface` anchors (child of file) | — |

External dependencies (npm packages, `node:*` builtins) are **excluded** from import edges.

### From Graphiti (via capture)

| Trigger | What's Captured | Edge Relation |
|---------|----------------|---------------|
| Brief accepted | Decision episode | `decision` |
| ADR accepted | Y-statement | `adr` |
| User correction | Lesson episode | `correction` |
| Retrospective | What-we-learned items | `lesson` |

## Graph Namespaces

Three namespaces coexist in the same FalkorDB instance (indusk-infra container):

| Namespace | Owner | Purpose |
|-----------|-------|---------|
| `cgc-{project}` | CodeGraphContext | Structural index (read-only to the bridge) |
| `semantic-{project}` | Semantic Graph | Anchors + edges (disposable, rebuilt from log) |
| Graphiti groups | Graphiti | Episodic memory (independent, queried by catchup) |

## Reference Pages

- [Event Schema](./event-schema.md) — the six event types with field tables and JSON examples
- [Adapter Interface](./adapter-interface.md) — how to write an adapter
- [CGC Adapter](./cgc-adapter.md) — how CGC data maps to anchors and edges
- [Jj Dependency](./jj-dependency.md) — why jj change IDs are the versioning substrate
- [Runtime Graph](./runtime-graph.md) — FalkorDB schema and naming conventions
- [Rebuild & Replay](./rebuild-and-replay.md) — how to reconstruct the runtime from the log

## Design Whitepaper

The architecture is described in detail in the [Anchor-Overlay Pattern](../../../../.indusk/research/anchor-overlay-pattern.md) whitepaper, which argues the pattern generalizes beyond code to any domain with authoritative structural sources and evaporating semantic context.
