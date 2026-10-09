import { describe, expect, it } from "vitest";
import { line, site } from "./fixture.js";
import { panelModel } from "./panel.js";
import { panelBody } from "./panel-html.js";
import type { HealthLine, View } from "./view.js";

/**
 * vscode-extension A23, A24: the panel lists every promise with its state,
 * broken first as cards, latest break first; each opens to its tests and the
 * places that keep it, at the line its token is on.
 *
 * promise: every-promise-is-listed-in-the-editor
 */

function twoBreaks(): View {
	const l = line({ productionState: "red" }) as HealthLine & {
		promises: { name: string; kind: string; statement: string; tests: string[]; sites: string[] }[];
	};
	l.promises[0] = { ...l.promises[0], sites: ["src/telemetry.ts", "src/gone.ts"] } as never;
	l.promises.push({
		name: "seats-booked",
		kind: "behaviour",
		statement: "A booked seat stays booked.",
		tests: ["src/book.test.ts"],
		sites: ["src/book.ts"],
	});
	const local = l.sources[1] as unknown as { rows: Record<string, unknown>[] };
	local.rows.push({
		promise: "seats-booked",
		state: "red",
		lastSeen: "2026-10-08T12:25:00.000Z",
		violations: 1,
		symptom: "seat 2 freed after booking",
		traceId: "t-b",
		tests: ["src/book.test.ts"],
	});
	const prod = l.sources[0] as unknown as { rows: Record<string, unknown>[] };
	prod.rows.push({
		promise: "seats-booked",
		state: "green",
		lastSeen: null,
		violations: 0,
		tests: [],
	});
	return { line: l, notReading: false };
}

describe("the promises panel", () => {
	it("A23 — every promise with its state; broken first as cards, latest break first; the rest by name", () => {
		const m = panelModel(twoBreaks(), new Map());
		expect(m.broken.map((p) => p.name)).toEqual(["seats-booked", "seats-held"]);
		expect(m.broken[0]).toMatchObject({
			source: "local",
			symptom: "seat 2 freed after booking",
			brokeAt: "2026-10-08T12:25:00.000Z",
			tone: "broken",
		});
		expect(m.broken[1]).toMatchObject({ source: "production", symptom: "seat 4 held twice" });
		expect(m.rest.map((p) => p.name)).toEqual(["page-answers"]);
		expect(m.rest[0]?.state).toBe("watched by the tests");
		expect(m.notReading).toBe(false);
	});

	it("A24 — a promise's tests and sites, each at the line its token is on, or without a line when it is gone", () => {
		const files = new Map([
			["src/telemetry.ts", `import x from "y";\n\n${site("seats-held", "mark(); ")}`],
			["src/seats.test.ts", site("seats-held")],
			["src/gone.ts", "export const nothing = 1;\n"],
		]);
		const held = panelModel(twoBreaks(), files).broken.find((p) => p.name === "seats-held");
		expect(held?.locations).toEqual([
			{ kind: "test", path: "src/seats.test.ts", line: 0 },
			{ kind: "site", path: "src/telemetry.ts", line: 2 },
			{ kind: "site", path: "src/gone.ts", line: null },
		]);
	});

	it("before any health line, the panel says it is not reading", () => {
		expect(panelModel(null, new Map())).toEqual({ broken: [], rest: [], notReading: true });
	});

	it("the panel's HTML shows span text as text, never markup", () => {
		const v = twoBreaks();
		const local = v.line.sources[1] as unknown as { rows: Record<string, unknown>[] };
		(local.rows[1] as Record<string, unknown>).symptom = '<img src=x onerror="alert(1)">';
		const html = panelBody(panelModel(v, new Map()), ["seats-held held (local) · <b>x</b>"]);
		expect(html).not.toContain("<img");
		expect(html).toContain("&lt;img");
		expect(html).not.toContain("<b>x</b>");
	});
});
