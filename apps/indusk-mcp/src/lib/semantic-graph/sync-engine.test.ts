import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AdapterEdge, AdapterRecord, SemanticGraphAdapter } from "./adapter.js";
import type { SemanticGraphEvent } from "./events.js";
import { resetJjRunner, setJjRunner } from "./jj.js";
import { LogWriter } from "./log-writer.js";
import { getLogPath } from "./paths.js";
import type { SemanticGraphClient } from "./runtime-client.js";
import { runSync } from "./sync-engine.js";

// ---------------------------------------------------------------------------
// Fake in-memory runtime client (no FalkorDB dependency)
// ---------------------------------------------------------------------------

interface FakeAnchor {
	uuid: string;
	kind: string;
	path: string;
	name: string | null;
	blob_hash: string | null;
	status: string;
}

class FakeRuntimeClient {
	anchors = new Map<string, FakeAnchor>();

	async ensureConnection(): Promise<void> {}
	async close(): Promise<void> {}

	async applyEvent(event: SemanticGraphEvent): Promise<void> {
		switch (event.type) {
			case "anchor.created":
				this.anchors.set(event.uuid, {
					uuid: event.uuid,
					kind: event.kind,
					path: event.path,
					name: event.name ?? null,
					blob_hash: event.blob_hash ?? null,
					status: "active",
				});
				break;
			case "anchor.moved": {
				const a = this.anchors.get(event.uuid);
				if (a) {
					a.path = event.to_path;
					if (event.blob_hash) a.blob_hash = event.blob_hash;
				}
				break;
			}
			case "anchor.tombstoned": {
				const a = this.anchors.get(event.uuid);
				if (a) a.status = "deleted";
				break;
			}
			case "edge.attached":
			case "edge.invalidated":
			case "sync.completed":
				break;
		}
	}

	async queryAnchors(options: { status?: string } = {}): Promise<FakeAnchor[]> {
		const all = [...this.anchors.values()];
		if (options.status) return all.filter((a) => a.status === options.status);
		return all;
	}

	async countAnchors(): Promise<number> {
		return [...this.anchors.values()].filter((a) => a.status === "active").length;
	}
}

// ---------------------------------------------------------------------------
// Fake adapter — returns canned records, zero external dependencies
// ---------------------------------------------------------------------------

