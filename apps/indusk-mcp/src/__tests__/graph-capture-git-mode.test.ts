import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GraphitiClient } from "../lib/graphiti-client.js";
import type { SemanticGraphEvent } from "../lib/semantic-graph/events.js";
import { captureWithLog } from "../lib/semantic-graph/graphiti-log-wrapper.js";
import { LogWriter } from "../lib/semantic-graph/log-writer.js";
import { getLogPath } from "../lib/semantic-graph/paths.js";
import type { SemanticGraphClient } from "../lib/semantic-graph/runtime-client.js";

/**
 * Trajectory T2, T5 — git-only-substrate plan, Phase 1 parity.
 *
 *   T2 — A `graph_capture` call on a git-mode project writes both the
 *        Graphiti episode AND an `edge.attached` event to the semantic
 *        graph log.
 *   T5 — When `graph_capture` is called with a `file_path` argument,
 *        the resulting `edge.attached` event's target_uuid matches the
 *        specific file's anchor UUID (not the project-root fallback).
 *
 * RED AGAINST PRE-PHASE-1 STACK. Today `captureWithLog` early-returns
 * at line 93 of graphiti-log-wrapper.ts on git-mode projects with
 * `edgeWritten: false`. After Phase 1 deletes the early-return, the
 * function falls through to anchor resolution + edge write.
 *
 * Strategy: stub GraphitiClient + use FakeRuntimeClient with pre-seeded
 * anchors + real LogWriter. Avoids the FalkorDB dependency that a full
 * integration test would need; the captureWithLog logic itself is what
 * we're asserting, not the runtime client's behavior.
 */

// ---------------------------------------------------------------------------
// Fakes (mirrored from graphiti-log-wrapper.test.ts)
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
		if (event.type === "anchor.created") {
			this.anchors.set(event.uuid, {
				uuid: event.uuid,
				kind: event.kind,
				path: event.path,
				name: event.name ?? null,
				blob_hash: event.blob_hash ?? null,
				status: "active",
			});
		}
	}

	async queryAnchors(options: { status?: string } = {}): Promise<FakeAnchor[]> {
		const all = [...this.anchors.values()];
		if (options.status) return all.filter((a) => a.status === options.status);
		return all;
	}

	seedAnchor(anchor: FakeAnchor): void {
		this.anchors.set(anchor.uuid, anchor);
	}
}

class FakeGraphitiClient {
	calls: Array<{ name: string; body: string }> = [];
	shouldSucceed = true;

	async addEpisode(
		name: string,
		body: string,
		_options?: Record<string, unknown>,
	): Promise<{ success: boolean } | null> {
		this.calls.push({ name, body });
		if (!this.shouldSucceed) return null;
		return { success: true };
	}
}

function asClient(fake: FakeRuntimeClient): SemanticGraphClient {
	return fake as unknown as SemanticGraphClient;
}

function asGraphiti(fake: FakeGraphitiClient): GraphitiClient {
	return fake as unknown as GraphitiClient;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testDir: string;
let logWriter: LogWriter;
let runtimeClient: FakeRuntimeClient;
let graphiti: FakeGraphitiClient;

beforeEach(() => {
	testDir = mkdtempSync(join(tmpdir(), "graph-capture-git-"));
	// Create a real git repo so getCurrentChangeId (which on git mode calls
	// `git rev-parse --short HEAD`) returns a valid short SHA. captureWithLog
	// reads it at line 115 — without a commit, git rev-parse errors and the
	// edge-write try/catch swallows it, breaking the test.
	spawnSync("git", ["init", "-q", "-b", "main"], { cwd: testDir });
	spawnSync("git", ["config", "user.email", "test@test.invalid"], { cwd: testDir });
	spawnSync("git", ["config", "user.name", "Test"], { cwd: testDir });
	spawnSync("git", ["commit", "--allow-empty", "-q", "-m", "initial"], { cwd: testDir });

	// Write a minimal .indusk/config.json. As of 1.31.0 the `scm` field is
	// no longer read by InDusk (git-only-substrate Phase 4); the file is
	// kept here only because some downstream callers (getProjectGroupId etc)
	// expect it to exist.
	mkdirSync(join(testDir, ".indusk"), { recursive: true });
	writeFileSync(
		join(testDir, ".indusk/config.json"),
		JSON.stringify({ name: "graph-capture-git-test", scm: "git" }, null, 2),
	);

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

describe("graph_capture on git-mode project (T2, T5)", () => {
	// T2 — both Graphiti episode AND edge.attached land
	it("T2: writes both Graphiti episode AND edge.attached event to semantic graph log", async () => {
		const result = await captureWithLog(
			"test-episode",
			"Some highlight body",
			testDir,
			asGraphiti(graphiti),
			logWriter,
			asClient(runtimeClient),
		);

		expect(result.graphitiSuccess, "Graphiti write should succeed").toBe(true);
		expect(result.edgeWritten, "edge.attached event should be written to log on git mode").toBe(
			true,
		);
		expect(graphiti.calls).toHaveLength(1);
		expect(graphiti.calls[0].name).toBe("test-episode");
		expect(graphiti.calls[0].body).toBe("Some highlight body");

		const events = readLogEvents();
		const edgeEvents = events.filter((e) => e.type === "edge.attached");
		expect(edgeEvents.length, "log should contain at least one edge.attached event").toBeGreaterThanOrEqual(1);
	});

	// T5 — file-linkage edge targets the specific file's anchor, not project-root fallback
	it("T5: when file_path is provided and the file's anchor exists, edge targets that anchor (not project-root fallback)", async () => {
		// Seed the runtime with an anchor for src/foo.ts. captureWithLog should
		// find this via resolveFileAnchor at line 102 and use its UUID as the
		// edge's target_uuid.
		const fileAnchorUuid = "11111111-1111-1111-1111-111111111111";
		runtimeClient.seedAnchor({
			uuid: fileAnchorUuid,
			kind: "file",
			path: "src/foo.ts",
			name: "foo.ts",
			blob_hash: "deadbeef",
			status: "active",
		});

		const result = await captureWithLog(
			"foo-specific-episode",
			"Knowledge about foo",
			testDir,
			asGraphiti(graphiti),
			logWriter,
			asClient(runtimeClient),
			{ filePath: "src/foo.ts", relation: "highlight" },
		);

		expect(result.edgeWritten, "edge.attached should be written").toBe(true);
		expect(result.anchorUuid, "anchorUuid should be the file's, not project-root").toBe(
			fileAnchorUuid,
		);

		const events = readLogEvents();
		const edgeEvents = events.filter((e) => e.type === "edge.attached");
		expect(edgeEvents.length).toBeGreaterThanOrEqual(1);
		// Find the edge.attached event whose target is the file's anchor
		const fileEdge = edgeEvents.find(
			(e) => e.type === "edge.attached" && e.target_uuid === fileAnchorUuid,
		);
		expect(
			fileEdge,
			`expected an edge.attached event with target_uuid ${fileAnchorUuid} (the file's anchor); got events: ${JSON.stringify(edgeEvents)}`,
		).toBeDefined();
		if (fileEdge?.type === "edge.attached") {
			expect(fileEdge.relation).toBe("highlight");
		}
	});
});
