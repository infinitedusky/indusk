/**
 * Query 4: Graphiti facts for structural neighbors.
 * Distance 1, summary detail.
 */

import { GraphitiClient } from "../../graphiti-client.js";
import type { QueryStep } from "../types.js";

export const neighborFacts: QueryStep = {
	name: "neighbor-facts",
	source: "graphiti",
	distance: 1,
	maxResults: 5,
	detail: "summary",
	async execute(ctx) {
		if (ctx.neighbors.length === 0) return [];

		try {
			const client = new GraphitiClient(ctx.projectRoot);
			const query = ctx.neighbors.slice(0, 10).join(", ");
			const facts = await client.searchFacts(query, { maxResults: 5 });

			return facts.map((f: { fact?: string; uuid?: string }) => ({
				source: "graphiti" as const,
				distance: 1 as const,
				detail: "summary" as const,
				content: f.fact ?? "(no fact text)",
				metadata: { factId: f.uuid },
			}));
		} catch {
			return [];
		}
	},
};
