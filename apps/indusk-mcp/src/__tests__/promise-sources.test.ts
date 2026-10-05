import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readPromises } from "../lib/promises/registry.js";
import { readSources } from "../lib/promises/sources.js";
import { registerPlanTools } from "../tools/plan-tools.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { newTraceId } from "./helpers/local-jaeger.js";
import { toolCaller } from "./helpers/tool-call.js";
import { CRED_ENV, startTwoSources, type TwoSources } from "./helpers/two-sources.js";

/**
 * promise-sources — A1, A2, A4–A7: a developer reads local and production side
 * by side (ADR D1–D6).
 *
 * Two real backends hold different marks:
 *
 *   seat-held      violated locally (LOCAL_BREAK),     upheld in production
 *   seat-released  upheld locally,                     violated in production (PROD_BREAK)
 *
 * so a reader that reads one source, or mixes them, gives a wrong answer.
 *
 * The output contract fixed here: with two sources, `promises status` prints a
 * section per source, each opening on a line that starts with the source's
 * name (`local` / `production`) and names its URL. With one source the output
 * is today's, with no section headers (A7).
 *
 * Red today: one source is read — the named server — and nothing says which.
 */

const HELD = "seat-held";
const RELEASED = "seat-released";

/** A source's section: from its header line to the next source's header, or the end. */
function section(out: string, name: "local" | "production"): string {
	const lines = out.split("\n");
	const header = /^(local|production)\b/;
	const start = lines.findIndex((l) => l.startsWith(name) && header.test(l));
	if (start === -1) return "";
	const end = lines.findIndex((l, i) => i > start && header.test(l));
	return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

async function health(t: TwoSources): Promise<{ json: Record<string, unknown>; isError: boolean }> {
	const saved = { home: process.env.INDUSK_HOME, cred: process.env[CRED_ENV] };
	process.env.INDUSK_HOME = t.local.home;
	process.env[CRED_ENV] = t.production.credential;
	try {
		const tools = toolCaller((server) => registerPlanTools(server, t.project.planRoot));
		const r = await tools.call("promise_health", {});
		return { json: r.json as Record<string, unknown>, isError: r.isError };
	} finally {
		if (saved.home === undefined) delete process.env.INDUSK_HOME;
		else process.env.INDUSK_HOME = saved.home;
		if (saved.cred === undefined) delete process.env[CRED_ENV];
		else process.env[CRED_ENV] = saved.cred;
	}
}

type SourceEntry = {
	name: string;
	ok: boolean;
	promises?: { name: string; violations: number }[];
	needsAttention?: string[];
};

function sourceOf(json: Record<string, unknown>, name: string): SourceEntry | undefined {
	return (json.sources as SourceEntry[] | undefined)?.find((s) => s.name === name);
}

function incidentPromises(root: string): string[] {
	const dir = join(root, ".indusk/promises/incidents");
	return existsSync(dir) ? readdirSync(dir) : [];
}

const LOCAL_BREAK = newTraceId();
const PROD_BREAK = newTraceId();

function marks() {
	return {
		promises: [HELD, RELEASED],
		localMarks: [
			{
				service: "seats-app",
				name: "hold-seat",
				promise: HELD,
				outcome: "violated" as const,
				symptom: "held twice on my laptop",
				traceId: LOCAL_BREAK,
			},
			{ service: "seats-app", name: "release-seat", promise: RELEASED, outcome: "upheld" as const },
		],
		productionMarks: [
			{ service: "seats-app", name: "hold-seat", promise: HELD, outcome: "upheld" as const },
			{
				service: "seats-app",
				name: "release-seat",
				promise: RELEASED,
				outcome: "violated" as const,
				symptom: "release never fired in production",
				traceId: PROD_BREAK,
			},
		],
	};
}

describe.skipIf(SHOULD_SKIP)("promise-sources — local and production side by side", () => {
	let t: TwoSources;

	beforeAll(async () => {
		t = await startTwoSources(marks());
	}, 180_000);

	afterAll(async () => {
		await t?.stop();
	});

	it("A1 — status prints a section per source, each with its own marks", () => {
		const r = runCli(t.project.root, ["promises", "status"], t.env);
		const text = r.stdout + r.stderr;
		const local = section(text, "local");
		const production = section(text, "production");
		expect(local, text).not.toBe("");
		expect(production, text).not.toBe("");
		expect(local).toContain(LOCAL_BREAK);
		expect(local).not.toContain(PROD_BREAK);
		expect(production).toContain(PROD_BREAK);
		expect(production).not.toContain(LOCAL_BREAK);
		expect(production).toContain(t.production.queryUrl);
		expect(r.code, text).toBe(0);
	}, 60_000);

	it("A2 — promise_health reports both sources, each with its own rows", async () => {
		const { json, isError } = await health(t);
		expect(isError, JSON.stringify(json)).toBe(false);
		const local = sourceOf(json, "local");
		const production = sourceOf(json, "production");
		expect(local?.ok, JSON.stringify(json)).toBe(true);
		expect(production?.ok).toBe(true);
		expect(local?.promises?.find((p) => p.name === HELD)?.violations).toBe(1);
		expect(local?.promises?.find((p) => p.name === RELEASED)?.violations).toBe(0);
		expect(production?.promises?.find((p) => p.name === RELEASED)?.violations).toBe(1);
		expect(production?.promises?.find((p) => p.name === HELD)?.violations).toBe(0);
	}, 60_000);

	it("A6 — a local-only break is shown in local, but the alarm names only production's", async () => {
		const { json } = await health(t);
		expect(sourceOf(json, "local")?.needsAttention, JSON.stringify(json)).toContain(HELD);
		const raised = (json.needsAttention as string[] | undefined) ?? [];
		expect(raised).toContain(RELEASED);
		expect(raised, "lesson: the-alarm-comes-from-production-when-there-is-one").not.toContain(HELD);
	}, 60_000);

	it("A5 — watch --source deployed records production's break; --source local records the laptop's", () => {
		const deployed = runCli(t.project.root, ["promises", "watch", "--source", "deployed"], t.env);
		const afterDeployed = incidentPromises(t.project.root);
		expect(
			afterDeployed.some((f) => f.includes(RELEASED)),
			`lesson: a-flag-that-names-a-source-must-choose-it\n${deployed.stdout}${deployed.stderr}`,
		).toBe(true);
		expect(afterDeployed.some((f) => f.includes(HELD))).toBe(false);

		const local = runCli(t.project.root, ["promises", "watch", "--source", "local"], t.env);
		const afterLocal = incidentPromises(t.project.root);
		expect(
			afterLocal.some((f) => f.includes(HELD)),
			`${local.stdout}${local.stderr}`,
		).toBe(true);
	}, 90_000);
});

describe.skipIf(SHOULD_SKIP)("promise-sources — A4: one source down, the other still shown", () => {
	let t: TwoSources;

	beforeAll(async () => {
		t = await startTwoSources(marks());
		await t.production.stop();
	}, 180_000);

	afterAll(async () => {
		await t?.stop();
	});

	it("status names production as unreachable, still prints local, and exits 2", () => {
		const r = runCli(t.project.root, ["promises", "status"], t.env);
		const text = r.stdout + r.stderr;
		const production = section(text, "production");
		expect(production, text).toMatch(/could not be reached|unreachable/i);
		expect(production).toContain(t.production.queryUrl);
		expect(section(text, "local"), "lesson: one-dead-source-never-hides-another").toContain(
			LOCAL_BREAK,
		);
		expect(r.code, text).toBe(2);
	}, 60_000);

	it("promise_health reports production failed and local's rows", async () => {
		const { json } = await health(t);
		expect(sourceOf(json, "production")?.ok, JSON.stringify(json)).toBe(false);
		const local = sourceOf(json, "local");
		expect(local?.ok).toBe(true);
		expect(local?.promises?.find((p) => p.name === HELD)?.violations).toBe(1);
	}, 60_000);
});

describe.skipIf(SHOULD_SKIP)("promise-sources — A7: no production server, exactly as today", () => {
	let t: TwoSources;

	beforeAll(async () => {
		t = await startTwoSources({ ...marks(), nameProduction: false });
	}, 180_000);

	afterAll(async () => {
		await t?.stop();
	});

	it("status reads local with today's output: no source sections", () => {
		const r = runCli(t.project.root, ["promises", "status"], t.env);
		const text = r.stdout + r.stderr;
		expect(r.code, text).toBe(0);
		expect(text).toMatch(/^Promises observed in /m);
		expect(text).not.toMatch(/^production\b/m);
		expect(text).toContain(LOCAL_BREAK);
		expect(text).not.toContain(PROD_BREAK);
	}, 60_000);

	it("promise_health keeps today's shape: source, promises, needsAttention", async () => {
		const { json, isError } = await health(t);
		expect(isError, JSON.stringify(json)).toBe(false);
		expect(json.source).toBe(t.local.queryUrl);
		expect((json.promises as unknown[]).length).toBe(2);
		expect(json.needsAttention).toEqual([HELD]);
	}, 60_000);
});

/** Replace `promises.jaeger` in the fixture's committed config. */
function setJaeger(t: TwoSources, jaeger: unknown): void {
	const path = join(t.project.planRoot, ".indusk", "config.json");
	const config = JSON.parse(readFileSync(path, "utf-8"));
	config.promises.jaeger = jaeger;
	writeFileSync(path, JSON.stringify(config, null, "\t"));
}

describe.skipIf(SHOULD_SKIP)(
	"promise-sources — A8: a malformed promises.jaeger is production's failure",
	() => {
		let t: TwoSources;

		beforeAll(async () => {
			t = await startTwoSources(marks());
		}, 180_000);

		afterAll(async () => {
			await t?.stop();
		});

		it("a string where the object belongs: local is still printed, production refused by key, exit 2", () => {
			setJaeger(t, t.production.queryUrl);
			const r = runCli(t.project.root, ["promises", "status"], t.env);
			const text = r.stdout + r.stderr;
			expect(text, "no stack trace").not.toMatch(/TypeError|at .*\.js:\d+/);
			expect(
				section(text, "local"),
				`lesson: one-dead-source-never-hides-another\n${text}`,
			).toContain(LOCAL_BREAK);
			expect(section(text, "production"), text).toContain("promises.jaeger");
			expect(r.code, text).toBe(2);
		}, 60_000);

		it("no url: promise_health reports local's rows and production failed naming promises.jaeger.url", async () => {
			setJaeger(t, { credential_env: CRED_ENV });
			const { json, isError } = await health(t);
			expect(isError, JSON.stringify(json)).toBe(false);
			expect(sourceOf(json, "local")?.promises?.find((p) => p.name === HELD)?.violations).toBe(1);
			const production = sourceOf(json, "production") as
				| (SourceEntry & { reason?: string })
				| undefined;
			expect(production?.ok).toBe(false);
			expect(production?.reason ?? "").toContain("promises.jaeger.url");
		}, 60_000);

		it("no credential_env: the refusal names promises.jaeger.credential_env, and readSources (the admin's read) still returns local", async () => {
			setJaeger(t, { url: t.production.queryUrl, otlp_url: t.production.otlpUrl });
			const read = readPromises(t.project.planRoot);
			if (!read.ok) throw new Error("fixture registry did not read");
			const saved = process.env.INDUSK_HOME;
			process.env.INDUSK_HOME = t.local.home;
			try {
				const reads = await readSources(t.project.planRoot, read.registry, { timeoutMs: 2_000 });
				const local = reads.find((r) => r.name === "local");
				const production = reads.find((r) => r.name === "production");
				expect(local?.ok).toBe(true);
				expect(production?.ok).toBe(false);
				expect(production?.ok === false && production.reason).toContain(
					"promises.jaeger.credential_env",
				);
			} finally {
				if (saved === undefined) delete process.env.INDUSK_HOME;
				else process.env.INDUSK_HOME = saved;
			}
		}, 60_000);
	},
);

describe.skipIf(SHOULD_SKIP)(
	"promise-sources — A9: a silent production does not hold local past the budget",
	() => {
		let t: TwoSources;
		let silent: Server;
		let silentUrl = "";

		beforeAll(async () => {
			t = await startTwoSources(marks());
			// Accepts every connection and never answers: a host that black-holes.
			silent = createServer(() => {});
			await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", resolve));
			const address = silent.address();
			if (!address || typeof address === "string") throw new Error("no port");
			silentUrl = `http://127.0.0.1:${address.port}`;
			setJaeger(t, { url: silentUrl, otlp_url: silentUrl, credential_env: CRED_ENV });
		}, 180_000);

		afterAll(async () => {
			silent?.close();
			await t?.stop();
		});

		it("readSources with a 2 s budget returns within 3 s, local read, production failed", async () => {
			const read = readPromises(t.project.planRoot);
			if (!read.ok) throw new Error("fixture registry did not read");
			const saved = { home: process.env.INDUSK_HOME, cred: process.env[CRED_ENV] };
			process.env.INDUSK_HOME = t.local.home;
			process.env[CRED_ENV] = t.production.credential;
			try {
				const started = Date.now();
				const reads = await readSources(t.project.planRoot, read.registry, { timeoutMs: 2_000 });
				const took = Date.now() - started;
				expect(reads.find((r) => r.name === "local")?.ok).toBe(true);
				expect(reads.find((r) => r.name === "production")?.ok).toBe(false);
				expect(took, `took ${took} ms`).toBeLessThan(3_000);
			} finally {
				if (saved.home === undefined) delete process.env.INDUSK_HOME;
				else process.env.INDUSK_HOME = saved.home;
				if (saved.cred === undefined) delete process.env[CRED_ENV];
				else process.env[CRED_ENV] = saved.cred;
			}
		}, 60_000);
	},
);

describe.skipIf(SHOULD_SKIP)(
	"promise-sources — A10: advice comes from the failure, not the raw config",
	() => {
		let t: TwoSources;

		beforeAll(async () => {
			t = await startTwoSources(marks());
			setJaeger(t, t.production.queryUrl);
		}, 180_000);

		afterAll(async () => {
			await t?.stop();
		});

		it("status names promises.jaeger and prints no undefined", () => {
			const r = runCli(t.project.root, ["promises", "status"], t.env);
			const text = r.stdout + r.stderr;
			expect(text, text).toContain("promises.jaeger");
			expect(text, text).not.toContain("undefined");
		}, 60_000);

		it("watch --source deployed names promises.jaeger and prints no undefined", () => {
			const r = runCli(t.project.root, ["promises", "watch", "--source", "deployed"], t.env);
			const text = r.stdout + r.stderr;
			expect(r.code, text).toBe(2);
			expect(text, text).toContain("promises.jaeger");
			expect(text, text).not.toContain("undefined");
		}, 60_000);
	},
);
