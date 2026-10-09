import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarkedSpan, MarkedSpansResult } from "../lib/promises/telemetry.js";
import { registerPromiseTools } from "../tools/promise-tools.js";
import { gitOut } from "./helpers/cli.js";
import {
	behaviourPromise,
	codeFilesFor,
	type PromiseProject,
	promiseProject,
} from "./helpers/promises-fixture.js";
import { toolCaller } from "./helpers/tool-call.js";

/**
 * incident-recording A8 — promise: catchup-records-what-it-finds.
 *
 * Catchup's tool records what the admin did not: every production violation
 * no incident holds becomes an incident, committed, and the answer says what
 * was opened. Asked again, nothing was unrecorded.
 *
 * The one read the tool makes — the production source's marks — is replaced
 * here, so a violation reaches the tool without a Jaeger (the everyday suite
 * starts none). Red today: no tool is registered under that name.
 */

const PROMISE = "seat-released";
const OWNER = "seat-holds";
const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";

const violation: MarkedSpan = {
	promise: PROMISE,
	outcome: "violated",
	traceId: TRACE,
	spanId: "00f067aa0ba902b7",
	service: "seat-holds",
	operation: "release",
	at: new Date("2026-10-08T20:00:00Z"),
	symptom: "a held seat was not released",
	environment: "production",
} as MarkedSpan;

vi.mock("../lib/promises/sources.js", async (importOriginal) => {
	const real = (await importOriginal()) as Record<string, unknown>;
	return {
		...real,
		readPromiseMarks: vi.fn(
			async (): Promise<MarkedSpansResult> => ({
				queryUrl: "https://jaeger.example",
				since: new Date("2026-10-01T00:00:00Z"),
				byPromise: new Map([
					[PROMISE, { violations: [violation], truncated: false, lastUpheld: null }],
				]),
			}),
		),
	};
});

let fixture: PromiseProject;
beforeEach(() => {
	fixture = promiseProject({
		archivedPlans: [OWNER],
		promises: [behaviourPromise(PROMISE, { owner: OWNER, domain: "seating" })],
		files: codeFilesFor(PROMISE),
		extraConfig: {
			promises: {
				domains: ["seating"],
				jaeger: { url: "https://jaeger.example", credential_env: "IR_TEST_JAEGER" },
			},
		},
	});
});
afterEach(() => rmSync(fixture.root, { recursive: true, force: true }));

const incidents = () => readdirSync(join(fixture.root, ".indusk", "promises", "incidents"));

describe("A8 — catchup's tool records what nobody recorded, and says what it opened", () => {
	it("opens and commits an incident for the unrecorded production violation, naming it", async () => {
		const tools = toolCaller((s) => registerPromiseTools(s, fixture.root));
		const first = await tools.call("record_breaks");
		expect(first.isError, JSON.stringify(first.json)).toBe(false);
		const opened = (first.json as { opened?: { id: string; promise: string; owner: string }[] })
			.opened;
		expect(opened).toEqual([
			expect.objectContaining({ promise: PROMISE, owner: OWNER, id: expect.stringMatching(/^i-/) }),
		]);
		expect(incidents()).toHaveLength(1);
		expect(gitOut(fixture.root, ["status", "--porcelain"])).toBe("");
		expect(gitOut(fixture.root, ["log", "-1", "--format=%s"])).toMatch(
			/^chore\(indusk\): incident i-.*recorded by catchup/,
		);

		const again = await tools.call("record_breaks");
		expect((again.json as { opened?: unknown[] }).opened).toEqual([]);
		expect(incidents()).toHaveLength(1);
	});
});
