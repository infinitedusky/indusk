import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SemanticGraphEvent } from "./events.js";
import { LogWriter } from "./log-writer.js";
import { getLogPath } from "./paths.js";

const CHANGE_ID = "ulqxwpkwmvsr";
const TS = "2026-04-08T12:00:00.000Z";

function makeAnchorCreated(uuid: string, path: string): SemanticGraphEvent {
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

describe("LogWriter", () => {
	let projectRoot: string;

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), "semantic-graph-writer-"));
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	it("creates the .indusk/graph directory lazily on first write", async () => {
		const logPath = getLogPath(projectRoot);
		expect(existsSync(logPath)).toBe(false);

		const writer = new LogWriter(logPath);
		await writer.append(makeAnchorCreated("a1", "src/foo.ts"));

		expect(existsSync(logPath)).toBe(true);
	});

	it("writes events as one JSONL line per event, newline-terminated", async () => {
		const logPath = getLogPath(projectRoot);
		const writer = new LogWriter(logPath);

		await writer.append(makeAnchorCreated("a1", "src/foo.ts"));
		await writer.append(makeAnchorCreated("a2", "src/bar.ts"));

		const raw = readFileSync(logPath, "utf8");
		const lines = raw.split("\n");
		// Two events + trailing empty string from final newline
		expect(lines).toHaveLength(3);
		expect(lines[2]).toBe("");
		expect(JSON.parse(lines[0] ?? "")).toMatchObject({ type: "anchor.created", uuid: "a1" });
		expect(JSON.parse(lines[1] ?? "")).toMatchObject({ type: "anchor.created", uuid: "a2" });
	});

	it("appends to an existing log without clobbering prior contents", async () => {
		const logPath = getLogPath(projectRoot);

		const writer1 = new LogWriter(logPath);
		await writer1.append(makeAnchorCreated("a1", "src/foo.ts"));

		const writer2 = new LogWriter(logPath);
		await writer2.append(makeAnchorCreated("a2", "src/bar.ts"));

		const raw = readFileSync(logPath, "utf8");
		expect(raw.split("\n").filter(Boolean)).toHaveLength(2);
	});
});
