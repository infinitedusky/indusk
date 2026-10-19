import { join } from "node:path";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { describe, expect, it } from "vitest";
import { reportLooks } from "../looks/report.js";
import { type LookRun, lookStandingFor, readLookStanding } from "./standing.js";
import { parseMarkedSpan } from "./telemetry.js";

// promise: a-look-reports-like-any-promise
// promise: every-part-of-the-ui-is-covered
// promise: a-look-check-runs-what-changed

/**
 * ui-promises Build Phase 4: the rule `readLookStanding` applies, over the
 * looks fixture (`home.empty` approved 2026-10-10T09:00, `home.full`
 * proposed with a stale entry, `detail.default` never approved, `badge`
 * rendered and shown by no mockup), with its runs handed in.
 */

const FIXTURE = join(__dirname, "..", "..", "__tests__", "fixtures", "looks-app");

const run = (state: string, device: string, outcome: LookRun["outcome"], at: string): LookRun => ({
	app: "demo",
	screen: "home",
	state,
	device,
	outcome,
	at,
	symptom: `${state} ${outcome}`,
});

const find = (
	rows: { look: string; device: string | null }[],
	look: string,
	device: string | null,
) => rows.find((r) => r.look === look && r.device === device);

describe("readLookStanding — each look's standing", () => {
	it("an approved look with no run since its approval reads unchecked; one held since, held; one broken, broken and first", async () => {
		const { rows } = await readLookStanding(FIXTURE, {
			runs: [
				run("empty", "phone", "upheld", "2026-10-09T00:00:00.000Z"),
				run("empty", "desktop", "broken", "2026-10-11T00:00:00.000Z"),
			],
		});
		expect(find(rows, "home.empty", "phone")?.standing).toBe("unchecked");
		expect(find(rows, "home.empty", "desktop")).toMatchObject({
			standing: "broken",
			symptom: "empty broken",
		});
		expect(rows[0]).toMatchObject({ look: "home.empty", device: "desktop" });
	});

	it("an uncovered look never reads held, even when a check against its old reference held", async () => {
		const { rows } = await readLookStanding(FIXTURE, {
			runs: [run("full", "phone", "upheld", "2026-10-11T00:00:00.000Z")],
		});
		expect(find(rows, "home.full", "phone")?.standing).toBe("uncovered");
		expect(find(rows, "detail.default", "desktop")?.standing).toBe("uncovered");
		expect(find(rows, "badge", null)).toMatchObject({ kind: "component", standing: "uncovered" });
		expect(rows.some((r) => r.standing === "held")).toBe(false);
	});

	it("a project with no looks reads none", async () => {
		expect(await readLookStanding(join(FIXTURE, "src"))).toEqual({
			rows: [],
			problems: [],
			runs: { ok: true },
		});
	});
});

describe("lookStandingFor — the look rule", () => {
	it("broken first, then uncovered until approved, then held or unchecked", () => {
		const held = run("empty", "phone", "upheld", "2026-10-11T00:00:00.000Z");
		const broke = run("empty", "phone", "broken", "2026-10-11T00:00:00.000Z");
		expect(lookStandingFor(false, broke)).toBe("broken");
		expect(lookStandingFor(false, held)).toBe("uncovered");
		expect(lookStandingFor(false, null)).toBe("uncovered");
		expect(lookStandingFor(true, held)).toBe("held");
		expect(lookStandingFor(true, null)).toBe("unchecked");
	});
});

describe("parseMarkedSpan — a look check's span names its look", () => {
	it("reads indusk.look.* into the mark's look, and leaves any other mark without one", () => {
		const span = (tags: { key: string; value: unknown }[]) => ({
			traceID: "t",
			spanID: "s",
			operationName: "indusk.looks.check",
			startTime: 1_000_000,
			duration: 0,
			processID: "p1",
			tags: [
				{ key: "indusk.promise", value: "tokens-are-held-exactly" },
				{ key: "indusk.promise.outcome", value: "upheld" },
				...tags,
			],
		});
		const look = parseMarkedSpan(
			span([
				{ key: "indusk.look.app", value: "demo" },
				{ key: "indusk.look.screen", value: "home" },
				{ key: "indusk.look.state", value: "empty" },
				{ key: "indusk.look.device", value: "phone" },
			]),
			"indusk-eval-agent",
		);
		expect(look?.look).toEqual({ app: "demo", screen: "home", state: "empty", device: "phone" });
		expect(parseMarkedSpan(span([]), "svc")?.look).toBeUndefined();
	});
});

