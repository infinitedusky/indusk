/**
 * Semantic graph event schema.
 *
 * The event log is the canonical source of truth for the semantic graph. Every
 * mutation — anchor lifecycle, edge attachment/invalidation, sync completion —
 * is a single event appended to `.indusk/graph/semantic-graph.log` as JSONL.
 * The runtime graph in FalkorDB is a disposable projection of these events.
 *
 * Events are tagged with the jj change ID active when they were written so
 * replay can filter by jj ancestry — this is how branch/rebase/amend safety
 * works without per-branch forking.
 *
 * See `.indusk/planning/cgc-graphiti-bridge/adr.md` for the full architecture.
 */

import { z } from "zod";

/** The kinds of anchors the sync pipeline knows how to project. */
export const AnchorKindSchema = z.enum(["file", "function", "class", "interface"]);
export type AnchorKind = z.infer<typeof AnchorKindSchema>;

const BaseEventFields = {
	change_id: z.string().min(1),
	ts: z.string().min(1),
} as const;

export const AnchorCreatedEventSchema = z.object({
	type: z.literal("anchor.created"),
	uuid: z.string().min(1),
	kind: AnchorKindSchema,
	path: z.string().min(1),
	name: z.string().optional(),
	parent_uuid: z.string().optional(),
	blob_hash: z.string().optional(),
	adapter: z.string().min(1),
	...BaseEventFields,
});
export type AnchorCreatedEvent = z.infer<typeof AnchorCreatedEventSchema>;

export const AnchorMovedEventSchema = z.object({
	type: z.literal("anchor.moved"),
	uuid: z.string().min(1),
	from_path: z.string().min(1),
	to_path: z.string().min(1),
	blob_hash: z.string().optional(),
	...BaseEventFields,
});
export type AnchorMovedEvent = z.infer<typeof AnchorMovedEventSchema>;

export const AnchorTombstonedEventSchema = z.object({
	type: z.literal("anchor.tombstoned"),
	uuid: z.string().min(1),
	...BaseEventFields,
});
export type AnchorTombstonedEvent = z.infer<typeof AnchorTombstonedEventSchema>;

export const EdgeAttachedEventSchema = z.object({
	type: z.literal("edge.attached"),
	edge_uuid: z.string().min(1),
	source_uuid: z.string().min(1),
	target_uuid: z.string().min(1),
	relation: z.string().min(1),
	payload: z.record(z.string(), z.unknown()),
	...BaseEventFields,
});
export type EdgeAttachedEvent = z.infer<typeof EdgeAttachedEventSchema>;

export const EdgeInvalidatedEventSchema = z.object({
	type: z.literal("edge.invalidated"),
	edge_uuid: z.string().min(1),
	reason: z.string().min(1),
	...BaseEventFields,
});
export type EdgeInvalidatedEvent = z.infer<typeof EdgeInvalidatedEventSchema>;

export const SyncCompletedEventSchema = z.object({
	type: z.literal("sync.completed"),
	adapter: z.string().min(1),
	deltas: z.object({
		created: z.number().int().nonnegative(),
		moved: z.number().int().nonnegative(),
		tombstoned: z.number().int().nonnegative(),
	}),
	duration_ms: z.number().int().nonnegative(),
	...BaseEventFields,
});
export type SyncCompletedEvent = z.infer<typeof SyncCompletedEventSchema>;

export const SemanticGraphEventSchema = z.discriminatedUnion("type", [
	AnchorCreatedEventSchema,
	AnchorMovedEventSchema,
	AnchorTombstonedEventSchema,
	EdgeAttachedEventSchema,
	EdgeInvalidatedEventSchema,
	SyncCompletedEventSchema,
]);
export type SemanticGraphEvent = z.infer<typeof SemanticGraphEventSchema>;

/**
 * Parse a single JSONL line into a validated event.
 *
 * Throws on malformed JSON or schema mismatch. Callers that want
 * skip-and-continue semantics should catch and log.
 */
export function parseEvent(line: string): SemanticGraphEvent {
	const raw = JSON.parse(line) as unknown;
	return SemanticGraphEventSchema.parse(raw);
}

/** Serialize an event to a single JSONL line (no trailing newline). */
export function serializeEvent(event: SemanticGraphEvent): string {
	return JSON.stringify(event);
}
