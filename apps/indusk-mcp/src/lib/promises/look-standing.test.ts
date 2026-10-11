import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type LookRun, lookStandingFor, readLookStanding } from "./standing.js";
import { parseMarkedSpan } from "./telemetry.js";

// promise: a-look-reports-like-any-promise
// promise: every-part-of-the-ui-is-covered

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
				run("empty", "desktop", "violated", "2026-10-11T00:00:00.000Z"),
			],
		});
		expect(find(rows, "home.empty", "phone")?.standing).toBe("unchecked");
		expect(find(rows, "home.empty", "desktop")).toMatchObject({
			standing: "broken",
			symptom: "empty violated",
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
		const broke = run("empty", "phone", "violated", "2026-10-11T00:00:00.000Z");
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
