import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * incident-recording — the admin daemon's recording loops (ADR D2).
 * A23 (second half) — promise: the-demo-break-is-caught-locally;
 * promise: a-production-break-is-recorded-unasked.
 *
 * One loop per registered project that names a production source, on that
 * project's refresh interval; none for a project with only a local source (a
 * local break is work in progress). A pass slower than its interval is never
 * overlapped, a pass that throws is logged and the loop goes on, projects
 * registered later are picked up, and stopping ends every loop.
 *
 * Time is faked; the projects, their sources and the pass are inputs. Loaded
 * by dynamic import: the module is this phase's to write.
 */

type Loops = { stop(): void; watching(): string[] };
type Start = (opts: {
	projects: () => string[];
	hasProduction: (root: string) => boolean;
	intervalFor: (root: string) => number;
	record: (root: string) => Promise<unknown>;
	log?: (line: string) => void;
	reconcileEveryMs?: number;
}) => Loops;

async function start(): Promise<Start> {
	const mod = (await import("./recorder-loop.js")) as Record<string, unknown>;
	if (typeof mod.startRecorderLoops !== "function") {
		throw new Error("recorder-loop.ts exports no startRecorderLoops");
	}
	return mod.startRecorderLoops as Start;
}

const PROD = "/projects/with-production";
const LOCAL = "/projects/local-only";

let loops: Loops | null = null;
beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	loops?.stop();
	loops = null;
	vi.useRealTimers();
});

describe("the admin records only projects that name a production source", () => {
	it("A23 — a project with only a local source gets no loop; one naming production is recorded on its interval", async () => {
		const startRecorderLoops = await start();
		const record = vi.fn(async () => {});
		loops = startRecorderLoops({
			projects: () => [PROD, LOCAL],
			hasProduction: (root) => root === PROD,
			intervalFor: () => 5_000,
			record,
		});
		expect(loops.watching()).toEqual([PROD]);
		await vi.advanceTimersByTimeAsync(15_000);
		expect(record.mock.calls.map(([root]) => root)).toEqual([PROD, PROD, PROD]);
	});
});

describe("a loop's passes", () => {
	it("a pass slower than its interval is never overlapped", async () => {
		const startRecorderLoops = await start();
		let release: () => void = () => {};
		const record = vi.fn(() => new Promise<void>((r) => (release = r)));
		loops = startRecorderLoops({
			projects: () => [PROD],
			hasProduction: () => true,
			intervalFor: () => 5_000,
			record,
		});
		await vi.advanceTimersByTimeAsync(20_000);
		expect(record).toHaveBeenCalledTimes(1);
		release();
		await vi.advanceTimersByTimeAsync(5_000);
		expect(record).toHaveBeenCalledTimes(2);
	});

	it("a pass that throws is logged and the loop goes on", async () => {
		const startRecorderLoops = await start();
		const lines: string[] = [];
		const record = vi
			.fn<(root: string) => Promise<unknown>>()
			.mockRejectedValueOnce(new Error("disk full"))
			.mockResolvedValue(undefined);
		loops = startRecorderLoops({
			projects: () => [PROD],
			hasProduction: () => true,
			intervalFor: () => 5_000,
			record,
			log: (l) => lines.push(l),
		});
		await vi.advanceTimersByTimeAsync(10_000);
		expect(record).toHaveBeenCalledTimes(2);
		expect(lines.join("\n")).toMatch(/disk full/);
	});

	it("a project registered later is picked up; stopping ends every loop", async () => {
		const startRecorderLoops = await start();
		const registered = [PROD];
		const record = vi.fn(async () => {});
		loops = startRecorderLoops({
			projects: () => registered,
			hasProduction: () => true,
			intervalFor: () => 5_000,
			record,
			reconcileEveryMs: 60_000,
		});
		registered.push("/projects/later");
		await vi.advanceTimersByTimeAsync(60_000);
		expect(loops.watching()).toEqual([PROD, "/projects/later"]);
		loops.stop();
		const calls = record.mock.calls.length;
		await vi.advanceTimersByTimeAsync(30_000);
		expect(record.mock.calls.length).toBe(calls);
	});
});
