---
title: "The Anchor-Overlay Pattern"
subtitle: "Authoritative Structural Sources as Attachment Surfaces for Semantic Memory"
authors: ["Sandy (InfiniteDusky)"]
date: 2026-04-08
status: living-draft
version: 0.1
related:
  - .indusk/research/context-graph-whitepaper.md
  - .indusk/planning/cgc-graphiti-bridge/brief.md
---

# The Anchor-Overlay Pattern

## Abstract

A general architectural pattern for externalizing memory in any domain where (a) structural truth is already maintained by an authoritative source system, and (b) the meaning, intent, and narrative around that structure is human-generated and currently evaporates. The pattern: project the authoritative source's records into a semantic graph as **anchor nodes** via a one-way sync pipeline, then attach interpretive context to those anchors via edges. Anchors are structurally authoritative and never hand-edited. Edges are semantically authored and accumulate over time. Move-preserving, delete-tombstoning semantics ensure that attached knowledge survives change in the underlying source. The pattern was discovered while building a code-context system (CGC → Graphiti), but the architecture is domain-agnostic. This paper argues that the pattern generalizes to any externalized-memory problem where scattered authoritative sources already record structural truth and the failure mode is that semantic context has nowhere stable to live.

---

## 1. The Pattern

**Authoritative structured source → sync pipeline → anchor graph → semantic attachment surface.**

Two conditions must hold:

1. **There is a structural source of truth maintained by something other than the user.** An external system records the "what" and "when" with high fidelity. The user does not have to author it.
2. **The meaning, intent, and narrative are human-generated, accumulate over time, and currently evaporate.** Today this knowledge lives in conversations, notes, memory, or nowhere at all.

When both hold, the architecture is:

```
┌─────────────────────────────────┐
│   Authoritative Source System   │   (already exists, not owned by us)
│   (CGC, bank, EHR, calendar…)   │
└────────────┬────────────────────┘
             │
             ▼  snapshot + diff
┌─────────────────────────────────┐
│       Sync Pipeline             │   (one-way, adapter per source)
│   • new → create anchor         │
│   • moved → update in place     │
│   • deleted → tombstone         │
│   • unchanged → no-op           │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│         Anchor Graph            │
│                                 │
│   ◆ ─── ◆ ─── ◆    anchors      │
│   │     │     │    (structural  │
│   │     │     │    skeleton)    │
│   ●     ●     ●    edges        │
│   │     │          (semantic    │
│   ●     ●          flesh)       │
│                                 │
│   episodes, facts, decisions,   │
│   lessons, traces, notes...     │
└─────────────────────────────────┘
```

Anchors are the skeleton. Everything else is flesh attached by edges.

## 2. Vocabulary

| Term | Definition |
|---|---|
| **Anchor** | A node in the semantic graph that was synced from an authoritative source. Represents a real structural record (a file, transaction, visit, job, possession). Never hand-edited. |
| **Adapter** | A connector to one authoritative source. Knows how to snapshot, diff, and produce anchors of a specific type. CGC is a code adapter; a Plaid integration would be a finance adapter. |
| **Sync pipeline** | The domain-agnostic engine that takes an adapter's output and applies it to the anchor graph with move/delete-preserving semantics. |
| **Tombstone** | An anchor whose underlying source record was deleted. Marked `deleted` but retained in the graph with all its edges intact. The memory of a dead branch. |
| **Overlay** | The accumulated semantic edges attached to anchors. Decisions, episodes, facts, lessons, external signals — anything that isn't structurally authoritative. |
| **Stable identity** | A per-adapter strategy for matching source records to anchors across syncs. File paths + content hashes, account numbers, FHIR resource ids, etc. |

The key distinction: **all anchors are nodes, but not all nodes are anchors.** Episodes, facts, and extracted entities are nodes that the overlay produces; they attach *to* anchors, they are not anchors themselves.

## 3. Why This Is the Right Shape

### 3.1 The failure mode of existing approaches

Personal knowledge graphs, "second brains," and structured-note systems (Obsidian, Roam, Notion, Mem, Rewind) keep failing as products for the same reason: **they start from the wrong end.** They ask the user to manually author both the structure and the meaning. Blank notes, manual links, high friction, eventually abandoned.

The premise is "you know your life best, describe it." The reality is: describing structure is tedious, error-prone, and duplicates work that external systems already do for free. Your bank already knows every transaction. Your employer already knows every paycheck. Your calendar already knows every meeting. Your code indexer already knows every file. **You don't have to describe the structure — you have to sync it.**

Once the structure arrives automatically, the semantic layer (the part that is actually *yours*) attaches with very low friction because the anchors are already there. The user's job is no longer "describe my life" but "add meaning to what already exists."

