import { rmSync } from "node:fs";
import { basename } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readPromises } from "../lib/promises/registry.js";
import { readTimeline } from "../lib/promises/timeline.js";
import { type AlwaysOnServer, startAlwaysOnServer } from "./helpers/always-on-server.js";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { type LocalJaeger, startLocalJaeger } from "./helpers/local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";
import { withEnv } from "./helpers/with-env.js";

/**
 * promise-timeline Build Phase 2 — the window reader, against a real local
 * daemon and a real always-on server (ADR D4). Not a trajectory row: the page
 * rows that draw it (A1, A11) pass at Build Phase 4.
 *
 *   dense   12 marks within one minute; the query limit is 5 → one full slice
 *   spread  12 marks across an hour → every one read, nothing full
 *
 * The project names a production server, which the last test stops: a source
 * that cannot be read is that source's failure, and local is still read.
 */

const OWNER = "seats-v2";
const DENSE = "seat-dense";
const SPREAD = "seat-spread";
const TAGGED = "seat-tagged";
const CRED_ENV = "INDUSK_TEST_TIMELINE_CREDENTIAL";
const MINUTE = 60_000;
const now = Date.now();

let local: LocalJaeger;
let production: AlwaysOnServer;
let fixture: PromiseProject;

function env(): Record<string, string> {
	return {
		INDUSK_HOME: local.home,
		[CRED_ENV]: production.credential,
		INDUSK_PROMISE_QUERY_LIMIT: "5",
	};
}

async function read(source: "local" | "production") {
	const r = readPromises(fixture.planRoot);
	if (!r.ok) throw new Error("fixture registry did not read");
	const registry = r.registry;
	return withEnv(env(), () =>
		readTimeline(fixture.planRoot, registry, {
			from: new Date(now - 2 * 60 * MINUTE),
			to: new Date(now + MINUTE),
			source,
		}),
	);
}

beforeAll(async () => {
	local = await startLocalJaeger();
	production = await startAlwaysOnServer();
	const behaviour = (name: string) => ({
		name,
		kind: "behaviour" as const,
		state: "enforced" as const,
		domain: "seating",
		owner: OWNER,
		sites: [`src/${name}.ts`],
		tests: [`src/${name}.test.ts`],
	});
	fixture = promiseProject({
		domains: ["seating"],
		landed: { [OWNER]: daysAgo(30) },
		promises: [behaviour(DENSE), behaviour(SPREAD), behaviour(TAGGED)],
		files: Object.fromEntries(
			[DENSE, SPREAD, TAGGED].flatMap((n) => [
				[`src/${n}.ts`, siteFile(n)],
				[`src/${n}.test.ts`, testFile(n)],
			]),
		),
		extraConfig: {
			promises: {
				domains: ["seating"],
				jaeger: {
					url: production.queryUrl,
					otlp_url: production.otlpUrl,
					credential_env: CRED_ENV,
				},
			},
		},
	});
	const mark = (promise: string, at: number) => ({
		service: "seats-app",
		name: promise,
		promise,
		outcome: "upheld" as const,
		at: new Date(at),
	});
	await local.load([
		...Array.from({ length: 12 }, (_, i) => mark(DENSE, now - 30 * MINUTE + i * 3_000)),
		...Array.from({ length: 12 }, (_, i) => mark(SPREAD, now - 90 * MINUTE + i * 5 * MINUTE)),
		// A15: tagged with this project's folder name as an application would
		// write it — hyphens and all — not the normalised id InDusk derives.
		...Array.from({ length: 3 }, (_, i) => ({
			...mark(TAGGED, now - 20 * MINUTE + i * MINUTE),
			attributes: { "indusk.project": basename(fixture.root) },
		})),
	]);
}, 180_000);

afterAll(async () => {
	local?.stop();
	await production?.stop();
	if (local) rmSync(local.home, { recursive: true, force: true });
	if (production) rmSync(production.volume, { recursive: true, force: true });
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
});

describe.skipIf(SHOULD_SKIP)("promise-timeline — the window reader", () => {
	it("a minute holding more runs than one query returns comes back as an at-least slice", async () => {
		const [r] = await read("local");
		expect(r.ok, JSON.stringify(r)).toBe(true);
		if (!r.ok) return;
		const dense = r.byPromise.get(DENSE);
		expect(dense?.atLeast.length, "one full slice").toBeGreaterThanOrEqual(1);
		for (const s of dense?.atLeast ?? []) {
			expect(Date.parse(s.to) - Date.parse(s.from)).toBeLessThanOrEqual(MINUTE);
		}
		expect(dense?.marks.length, "at least the limit was read").toBeGreaterThanOrEqual(5);
	}, 60_000);

	it("runs spread across the window are all read, oldest first, with nothing full", async () => {
		const [r] = await read("local");
		if (!r.ok) throw new Error(JSON.stringify(r));
		const spread = r.byPromise.get(SPREAD);
		expect(spread?.marks).toHaveLength(12);
		expect(spread?.atLeast).toEqual([]);
		const times = (spread?.marks ?? []).map((m) => Date.parse(m.at));
		expect(times).toEqual([...times].sort((a, b) => a - b));
		expect(spread?.marks.every((m) => m.outcome === "upheld" && m.traceId.length > 0)).toBe(true);
	}, 60_000);

	it("A15 — runs tagged with this project's id in other separators count as this project's", async () => {
		expect(basename(fixture.root), "the fixture's folder name carries separators").toMatch(/[-.]/);
		const [r] = await read("local");
		if (!r.ok) throw new Error(JSON.stringify(r));
		expect(
			r.byPromise.get(TAGGED)?.marks,
			"lesson: a-filter-that-drops-must-normalise-both-sides",
		).toHaveLength(3);
	}, 60_000);

	it("a stopped source is that source's failure, and local is still read", async () => {
		await production.stop();
		const [p] = await read("production");
		expect(p.ok).toBe(false);
		if (p.ok) return;
		expect(p.kind).toBe("unreachable");
		const [l] = await read("local");
		expect(l.ok).toBe(true);
	}, 60_000);
});
