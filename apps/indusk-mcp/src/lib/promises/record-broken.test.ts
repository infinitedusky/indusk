import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeJaegerFetch } from "../../__tests__/helpers/fake-jaeger.js";
import {
	incidentsIn,
	OWNER,
	PROMISE,
	recordingProject,
} from "../../__tests__/helpers/record-fixture.js";
import { type PassMark, recordBreaks } from "./record.js";
import { jaegerEndpoint, type MarkedSpansResult, markedSpans } from "./telemetry.js";

// promise: a-production-break-is-recorded-unasked
// promise: a-promise-is-upheld-or-broken

/**
 * A11 of one-promise-language: a production signal saying `broken` becomes an
 * incident with its owning plan reopened, exactly as one saying `violated`
 * does. The recorder's pass reads production through the one marks query, so
 * the read is handed in as that query over a fake Jaeger holding one signal
 * — the word on it is the only thing that differs between the two runs.
 */

let home: string;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "record-broken-home-"));
	cleanups.push(() => rmSync(home, { recursive: true, force: true }));
});
afterEach(() => {
	vi.unstubAllGlobals();
	for (const c of cleanups.splice(0).reverse()) c();
});

async function passOver(word: string) {
	vi.stubGlobal(
		"fetch",
		fakeJaegerFetch([
			{
				service: "seat-holds",
				name: "release",
				spanId: "00f067aa0ba902b7",
				tags: { "indusk.promise": PROMISE, "indusk.promise.outcome": word },
			},
		]),
	);
	const fx = recordingProject();
	cleanups.push(fx.cleanup);
	const marks: PassMark[] = [];
	const reads = async (): Promise<MarkedSpansResult> =>
		markedSpans({
			promises: [PROMISE],
			since: new Date(Date.now() - 7 * 86_400_000),
			endpoint: jaegerEndpoint("http://jaeger.test"),
		});
	const result = await recordBreaks(
		fx.root,
		{ by: "admin", source: "deployed" },
		{ reads, mark: (m) => marks.push(m), home },
	);
	const impl = readFileSync(join(fx.root, ".indusk/planning/archive", OWNER, "impl.md"), "utf-8");
	return { result, incidents: incidentsIn(fx.root), impl, marks };
}

describe("A11 — a production signal saying broken is recorded as one saying violated is", () => {
	for (const word of ["broken", "violated"]) {
		it(`${word}: opens one incident and reopens the owning plan`, async () => {
			const { result, incidents, impl, marks } = await passOver(word);
			expect(result.opened).toEqual([expect.objectContaining({ promise: PROMISE, owner: OWNER })]);
			expect(incidents).toHaveLength(1);
			expect(impl).toMatch(/### Build Phase 2: Maintenance — i-/);
			expect(marks.map((m) => m.outcome)).toEqual(["upheld"]);
		});
	}
});
