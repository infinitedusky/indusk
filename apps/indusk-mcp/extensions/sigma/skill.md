# Sigma.js

You are working in a project that uses [Sigma.js](https://www.sigmajs.org) — a WebGL-backed graph visualization library built on top of [graphology](https://graphology.github.io). Follow these patterns.

Sigma v3 is the current major version. If you find tutorials or Stack Overflow answers referencing Sigma v1 or v2, treat them as suspect — the API changed significantly.

## The core mental model

Sigma has **two layers** that are easy to confuse:

- **graphology** is the **data model**. It owns nodes, edges, attributes, mutation. You `graph.addNode`, `graph.addEdge`, `graph.setNodeAttribute`. It doesn't know about rendering.
- **sigma** is the **renderer**. It reads from a graphology instance and draws it to a canvas via WebGL. It handles camera, events, layouts, and styling.

You build the graph in graphology. You render it with sigma. You mutate the graph through graphology and call `renderer.refresh()` (or rely on sigma's automatic refresh) to update the view.

**Corollary:** "How do I add a node to sigma?" is the wrong question. You add a node to graphology, and sigma picks it up.

## Installation

```bash
pnpm add sigma graphology
pnpm add -D @types/graphology
```

For React projects, also install the official wrapper:

```bash
pnpm add @react-sigma/core
```

Common companion packages to know about:

- `graphology-layout-force` / `graphology-layout-forceatlas2` — force-directed layouts
- `graphology-layout` — simple layouts (circular, random)
- `graphology-metrics` — centrality, clustering, density
- `chroma-js` — color helpers, often used for styling
- `@react-sigma/layout-core`, `@react-sigma/layout-forceatlas2` — React hooks for layouts

## Vanilla sigma — the canonical setup

```ts
import Graph from "graphology";
import Sigma from "sigma";

const graph = new Graph();
graph.addNode("a", { x: 0, y: 0, size: 15, label: "Node A", color: "#4F7AFA" });
graph.addNode("b", { x: 1, y: 1, size: 10, label: "Node B", color: "#FA4F40" });
graph.addEdge("a", "b", { size: 2, color: "#999" });

const container = document.getElementById("sigma-container") as HTMLElement;
const renderer = new Sigma(graph, container);
```

Key rules:

- **Every node needs `x` and `y`** or sigma won't know where to put it. These are graph-space coordinates, not pixels — sigma's camera handles the mapping. If you don't know the coordinates up front, use a layout (see below).
- **`size` is required for visibility.** A node with `size: 0` won't render. Typical values are 5–20.
- **`label` is optional but expected.** If present, sigma can render it; otherwise the node has no text.
- **`color` is optional** — falls back to the `defaultNodeColor` setting.
- **Always call `renderer.kill()`** when the container is unmounted or torn down. Otherwise sigma leaks GL contexts and event listeners.

## React — use @react-sigma/core

Do not instantiate `Sigma` directly in a React app. Use `@react-sigma/core`, which handles the React lifecycle, context propagation, and teardown.

```tsx
import { SigmaContainer, useLoadGraph } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import { useEffect } from "react";

const LoadGraph = () => {
	const loadGraph = useLoadGraph();
	useEffect(() => {
		const graph = new Graph();
		graph.addNode("a", { x: 0, y: 0, size: 15, label: "A", color: "#4F7AFA" });
		graph.addNode("b", { x: 1, y: 1, size: 10, label: "B", color: "#FA4F40" });
		graph.addEdge("a", "b");
		loadGraph(graph);
	}, [loadGraph]);
	return null;
};

export const MyGraph = () => (
	<SigmaContainer
		style={{ height: "500px", width: "100%" }}
		settings={{ defaultNodeType: "circle", defaultEdgeType: "arrow", allowInvalidContainer: true }}
	>
		<LoadGraph />
	</SigmaContainer>
);
```

**Hooks to know:**

| Hook | What it gives you |
|---|---|
| `useSigma()` | The `Sigma` renderer instance — use this for camera, refresh, settings |
| `useLoadGraph()` | A function that installs a graphology graph into the container |
| `useRegisterEvents()` | Idiomatic event registration with automatic cleanup |
| `useSetSettings()` | Mutate sigma settings (reducers, types, defaults) |
| `useCamera()` | Programmatic camera control (animate, zoom, center) |

**Always put hook usage inside children of `SigmaContainer`**, not as siblings. The hooks read from React context that `SigmaContainer` provides.

## Next.js — client-only, dynamic import

Sigma touches `window`, WebGL, and DOM refs. It **cannot** run during SSR. If you try to render a `SigmaContainer` in a Server Component or in a Client Component that gets pre-rendered on the server, you'll get `ReferenceError: window is not defined` at build or request time.

The fix is a dynamic import with `ssr: false`:

```tsx
// app/graph/page.tsx
"use client";
import dynamic from "next/dynamic";

const GraphView = dynamic(() => import("@/components/graph-view").then((m) => m.GraphView), {
	ssr: false,
	loading: () => <div>Loading graph…</div>,
});

export default function GraphPage() {
	return <GraphView />;
}
```

Put the `SigmaContainer` and all sigma/graphology imports inside `graph-view.tsx`. That file must be `"use client"` and must never be imported from a server file.

The `"use client"` directive alone is **not enough** — client components still pre-render on the server during the initial build. The `dynamic(..., { ssr: false })` wrapper is what actually keeps sigma out of the server pipeline.

## Layouts

Nodes need `x` and `y` coordinates. For small hand-built graphs you supply them directly. For larger or dynamically-built graphs, use a layout.

**Force-directed (looks organic, slow on huge graphs):**

```ts
import ForceSupervisor from "graphology-layout-force/worker";

const layout = new ForceSupervisor(graph, {
	isNodeFixed: (_, attr) => attr.highlighted,
});
layout.start();
// later: layout.stop();
```

**ForceAtlas2 (faster, scales better to thousands of nodes):**

```ts
import forceAtlas2 from "graphology-layout-forceatlas2";
forceAtlas2.assign(graph, { iterations: 50, settings: { gravity: 1 } });
```

**Circular / random (cheap, for initial placement or small graphs):**

```ts
import circular from "graphology-layout/circular";
import random from "graphology-layout/random";
circular.assign(graph);
random.assign(graph, { scale: 10 });
```

Rule of thumb: use `random.assign(graph)` as initial placement, then run `forceAtlas2` or `ForceSupervisor` on top. Pure force-directed without initial placement is slower and can produce worse layouts.

## Styling with reducers — the secret weapon

The most common mistake is mutating the graph to change appearance. **Don't.** Graphology holds your data; sigma's reducers are for presentation. Keep them separate.

A reducer is a function `(nodeId, data) => Partial<NodeDisplayData>` that runs once per node per render. You use it to derive visual state from app state:

```ts
renderer.setSetting("nodeReducer", (node, data) => {
	const res = { ...data };
	if (hoveredNeighbors && !hoveredNeighbors.has(node) && hoveredNode !== node) {
		res.label = "";
		res.color = "#f6f6f6"; // grey out non-neighbors
	}
	if (selectedNode === node) {
		res.highlighted = true;
	}
	return res;
});
```

Same pattern for edges with `edgeReducer`.

**Why this matters:** hovering a node, highlighting search results, "beam lighting up" effects — all of these should go through reducers, not `setNodeAttribute`. Reducers are cheap to re-run (`renderer.refresh({ skipIndexation: true })`) and don't mutate your source of truth.

**Always pass `skipIndexation: true` to `refresh()` when you didn't touch the graph data.** Full reindexation is expensive on large graphs.

## Events

Sigma exposes mouse and keyboard events for nodes, edges, and the stage (background). Use the event system instead of wiring DOM listeners yourself — sigma handles coordinate translation and hit testing.

```ts
renderer.on("enterNode", ({ node }) => { /* hover start */ });
renderer.on("leaveNode", () => { /* hover end */ });
renderer.on("clickNode", ({ node }) => { /* selection */ });
renderer.on("clickStage", ({ event }) => {
	const coords = renderer.viewportToGraph({ x: event.x, y: event.y });
	// coords.x, coords.y are in graph space, not pixels
});
```

**In React, use `useRegisterEvents` instead of `renderer.on`** — it handles cleanup automatically on unmount.

Edge events are **opt-in** — you must pass `enableEdgeEvents: true` to the Sigma constructor (or SigmaContainer settings). Otherwise `clickEdge`, `enterEdge`, etc. won't fire.

## Dynamic updates and animation

To add nodes/edges at runtime, mutate the graphology graph. Sigma re-renders automatically on the next frame.

```ts
graph.addNode(id, { x, y, size: 10, color: "#4F7AFA", label: "New node" });
graph.addEdge(sourceId, id);
// no explicit refresh needed for typical mutations
```

For "just appeared" pulse animations, the cleanest pattern is: add the node, then briefly bump its size via a reducer, then decay:

```ts
const recentlyAdded = new Set<string>();
// When a node arrives:
recentlyAdded.add(id);
setTimeout(() => {
	recentlyAdded.delete(id);
	renderer.refresh({ skipIndexation: true });
}, 1500);

renderer.setSetting("nodeReducer", (node, data) => {
	if (recentlyAdded.has(node)) return { ...data, size: data.size * 1.5, zIndex: 10 };
	return data;
});
```

For smooth interpolation rather than step changes, wrap the size with an easing function that samples `performance.now()` on each refresh call. Sigma does not currently ship built-in animation primitives for per-attribute tweening — you either drive it yourself via `refresh` or use graphology-layout layouts that animate node positions over frames.

## Camera

```ts
const camera = renderer.getCamera();
camera.animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 500 });
camera.setState({ ratio: 0.5 }); // immediate (no animation)
```

Camera state is normalized 0..1 in each axis regardless of your graph's coordinate range. Use `renderer.viewportToGraph` and `renderer.graphToViewport` to convert between screen space, graph space, and camera space.

`renderer.getNodeDisplayData(id)` returns the node's current visual position — useful for centering the camera on a specific node.

## Performance

Sigma is designed for tens of thousands of nodes. It scales by rendering in WebGL and skipping off-screen nodes. But there are ways to accidentally make it slow:

- **Full reindexation on every update.** If you call `renderer.refresh()` without `skipIndexation: true`, sigma re-indexes the whole graph. Only do this when you actually changed node/edge structure, not on hover state.
- **Rendering every node's label.** Labels are expensive. By default sigma only draws labels for nodes above a size threshold. If you force all labels via reducers, expect FPS drops past ~500 visible nodes.
- **Complex reducers.** Reducers run once per visible node per frame. Keep them allocation-free — don't create new objects per call, don't iterate neighbors inside the reducer. Precompute state into a `Set` outside and check membership inside.
- **Layout workers on massive graphs.** `ForceSupervisor` runs the layout on the main thread by default. For 10k+ nodes, use `graphology-layout-forceatlas2/worker` or pre-compute the layout.

Rough numbers: sigma handles 1k nodes at 60fps without thinking, 10k with care, 50k+ with aggressive optimization (fewer labels, simpler reducers, worker layouts).

## Common gotchas

- **`allowInvalidContainer: true`** — set this in the Sigma constructor or SigmaContainer settings when the container starts with `width: 0` or `height: 0` (e.g., before layout completes). Without it sigma throws "Container has invalid dimensions."
- **Empty graph = black screen.** Sigma renders nothing until you add at least one node with valid `x`, `y`, `size`. If you see a blank canvas, check that `graph.order > 0` and nodes have positions.
- **Sigma v3 API differs from v1/v2.** Method names like `getGraph`, `setSetting`, `refresh` are the same, but node/edge event payloads, reducer signatures, and camera API all changed. Don't mix examples.
- **`renderer.kill()` must be called on unmount.** In React, `@react-sigma/core` does this for you. In vanilla, you own it.
- **Reducers return a `Partial<NodeDisplayData>`, not a full object.** Start from `{...data}` and only override the fields you're changing, or sigma's defaults will wipe out things you didn't touch.
- **Node `type` determines which renderer is used** — `circle`, `square`, or a custom program. Install and register the program before using a non-default type.
- **`enableEdgeEvents: true` must be set at construction time.** You can't toggle it later via `setSetting`.
- **Edge events fire only on the edge's hit area**, which is thin. For better hover-ability, widen edges visually with `size` or register events on the `stage` and do your own hit testing.
- **Sigma does not render nodes with `hidden: true`** — this is set via a reducer, not on the graph attribute. Same for `forceLabel`, `highlighted`, `zIndex`.
- **`renderer.refresh({ skipIndexation: true })` is your friend.** Use it whenever you change presentation state (hover, selection, filter) without touching the underlying graph. Use plain `refresh()` only after `addNode`, `addEdge`, or attribute changes that affect rendering shape.

## When to choose sigma over alternatives

| Situation | Pick |
|---|---|
| 10k+ nodes, interactive panning/zooming | **Sigma** (WebGL, scales) |
| < 2k nodes, rich built-in features, easier learning curve | Cytoscape.js |
| < 500 nodes, custom SVG visuals, bespoke interactions | D3 |
| Sparse, mostly static diagrams | Mermaid or Excalidraw |

Sigma is the right choice when the graph is large, live, and exploratory — the dashboard use case. It is *not* the right choice for small decorative diagrams on a docs page; those should be Mermaid.

## References

- [sigma.js docs](https://www.sigmajs.org/docs)
- [sigma.js storybook](https://www.sigmajs.org/storybook) — runnable examples for every feature
- [graphology docs](https://graphology.github.io)
- [@react-sigma/core](https://sim51.github.io/react-sigma/)
