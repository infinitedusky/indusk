import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type AlwaysOnServer,
	startAlwaysOnServer,
} from "../src/__tests__/helpers/always-on-server.js";
import { runCliAsync } from "../src/__tests__/helpers/cli.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "../src/__tests__/helpers/promises-fixture.js";
import { type SlackCapture, startSlackCapture } from "../src/__tests__/helpers/slack-capture.js";
import { toolCaller } from "../src/__tests__/helpers/tool-call.js";
import { registerPlanTools } from "../src/tools/plan-tools.js";

/**
 * day-always-on — A21, end to end, with no developer machine in the loop
 * (ADR D10).
 *
 * The whole thing, nothing stubbed but Slack: the real `jaeger` binary runs
 * as the always-on server behind basic auth; a **separate Node process**
 * stands in for a deployed application and exports a violated promise mark
 * through the ordinary OpenTelemetry SDK, authenticating the way any
 * application would (`OTEL_EXPORTER_OTLP_HEADERS`); the server's own pass
 * announces it; and only then does a developer machine appear — a scratch
 * project that names the server, reads the violation back, records the
 * incident with its environment, reopens the owning plan, and is finally
 * asked `promise_health` the way `/catchup` asks it.
 *
 * The point of the row is the ordering: everything up to the announcement
 * happens with nobody watching. Run with `pnpm e2e`.
 */

const PROMISE = "seat-never-double-booked";
const OWNER = "seats-v2";
const CRED_ENV = "INDUSK_E2E_SERVER_CREDENTIAL";
const ENVIRONMENT = "staging";
const SYMPTOM = "seat 4 held by two players";

const OWNER_IMPL = `---
title: "${OWNER}"
status: completed
---

# ${OWNER}

## Checklist

### Phase 1: Hold a seat

- [x] A seat is held atomically

#### Phase 1 Verification

- [x] The seat tests pass

#### Phase 1 Context

- [x] Noted

#### Phase 1 Document

- [x] The seats page
`;

/**
 * A deployed application, as a separate process.
 *
 * Deliberately not the test's own OTLP helper: that would prove our helper
 * can reach the server, not that an application's exporter can. This is the
 * plain SDK with the two environment variables an application sets, and the
 * mark is plain attributes — no InDusk import anywhere in it (ADR D1).
 */
function appProcess(dir: string): string {
	const script = join(dir, "app.mjs");
	writeFileSync(
		script,
		`import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    "service.name": "seats-api",
    "deployment.environment": ${JSON.stringify(ENVIRONMENT)},
  }),
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
});
provider.register();

const span = trace.getTracer("seats").startSpan("hold-seat");
span.setAttribute("indusk.promise", ${JSON.stringify(PROMISE)});
span.setAttribute("indusk.promise.outcome", "violated");
span.addEvent("indusk.promise.violated", { "indusk.promise.symptom": ${JSON.stringify(SYMPTOM)} });
const traceId = span.spanContext().traceId;
span.end();

await provider.forceFlush();
await provider.shutdown();
process.stdout.write(traceId);
`,
	);
	return script;
}

