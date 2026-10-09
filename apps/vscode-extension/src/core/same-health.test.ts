import { healthLine, healthRows } from "@infinitedusky/indusk-mcp/promises/health";
import type { Registry } from "@infinitedusky/indusk-mcp/promises/registry";
import type { MarkedSpan, MarkedSpansResult } from "@infinitedusky/indusk-mcp/promises/telemetry";
import { describe, expect, it } from "vitest";
import { markers } from "./markers.js";

/**
 * vscode-extension A6, the editor's half: the editor's word for every promise
 * is the admin's state, because it reads the line the package's one rule
 * builds. (The package's half compares the admin, the CLI and the agents'
 * report: apps/indusk-mcp/src/__tests__/promise-health-windows.test.ts.)
 *
 * promise: the-editor-shows-the-same-health-as-the-admin
 */

const at = (min: number) => new Date(Date.UTC(2026, 9, 8, 12, min));
const mark = (promise: string, outcome: "upheld" | "violated", min: number, traceId: string) =>
	({
		promise,
		outcome,
		traceId,
		spanId: `s-${traceId}`,
		service: "s",
		operation: "o",
		at: at(min),
		symptom: outcome === "violated" ? "broke" : null,
		environment: "production",
	}) as MarkedSpan;

const promise = (name: string) => ({
	name,
	kind: "behaviour",
	state: "enforced",
	statement: `${name} holds.`,
	tests: [],
	owner: "demo",
	domain: "demo",
	sites: [],
	incidents: [],
	aliases: [],
});
const registry = {
	dir: "/r",
	promises: [promise("held"), promise("released"), promise("quiet")],
	incidents: [],
} as unknown as Registry;
const marks: MarkedSpansResult = {
	queryUrl: "https://x.fly.dev:16687",
	since: at(0),
	byPromise: new Map([
		[
			"held",
			{
				violations: [mark("held", "violated", 20, "t1")],
				truncated: false,
				lastUpheld: mark("held", "upheld", 10, "u1"),
			},
		],
		[
			"released",
			{ violations: [], truncated: false, lastUpheld: mark("released", "upheld", 15, "u2") },
		],
		["quiet", { violations: [], truncated: false, lastUpheld: null }],
	]),
};

const WORD: Record<string, string> = {
	red: "broken",
	green: "holding",
	unverified: "not seen",
	fixed: "fixed",
};

describe("A6 — the editor's state is the admin's", () => {
	it("for each promise, the word on its line is the admin's chip, read from the package's line", () => {
		const read = { ok: true as const, at: at(30).toISOString(), marks };
		const admin = healthRows(registry, read);
		const line = healthLine(
			registry,
			[{ name: "production", label: marks.queryUrl, ...read }],
			at(30),
		);
		const view = { line, notReading: false };
		for (const name of ["held", "released", "quiet"]) {
			const text =
				markers({ path: "src/x.ts", text: `// promise: ${name}\n` }, view)[0]?.text ?? "";
			const word = WORD[admin[name]?.health ?? ""];
			expect(text, name).toContain(word);
		}
	});
});
