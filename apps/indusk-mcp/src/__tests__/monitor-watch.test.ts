import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { type LocalJaeger, newTraceId, startLocalJaeger } from "./helpers/local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	type PromiseSpec,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";

/**
 * day-monitor — A11–A13, A15: `indusk promises watch` opens and extends
 * incidents from violations in a real local Jaeger; `promises check` refuses
 * a fixed incident whose root cause nobody wrote.
 *
 * Red today: `promises watch` is not a command, and `check` accepts a fixed
 * incident whatever its root cause says. Green after Build Phase 3.
 */

const DOUBLE = "seat-never-double-booked";
const RELEASE = "seat-release-on-timeout";
const UNWRITTEN = "_Unwritten — a person writes this._";

function behaviour(name: string, extra: Partial<PromiseSpec> = {}): PromiseSpec {
	return {
		name,
		kind: "behaviour",
		state: "enforced",
		domain: "seating",
		owner: "lab-v0",
		sites: [`src/${name}.ts`],
		tests: [`src/${name}.test.ts`],
		...extra,
	};
}

function codeFiles(...names: string[]): Record<string, string> {
	return Object.fromEntries(
		names.flatMap((n) => [
			[`src/${n}.ts`, siteFile(n)],
			[`src/${n}.test.ts`, testFile(n)],
		]),
	);
}

function incidentsFor(
	root: string,
	promise: string,
): { file: string; data: Record<string, unknown>; body: string }[] {
	const dir = join(root, ".indusk", "promises", "incidents");
	let names: string[] = [];
	try {
		names = readdirSync(dir);
	} catch {
		return [];
	}
	return names
		.filter((n) => n.endsWith(".md"))
		.map((n) => {
			const parsed = matter(readFileSync(join(dir, n), "utf-8"));
			return { file: n, data: parsed.data, body: parsed.content };
		})
		.filter((i) => i.data.promise === promise);
}

/** Every file under `.indusk/`, relative path → content. */
function snapshot(root: string): Map<string, string> {
	const out = new Map<string, string>();
	const walk = (dir: string) => {
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) walk(path);
			else out.set(relative(root, path), readFileSync(path, "utf-8"));
		}
	};
	walk(join(root, ".indusk"));
	return out;
}

describe.skipIf(SHOULD_SKIP)("day-monitor — promises watch", () => {
	let jaeger: LocalJaeger;
	let opened: PromiseProject;
	let extended: PromiseProject;
	const firstViolation = newTraceId();
	const oldTrace = "0af7651916cd43dd8448eb211c80319c";
	const laterViolation = newTraceId();
	let firstWatch = { code: -1, out: "" };

	beforeAll(async () => {
		jaeger = await startLocalJaeger();
		opened = promiseProject({
			domains: ["seating"],
			landed: { "lab-v0": daysAgo(3) },
			promises: [behaviour(DOUBLE)],
			files: codeFiles(DOUBLE),
		});
		extended = promiseProject({
			domains: ["seating"],
			landed: { "lab-v0": daysAgo(3) },
			promises: [
				behaviour(RELEASE, {
					state: "known-violated",
					incidents: [`i-2026-09-17-${RELEASE}`],
				}),
			],
			// The pre-existing open incident, in ADR D6's shape.
			incidents: [
				{
					id: `i-2026-09-17-${RELEASE}`,
					promise: RELEASE,
					source: "local",
					status: "open",
					date: "2026-09-17",
					symptom: "A held seat stayed held.",
					rootCause: UNWRITTEN,
					fix: "_Not yet fixed._",
					opened: "2026-09-17T10:00:00Z",
					lastSeen: "2026-09-17T10:00:00Z",
					traces: [oldTrace],
				},
			],
			files: codeFiles(RELEASE),
		});
		await jaeger.load([
			{
				service: "fixture-app",
				name: "hold-seat",
				promise: DOUBLE,
				outcome: "violated",
				symptom: "seat 4 held by two players",
				traceId: firstViolation,
			},
			{
				service: "fixture-app",
				name: "release-seat",
				promise: RELEASE,
				outcome: "violated",
				symptom: "seat 9 never released",
				traceId: laterViolation,
			},
		]);
		const r = runCli(opened.root, ["promises", "watch"], { INDUSK_HOME: jaeger.home });
		firstWatch = { code: r.code, out: r.stdout + r.stderr };
	}, 90_000);

	afterAll(() => {
		jaeger?.stop();
		for (const dir of [jaeger?.home, opened?.root, extended?.root]) {
			if (dir) rmSync(dir, { recursive: true, force: true });
		}
	});

	it("A11 — a violation with no open incident opens one: promise, traces, source local, symptom, root cause unwritten", () => {
		expect(firstWatch.out).not.toMatch(/unknown command/);
		expect(firstWatch.code).toBe(0);
		const found = incidentsFor(opened.root, DOUBLE);
		expect(found, "one incident for the violated promise").toHaveLength(1);
		const [i] = found;
		expect(i.file).toMatch(new RegExp(`^i-\\d{4}-\\d{2}-\\d{2}-${DOUBLE}(-\\d+)?\\.md$`));
		expect(i.data.source).toBe("local");
		expect(i.data.status).toBe("open");
		expect(i.data.traces).toContain(firstViolation);
		expect(i.body).toContain("seat 4 held by two players");
		expect(i.body).toContain(UNWRITTEN);
	});

	it("A11 — and the registry, incident included, still passes `promises check`", () => {
		expect(incidentsFor(opened.root, DOUBLE), "the incident watch opened").toHaveLength(1);
		const r = runCli(opened.root, ["promises", "check"]);
		expect(r.stdout + r.stderr).not.toMatch(/refus/i);
		expect(r.code).toBe(0);
	});

	it("A12 — a violation of a promise with an open incident extends it and opens no other", () => {
		const r = runCli(extended.root, ["promises", "watch"], { INDUSK_HOME: jaeger.home });
		expect(r.stdout + r.stderr).not.toMatch(/unknown command/);
		expect(r.code).toBe(0);
		const found = incidentsFor(extended.root, RELEASE);
		expect(found).toHaveLength(1);
		expect(found[0].data.traces).toEqual(expect.arrayContaining([oldTrace, laterViolation]));
	});

	it("A13 — a second watch over the same violations changes no file", () => {
		const before = snapshot(opened.root);
		const r = runCli(opened.root, ["promises", "watch"], { INDUSK_HOME: jaeger.home });
		expect(r.code).toBe(0);
		const after = snapshot(opened.root);
		expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
		for (const [path, content] of before) expect(after.get(path), path).toBe(content);
	});
});

describe.skipIf(SHOULD_SKIP)("day-monitor — an unwritten root cause cannot be fixed", () => {
	let fixture: PromiseProject;
	const id = `i-2026-09-17-${DOUBLE}`;

	beforeAll(() => {
		fixture = promiseProject({
			domains: ["seating"],
			landed: { "lab-v0": daysAgo(3) },
			promises: [behaviour(DOUBLE, { incidents: [id] })],
			incidents: [
				{
					id,
					promise: DOUBLE,
					source: "local",
					status: "fixed",
					rootCause: UNWRITTEN,
				},
			],
			files: codeFiles(DOUBLE),
		});
	});

	afterAll(() => {
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("A15 — `promises check` refuses it, naming the file", () => {
		const r = runCli(fixture.root, ["promises", "check"]);
		expect(r.code).not.toBe(0);
		expect(r.stdout + r.stderr).toContain(`${id}.md`);
	});
});