### 3.2 Why move/delete preservation matters

In a naïve sync, a rename means the old node is deleted and a new node is created. Any edges attached to the old node are orphaned. The semantic knowledge evaporates at exactly the moment it's most needed — during change.

The anchor-overlay pattern inverts this. The sync pipeline treats identity as a first-class concern:

- **Move/rename** → mutate the anchor's location-descriptive fields in place, leave the node and its edges untouched
- **Delete** → set `status: deleted`, leave the node and its edges untouched

The second rule is the more interesting one. In life, a closed bank account should not erase your memories of using it. A relationship that ended should not delete the decisions it shaped. A project that got cancelled should still hold the lessons. A person who passes away should still hold the conversations. **The tombstone is the memory of the dead branch.** It is not grief to preserve it; it is the point.

### 3.3 Why one-way sync is sufficient

The authoritative source is authoritative. Writing back to it is a different problem — executing a transaction, modifying code, updating medical records. That's *action*, not memory. The anchor-overlay pattern is strictly about externalized memory; it reads from the source, it does not write. This keeps the architecture simple, keeps the trust boundaries clean, and keeps the failure modes bounded.

### 3.4 Why adapters matter more than the pipeline

The sync pipeline is small and generic. Its job is to take an adapter's diff output and apply it with the right semantics. The hard, domain-specific work lives in the adapter:

- How do I snapshot this source?
- What constitutes identity here? (path? account number? FHIR id?)
- What's a move versus a delete-and-recreate?
- What granularity of anchor do I produce? (file? function? both?)
- How do I detect changes I can't see directly?

A well-designed pipeline is dumb and adaptable. The adapter layer is where the expertise lives. This is why designing `cgc-graphiti-bridge` as a CGC-specific thing would be a mistake — the pipeline should not know the word "CGC."

## 4. Instance Gallery

The pattern holds across radically different domains. Each row below describes a full instance: the authoritative source, the anchors it produces, and the kinds of overlay that would attach.

### 4.1 Code (the instance we're building)

| | |
|---|---|
| **Authoritative source** | CGC indexer — static analysis of source files |
| **Anchors** | File, Function, Class, Interface nodes |
| **Identity strategy** | Repo-relative path + content hash for files; path + symbol name + signature hash for symbols |
| **Sync trigger** | Implementation phase boundary (v1); CGC reindex completion (v2) |
| **Overlay examples** | ADRs attach to files they govern. Retrospective lessons attach to files touched in the plan. Work skill corrections attach as facts. Rule-based checks (refactor tests, lint) attach violations as edges. Dash0 error traces attach to files in the stack. Conversation captures attach "why this file does X" explanations. |
| **Move case** | `utils/foo.ts` → `lib/foo.ts`: anchor's path updates, all ADRs/lessons/gotchas ride along |
| **Delete case** | File removed in a refactor: anchor tombstoned, edges preserved — "we used to have this and here's what we knew about it" |

### 4.2 Personal finances

| | |
|---|---|
| **Authoritative source** | Plaid / bank APIs / brokerage APIs / payroll systems |
| **Anchors** | Accounts, transactions, holdings, pay periods, tax documents |
| **Identity strategy** | Institution id + account number + transaction id (stable per provider) |
| **Sync trigger** | Scheduled (nightly), or on-demand via adapter pull |
| **Overlay examples** | "This $4200 transaction was the security deposit for the Oakland apartment." "I moved this money because I was saving for the car." "I closed this account because the fees were predatory." "This is the paycheck from the job I loved." Goals attach to accounts, regrets attach to purchases, tax rationales attach to transfers. |
| **Move case** | Bank merger renames account: anchor updates in place, all attached reasoning rides along |
| **Delete case** | Closed account: tombstoned, the record of "why I had this and what it meant" is preserved forever |

### 4.3 Career and work history

| | |
|---|---|
| **Authoritative source** | Payroll, LinkedIn, calendar, email threads, code commits |
| **Anchors** | Jobs, projects, meetings, people, decisions |
| **Identity strategy** | Company + role + dates; meeting ids from calendar; person ids from contacts |
| **Sync trigger** | Event-driven (new calendar events, new jobs) or scheduled |
| **Overlay examples** | "This is the job I took because of the equity promise that never materialized." "This meeting is where the whole project pivoted." "This person taught me how to run retros." "I passed on this role because of the CEO's first interview." Career lessons attach to roles; mentorship memories attach to people; strategic decisions attach to projects. |
| **Move case** | Title change within the same company: role anchor updates, all lessons persist |
| **Delete case** | Company acquired and dissolved: jobs tombstoned, lessons remain |

### 4.4 Health

