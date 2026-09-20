import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AlwaysOnServer, startAlwaysOnServer } from "./helpers/always-on-server.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { type LocalJaeger, newTraceId, startLocalJaeger } from "./helpers/local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";

/**
 * day-always-on — A10–A14: a developer machine reads the deployed system
 * (ADR D5, D6).
 *
 * The project names the server in `promises.jaeger`; the credential lives in
 * the environment variable that config names, never in the file. A10–A13 run
 * against the always-on server with no local daemon at all, so a reader that
 * still asks the local daemon cannot pass them by accident. A14 is the
 * opposite: no remote named, a local daemon running, and today's behaviour
 * unchanged.
 *
 * Red today: nothing reads `promises.jaeger`, so a project naming it still
 * asks its local daemon and reports it unreachable. Green after Build Phase 3.
 */

const PROMISE = "seat-never-double-booked";
const OWNER = "seats-v2";
const CRED_ENV = "INDUSK_TEST_SERVER_CREDENTIAL";

function project(opts: { jaeger?: { url: string; credential_env: string } } = {}): PromiseProject {
	return promiseProject({
		domains: ["seating"],
		landed: { [OWNER]: daysAgo(30) },
		planFiles: {
			[`archive/${OWNER}/impl.md`]: `---\ntitle: "${OWNER}"\nstatus: completed\n---\n\n# ${OWNER}\n\n## Checklist\n\n### Phase 1: Seats\n\n- [x] Hold a seat atomically\n\n#### Phase 1 Verification\n\n- [x] The seat tests pass\n\n#### Phase 1 Context\n\n- [x] Noted\n\n#### Phase 1 Document\n\n- [x] The seats page\n`,
		},
		promises: [
			{
				name: PROMISE,
				kind: "behaviour",
				state: "enforced",
				domain: "seating",
				owner: OWNER,
				sites: [`src/${PROMISE}.ts`],
				tests: [`src/${PROMISE}.test.ts`],
			},
		],
		files: {
			[`src/${PROMISE}.ts`]: siteFile(PROMISE),
			[`src/${PROMISE}.test.ts`]: testFile(PROMISE),
		},
		...(opts.jaeger
			? { extraConfig: { promises: { domains: ["seating"], jaeger: opts.jaeger } } }
			: {}),
	});
}

describe.skipIf(SHOULD_SKIP)("day-always-on — a project that names its Jaeger", () => {
	let server: AlwaysOnServer;
	let fixture: PromiseProject;
	let violated = "";
	let env: NodeJS.ProcessEnv;

	beforeAll(async () => {
		server = await startAlwaysOnServer();
		fixture = project({ jaeger: { url: server.queryUrl, credential_env: CRED_ENV } });
		violated = newTraceId();
		await server.load([
			{
				service: "seats-api",
				name: "hold-seat",
				promise: PROMISE,
				outcome: "violated",
				symptom: "seat 4 held by two players",
				traceId: violated,
				attributes: { "deployment.environment": "production" },
			},
		]);
		// No local daemon: a reader that asks the local one cannot pass by luck.
		env = { [CRED_ENV]: server.credential, INDUSK_HOME: server.volume };
	}, 120_000);

	afterAll(async () => {
		await server?.stop();
		if (server) rmSync(server.volume, { recursive: true, force: true });
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("A10 — `status` reports the deployed run's violations", () => {
		const r = runCli(fixture.root, ["promises", "status"], env);
		const text = r.stdout + r.stderr;
		expect(r.code, text).toBe(0);
		expect(text).toMatch(/\b1 violation\b/);
		expect(text).toContain(violated);
		expect(text, "it says which Jaeger answered").toContain(server.queryUrl);
	});

	it("A11 — a wrong credential names where it looked and exits non-zero, with no count", () => {
		const r = runCli(fixture.root, ["promises", "status"], {
			...env,
			[CRED_ENV]: "indusk:wrong-password",
		});
		const text = r.stdout + r.stderr;
		expect(r.code).not.toBe(0);
		expect(text).toContain(server.queryUrl);
		expect(text).not.toMatch(/\b0 violations\b/);
	});

	it("A12 — `watch --source deployed` records the incident with its environment and reopens the owner", () => {
		const r = runCli(fixture.root, ["promises", "watch", "--source", "deployed"], env);
		expect(r.stdout + r.stderr, "watch ran").not.toMatch(/unknown option|unknown command/);
		expect(r.code).toBe(0);
		const dir = join(fixture.planRoot, ".indusk", "promises", "incidents");
		const files = readdirSync(dir).filter((n) => n.includes(PROMISE));
		expect(files).toHaveLength(1);
		const incident = matter(readFileSync(join(dir, files[0]), "utf-8"));
		expect(incident.data.source).toBe("deployed");
		expect(String(incident.data.environment)).toBe("production");
		expect(incident.data.traces).toContain(violated);
		const impl = readFileSync(
			join(fixture.planRoot, ".indusk", "planning", "archive", OWNER, "impl.md"),
			"utf-8",
		);
		expect(impl).toMatch(/^### Build Phase \d+: Maintenance — i-/m);
	});

	it("A13 — a later pass records nothing a second time", () => {
		const dir = join(fixture.planRoot, ".indusk", "promises", "incidents");
		const before = readdirSync(dir).map((n) => readFileSync(join(dir, n), "utf-8"));
		const r = runCli(fixture.root, ["promises", "watch", "--source", "deployed"], env);
		expect(r.code).toBe(0);
		const after = readdirSync(dir).map((n) => readFileSync(join(dir, n), "utf-8"));
		expect(after).toEqual(before);
	});
});

describe.skipIf(SHOULD_SKIP)("day-always-on — a project that names none", () => {
	let jaeger: LocalJaeger;
	let fixture: PromiseProject;
	let local = "";

	beforeAll(async () => {
		fixture = project();
		jaeger = await startLocalJaeger();
		local = newTraceId();
		await jaeger.load([
			{
				service: "fixture-app",
				name: "hold-seat",
				promise: PROMISE,
				outcome: "violated",
				symptom: "seat 4 held twice, locally",
				traceId: local,
			},
		]);
	}, 120_000);

	afterAll(() => {
		jaeger?.stop();
		if (jaeger) rmSync(jaeger.home, { recursive: true, force: true });
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("A14 — still reads its local daemon, exactly as before", () => {
		const r = runCli(fixture.root, ["promises", "status"], { INDUSK_HOME: jaeger.home });
		const text = r.stdout + r.stderr;
		expect(r.code, text).toBe(0);
		expect(text).toMatch(/\b1 violation\b/);
		expect(text).toContain(local);
	});
});
