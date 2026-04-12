/**
 * Query 6: CGC callers/callees — function-level dependencies.
 * Distance 1, summary detail.
 */

import { FalkorDB } from "falkordb";
import type { QueryStep } from "../types.js";

export const cgcRelationships: QueryStep = {
	name: "cgc-relationships",
	source: "cgc",
	distance: 1,
	maxResults: 10,
	detail: "summary",
	async execute(ctx) {
		const graphName = `cgc-${ctx.projectName}`;
		let db: FalkorDB | undefined;

		try {
			db = await FalkorDB.connect({ socket: { host: "localhost", port: 6379 } });
			const graph = db.selectGraph(graphName);

			// Find functions in the target file and their callers/callees
			// CGC IMPORTS: File → Module. CONTAINS: File → Function/Class.
			// Find what this file imports (modules) and what files contain functions that call into this file.
			const rows = await graph.query<{
				name: string;
				relationship: string;
				path: string;
			}>(
				`MATCH (f:File {relative_path: $path})-[r:IMPORTS]->(m:Module)
				 RETURN m.name AS name, 'imports' AS relationship, m.name AS path
				 UNION
				 MATCH (f:File {relative_path: $path})-[:CONTAINS]->(fn)-[:CALLS]->(callee)<-[:CONTAINS]-(other:File)
				 WHERE other.relative_path <> $path AND other.is_dependency = false
				 RETURN other.relative_path AS name, 'calls-into' AS relationship, other.relative_path AS path
				 UNION
				 MATCH (other:File)-[:CONTAINS]->(fn)-[:CALLS]->(callee)<-[:CONTAINS]-(f:File {relative_path: $path})
				 WHERE other.relative_path <> $path AND other.is_dependency = false
				 RETURN other.relative_path AS name, 'called-by' AS relationship, other.relative_path AS path`,
				{ params: { path: ctx.targetRelativePath } },
			);

			const data = rows.data ?? [];
			return data.map((row) => {
				const neighborPath = String(row.path);
				return {
					source: "cgc" as const,
					distance: 1 as const,
					detail: "summary" as const,
					content: `${row.relationship}: ${neighborPath}`,
					metadata: {
						path: neighborPath,
						relationship: String(row.relationship),
					},
				};
			});
		} catch {
			return [];
		} finally {
			if (db) await db.close();
		}
	},
};
