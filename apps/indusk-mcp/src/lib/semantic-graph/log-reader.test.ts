import { mkdtempSync, rmSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SemanticGraphEvent } from "./events.js";
import { readAllEvents } from "./log-reader.js";
import { LogWriter } from "./log-writer.js";
import { getLogPath } from "./paths.js";

const CHANGE_ID = "ulqxwpkwmvsr";
const TS = "2026-04-08T12:00:00.000Z";

function event(uuid: string, path: string): SemanticGraphEvent {
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

describe("log reader", () => {
	let projectRoot: string;

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), "semantic-graph-reader-"));
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	it("returns an empty iterator for a missing log file", async () => {
		const logPath = getLogPath(projectRoot);
		const events = await readAllEvents(logPath);
		expect(events).toEqual([]);
	});

	it("roundtrips events written by LogWriter", async () => {
		const logPath = getLogPath(projectRoot);
		const writer = new LogWriter(logPath);

		const written = [
			event("a1", "src/foo.ts"),
			event("a2", "src/bar.ts"),
			event("a3", "src/baz.ts"),
		];
		for (const e of written) {
			await writer.append(e);
		}

		const read = await readAllEvents(logPath);
		expect(read).toEqual(written);
	});

	it("skips malformed lines via the onMalformed callback and continues", async () => {
		const logPath = getLogPath(projectRoot);
		const writer = new LogWriter(logPath);

		await writer.append(event("a1", "src/foo.ts"));
		// Inject a garbage line directly
		await appendFile(logPath, "{not-valid-json\n", "utf8");
		await writer.append(event("a2", "src/bar.ts"));

		const malformed: Array<{ line: string; lineNumber: number }> = [];
		const read = await readAllEvents(logPath, {
			onMalformed: (line, _err, lineNumber) => {
				malformed.push({ line, lineNumber });
			},
		});

		expect(read).toHaveLength(2);
		expect(read[0]?.type).toBe("anchor.created");
		expect(read[1]?.type).toBe("anchor.created");
		expect(malformed).toHaveLength(1);
		expect(malformed[0]?.lineNumber).toBe(2);
	});

	it("skips blank lines silently", async () => {
		const logPath = getLogPath(projectRoot);
		const writer = new LogWriter(logPath);

		await writer.append(event("a1", "src/foo.ts"));
		await appendFile(logPath, "\n", "utf8");
		await writer.append(event("a2", "src/bar.ts"));

		const read = await readAllEvents(logPath);
		expect(read).toHaveLength(2);
	});

	it("survives a half-written event at EOF (simulates crash during append)", async () => {
		const logPath = getLogPath(projectRoot);
		const writer = new LogWriter(logPath);

		await writer.append(event("a1", "src/foo.ts"));
		// Simulate a crash: partial JSON, no newline
		await appendFile(logPath, '{"type":"anchor.created","uuid":"a2"', "utf8");

		const malformed: Array<string> = [];
		const read = await readAllEvents(logPath, {
			onMalformed: (line) => {
				malformed.push(line);
			},
		});

		expect(read).toHaveLength(1);
		expect(malformed).toHaveLength(1);
	});
});
