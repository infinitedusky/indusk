/**
 * Generic sync engine for the semantic graph.
 *
 * Diffs an adapter's snapshot against the current runtime state and emits
 * events for created, moved, and tombstoned anchors. The engine is
 * adapter-agnostic — it never imports or references any concrete adapter.
 * This is enforced by tests (Phase 5 verification grep).
 *
 * See `.indusk/research/anchor-overlay-pattern.md` Section 7.
 */

import { randomUUID } from "node:crypto";

import { getCurrentChangeId } from "../scm/index.js";
import type { SemanticGraphAdapter } from "./adapter.js";
import type {
	AnchorCreatedEvent,
	AnchorMovedEvent,
	AnchorTombstonedEvent,
	EdgeAttachedEvent,
	SemanticGraphEvent,
	SyncCompletedEvent,
} from "./events.js";
import type { LogWriter } from "./log-writer.js";
import type { SemanticGraphClient } from "./runtime-client.js";

export interface SyncResult {
	created: number;
	moved: number;
	tombstoned: number;
	unchanged: number;
	edges_attached: number;
	duration_ms: number;
}

interface ExistingAnchor {
	uuid: string;
	kind: string;
	path: string;
	name: string | null;
	blob_hash: string | null;
	status: string;
}

/**
 * Run a full sync: snapshot the adapter, diff against the runtime, emit events.
 *
 * 1. adapter.snapshot() → current records
 * 2. Read existing active anchors from runtime
 * 3. Match by identity; fallback to contentFingerprint for rename detection
 * 4. Unmatched existing → tombstone
 * 5. Tag events with current git short SHA
 * 6. Write each event to log AND apply to runtime
 * 7. Emit sync.completed
 *
 * Rebase tolerance: events are de-duplicated by content identity at sync
 * time (`existingByIdentity` on path + `existingByFingerprint` on blob hash),
 * not by change ID. A `git rebase` that rewrites commit SHAs produces
 * noisy-replay-then-converge: extra events get written; the next sync's
 * identity-matching tombstones whatever's orphaned; the runtime converges
 * to current file state after one cycle. The log may carry historical
 * noise, but functional correctness holds.
 */
export async function runSync(
	adapter: SemanticGraphAdapter,
	projectRoot: string,
	logWriter: LogWriter,
	runtimeClient: SemanticGraphClient,
): Promise<SyncResult> {
	const start = Date.now();

	const changeId = await getCurrentChangeId(projectRoot);
	const ts = new Date().toISOString();

	// 1. Snapshot current state from adapter
	const records = await adapter.snapshot(projectRoot);

	// 2. Read existing active anchors from runtime
	const existing = await getExistingAnchors(runtimeClient);

	// Build lookup maps
	const existingByIdentity = new Map<string, ExistingAnchor>();
	const existingByFingerprint = new Map<string, ExistingAnchor>();
	for (const anchor of existing) {
		const identity = identityFromAnchor(anchor);
		existingByIdentity.set(identity, anchor);
		if (anchor.blob_hash) {
			existingByFingerprint.set(anchor.blob_hash, anchor);
		}
	}

	// 3. Diff: match current records against existing anchors
	const matchedUuids = new Set<string>();
	const identityToUuid = new Map<string, string>();
	const events: SemanticGraphEvent[] = [];
	let created = 0;
	let moved = 0;
	let unchanged = 0;

	for (const record of records) {
		const identity = adapter.identify(record);
		const match = existingByIdentity.get(identity);

		if (match) {
			// Identity match — anchor still exists, no event needed
			matchedUuids.add(match.uuid);
			identityToUuid.set(identity, match.uuid);
			unchanged++;
			continue;
		}

		// No identity match — check fingerprint for rename detection
		const fingerprint = adapter.contentFingerprint(record);
		if (fingerprint) {
			const fpMatch = existingByFingerprint.get(fingerprint);
			if (fpMatch && !matchedUuids.has(fpMatch.uuid)) {
				// Same content, different identity → move
				matchedUuids.add(fpMatch.uuid);
				identityToUuid.set(identity, fpMatch.uuid);
				const moveEvent: AnchorMovedEvent = {
					type: "anchor.moved",
					uuid: fpMatch.uuid,
					from_path: fpMatch.path,
					to_path: record.path,
					blob_hash: fingerprint,
					change_id: changeId,
					ts,
				};
				events.push(moveEvent);
				moved++;
				continue;
			}
		}

		// No match at all → create
		const newUuid = randomUUID();
		identityToUuid.set(identity, newUuid);
		const createEvent: AnchorCreatedEvent = {
			type: "anchor.created",
			uuid: newUuid,
			kind: record.kind,
			path: record.path,
			name: record.name,
			parent_uuid: undefined,
			blob_hash: fingerprint ?? undefined,
			adapter: adapter.name,
			change_id: changeId,
			ts,
		};
		events.push(createEvent);
		created++;
	}

	// 4. Unmatched existing anchors → tombstone
	let tombstoned = 0;
	for (const anchor of existing) {
		if (!matchedUuids.has(anchor.uuid)) {
			const tombEvent: AnchorTombstonedEvent = {
				type: "anchor.tombstoned",
				uuid: anchor.uuid,
				change_id: changeId,
				ts,
			};
			events.push(tombEvent);
			tombstoned++;
		}
	}

	// 5. Project adapter edges (e.g. internal imports)
	let edges_attached = 0;
	if (adapter.edges) {
		const adapterEdges = adapter.edges();
		for (const edge of adapterEdges) {
			const sourceUuid = identityToUuid.get(edge.source_identity);
			const targetUuid = identityToUuid.get(edge.target_identity);
			if (!sourceUuid || !targetUuid) continue; // skip unresolvable
			const edgeEvent: EdgeAttachedEvent = {
				type: "edge.attached",
				edge_uuid: randomUUID(),
				source_uuid: sourceUuid,
				target_uuid: targetUuid,
				relation: edge.relation,
				payload: {},
				change_id: changeId,
				ts,
			};
			events.push(edgeEvent);
			edges_attached++;
		}
	}

	// 6. Write each event to log AND apply to runtime
	for (const event of events) {
		await logWriter.append(event);
		await runtimeClient.applyEvent(event);
	}

	// 7. Emit sync.completed
	const duration_ms = Date.now() - start;
	const completedEvent: SyncCompletedEvent = {
		type: "sync.completed",
		adapter: adapter.name,
		deltas: { created, moved, tombstoned },
		duration_ms,
		change_id: changeId,
		ts: new Date().toISOString(),
	};
	await logWriter.append(completedEvent);
	await runtimeClient.applyEvent(completedEvent);

	return { created, moved, tombstoned, unchanged, edges_attached, duration_ms };
}

/** Query all active anchors from the runtime graph. */
async function getExistingAnchors(client: SemanticGraphClient): Promise<ExistingAnchor[]> {
	return client.queryAnchors({ status: "active" });
}

/** Reconstruct identity string from a stored anchor (mirrors adapter.identify format). */
function identityFromAnchor(anchor: ExistingAnchor): string {
	if (anchor.kind === "file") {
		return `file::${anchor.path}`;
	}
	// Symbol kinds use parent path + name
	return `${anchor.kind}::${anchor.path}::${anchor.name ?? ""}`;
}
