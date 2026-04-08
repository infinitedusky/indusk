# CGC Adapter

The CGC adapter is the first concrete implementation of the [SemanticGraphAdapter interface](./adapter-interface.md). It reads structural code data from CodeGraphContext's FalkorDB graph and projects it into the semantic graph.

## What It Reads

The adapter connects to the `cgc-{projectName}` graph in the indusk-infra FalkorDB container and queries:

| CGC Node Type | Anchor Kind | Identity Pattern | Fingerprint |
|---------------|-------------|-----------------|-------------|
| `File` | `file` | `file::{path}` | `git hash-object {path}` |
| `Function` | `function` | `function::{path}::{name}` | `undefined` (v1) |
| `Class` | `class` | `class::{path}::{name}` | `undefined` (v1) |
| `Interface` | `interface` | `interface::{path}::{name}` | `undefined` (v1) |

Files get a `blob_hash` via `git hash-object` for rename detection. Symbol kinds don't support rename detection in v1 — a renamed function is tombstoned and recreated.

## Internal Import Edges

The adapter also queries CGC's `IMPORTS` relationships and projects intra-codebase imports as `edge.attached` events:

```
File -[:IMPORTS]-> Module (where module starts with "./" or "../")
```

External dependencies are excluded:
- npm packages (`zod`, `@opentelemetry/sdk-node`, etc.)
- Node.js builtins (`node:fs`, `node:path`, etc.)
- Any specifier that doesn't start with `./` or `../`

The adapter resolves relative specifiers to absolute file paths by:
1. Computing `path.resolve(dirname(importer), specifier)`
2. Trying extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `/index.ts`, `/index.js`
3. Handling `.js` → `.ts` substitution (common in TypeScript projects)

Unresolvable specifiers (deleted files, complex re-exports) are silently skipped.

## Graph Namespaces

The CGC adapter reads from one graph and writes to another:

| Graph | Purpose | Owned By |
|-------|---------|----------|
| `cgc-{project}` | CGC's structural index (read-only to the adapter) | CodeGraphContext |
| `semantic-{project}` | Semantic graph runtime (written by sync engine) | Semantic graph bridge |

Both live in the same FalkorDB instance (indusk-infra container). Don't confuse them in manual Cypher queries.

## Usage

```typescript
import { CgcAdapter } from "./adapters/cgc.js";
import { runSync } from "./sync-engine.js";

const adapter = new CgcAdapter(); // defaults to localhost:6379
const result = await runSync(adapter, projectRoot, logWriter, runtimeClient);
// result: { created, moved, tombstoned, unchanged, edges_attached, duration_ms }
```

## Performance

First sync of infinitedusky (118 files, ~10k functions, 20 classes, 18 interfaces, 155 import edges): ~73 seconds, 10k+ events, 3.3MB log file. Subsequent syncs with no changes produce zero deltas in under a second.
