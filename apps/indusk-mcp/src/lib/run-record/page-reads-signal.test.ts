// promise: admin-pages-load-fast
// clause: admin-pages-load-fast/one-read-per-page
// clause: admin-pages-load-fast/kept-briefly
// clause: admin-pages-load-fast/never-freezes
import { describe, expect, it } from "vitest";
import { captureTracer, outcomesByClause } from "../promises/capture-tracer.js";
import {
	BLOCKED_LIMIT_MS,
	judgePageReads,
	PAGE_LIMIT_MS,
	PAGE_STARTS_LIMIT,
	type PageReadsInput,
	reportPageReads,
} from "./page-reads-signal.js";

const input = (over: Partial<PageReadsInput> = {}): PageReadsInput => ({
	page: "plan",
	plans: 10,
	processReads: 1,
	landingReads: 1,
	programStarts: 3,
	repositories: 1,
	refreshedEarly: [false, false],
	readings: [{ ageMs: 1000, windowMs: 8000 }],
	maxBlockedMs: 5,
	elapsedMs: 300,
	...over,
});

const byClause = (v: ReturnType<typeof judgePageReads>) =>
	Object.fromEntries(v.map((x) => [x.clause, x.broken === undefined ? "upheld" : "broken"]));

describe("A22 — a page's report carries its elapsed time and its program starts", () => {
	it("A22 a quick page with one read of each and few starts holds all three clauses", () => {
		expect(byClause(judgePageReads(input()))).toEqual({
			"one-read-per-page": "upheld",
			"kept-briefly": "upheld",
			"never-freezes": "upheld",
		});
	});

	it("A22 a page over one second reports never-freezes broken, naming the page and the elapsed time apart from the blocked time", () => {
		const v = judgePageReads(input({ elapsedMs: PAGE_LIMIT_MS + 500, maxBlockedMs: 2 }));
		const broken = v.find((x) => x.clause === "never-freezes");
		expect(broken?.broken).toMatch(/plan/);
		expect(broken?.broken).toMatch(/elapsed 1500 ms/);
		expect(broken?.broken).toMatch(/blocked 2 ms/);
	});

	it("A22 a blocked event loop over the limit reports never-freezes broken", () => {
		const v = judgePageReads(input({ maxBlockedMs: BLOCKED_LIMIT_MS + 1 }));
		expect(byClause(v)["never-freezes"]).toBe("broken");
	});

	it("A22 starts that grow with the plans report one-read-per-page broken, naming the counts and the plan count", () => {
		const v = judgePageReads(input({ plans: 10, programStarts: 20 }));
		const broken = v.find((x) => x.clause === "one-read-per-page");
		expect(broken?.broken).toMatch(/10 plans/);
		expect(broken?.broken).toMatch(/20/);
	});

	it("A22 the same starts for one plan or for fifty plans are upheld", () => {
		for (const plans of [1, 50])
			expect(
				byClause(judgePageReads(input({ plans, programStarts: PAGE_STARTS_LIMIT })))[
					"one-read-per-page"
				],
			).toBe("upheld");
	});

	it("A22 a three-repository page with 18 starts is upheld, 19 is broken (6 per repository)", () => {
		expect(
			byClause(judgePageReads(input({ repositories: 3, programStarts: 18 })))["one-read-per-page"],
		).toBe("upheld");
		expect(
			byClause(judgePageReads(input({ repositories: 3, programStarts: 19 })))["one-read-per-page"],
		).toBe("broken");
	});

	it("A22 two process-list reads or two landing reads on a page are broken", () => {
		expect(byClause(judgePageReads(input({ processReads: 2 })))["one-read-per-page"]).toBe(
			"broken",
		);
		expect(byClause(judgePageReads(input({ landingReads: 2 })))["one-read-per-page"]).toBe(
			"broken",
		);
	});

	it("A22 a page with no reads and no starts holds one-read-per-page", () => {
		expect(
			byClause(
				judgePageReads(
					input({
						plans: 0,
						processReads: 0,
						landingReads: 0,
						programStarts: 0,
						refreshedEarly: [],
						readings: [],
					}),
				),
			)["one-read-per-page"],
		).toBe("upheld");
	});

	it("A22 a broken report is written though an upheld one went a moment before; upheld ones are throttled", async () => {
		const { tracer, spans } = captureTracer();
		let t = 10_000_000;
		const deps = { tracer, now: () => t };
		await reportPageReads("/p", input(), deps);
		expect(spans).toHaveLength(3);
		t += 1000;
		await reportPageReads("/p", input(), deps);
		expect(spans).toHaveLength(3); // upheld again inside the throttle: not written
		t += 1000;
		await reportPageReads("/p", input({ elapsedMs: 4000 }), deps);
		expect(spans.length).toBeGreaterThan(3);
		expect(outcomesByClause(spans.slice(3))["never-freezes"]).toBe("broken");
	});

	it("A22 the report is filed under this plan's promise and never raises", async () => {
		const { tracer, spans } = captureTracer();
		await reportPageReads("/p", input(), { tracer, now: () => 1 });
		expect(spans.every((s) => s.attrs["indusk.promise"] === "admin-pages-load-fast")).toBe(true);
		await expect(
			reportPageReads("/p", null as unknown as PageReadsInput, { now: () => 2 }),
		).resolves.toBeUndefined();
	});
});

describe("A23 — a fresh read inside the window reports kept-briefly broken", () => {
	it("A23 a load that read fresh although the last reading was inside the window", () => {
		const v = judgePageReads(input({ refreshedEarly: [false, true] }));
		expect(byClause(v)["kept-briefly"]).toBe("broken");
		expect(v.find((x) => x.clause === "kept-briefly")?.broken).toMatch(/plan/);
	});

	it("A23 a reading used past its stored window reads kept-briefly broken", () => {
		const v = judgePageReads(input({ readings: [{ ageMs: 9000, windowMs: 8000 }] }));
		expect(byClause(v)["kept-briefly"]).toBe("broken");
	});

	it("A23 readings inside their window with no early refresh hold the clause", () => {
		expect(byClause(judgePageReads(input()))["kept-briefly"]).toBe("upheld");
	});
});
