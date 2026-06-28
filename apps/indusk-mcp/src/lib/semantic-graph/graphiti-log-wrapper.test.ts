import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GraphitiClient } from "../graphiti-client.js";
import type { SemanticGraphEvent } from "./events.js";
import { captureWithLog } from "./graphiti-log-wrapper.js";
import { LogWriter } from "./log-writer.js";
import { getLogPath } from "./paths.js";
import type { SemanticGraphClient } from "./runtime-client.js";

// ---------------------------------------------------------------------------
// Fakes
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
			case "edge.attached":
			case "edge.invalidated":
			case "anchor.moved":
			case "anchor.tombstoned":
			case "sync.completed":
				break;
		}
	}

	async queryAnchors(options: { status?: string } = {}): Promise<FakeAnchor[]> {
		const all = [...this.anchors.values()];
		if (options.status) return all.filter((a) => a.status === options.status);
		return all;
	}
}

function asClient(fake: FakeRuntimeClient): SemanticGraphClient {
	return fake as unknown as SemanticGraphClient;
}

function asGraphiti(): GraphitiClient {
	return graphiti as unknown as GraphitiClient;
}

class FakeGraphitiClient {
	lastCall: { name: string; body: string } | null = null;
	shouldSucceed = true;

	async addEpisode(
		name: string,
		body: string,
		_options?: Record<string, unknown>,
	): Promise<{ success: boolean } | null> {
		this.lastCall = { name, body };
		if (!this.shouldSucceed) return null;
		return { success: true };
	}
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testDir: string;
let logWriter: LogWriter;
let runtimeClient: FakeRuntimeClient;
let graphiti: FakeGraphitiClient;

beforeEach(() => {
	testDir = join(tmpdir(), `wrapper-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(testDir, { recursive: true });
	// captureWithLog calls getCurrentChangeId via lib/scm which runs
	// `git rev-parse --short HEAD`. Create a real git repo with one
	// commit so the call succeeds.
	spawnSync("git", ["init", "-q", "-b", "main"], { cwd: testDir });
	spawnSync("git", ["config", "user.email", "test@test.invalid"], { cwd: testDir });
	spawnSync("git", ["config", "user.name", "Test"], { cwd: testDir });
	spawnSync("git", ["commit", "--allow-empty", "-q", "-m", "initial"], { cwd: testDir });
	logWriter = new LogWriter(getLogPath(testDir));
	runtimeClient = new FakeRuntimeClient();
	graphiti = new FakeGraphitiClient();
});

afterEach(() => {
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

describe("graphiti-log-wrapper", () => {
	it("writes to Graphiti and appends edge.attached to log", async () => {
		const result = await captureWithLog(
			"test-capture",
			"Some knowledge",
			testDir,
			asGraphiti(),
			logWriter,
			asClient(runtimeClient),
		);

		expect(result.graphitiSuccess).toBe(true);
		expect(result.edgeWritten).toBe(true);
		expect(graphiti.lastCall?.name).toBe("test-capture");

		const events = readLogEvents();
		// Should have: anchor.created (project root) + edge.attached
		const edgeEvents = events.filter((e) => e.type === "edge.attached");
		expect(edgeEvents).toHaveLength(1);
		if (edgeEvents[0].type === "edge.attached") {
			expect(edgeEvents[0].relation).toBe("knowledge");
		}
	});

	it("attaches to file anchor when filePath matches", async () => {
		// Seed a file anchor
		const fileUuid = "file-anchor-uuid-123";
		runtimeClient.anchors.set(fileUuid, {
			uuid: fileUuid,
			kind: "file",
			path: "/some/file.ts",
			name: null,
			blob_hash: null,
			status: "active",
		});

		const result = await captureWithLog(
			"file-capture",
			"Knowledge about file.ts",
			testDir,
			asGraphiti(),
			logWriter,
			asClient(runtimeClient),
			{ filePath: "/some/file.ts" },
		);

		expect(result.anchorUuid).toBe(fileUuid);
		expect(result.edgeWritten).toBe(true);
	});

	it("falls back to project-root anchor when filePath doesn't match", async () => {
		const result = await captureWithLog(
			"orphan-capture",
			"Knowledge about nothing specific",
			testDir,
			asGraphiti(),
			logWriter,
			asClient(runtimeClient),
			{ filePath: "/nonexistent/file.ts" },
		);

		expect(result.edgeWritten).toBe(true);
		// Should have created a project-root anchor
		const events = readLogEvents();
		const creates = events.filter((e) => e.type === "anchor.created");
		expect(creates).toHaveLength(1);
		if (creates[0].type === "anchor.created") {
			expect(creates[0].path).toBe(".");
			expect(creates[0].name).toBe("project-root");
		}
	});

	it("still writes edge when Graphiti fails", async () => {
		graphiti.shouldSucceed = false;

		const result = await captureWithLog(
			"failing-capture",
			"Graphiti is down",
			testDir,
			asGraphiti(),
			logWriter,
			asClient(runtimeClient),
		);

		expect(result.graphitiSuccess).toBe(false);
		expect(result.edgeWritten).toBe(true);

		const events = readLogEvents();
		const edgeEvents = events.filter((e) => e.type === "edge.attached");
		expect(edgeEvents).toHaveLength(1);
		if (edgeEvents[0].type === "edge.attached") {
			const payload = edgeEvents[0].payload as Record<string, unknown>;
			expect(payload.graphiti_success).toBe(false);
		}
	});

	it("uses custom relation label", async () => {
		const result = await captureWithLog(
			"decision-capture",
			"We decided X",
			testDir,
			asGraphiti(),
			logWriter,
			asClient(runtimeClient),
			{ relation: "decision" },
		);

		expect(result.edgeWritten).toBe(true);
		const events = readLogEvents();
		const edge = events.find((e) => e.type === "edge.attached");
		if (edge?.type === "edge.attached") {
			expect(edge.relation).toBe("decision");
		}
	});

	it("reuses existing project-root anchor", async () => {
		// First capture creates project-root
		await captureWithLog(
			"first",
			"First capture",
			testDir,
			asGraphiti(),
			logWriter,
			asClient(runtimeClient),
		);

		// Second capture should reuse it
		await captureWithLog(
			"second",
			"Second capture",
			testDir,
			asGraphiti(),
			logWriter,
			asClient(runtimeClient),
		);

		const events = readLogEvents();
		const creates = events.filter((e) => e.type === "anchor.created");
		expect(creates).toHaveLength(1); // only one project-root created
		const edges = events.filter((e) => e.type === "edge.attached");
		expect(edges).toHaveLength(2); // two captures
	});
});
