import { describe, expect, it } from "vitest";
import * as health from "../lib/promises/health.js";
import { readPromises } from "../lib/promises/registry.js";
import type { MarkedSpan, MarkedSpansResult } from "../lib/promises/telemetry.js";
import { behaviourPromise, openIncidentSpec, promiseProject } from "./helpers/promises-fixture.js";

/**
 * vscode-extension A6: for the same project and the same recorded marks, the
 * admin's chips, the line `indusk promises health --json` prints and the
 * agents' `promise_health` report give every promise the same state, for
 * each source. The editor reads the CLI's line, so it joins by that.
 *
 * All three are fed one set of reads; nothing is fetched.
 *
 * promise: the-editor-shows-the-same-health-as-the-admin
 */

const at = (min: number) => new Date(Date.UTC(2026, 9, 8, 12, min));
function mark(
	promise: string,
	outcome: "upheld" | "violated",
	min: number,
	traceId: string,
): MarkedSpan {
	return {
		promise,
		outcome,
		traceId,
		spanId: `s-${traceId}`,
		service: "seat-holds",
		operation: "hold",
		at: at(min),
		symptom: outcome === "violated" ? "seat 4 held twice" : null,
		environment: "production",
	} as MarkedSpan;
}

function fixture() {
	const p = promiseProject({
		promises: [
			behaviourPromise("seats-held", { owner: "demo" }),
			behaviourPromise("seats-released", { owner: "demo" }),
			behaviourPromise("seats-quiet", { owner: "demo" }),
			behaviourPromise("seats-mended", { owner: "demo" }),
		],
		incidents: [
			{
				...openIncidentSpec("seats-mended", ["t-mended"]),
				status: "fixed",
				fixed: "2026-10-08T12:30:00Z",
			},
		],
	});
	const read = readPromises(p.planRoot);
	if (!read.ok) throw new Error("fixture registry did not read");
	const marks: MarkedSpansResult = {
		queryUrl: "https://example.fly.dev:16687",
		since: at(0),
		byPromise: new Map([
			[
				"seats-held",
				{
					violations: [mark("seats-held", "violated", 20, "t-held")],
					truncated: false,
					lastUpheld: mark("seats-held", "upheld", 10, "u1"),
				},
			],
			[
				"seats-released",
				{
					violations: [],
					truncated: false,
					lastUpheld: mark("seats-released", "upheld", 15, "u2"),
				},
			],
			["seats-quiet", { violations: [], truncated: false, lastUpheld: null }],
			[
				"seats-mended",
				{
					violations: [mark("seats-mended", "violated", 5, "t-mended")],
					truncated: false,
					lastUpheld: mark("seats-mended", "upheld", 25, "u3"),
				},
			],
		]),
	};
	return { registry: read.registry, marks };
}

describe("A6 — the admin, the CLI and the agents' report agree on every promise's state", () => {
	it("the three are one rule over one read", () => {
		const h = health as Record<string, unknown>;
		expect(typeof h.healthRows, "the admin's chip rule, in the package").toBe("function");
		expect(typeof h.healthLine, "the CLI's line, built in the package").toBe("function");
		expect(typeof h.reportRows, "the agents' rows, built in the package").toBe("function");
		if (
			typeof h.healthRows !== "function" ||
			typeof h.healthLine !== "function" ||
			typeof h.reportRows !== "function"
		)
			return;

		const { registry, marks } = fixture();
		const read = { ok: true as const, at: at(30).toISOString(), marks };
		type Row = { health: string };
		const admin = (h.healthRows as (r: unknown, x: unknown) => Record<string, Row>)(registry, read);
		const line = (
			h.healthLine as (
				r: unknown,
				reads: unknown[],
				now: Date,
			) => { sources: { name: string; rows: { promise: string; state: string }[] }[] }
		)(registry, [{ name: "production", label: marks.queryUrl, ...read }], at(30));
		const report = (
			h.reportRows as (r: unknown, m: unknown, now: Date) => { name: string; health: string }[]
		)(registry, marks, at(30));

		const fromLine = Object.fromEntries(
			line.sources[0]?.rows.map((r) => [r.promise, r.state]) ?? [],
		);
		const fromReport = Object.fromEntries(report.map((r) => [r.name, r.health]));
		const fromAdmin = Object.fromEntries(
			Object.entries(admin).map(([name, r]) => [name, r.health]),
		);

		expect(fromAdmin).toEqual({
			"seats-held": "red",
			"seats-released": "green",
			"seats-quiet": "unverified",
			"seats-mended": "fixed",
		});
		expect(fromLine).toEqual(fromAdmin);
		expect(fromReport).toEqual(fromAdmin);
	});
});