function createFakeAdapter(
	records: AdapterRecord[],
	adapterEdges?: AdapterEdge[],
): SemanticGraphAdapter {
	return {
		name: "fake",
		snapshot: async () => records,
		identify: (record) => {
			if (record.kind === "file") return `file::${record.path}`;
			return `${record.kind}::${record.path}::${record.name ?? ""}`;
		},
		contentFingerprint: (record) => {
			return (record.metadata?.blob_hash as string) ?? undefined;
		},
		...(adapterEdges ? { edges: () => adapterEdges } : {}),
	};
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let testDir: string;
let logWriter: LogWriter;
let client: FakeRuntimeClient;

/** Cast the fake client to the type runSync expects. Structurally compatible. */
function asClient(): SemanticGraphClient {
	return client as unknown as SemanticGraphClient;
}

beforeEach(() => {
	testDir = join(tmpdir(), `sync-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(testDir, { recursive: true });
	setJjRunner(async () => "testchangeid\n");
	logWriter = new LogWriter(getLogPath(testDir));
	client = new FakeRuntimeClient();
});

afterEach(() => {
	resetJjRunner();
	rmSync(testDir, { recursive: true, force: true });
});

function readLogEvents(): SemanticGraphEvent[] {
	try {
		const content = readFileSync(getLogPath(testDir), "utf8");
		return content
			.split("\n")
			.filter((l) => l.trim().length > 0)
			.map((l) => JSON.parse(l) as SemanticGraphEvent);
	} catch {
		return [];
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sync-engine", () => {
	it("fresh sync creates anchors for all records", async () => {
		const adapter = createFakeAdapter([
			{ kind: "file", path: "src/app.ts", metadata: { blob_hash: "abc123" } },
			{ kind: "file", path: "src/index.ts", metadata: { blob_hash: "def456" } },
			{ kind: "function", path: "src/app.ts", name: "main" },
		]);

		const result = await runSync(adapter, testDir, logWriter, asClient());

		expect(result.created).toBe(3);
		expect(result.moved).toBe(0);
		expect(result.tombstoned).toBe(0);
		expect(result.unchanged).toBe(0);
		expect(result.edges_attached).toBe(0);
		expect(await client.countAnchors()).toBe(3);

		const events = readLogEvents();
		const creates = events.filter((e) => e.type === "anchor.created");
		const completed = events.filter((e) => e.type === "sync.completed");
		expect(creates).toHaveLength(3);
		expect(completed).toHaveLength(1);
	});

	it("second sync with same records produces zero deltas", async () => {
		const records: AdapterRecord[] = [
			{ kind: "file", path: "src/app.ts", metadata: { blob_hash: "abc123" } },
			{ kind: "file", path: "src/index.ts", metadata: { blob_hash: "def456" } },
		];
		const adapter = createFakeAdapter(records);

		await runSync(adapter, testDir, logWriter, asClient());
		const result = await runSync(adapter, testDir, logWriter, asClient());

		expect(result.created).toBe(0);
		expect(result.moved).toBe(0);
		expect(result.tombstoned).toBe(0);
		expect(result.unchanged).toBe(2);
	});

	it("detects renames via content fingerprint", async () => {
		const adapter1 = createFakeAdapter([
			{ kind: "file", path: "src/old.ts", metadata: { blob_hash: "samehash" } },
		]);
		await runSync(adapter1, testDir, logWriter, asClient());

		const anchorsBefore = await client.queryAnchors({ status: "active" });
		const originalUuid = anchorsBefore[0].uuid;

		const adapter2 = createFakeAdapter([
			{ kind: "file", path: "src/new.ts", metadata: { blob_hash: "samehash" } },
		]);
		const result = await runSync(adapter2, testDir, logWriter, asClient());

		expect(result.created).toBe(0);
		expect(result.moved).toBe(1);
		expect(result.tombstoned).toBe(0);

		const anchorsAfter = await client.queryAnchors({ status: "active" });
		expect(anchorsAfter).toHaveLength(1);
		expect(anchorsAfter[0].uuid).toBe(originalUuid);
		expect(anchorsAfter[0].path).toBe("src/new.ts");
	});

	it("tombstones anchors that disappear from snapshot", async () => {
		const adapter1 = createFakeAdapter([
			{ kind: "file", path: "src/keep.ts", metadata: { blob_hash: "aaa" } },
			{ kind: "file", path: "src/remove.ts", metadata: { blob_hash: "bbb" } },
		]);
		await runSync(adapter1, testDir, logWriter, asClient());

		const adapter2 = createFakeAdapter([
			{ kind: "file", path: "src/keep.ts", metadata: { blob_hash: "aaa" } },
		]);
		const result = await runSync(adapter2, testDir, logWriter, asClient());

		expect(result.created).toBe(0);
		expect(result.tombstoned).toBe(1);
		expect(result.unchanged).toBe(1);
		expect(await client.countAnchors()).toBe(1);
	});

	it("handles mixed deltas: create + move + tombstone in one sync", async () => {
		const adapter1 = createFakeAdapter([
			{ kind: "file", path: "src/a.ts", metadata: { blob_hash: "h1" } },
			{ kind: "file", path: "src/b.ts", metadata: { blob_hash: "h2" } },
			{ kind: "file", path: "src/c.ts", metadata: { blob_hash: "h3" } },
		]);
		await runSync(adapter1, testDir, logWriter, asClient());

		const adapter2 = createFakeAdapter([
			{ kind: "file", path: "src/a.ts", metadata: { blob_hash: "h1" } },
			{ kind: "file", path: "src/d.ts", metadata: { blob_hash: "h2" } },
			{ kind: "file", path: "src/e.ts", metadata: { blob_hash: "h5" } },
		]);
		const result = await runSync(adapter2, testDir, logWriter, asClient());

		expect(result.unchanged).toBe(1);
		expect(result.moved).toBe(1);
		expect(result.tombstoned).toBe(1);
		expect(result.created).toBe(1);
	});

	it("handles empty snapshot (tombstones everything)", async () => {
		const adapter1 = createFakeAdapter([
			{ kind: "file", path: "src/a.ts" },
			{ kind: "file", path: "src/b.ts" },
		]);
		await runSync(adapter1, testDir, logWriter, asClient());

		const adapter2 = createFakeAdapter([]);
		const result = await runSync(adapter2, testDir, logWriter, asClient());

		expect(result.tombstoned).toBe(2);
		expect(result.created).toBe(0);
		expect(await client.countAnchors()).toBe(0);
	});

	it("handles empty runtime (first sync with no prior state)", async () => {
		const adapter = createFakeAdapter([
			{ kind: "function", path: "src/app.ts", name: "handler" },
		]);
		const result = await runSync(adapter, testDir, logWriter, asClient());

		expect(result.created).toBe(1);
		expect(result.unchanged).toBe(0);
	});

	it("tags all events with the jj change ID", async () => {
		setJjRunner(async () => "specificchangeid\n");

		const adapter = createFakeAdapter([
			{ kind: "file", path: "src/app.ts" },
		]);
		await runSync(adapter, testDir, logWriter, asClient());

		const events = readLogEvents();
		for (const event of events) {
			expect(event.change_id).toBe("specificchangeid");
		}
	});

	it("records without fingerprint skip rename detection", async () => {
		const adapter1 = createFakeAdapter([
			{ kind: "function", path: "src/app.ts", name: "oldName" },
		]);
		await runSync(adapter1, testDir, logWriter, asClient());

		const adapter2 = createFakeAdapter([
			{ kind: "function", path: "src/app.ts", name: "newName" },
		]);
		const result = await runSync(adapter2, testDir, logWriter, asClient());

		expect(result.tombstoned).toBe(1);
		expect(result.created).toBe(1);
		expect(result.moved).toBe(0);
	});

	it("projects adapter edges as edge.attached events", async () => {
		const records: AdapterRecord[] = [
			{ kind: "file", path: "src/app.ts" },
			{ kind: "file", path: "src/utils.ts" },
			{ kind: "file", path: "src/db.ts" },
		];
		const edges: AdapterEdge[] = [
			{ source_identity: "file::src/app.ts", target_identity: "file::src/utils.ts", relation: "imports" },
			{ source_identity: "file::src/app.ts", target_identity: "file::src/db.ts", relation: "imports" },
		];
		const adapter = createFakeAdapter(records, edges);

		const result = await runSync(adapter, testDir, logWriter, asClient());

		expect(result.created).toBe(3);
		expect(result.edges_attached).toBe(2);

		const logEvents = readLogEvents();
		const edgeEvents = logEvents.filter((e) => e.type === "edge.attached");
		expect(edgeEvents).toHaveLength(2);
		for (const e of edgeEvents) {
			if (e.type !== "edge.attached") continue;
			expect(e.relation).toBe("imports");
		}
	});

	it("skips edges with unresolvable identities", async () => {
		const records: AdapterRecord[] = [
			{ kind: "file", path: "src/app.ts" },
		];
		const edges: AdapterEdge[] = [
			{ source_identity: "file::src/app.ts", target_identity: "file::src/missing.ts", relation: "imports" },
		];
		const adapter = createFakeAdapter(records, edges);

		const result = await runSync(adapter, testDir, logWriter, asClient());

		expect(result.created).toBe(1);
		expect(result.edges_attached).toBe(0);
	});

	it("adapter without edges() method works fine", async () => {
		const adapter = createFakeAdapter([
			{ kind: "file", path: "src/app.ts" },
		]);

		const result = await runSync(adapter, testDir, logWriter, asClient());

		expect(result.created).toBe(1);
		expect(result.edges_attached).toBe(0);
	});
});