describe("a story's check run is told from a screen's", () => {
	const verdict = { state: "held" as const, findings: [] };
	const spanTags = async (kind?: "story") => {
		const exporter = new InMemorySpanExporter();
		const provider = new NodeTracerProvider({
			spanProcessors: [new SimpleSpanProcessor(exporter)],
		});
		reportLooks(
			[
				{
					app: "demo",
					screen: "home",
					state: "empty",
					device: "phone",
					verdict,
					...(kind ? { kind } : {}),
				},
			],
			provider.getTracer("a41"),
		);
		const attributes = exporter.getFinishedSpans()[0]?.attributes ?? {};
		return Object.entries(attributes).map(([key, value]) => ({ key, value }));
	};

	// A41
	it("A41 a story's span carries indusk.look.kind = story, the run read back keeps it, and a held story run never stands for a broken screen's", async () => {
		const storyTags = await spanTags("story");
		const screenTags = await spanTags();
		const marked = (tags: { key: string; value: unknown }[]) =>
			parseMarkedSpan(
				{
					traceID: "t",
					spanID: "s",
					operationName: "indusk.looks.check",
					startTime: 1_000_000,
					duration: 0,
					processID: "p1",
					// Read as a running system's span, without the test-run marker (mark-first A6).
					tags: tags.filter((t) => t.key !== "indusk.run"),
				},
				"svc",
			);
		expect(storyTags.find((t) => t.key === "indusk.look.kind")?.value).toBe("story");
		expect(screenTags.some((t) => t.key === "indusk.look.kind")).toBe(false);
		expect(marked(storyTags)?.look).toMatchObject({ kind: "story" });
		expect(marked(screenTags)?.look?.kind).toBeUndefined();

		// The screen `home.empty @ phone` broke; a later held run of the story `home.empty @ phone` exists.
		const { rows } = await readLookStanding(FIXTURE, {
			runs: [
				run("empty", "phone", "broken", "2026-10-11T00:00:00.000Z"),
				{ ...run("empty", "phone", "upheld", "2026-10-11T06:00:00.000Z"), kind: "story" },
			],
		});
		expect(find(rows, "home.empty", "phone")?.standing).toBe("broken");
	});
});

// looks-check-speed A25: a regression guard. The reader counts any upheld look
// span and ignores attributes it does not read, so a span marked reused reads
// holding; no later change to it may discount reused runs, or an unchanged
// look would decay to no signal.
describe("a look reported only as reused keeps reading holding", () => {
	const reusedSpan = (device: string, day: string) => ({
		traceID: "t",
		spanID: `s-${device}-${day}`,
		operationName: "indusk.looks.check",
		startTime: Date.parse(`2026-10-${day}T00:00:00.000Z`) * 1000,
		duration: 0,
		processID: "p1",
		tags: [
			{ key: "indusk.promise", value: "tokens-are-held-exactly" },
			{ key: "indusk.promise.outcome", value: "upheld" },
			{ key: "indusk.look.app", value: "demo" },
			{ key: "indusk.look.screen", value: "home" },
			{ key: "indusk.look.state", value: "empty" },
			{ key: "indusk.look.device", value: device },
			{ key: "indusk.look.reused", value: true },
			{ key: "indusk.look.measured_at", value: "2026-10-10T10:00:00.000Z" },
		],
	});

	it("run after run with no fresh measurement, each device reads held, never unchecked", async () => {
		const runs: LookRun[] = [];
		for (const day of ["11", "12", "13"]) {
			for (const device of ["phone", "desktop"]) {
				const mark = parseMarkedSpan(reusedSpan(device, day), "indusk-eval-agent");
				if (!mark?.look) throw new Error("the reused span named no look");
				runs.push({
					...mark.look,
					outcome: mark.outcome,
					at: mark.at.toISOString(),
					symptom: mark.symptom,
				});
			}
		}
		const { rows } = await readLookStanding(FIXTURE, { runs });
		expect(find(rows, "home.empty", "phone")?.standing).toBe("held");
		expect(find(rows, "home.empty", "desktop")?.standing).toBe("held");
	});
});
