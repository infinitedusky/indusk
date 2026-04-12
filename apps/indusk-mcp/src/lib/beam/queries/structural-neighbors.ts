/**
 * Query 2: Structural neighbors — files that import or are imported by the target.
 * Distance 1. Populates ctx.neighbors for downstream queries.
 */

import { BeamGraphClient } from "../graph-client.js";
import type { QueryStep } from "../types.js";

export const structuralNeighbors: QueryStep = {
	name: "structural-neighbors",
	source: "semantic-graph",
	distance: 1,
	maxResults: 20,
	detail: "summary",
	async execute(ctx) {
		const client = new BeamGraphClient(ctx.projectName);
		try {
			await client.connect();
			const rows = await client.query<{
				path: string;
				kind: string;
				relationship: string;
				importance: number;
				weight: number;
			}>(
				`MATCH (a:Anchor {path: $path})-[r]-(neighbor:Anchor)
				 WHERE neighbor.status = 'active'
				 RETURN neighbor.path AS path, neighbor.kind AS kind, type(r) AS relationship,
				        COALESCE(neighbor.importance, 0) AS importance, COALESCE(r.weight, 1) AS weight
				 ORDER BY weight DESC, importance DESC`,
				{ path: ctx.targetAbsolutePath },
			);

			// Populate neighbors on context for downstream queries
			ctx.neighbors = rows.map((r) => String(r.path));

			return rows.map((row) => ({
				source: "semantic-graph" as const,
				distance: 1 as const,
				detail: "summary" as const,
				content: `${row.relationship}: ${row.path}`,
				metadata: {
					path: String(row.path),
					relationship: String(row.relationship),
				},
			}));
		} catch {
			return [];
		} finally {
			await client.close();
		}
	},
};
