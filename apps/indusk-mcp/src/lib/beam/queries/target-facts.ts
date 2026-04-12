/**
 * Query 3: Graphiti facts for the target file.
 * Distance 0, full detail.
 */

import { GraphitiClient } from "../../graphiti-client.js";
import type { QueryStep } from "../types.js";

export const targetFacts: QueryStep = {
	name: "target-facts",
	source: "graphiti",
	distance: 0,
	maxResults: 10,
	detail: "full",
	async execute(ctx) {
		try {
			const client = new GraphitiClient(ctx.projectRoot);
			const facts = await client.searchFacts(ctx.targetPath, { maxResults: 10 });

			return facts.map((f) => ({
				source: "graphiti" as const,
				distance: 0 as const,
				detail: "full" as const,
				content: f.fact ?? "(no fact text)",
				metadata: {
					path: ctx.targetPath,
					timestamp: f.valid_at ?? undefined,
					factId: f.uuid,
				},
			}));
		} catch {
			return [];
		}
	},
};
