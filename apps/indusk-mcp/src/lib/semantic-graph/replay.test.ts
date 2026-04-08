/**
 * Replay engine tests — integration tests against a real FalkorDB instance.
 *
 * Self-skip if indusk-infra is not reachable so CI and local dev without the
 * container don't fail.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SemanticGraphEvent } from "./events.js";
import { LogWriter } from "./log-writer.js";
import { getLogPath } from "./paths.js";
import { replay } from "./replay.js";
import { SemanticGraphClient } from "./runtime-client.js";

const TEST_PROJECT = `replay-test-${process.pid}`;
const CHANGE_A = "changeaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CHANGE_B = "changebbbbbbbbbbbbbbbbbbbbbbbbbb";
const CHANGE_C = "changecccccccccccccccccccccccccc";
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

function anchorCreated(uuid: string, path: string, change_id = CHANGE_A): SemanticGraphEvent {
	return {
		type: "anchor.created",
		uuid,
		kind: "file",
		path,
		adapter: "cgc",
		change_id,
		ts: TS,
	};
}

const describeIfFalkor = (await isFalkorReachable()) ? describe : describe.skip;

describeIfFalkor("replay engine", () => {
	let projectRoot: string;
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
		projectRoot = mkdtempSync(join(tmpdir(), "replay-test-"));
		await client.clearGraph();
		// Reopen graph handle after delete
		await client.close();
		client = new SemanticGraphClient(TEST_PROJECT);
		await client.ensureConnection();
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	it("replays an empty log to an empty runtime", async () => {
		const result = await replay(getLogPath(projectRoot), client);
		expect(result).toEqual({ total: 0, applied: 0, skipped: 0, errors: 0 });
		expect(await client.countAnchors()).toBe(0);
	});

	it("replays a simple log end-to-end", async () => {
		const writer = new LogWriter(getLogPath(projectRoot));
		await writer.append(anchorCreated("a1", "src/foo.ts"));
		await writer.append(anchorCreated("a2", "src/bar.ts"));
		await writer.append(anchorCreated("a3", "src/baz.ts"));

		const result = await replay(getLogPath(projectRoot), client);
		expect(result.total).toBe(3);
		expect(result.applied).toBe(3);
		expect(result.skipped).toBe(0);
		expect(result.errors).toBe(0);
		expect(await client.countAnchors()).toBe(3);
	});

	it("applies move and tombstone events in order", async () => {
		const writer = new LogWriter(getLogPath(projectRoot));
		await writer.append(anchorCreated("a1", "src/foo.ts"));
		await writer.append({
			type: "anchor.moved",
			uuid: "a1",
			from_path: "src/foo.ts",
			to_path: "lib/foo.ts",
			change_id: CHANGE_A,
			ts: TS,
		});
		await writer.append({
			type: "anchor.tombstoned",
			uuid: "a1",
			change_id: CHANGE_A,
			ts: TS,
		});

		const result = await replay(getLogPath(projectRoot), client);
		expect(result.applied).toBe(3);

		const found = await client.getAnchor("a1");
		expect(found?.path).toBe("lib/foo.ts");
		expect(found?.status).toBe("deleted");
	});

	it("filters by ancestry — only applies events whose change_id is reachable", async () => {
		const writer = new LogWriter(getLogPath(projectRoot));
		await writer.append(anchorCreated("a1", "src/foo.ts", CHANGE_A));
		await writer.append(anchorCreated("a2", "src/bar.ts", CHANGE_B));
		await writer.append(anchorCreated("a3", "src/baz.ts", CHANGE_C));

		// Only CHANGE_A and CHANGE_C are ancestors of HEAD
		const ancestryFilter = new Set([CHANGE_A, CHANGE_C]);
		const result = await replay(getLogPath(projectRoot), client, { ancestryFilter });

		expect(result.total).toBe(3);
		expect(result.applied).toBe(2);
		expect(result.skipped).toBe(1);
		expect(result.errors).toBe(0);

		expect(await client.getAnchor("a1")).not.toBeNull();
		expect(await client.getAnchor("a2")).toBeNull();
		expect(await client.getAnchor("a3")).not.toBeNull();
	});

	it("counts malformed lines as errors and continues", async () => {
		const logPath = getLogPath(projectRoot);
		const writer = new LogWriter(logPath);
		await writer.append(anchorCreated("a1", "src/foo.ts"));
		// Inject garbage
		const { appendFile } = await import("node:fs/promises");
		await appendFile(logPath, "{bogus json\n", "utf8");
		await writer.append(anchorCreated("a2", "src/bar.ts"));

		const malformed: string[] = [];
		const result = await replay(logPath, client, {
			onMalformed: (line) => malformed.push(line),
		});

		expect(result.applied).toBe(2);
		expect(result.errors).toBe(1);
		expect(malformed).toHaveLength(1);
		expect(await client.countAnchors()).toBe(2);
	});

	it("rebuild pattern: clearGraph then replay reconstructs identical state", async () => {
		const writer = new LogWriter(getLogPath(projectRoot));
		await writer.append(anchorCreated("a1", "src/foo.ts"));
		await writer.append(anchorCreated("a2", "src/bar.ts"));
		await writer.append({
			type: "edge.attached",
			edge_uuid: "e1",
			source_uuid: "episode-1",
			target_uuid: "a1",
			relation: "describes",
			payload: { summary: "test" },
			change_id: CHANGE_A,
			ts: TS,
		});

		// First replay
		await replay(getLogPath(projectRoot), client);
		const anchorsBefore = await client.countAnchors();
		const edgesBefore = await client.countEdges();

		// Simulate a fresh rebuild: clear and replay again
		await client.clearGraph();
		await client.close();
		client = new SemanticGraphClient(TEST_PROJECT);
		await client.ensureConnection();

		const result = await replay(getLogPath(projectRoot), client);
		expect(result.applied).toBe(3);

		expect(await client.countAnchors()).toBe(anchorsBefore);
		expect(await client.countEdges()).toBe(edgesBefore);
	});

	it("ignores sync.completed events but counts them (no-op by design)", async () => {
		const writer = new LogWriter(getLogPath(projectRoot));
		await writer.append(anchorCreated("a1", "src/foo.ts"));
		await writer.append({
			type: "sync.completed",
			adapter: "cgc",
			deltas: { created: 1, moved: 0, tombstoned: 0 },
			duration_ms: 42,
			change_id: CHANGE_A,
			ts: TS,
		});

		const result = await replay(getLogPath(projectRoot), client);
		expect(result.total).toBe(2);
		expect(result.applied).toBe(2);
		expect(await client.countAnchors()).toBe(1);
	});
});
