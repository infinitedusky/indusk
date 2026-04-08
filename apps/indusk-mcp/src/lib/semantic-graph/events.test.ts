import { describe, expect, it } from "vitest";

import { parseEvent, type SemanticGraphEvent, serializeEvent } from "./events.js";

const SAMPLE_CHANGE_ID = "ulqxwpkwmvsr";
const SAMPLE_TS = "2026-04-08T12:00:00.000Z";

function baseFields() {
	return { change_id: SAMPLE_CHANGE_ID, ts: SAMPLE_TS };
}

describe("semantic graph events", () => {
	const roundtripCases: SemanticGraphEvent[] = [
		{
			type: "anchor.created",
			uuid: "a1",
			kind: "file",
			path: "src/foo.ts",
			blob_hash: "abc123",
			adapter: "cgc",
			...baseFields(),
		},
		{
			type: "anchor.created",
			uuid: "s1",
			kind: "function",
			path: "src/foo.ts",
			name: "processPayment",
			parent_uuid: "a1",
			adapter: "cgc",
			...baseFields(),
		},
		{
			type: "anchor.moved",
			uuid: "a1",
			from_path: "src/foo.ts",
			to_path: "lib/foo.ts",
			blob_hash: "abc123",
			...baseFields(),
		},
		{
			type: "anchor.tombstoned",
			uuid: "a1",
			...baseFields(),
		},
		{
			type: "edge.attached",
			edge_uuid: "e1",
			source_uuid: "episode-1",
			target_uuid: "a1",
			relation: "describes",
			payload: { summary: "ADR about foo", commit: "abc" },
			...baseFields(),
		},
		{
			type: "edge.invalidated",
			edge_uuid: "e1",
			reason: "superseded by ADR-42",
			...baseFields(),
		},
		{
			type: "sync.completed",
			adapter: "cgc",
			deltas: { created: 3, moved: 1, tombstoned: 0 },
			duration_ms: 420,
			...baseFields(),
		},
	];

	for (const event of roundtripCases) {
		it(`roundtrips ${event.type}`, () => {
			const serialized = serializeEvent(event);
			expect(serialized).not.toContain("\n");
			const parsed = parseEvent(serialized);
			expect(parsed).toEqual(event);
		});
	}

	it("rejects events missing change_id", () => {
		const bad = JSON.stringify({
			type: "anchor.tombstoned",
			uuid: "a1",
			ts: SAMPLE_TS,
		});
		expect(() => parseEvent(bad)).toThrow();
	});

	it("rejects unknown event type", () => {
		const bad = JSON.stringify({
			type: "anchor.teleported",
			uuid: "a1",
			...baseFields(),
		});
		expect(() => parseEvent(bad)).toThrow();
	});

	it("rejects malformed JSON", () => {
		expect(() => parseEvent("{not-json")).toThrow();
	});

	it("rejects sync.completed with negative counts", () => {
		const bad = JSON.stringify({
			type: "sync.completed",
			adapter: "cgc",
			deltas: { created: -1, moved: 0, tombstoned: 0 },
			duration_ms: 10,
			...baseFields(),
		});
		expect(() => parseEvent(bad)).toThrow();
	});
});
