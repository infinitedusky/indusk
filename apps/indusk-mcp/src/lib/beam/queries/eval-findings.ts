/**
 * Query 5: Unresolved eval findings referencing the target file.
 * Distance 0, full detail. These are active warnings.
 */

import { getUnresolvedFindings } from "../../eval/findings.js";
import type { QueryStep } from "../types.js";

export const evalFindings: QueryStep = {
	name: "eval-findings",
	source: "eval",
	distance: 0,
	maxResults: 10,
	detail: "full",
	async execute(ctx) {
		try {
			const findings = getUnresolvedFindings(ctx.projectRoot);
			const relevant = findings.filter(
				(f) =>
					f.finding.includes(ctx.targetPath) ||
					f.finding.includes(ctx.targetPath.split("/").pop() ?? ""),
			);

			return relevant.map((f) => ({
				source: "eval" as const,
				distance: 0 as const,
				detail: "full" as const,
				content: `[${f.severity}] ${f.questionId}: ${f.finding}`,
				metadata: {
					path: ctx.targetPath,
					severity: f.severity,
				},
			}));
		} catch {
			return [];
		}
	},
};
