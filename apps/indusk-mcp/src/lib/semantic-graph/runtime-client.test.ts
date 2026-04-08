/**
 * Integration tests for the FalkorDB runtime client.
 *
 * These tests run against a real FalkorDB instance (the indusk-infra
 * container). They self-skip if the container is not reachable so CI and
 * local dev without the container don't fail.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SemanticGraphEvent } from "./events.js";
import { SemanticGraphClient } from "./runtime-client.js";

const TEST_PROJECT = `semantic-graph-test-${process.pid}`;
const CHANGE_ID = "testchangeiddummyvalueforunittests";
const TS = "2026-04-08T12:00:00.000Z";

async function isFalkorReachable(): Promise<boolean> {
	try {
		const probe = new SemanticGraphClient(TEST_PROJECT);
		await probe.ensureConnection();
		await probe.close();
		return true;
	} catch {
		return false;
	}
}

const describeIfFalkor = (await isFalkorReachable()) ? describe : describe.skip;

function anchorCreated(uuid: string, path: string): SemanticGraphEvent {
	return {
		type: "anchor.created",
		uuid,
		kind: "file",
		path,
		adapter: "cgc",
		change_id: CHANGE_ID,
		ts: TS,
	};
}

describeIfFalkor("SemanticGraphClient (integration)", () => {
	let client: SemanticGraphClient;

	beforeAll(async () => {
		client = new SemanticGraphClient(TEST_PROJECT);
		await client.ensureConnection();
	});

	afterAll(async () => {
		await client.clearGraph();
		await client.close();
	});

	beforeEach(async () => {
		await client.clearGraph();
		// Re-open graph handle after delete
		await client.close();
		client = new SemanticGraphClient(TEST_PROJECT);
		await client.ensureConnection();
	});

	afterEach(async () => {
		// no-op; beforeEach handles cleanup
	});

	it("rejects empty project name", () => {
		expect(() => new SemanticGraphClient("")).toThrow();
	});

	it("exposes the semantic-{project} graph name", () => {
		expect(client.name).toBe(`semantic-${TEST_PROJECT}`);
	});

	it("anchor.created persists an anchor with active status", async () => {
		await client.applyEvent(anchorCreated("a1", "src/foo.ts"));

		const found = await client.getAnchor("a1");
		expect(found).not.toBeNull();
		expect(found?.path).toBe("src/foo.ts");
		expect(found?.status).toBe("active");
		expect(await client.countAnchors()).toBe(1);
	});

	it("anchor.created is idempotent (MERGE semantics)", async () => {
		await client.applyEvent(anchorCreated("a1", "src/foo.ts"));
		await client.applyEvent(anchorCreated("a1", "src/foo.ts"));

		expect(await client.countAnchors()).toBe(1);
	});

	it("anchor.moved updates path in place without touching uuid", async () => {
		await client.applyEvent(anchorCreated("a1", "src/foo.ts"));
		await client.applyEvent({
			type: "anchor.moved",
			uuid: "a1",
			from_path: "src/foo.ts",
			to_path: "lib/foo.ts",
			blob_hash: "deadbeef",
			change_id: CHANGE_ID,
			ts: TS,
		});

		const found = await client.getAnchor("a1");
		expect(found?.path).toBe("lib/foo.ts");
		expect(found?.status).toBe("active");
	});

	it("anchor.tombstoned marks anchor deleted, keeps the node", async () => {
		await client.applyEvent(anchorCreated("a1", "src/foo.ts"));
		await client.applyEvent({
			type: "anchor.tombstoned",
			uuid: "a1",
			change_id: CHANGE_ID,
			ts: TS,
		});

		const found = await client.getAnchor("a1");
		expect(found).not.toBeNull();
		expect(found?.status).toBe("deleted");
		expect(await client.countAnchors()).toBe(0); // active count
		expect(await client.countAnchors({ includeTombstoned: true })).toBe(1);
	});

	it("edge.attached creates an edge linked to the anchor", async () => {
		await client.applyEvent(anchorCreated("a1", "src/foo.ts"));
		await client.applyEvent({
			type: "edge.attached",
			edge_uuid: "e1",
			source_uuid: "episode-42",
			target_uuid: "a1",
			relation: "describes",
			payload: { summary: "ADR about foo" },
			change_id: CHANGE_ID,
			ts: TS,
		});

		expect(await client.countEdges()).toBe(1);
	});

	it("edges survive anchor tombstoning (memory of the dead branch)", async () => {
		await client.applyEvent(anchorCreated("a1", "src/foo.ts"));
		await client.applyEvent({
			type: "edge.attached",
			edge_uuid: "e1",
			source_uuid: "episode-42",
			target_uuid: "a1",
			relation: "describes",
			payload: {},
			change_id: CHANGE_ID,
			ts: TS,
		});
		await client.applyEvent({
			type: "anchor.tombstoned",
			uuid: "a1",
			change_id: CHANGE_ID,
			ts: TS,
		});

		expect(await client.countEdges()).toBe(1);
		const found = await client.getAnchor("a1");
		expect(found?.status).toBe("deleted");
	});

	it("sync.completed is a no-op (does not mutate graph)", async () => {
		await client.applyEvent(anchorCreated("a1", "src/foo.ts"));
		const before = await client.countAnchors();

		await client.applyEvent({
			type: "sync.completed",
			adapter: "cgc",
			deltas: { created: 1, moved: 0, tombstoned: 0 },
			duration_ms: 10,
			change_id: CHANGE_ID,
			ts: TS,
		});

		expect(await client.countAnchors()).toBe(before);
	});
});

describe("SemanticGraphClient (unit)", () => {
	it("throws on empty project name", () => {
		expect(() => new SemanticGraphClient("")).toThrow();
	});

	it("derives the graph name as semantic-{project}", () => {
		const c = new SemanticGraphClient("foo-bar");
		expect(c.name).toBe("semantic-foo-bar");
	});

	it("requireGraph throws before ensureConnection", async () => {
		const c = new SemanticGraphClient("no-connection");
		await expect(
			c.applyEvent({
				type: "anchor.tombstoned",
				uuid: "a1",
				change_id: CHANGE_ID,
				ts: TS,
			}),
		).rejects.toThrow(/ensureConnection/);
	});
});