describe("day-always-on — the loop with no developer machine in it", () => {
	let server: AlwaysOnServer;
	let slack: SlackCapture;
	let fixture: PromiseProject;
	let appDir = "";
	let traceId = "";

	beforeAll(async () => {
		server = await startAlwaysOnServer();
		slack = await startSlackCapture();
		// Inside the package on purpose: the script `import`s the real
		// OpenTelemetry packages, and ESM resolution walks up from the file's
		// own directory — NODE_PATH does not apply to it. A temp dir under
		// /tmp cannot see node_modules at all.
		appDir = mkdtempSync(join(process.cwd(), ".e2e-app-"));
		fixture = promiseProject({
			domains: ["seating"],
			landed: { [OWNER]: daysAgo(30) },
			planFiles: { [`archive/${OWNER}/impl.md`]: OWNER_IMPL },
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
			extraConfig: {
				promises: {
					domains: ["seating"],
					jaeger: { url: server.queryUrl, credential_env: CRED_ENV },
				},
			},
		});
	}, 180_000);

	afterAll(async () => {
		await server?.stop();
		await slack?.close();
		for (const dir of [appDir, server?.volume, fixture?.root]) {
			if (dir) rmSync(dir, { recursive: true, force: true });
		}
	});

	it("an application marks a promise violated, authenticating like any exporter", async () => {
		const credential = Buffer.from(server.credential).toString("base64");
		traceId = execFileSync("node", [appProcess(appDir)], {
			cwd: appDir,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "inherit"],
			env: {
				...process.env,
				OTEL_EXPORTER_OTLP_ENDPOINT: server.otlpUrl,
				OTEL_EXPORTER_OTLP_HEADERS: `Authorization=Basic ${credential}`,
			},
		}).trim();
		expect(traceId).toMatch(/^[0-9a-f]{32}$/);

		// The application exported and exited; Jaeger indexes on its own
		// schedule. Everything after this asks the server what it holds, so
		// wait for the trace to be queryable rather than racing it — a pass
		// that runs too early finds nothing and reports, correctly, that
		// there was nothing to announce.
		const deadline = Date.now() + 30_000;
		for (;;) {
			const res = await server.query(`/api/traces/${traceId}`).catch(() => null);
			if (res?.ok) {
				const json = (await res.json()) as { data?: unknown[] };
				if (json.data && json.data.length > 0) break;
			}
			if (Date.now() > deadline) {
				throw new Error(`the application's trace ${traceId} never became queryable`);
			}
			await new Promise((r) => setTimeout(r, 250));
		}
	});

	it("the server announces it to Slack, before anyone looks", async () => {
		const run = await runCliAsync(server.volume, ["telemetry", "announce", "--once"], {
			INDUSK_SERVER_VOLUME: server.volume,
			INDUSK_SERVER_QUERY_URL: server.queryUrl,
			INDUSK_SERVER_CREDENTIAL: server.credential,
			INDUSK_SERVER_SLACK_WEBHOOK: slack.url,
		});
		expect(run.code, run.stdout + run.stderr).toBe(0);
		await slack.waitForPosts(1, 20_000);
		const text = slack.texts()[0];
		expect(text).toContain(PROMISE);
		expect(text).toContain(SYMPTOM);
		expect(text).toContain(ENVIRONMENT);
		expect(text).toContain(traceId);
	});

	it("a developer machine records the incident and reopens the plan", async () => {
		const run = await runCliAsync(fixture.root, ["promises", "watch", "--source", "deployed"], {
			[CRED_ENV]: server.credential,
			INDUSK_HOME: server.volume,
		});
		expect(run.code, run.stdout + run.stderr).toBe(0);
		expect(run.stdout, "it names the Jaeger it read").toContain(server.queryUrl);

		const dir = join(fixture.planRoot, ".indusk", "promises", "incidents");
		const files = readdirSync(dir).filter((n) => n.includes(PROMISE));
		expect(files).toHaveLength(1);
		const incident = matter(readFileSync(join(dir, files[0]), "utf-8"));
		expect(incident.data.source).toBe("deployed");
		expect(String(incident.data.environment)).toBe(ENVIRONMENT);
		expect(incident.data.traces).toContain(traceId);

		const impl = readFileSync(
			join(fixture.planRoot, ".indusk", "planning", "archive", OWNER, "impl.md"),
			"utf-8",
		);
		expect(impl).toMatch(/^### Build Phase \d+: Maintenance — i-/m);
	});

	it("and a session asked what is next is told about it", async () => {
		process.env[CRED_ENV] = server.credential;
		try {
			const tools = toolCaller((s) => registerPlanTools(s, fixture.planRoot));
			const { json, isError } = await tools.call("promise_health", {});
			expect(isError, JSON.stringify(json)).toBe(false);
			const report = json as {
				needsAttention: string[];
				promises: { name: string; violations: number; incidents: number }[];
			};
			const row = report.promises.find((p) => p.name === PROMISE);
			expect(row?.violations).toBe(1);
			expect(row?.incidents, "the incident it just recorded is open").toBe(1);
			// Recorded now, so nothing is left unrecorded — the violation has
			// been seen, which is the whole point of the watch above.
			expect(report.needsAttention).not.toContain(PROMISE);
		} finally {
			delete process.env[CRED_ENV];
		}
	});
});
