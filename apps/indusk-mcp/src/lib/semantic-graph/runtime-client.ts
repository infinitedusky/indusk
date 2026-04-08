/**
 * FalkorDB runtime client for the semantic graph.
 *
 * This is the "runtime" side of the event-sourced architecture — a disposable
 * projection of the event log. The log is canonical; this client is a query
 * cache rebuilt from the log at any time via the replay engine.
 *
 * Per-project isolation: each project gets its own FalkorDB graph named
 * `semantic-{projectName}`, living alongside `cgc-{projectName}` in the same
 * indusk-infra container. See ADR decision #4.
 */

import { FalkorDB, type Graph } from "falkordb";

import type { SemanticGraphEvent } from "./events.js";

export interface SemanticGraphClientOptions {
	host?: string;
	port?: number;
}

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 6379;

export class SemanticGraphClient {
	private db: FalkorDB | undefined;
	private graph: Graph | undefined;
	private readonly graphName: string;
	private readonly host: string;
	private readonly port: number;

	constructor(projectName: string, options: SemanticGraphClientOptions = {}) {
		if (projectName.length === 0) {
			throw new Error("SemanticGraphClient: projectName must not be empty");
		}
		this.graphName = `semantic-${projectName}`;
		this.host = options.host ?? DEFAULT_HOST;
		this.port = options.port ?? DEFAULT_PORT;
	}

	/** The FalkorDB graph name for this project. */
	get name(): string {
		return this.graphName;
	}

	async ensureConnection(): Promise<void> {
		if (this.db && this.graph) return;
		this.db = await FalkorDB.connect({ socket: { host: this.host, port: this.port } });
		this.graph = this.db.selectGraph(this.graphName);
	}

	async close(): Promise<void> {
		if (this.db) {
			await this.db.close();
			this.db = undefined;
			this.graph = undefined;
		}
	}

	private requireGraph(): Graph {
		if (!this.graph) {
			throw new Error("SemanticGraphClient: call ensureConnection() before operations");
		}
		return this.graph;
	}

	/**
	 * Apply a single event to the runtime graph.
	 *
	 * Event → Cypher mapping per ADR decision #4. Events are idempotent: MERGE
	 * for creation, MATCH+SET for mutation. `sync.completed` is a log bookmark,
	 * not a graph mutation, so it's a no-op here.
	 */
	async applyEvent(event: SemanticGraphEvent): Promise<void> {
		const graph = this.requireGraph();

		switch (event.type) {
			case "anchor.created": {
				await graph.query(
					`MERGE (a:Anchor {uuid: $uuid})
					 SET a.kind = $kind,
					     a.path = $path,
					     a.name = $name,
					     a.parent_uuid = $parent_uuid,
					     a.blob_hash = $blob_hash,
					     a.adapter = $adapter,
					     a.created_change_id = coalesce(a.created_change_id, $change_id),
					     a.created_ts = coalesce(a.created_ts, $ts),
					     a.status = 'active'`,
					{
						params: {
							uuid: event.uuid,
							kind: event.kind,
							path: event.path,
							name: event.name ?? null,
							parent_uuid: event.parent_uuid ?? null,
							blob_hash: event.blob_hash ?? null,
							adapter: event.adapter,
							change_id: event.change_id,
							ts: event.ts,
						},
					},
				);
				return;
			}

			case "anchor.moved": {
				await graph.query(
					`MATCH (a:Anchor {uuid: $uuid})
					 SET a.path = $to_path,
					     a.blob_hash = coalesce($blob_hash, a.blob_hash),
					     a.last_moved_change_id = $change_id,
					     a.last_moved_ts = $ts`,
					{
						params: {
							uuid: event.uuid,
							to_path: event.to_path,
							blob_hash: event.blob_hash ?? null,
							change_id: event.change_id,
							ts: event.ts,
						},
					},
				);
				return;
			}

			case "anchor.tombstoned": {
				await graph.query(
					`MATCH (a:Anchor {uuid: $uuid})
					 SET a.status = 'deleted',
					     a.tombstoned_change_id = $change_id,
					     a.tombstoned_ts = $ts`,
					{
						params: {
							uuid: event.uuid,
							change_id: event.change_id,
							ts: event.ts,
						},
					},
				);
				return;
			}

			case "edge.attached": {
				await graph.query(
					`MATCH (a:Anchor {uuid: $target_uuid})
					 MERGE (e:Edge {uuid: $edge_uuid})
					 SET e.source_uuid = $source_uuid,
					     e.target_uuid = $target_uuid,
					     e.relation = $relation,
					     e.payload = $payload_json,
					     e.attached_change_id = coalesce(e.attached_change_id, $change_id),
					     e.attached_ts = coalesce(e.attached_ts, $ts)
					 MERGE (e)-[:ATTACHED_TO]->(a)`,
					{
						params: {
							target_uuid: event.target_uuid,
							edge_uuid: event.edge_uuid,
							source_uuid: event.source_uuid,
							relation: event.relation,
							payload_json: JSON.stringify(event.payload),
							change_id: event.change_id,
							ts: event.ts,
						},
					},
				);
				return;
			}

			case "edge.invalidated": {
				await graph.query(
					`MATCH (e:Edge {uuid: $edge_uuid})
					 SET e.invalidated_at = $ts,
					     e.invalidation_reason = $reason,
					     e.invalidated_change_id = $change_id`,
					{
						params: {
							edge_uuid: event.edge_uuid,
							reason: event.reason,
							change_id: event.change_id,
							ts: event.ts,
						},
					},
				);
				return;
			}

			case "sync.completed":
				// Log-only bookmark; no graph mutation.
				return;
		}
	}

	/** Delete the entire semantic-{project} graph. Used by rebuild. */
	async clearGraph(): Promise<void> {
		const graph = this.requireGraph();
		try {
			await graph.delete();
		} catch (err) {
			// `graph.delete()` throws on missing graph; that's fine — the goal was "gone".
			if (!(err instanceof Error) || !err.message.toLowerCase().includes("empty key")) {
				// Best-effort: ignore "graph didn't exist" errors
			}
		}
	}

	async countAnchors(options: { includeTombstoned?: boolean } = {}): Promise<number> {
		const graph = this.requireGraph();
		const where = options.includeTombstoned ? "" : "WHERE a.status = 'active'";
		const result = await graph.query<{ n: number }>(
			`MATCH (a:Anchor) ${where} RETURN count(a) AS n`,
		);
		const row = result.data?.[0];
		return row ? Number(row.n ?? 0) : 0;
	}

	async countEdges(): Promise<number> {
		const graph = this.requireGraph();
		const result = await graph.query<{ n: number }>(`MATCH (e:Edge) RETURN count(e) AS n`);
		const row = result.data?.[0];
		return row ? Number(row.n ?? 0) : 0;
	}

	async getAnchor(uuid: string): Promise<{ uuid: string; path: string; status: string } | null> {
		const graph = this.requireGraph();
		const result = await graph.query<{ uuid: string; path: string; status: string }>(
			`MATCH (a:Anchor {uuid: $uuid}) RETURN a.uuid AS uuid, a.path AS path, a.status AS status`,
			{ params: { uuid } },
		);
		const row = result.data?.[0];
		if (!row) return null;
		return {
			uuid: String(row.uuid),
			path: String(row.path),
			status: String(row.status ?? "active"),
		};
	}
}