| | |
|---|---|
| **Authoritative source** | EHR (FHIR endpoints), wearables, pharmacy, lab results |
| **Anchors** | Visits, prescriptions, diagnoses, metrics, providers |
| **Identity strategy** | FHIR resource ids (stable across providers via national health identifiers where available) |
| **Sync trigger** | After each visit, after lab result arrival |
| **Overlay examples** | "I started this medication because of the side effects from the previous one." "This was the first visit where I realized something was actually wrong." "I stopped seeing this provider because they didn't listen." Narratives of illness, treatment rationales, relationship-with-doctors memories. |
| **Move case** | Provider moves practices: provider anchor updates, all "how I felt about them" notes persist |
| **Delete case** | Resolved diagnosis or stopped medication: tombstoned, the story of the illness remains |

### 4.5 Home and possessions

| | |
|---|---|
| **Authoritative source** | Receipts (OCR'd), warranties, smart home device registry |
| **Anchors** | Purchases, devices, rooms, repairs |
| **Identity strategy** | Receipt id + serial number where available; fuzzy matching otherwise |
| **Sync trigger** | On receipt scan, on device registration |
| **Overlay examples** | "I bought this because the old one broke during the move." "This was a gift from my sister." "I replaced this after two years because the motor burned out." The accumulated history of physical life. |
| **Move case** | Moved the desk to a new room: device anchor updates, "where I wrote my thesis on this" persists |
| **Delete case** | Thrown out: tombstoned, the memory of the object and its use persists |

### 4.6 Research and learning

| | |
|---|---|
| **Authoritative source** | Zotero, Kindle highlights, bookmarks, paper archives, podcast queues |
| **Anchors** | Papers, books, highlights, talks, quotes |
| **Identity strategy** | DOI, ISBN, URL hash |
| **Sync trigger** | On new highlight, on new paper added |
| **Overlay examples** | "This is the paper that changed how I thought about context." "I disagreed with this chapter at the time but now think they were right." "This quote sparked the idea for the anchor-overlay pattern." Intellectual genealogy, evolving opinions, idea-to-source traceability. |
| **Move case** | Paper reorganized in library: anchor updates, notes ride along |
| **Delete case** | Book lost or retracted paper: tombstoned, my reaction to it remains |

Every row works. The architecture is identical. Only the adapter layer differs.

## 5. Why Code Is the Right First Substrate

Not because the pattern is code-specific — because code is the easiest substrate to prove it on.

- **The structural indexer already exists.** CGC is built, deployed, and indexing. We don't have to write a Plaid connector first.
- **Structure is highly regular.** Files, functions, classes, interfaces — clean types, stable identifiers, well-defined relationships. Life events have no such clean schema.
- **The feedback loop is seconds.** Rename a file, run the sync, see the anchor move. You can't rename a bank account and watch anything happen immediately.
- **Signal-to-noise is high.** Every file matters, every function matters. In finance, most transactions are noise ($4 coffees); the overlay system needs filtering logic that code doesn't.
- **Privacy is a non-issue.** Your code isn't your medical records.
- **We're already living in it.** The code case is dogfoodable from day one. We can evaluate whether the pattern works by using it on the tool we use to build the tool.

The corollary: **the design decisions made while building the code case should be evaluated against the general pattern.** If a decision would make the pipeline useless for a Plaid adapter, it's probably the wrong decision — not because we're going to build the Plaid adapter, but because CGC-specific assumptions are a warning sign of leakage between the pipeline and the adapter layer.

## 6. What Breaks When the Substrate Changes

The pattern holds, but substrates have different pain points. An honest accounting:

### 6.1 Connectors are the bottleneck outside of code

Code has one indexer. Life has dozens of systems, most of which have hostile or absent APIs. Building a life-memory version of this pattern is a plumbing problem first and an architecture problem second. Many instances require:
- Scraping or manual export where APIs don't exist
- OCR or document parsing for physical records
- Fuzzy matching where stable identifiers are unavailable
- Privacy-preserving connectors because the data is sensitive

The good news: the pipeline doesn't care. Each adapter is a separate plumbing problem, solvable independently, addable incrementally.

### 6.2 Identity is harder when the source doesn't give you stable ids

Code has file paths and content hashes. Finance has account numbers and transaction ids. Health has FHIR resource ids. But:
- Physical possessions have no stable identifier
- People change names, phone numbers, email addresses
- Books get new editions
- Meetings in memory have no calendar record

The identity strategy must be per-adapter, and some adapters will need fuzzy matching or user confirmation loops. The pipeline should accept "ambiguous identity" as a first-class state.

### 6.3 Schema is less regular

Code nodes are well-typed: File, Function, Class, Interface. Life nodes are fuzzier: is "the apartment in Oakland" a Place, an Accommodation, a Chapter, or a Relationship anchor? This is an adapter-level design question and will require thought per domain.

### 6.4 Privacy and sovereignty

Code is shared with your team. Life data is not shared with anyone. A life-memory version of this system must be local-first, encrypted, and owned by the user. The architecture doesn't change, but the deployment model does.

### 6.5 Signal-to-noise

Every file matters. Not every $4 coffee matters. Non-code domains need aggressive filtering, summarization, and importance-weighting at the adapter or overlay layer. This is a solvable problem but it's extra work not required by the code case.

## 7. Design Constraints This Imposes on `cgc-graphiti-bridge`

Even though we're only building the code instance, the pattern's generality is a useful forcing function. Concrete constraints for the ADR:

1. **The sync pipeline must not know the word "CGC."** It takes a generic adapter interface (snapshot, diff, apply) and a target graph handle. CGC is the first adapter; the pipeline must accept others without refactor.

2. **Stable identity is a pluggable strategy per adapter.** The pipeline provides hooks (`identify(record) → stable_id`, `match(old, new) → boolean`); the adapter implements them. The pipeline doesn't hardcode file-path identity.

3. **Anchor types are declared by the adapter.** CGC produces `File`, `Function`, `Class`, `Interface`. The graph schema must accept adapter-declared labels; the pipeline doesn't hardcode "file."

4. **Move/delete-preserve semantics live in the pipeline, not the adapter.** Every domain needs tombstoning. The adapter reports deltas; the pipeline applies them with the right semantics. No adapter should ever re-implement edge preservation.

5. **Sync runs are first-class records.** The pipeline writes a sync episode/log for each run: what adapter, what deltas, any errors, when. This is how we debug sync issues and how we explain to the user why their graph changed.

6. **The pipeline is pull-based and trigger-agnostic.** It can be invoked by a phase boundary, a cron, a webhook, or an on-demand CLI. The trigger is the caller's problem; the pipeline is stateless with respect to timing.

None of this adds meaningful cost to the code implementation. All of it preserves optionality.

## 8. What We Are (And Aren't) Claiming

We are claiming that:

- The anchor-overlay pattern is a real architectural pattern, not a coincidence
- It generalizes across any domain meeting the two conditions in Section 1
- The code case is the tractable first proof point
- The design decisions we make while building the code case should be made with the general pattern in mind
- Existing personal-knowledge-graph products keep failing because they start from blank notes instead of synced authoritative sources

We are **not** claiming that:

- We are going to build the life-memory version of this anytime soon
- The life-memory version would be easy (it wouldn't — see Section 6)
- This architecture solves privacy, data sovereignty, or connector plumbing
- The pattern replaces all forms of externalized memory (it doesn't — there's still a place for always-loaded rules, procedural skills, and unstructured notes)

## 9. Open Questions

- **Is the overlay schema uniform across adapters?** ADRs attach to code anchors; bank statements attach to finance anchors. Should these use the same edge types (`DESCRIBES`, `EXPLAINS`, `GOVERNS`) or should each domain have its own vocabulary?
- **How does cross-domain linking work?** "The paycheck that funded the house" links a finance anchor to a possession anchor. The pipeline supports this trivially; is there a UX for authoring it?
- **What's the query surface?** In the code case, `context-beam` is the query layer. Does every domain need its own beam, or is there a generic graph-query interface that works across all of them?
- **How do we handle adapter disagreement?** Two adapters might produce overlapping anchors (a transaction receipt from OCR and the same transaction from Plaid). Dedup? Merge? User confirmation?
- **How does the LLM fit in?** Graphiti uses LLMs for entity extraction and contradiction detection. In the code case we might bypass that for anchors (direct Cypher writes) and use Graphiti's native pipeline only for overlay facts. Does this tiered approach generalize, or does each domain make its own choice?
- **Does the pattern want a name?** "Anchor-overlay" is descriptive but ugly. "Substrate memory"? "Projected knowledge graph"? "Externalized cognition via authoritative projection"? Naming this properly matters if we want others to adopt it.

## 10. Provenance

This pattern was articulated during the `cgc-graphiti-bridge` rewrite session on 2026-04-08. The trigger was an observation while reviewing the new brief: the move/delete semantics and the sync pipeline were obviously correct for code, and the same structure obviously applied to life-memory problems the author had been thinking about separately. The generalization crystallized in a single conversation. This document exists to preserve the insight before it evaporates — which, fittingly, is the exact failure mode the pattern is designed to prevent.

The `cgc-graphiti-bridge` plan is the first concrete implementation. Its ADR and impl should be reviewed against the design constraints in Section 7 before being accepted.
