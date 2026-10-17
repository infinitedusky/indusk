import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Tracer } from "@opentelemetry/api";
import { afterEach, describe, expect, it } from "vitest";
import { git } from "../../__tests__/helpers/test-git.js";
import { markEvaluation } from "../eval/otel.js";
import { type LookResult, reportLooks } from "../looks/report.js";
import { type Report, reportBody } from "../telemetry/daemon-reports.js";
import { markPromise } from "./mark.js";
import { recorderMark } from "./record.js";
import { parseMarkedSpan } from "./telemetry.js";
import { trunkCommitMarks } from "./trunk-commit.js";

// promise: a-promise-is-upheld-or-broken

/**
 * A3 of one-promise-language: InDusk's own signals — the evaluator's, the
 * recorder's, the trunk-commit signal's and the looks check's — still write
 * the word `violated` on the wire this release, so a recording server already
 * deployed keeps reading them; and what they wrote reads back as broken.
 * Switching the asserted wire word to `broken` is the `mark-first` plan's.
 *
 * Each caller is driven through its own path against a recording span; what
 * it wrote is then handed to the span parser as Jaeger would return it.
 */

interface Recorded {
	attributes: Record<string, string>;
	events: { name: string; attributes: Record<string, string> }[];
}

function recordingSpan() {
	const rec: Recorded = { attributes: {}, events: [] };
	const span = {
		setAttribute(key: string, value: unknown) {
			rec.attributes[key] = String(value);
			return span;
		},
		addEvent(name: string, attributes?: Record<string, unknown>) {
			rec.events.push({
				name,
				attributes: Object.fromEntries(
					Object.entries(attributes ?? {}).map(([k, v]) => [k, String(v)]),
				),
			});
			return span;
		},
	};
	return { span, rec };
}

/** What Jaeger would hand back for the span a caller wrote, parsed as the reader parses it. */
function readBack(rec: Recorded) {
	const tags = Object.entries(rec.attributes).map(([key, value]) => ({ key, value }));
	const logs = rec.events.map((e) => ({
		timestamp: 0,
		fields: [
			{ key: "event", value: e.name },
			...Object.entries(e.attributes).map(([key, value]) => ({ key, value })),
		],
	}));
	return parseMarkedSpan(
		{
			traceID: "t",
			spanID: "s",
			operationName: "op",
			startTime: 1_000_000,
			duration: 1_000,
			processID: "p",
			tags,
			logs,
		},
		"indusk",
	);
}

/** The assertions every writer shares: `violated` on the wire, the event carried, broken on the way back. */
function expectWrittenViolatedReadBroken(rec: Recorded) {
	expect(rec.attributes["indusk.promise.outcome"]).toBe("violated");
	expect(rec.events.map((e) => e.name)).toContain("indusk.promise.violated");
	expect(readBack(rec)?.outcome).toBe("broken");
}

describe("A3 — InDusk's own signals write violated this release and read back broken", () => {
	it("the evaluator's failed evaluation", () => {
		const { span, rec } = recordingSpan();
		markEvaluation(span as never, { error: true, message: "the model refused" } as never, "demo");
		expectWrittenViolatedReadBroken(rec);
	});

	it("the recorder's broken pass, given the in-memory verdict broken", () => {
		const { span, rec } = recordingSpan();
		recorderMark(span as never, { outcome: "broken", symptom: "could not read" } as never);
		expectWrittenViolatedReadBroken(rec);
	});

	it("the recorder's upheld pass is written and read upheld", () => {
		const { span, rec } = recordingSpan();
		recorderMark(span as never, { outcome: "upheld" });
		expect(rec.attributes["indusk.promise.outcome"]).toBe("upheld");
		expect(readBack(rec)?.outcome).toBe("upheld");
	});

	it("the looks check's broken look", () => {
		const { span, rec } = recordingSpan();
		const tracer = { startSpan: () => ({ ...span, end() {} }) } as unknown as Tracer;
		const broken: LookResult = {
			app: "demo",
			screen: "home",
			state: "empty",
			device: "phone",
			verdict: {
				state: "broken",
				findings: [{ token: "--dusk", approved: "#c2620b", actual: "#c2620c" }],
			},
		};
		reportLooks([broken], tracer, { project: "demo" });
		expectWrittenViolatedReadBroken(rec);
	});

	describe("the trunk-commit signal for a plan written on the trunk", () => {
		const dirs: string[] = [];
		afterEach(() => {
			for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
		});

		it("is a broken verdict in code, written violated and read back broken", async () => {
			const dir = mkdtempSync(join(tmpdir(), "signal-writers-"));
			dirs.push(dir);
			git(dir, ["init", "-q", "-b", "main"]);
			writeFileSync(join(dir, "README.md"), "x\n");
			git(dir, ["add", "-A"]);
			git(dir, ["commit", "-qm", "init"]);
			const rel = ".indusk/planning/seats/brief.md";
			mkdirSync(dirname(join(dir, rel)), { recursive: true });
			writeFileSync(join(dir, rel), "# seats\n");
			git(dir, ["add", "-A"]);
			git(dir, ["commit", "-qm", "plan(seats): brief"]);
			const sha = git(dir, ["rev-parse", "HEAD"]);

			const [mark] = await trunkCommitMarks(dir, sha, ["main"]);
			expect(mark?.outcome).toBe("broken");

			const { span, rec } = recordingSpan();
			markPromise(span, { promise: "a-plan-is-written-on-its-own-branch", ...(mark as never) });
			expectWrittenViolatedReadBroken(rec);
		});
	});

	describe("the daemon's own reports", () => {
		type OtlpAttr = { key: string; value: Record<string, string> };
		const flat = (attrs: OtlpAttr[]) =>
			attrs.map((a) => ({ key: a.key, value: Object.values(a.value)[0] as string }));

		/** An OTLP/JSON span body as Jaeger would hand it back, parsed as the reader parses it. */
		function readReport(report: Report) {
			const body = reportBody(report) as {
				resourceSpans: {
					scopeSpans: {
						spans: { attributes: OtlpAttr[]; events: { name: string; attributes: OtlpAttr[] }[] }[];
					}[];
				}[];
			};
			const span = body.resourceSpans[0]?.scopeSpans[0]?.spans[0];
			if (!span) throw new Error("no span");
			return {
				tags: flat(span.attributes),
				parsed: parseMarkedSpan(
					{
						traceID: "t",
						spanID: "s",
						operationName: "daemon.report",
						startTime: 1_000_000,
						duration: 1_000,
						processID: "p",
						tags: flat(span.attributes),
						logs: span.events.map((e) => ({
							timestamp: 0,
							fields: [{ key: "event", value: e.name }, ...flat(e.attributes)],
						})),
					},
					"indusk",
				),
			};
		}

		it("a broken report is written violated, carries its clause, and reads back broken", () => {
			const { tags, parsed } = readReport({
				clause: "strays-are-cleared",
				outcome: "broken",
				symptom: "strays-are-cleared: still running: jaeger 4",
				attributes: {},
			});
			expect(tags).toContainEqual({ key: "indusk.promise.outcome", value: "violated" });
			expect(tags).toContainEqual({ key: "indusk.clause", value: "strays-are-cleared" });
			expect(parsed?.outcome).toBe("broken");
		});

		it("an upheld report is written upheld and read back upheld", () => {
			const { tags, parsed } = readReport({
				clause: "the-log-is-readable",
				outcome: "upheld",
				attributes: {},
			});
			expect(tags).toContainEqual({ key: "indusk.promise.outcome", value: "upheld" });
			expect(parsed?.outcome).toBe("upheld");
		});
	});
});
