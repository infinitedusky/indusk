/**
 * Adapter interface for the semantic graph sync engine.
 *
 * An adapter teaches the sync engine how to snapshot a particular data source
 * (files, symbols, API endpoints, calendar events…) and identify records
 * across syncs. The sync engine itself is adapter-agnostic — it never imports
 * or references any concrete adapter. This is enforced by tests.
 *
 * See `.indusk/research/anchor-overlay-pattern.md` Section 7 for the
 * architectural constraint: "the sync pipeline must not know the word CGC."
 */

import type { AnchorKind } from "./events.js";

/**
 * A single record returned by an adapter's `snapshot()`.
 *
 * Each record maps 1:1 to a potential anchor in the semantic graph. The sync
 * engine uses `identify()` and `contentFingerprint()` to match records across
 * syncs and detect renames.
 */
export type AdapterRecord = {
	kind: AnchorKind;
	path: string;
	name?: string;
	parent_identity?: string;
	metadata?: Record<string, unknown>;
};

/**
 * A relationship between two records, discovered during snapshot.
 *
 * Edges are projected as `edge.attached` events after all anchors are synced.
 * Source and target are identity strings (from `identify()`) — the sync engine
 * resolves them to anchor UUIDs.
 */
export type AdapterEdge = {
	source_identity: string;
	target_identity: string;
	relation: string;
};

/**
 * Contract that every data-source adapter must implement.
 *
 * - `name` — stable identifier used in event log entries (e.g. "cgc", "plaid")
 * - `snapshot` — returns the current full set of records from the source
 * - `identify` — returns a stable identity string for diffing across syncs
 * - `contentFingerprint` — returns a content hash for rename detection;
 *   `undefined` means the record type doesn't support rename detection
 * - `edges` — optional; returns relationships discovered during snapshot
 */
export interface SemanticGraphAdapter {
	readonly name: string;
	snapshot(projectRoot: string): Promise<AdapterRecord[]>;
	identify(record: AdapterRecord): string;
	contentFingerprint(record: AdapterRecord): string | undefined;
	edges?(): AdapterEdge[];
}
