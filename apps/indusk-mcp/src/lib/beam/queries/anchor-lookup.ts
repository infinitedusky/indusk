/**
 * Query 1: Find the target file's anchor in the semantic graph.
 * Distance 0 — the starting point for the beam.
 */

import { BeamGraphClient } from "../graph-client.js";
import type { QueryStep } from "../types.js";

export const anchorLookup: QueryStep = {
	name: "anchor-lookup",
	source: "semantic-graph",
	distance: 0,
	maxResults: 1,
	detail: "full",
	async execute(ctx) {
		const client = new BeamGraphClient(ctx.projectName);
		try {
			await client.connect();
			const rows = await client.query<{ uuid: string; kind: string; path: string }>(
				"MATCH (a:Anchor {path: $path, status: 'active'}) RETURN a.uuid AS uuid, a.kind AS kind, a.path AS path",
				{ path: ctx.targetAbsolutePath },
			);

			return rows.map((row) => ({
				source: "semantic-graph" as const,
				distance: 0 as const,
				detail: "full" as const,
				content: `Anchor: ${row.kind} at ${row.path}`,
				metadata: { path: String(row.path) },
			}));
		} catch {
			return [];
		} finally {
			await client.close();
		}
	},
};
