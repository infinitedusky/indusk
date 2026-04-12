/**
 * Lightweight FalkorDB client for beam queries.
 *
 * Wraps a connection to the semantic-{project} graph with a generic query
 * method. The beam needs ad-hoc Cypher queries that don't fit the
 * SemanticGraphClient's event-replay API.
 */

import { FalkorDB, type Graph } from "falkordb";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 6379;

export class BeamGraphClient {
	private db: FalkorDB | undefined;
	private graph: Graph | undefined;
	private readonly graphName: string;

	constructor(
		projectName: string,
		private readonly host = DEFAULT_HOST,
		private readonly port = DEFAULT_PORT,
	) {
		this.graphName = `semantic-${projectName}`;
	}

	async connect(): Promise<void> {
		if (this.db && this.graph) return;
		this.db = await FalkorDB.connect({ socket: { host: this.host, port: this.port } });
		this.graph = this.db.selectGraph(this.graphName);
	}

	async query<T extends Record<string, unknown>>(
		cypher: string,
		params?: Record<string, unknown>,
	): Promise<T[]> {
		if (!this.graph) throw new Error("BeamGraphClient: call connect() first");
		const result = await this.graph.query<T>(cypher, params ? ({ params } as never) : undefined);
		return result.data ?? [];
	}

	async close(): Promise<void> {
		if (this.db) {
			await this.db.close();
			this.db = undefined;
			this.graph = undefined;
		}
	}
}
