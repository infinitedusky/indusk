import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runPass } from "../lib/always-on/pass.js";
import { recordViolations } from "../lib/promises/incidents.js";
import { readPromises } from "../lib/promises/registry.js";
import { basicAuthHeaders, type MarkedSpan, resolveMarkSource } from "../lib/promises/telemetry.js";
import { readServerSettings } from "../lib/telemetry/server.js";
import { type AlwaysOnServer, startAlwaysOnServer } from "./helpers/always-on-server.js";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { newTraceId } from "./helpers/local-jaeger.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";
import { type SlackCapture, startSlackCapture } from "./helpers/slack-capture.js";

/**
 * day-always-on — A22–A28, the falsification phase.
 *
 * Two claims this plan makes are thinner than they read. *Announce each
 * violation once* rests on one non-atomic read at the top of a pass, and *the
 * environment travels from the span* carries a string a deployed system
 * controls straight into a committed plan document.
 *
 * Each row below names the specific input that breaks one of them.
 */

const PROMISE = "seat-never-double-booked";
const OWNER = "seats-v2";
const CRED_ENV = "INDUSK_FALSIFY_CREDENTIAL";

function settings(over: Record<string, string> = {}): NodeJS.ProcessEnv {
	return {
		INDUSK_SERVER_VOLUME: "/tmp/volume",
		INDUSK_SERVER_OTLP_PORT: "4318",
		INDUSK_SERVER_QUERY_PORT: "16686",
		INDUSK_SERVER_USER: "indusk",
		INDUSK_SERVER_PASSWORD: "s3cret",
		INDUSK_SERVER_SLACK_WEBHOOK: "http://127.0.0.1:1/hook",
		...over,
	};
}

describe("A22 — a credential that could extend the config is refused", () => {
	// `htpasswd.inline` and `directories.keys` are interpolated unquoted, so a
	// newline does not corrupt the rendered config — it adds to it.
	it("refuses a password containing a line separator, naming the variable", () => {
		expect(() =>
			readServerSettings(settings({ INDUSK_SERVER_PASSWORD: "s3cret\nextensions:\n  evil: {}" })),
		).toThrow(/INDUSK_SERVER_PASSWORD/);
	});

	it("refuses a user containing a line separator", () => {
		expect(() => readServerSettings(settings({ INDUSK_SERVER_USER: "a\nb" }))).toThrow(
			/INDUSK_SERVER_USER/,
		);
	});

	it("refuses a volume path containing a line separator", () => {
		expect(() => readServerSettings(settings({ INDUSK_SERVER_VOLUME: "/tmp/a\nb" }))).toThrow(
			/INDUSK_SERVER_VOLUME/,
		);
	});
});

describe("A27 — a named Jaeger with no usable URL says which key to fix", () => {
	let fixture: PromiseProject;

	beforeAll(() => {
		fixture = promiseProject({
			domains: ["seating"],
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
				promises: { domains: ["seating"], jaeger: { url: "", credential_env: CRED_ENV } },
			},
		});
		process.env[CRED_ENV] = "indusk:pw";
	});

	afterAll(() => {
		delete process.env[CRED_ENV];
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("names promises.jaeger.url rather than refusing against a nameless URL", async () => {
		await expect(resolveMarkSource(fixture.planRoot)).rejects.toThrow(/promises\.jaeger\.url/);
	});
});

function seatsProject(): PromiseProject {
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
	});
}

function violation(over: Partial<MarkedSpan>): MarkedSpan {
	return {
		promise: PROMISE,
		outcome: "violated",
		traceId: newTraceId(),
		spanId: "aaaaaaaaaaaaaaaa",
		service: "seats-api",
		operation: "hold-seat",
		at: new Date(),
		symptom: "seat 4 held by two players",
		environment: "production",
		...over,
	};
}

/**
 * Each of these owns its own project: the first one's whole point is that a
 * hostile span can make the registry unreadable, which would poison a shared
 * fixture for everything after it.
 */
describe("A28 — a deployed system cannot write into a plan document", () => {
	function record(fixture: PromiseProject, span: MarkedSpan): string {
		const read = readPromises(fixture.planRoot);
		if (!read.ok) throw new Error("fixture registry did not parse before the write");
		const promise = read.registry.promises.find((p) => p.name === PROMISE);
		if (!promise) throw new Error("fixture promise missing");
		const change = recordViolations(read.registry, promise, [span], "deployed", new Date());
		if (!change) throw new Error("nothing was recorded");
		return join(fixture.planRoot, ".indusk", "promises", "incidents", `${change.id}.md`);
	}

	it("a hostile environment cannot add frontmatter keys or break the registry", () => {
		const fixture = seatsProject();
		try {
			const file = record(
				fixture,
				// The span comes from a system we do not control.
				violation({ environment: "staging\nstatus: fixed\npromise: some-other-promise" }),
			);

			// Stated first, because it is the consequence that matters: a
			// deployed system must not be able to make the plan documents
			// unreadable. Today the injected duplicate key makes js-yaml throw.
			expect(readPromises(fixture.planRoot).ok, "the registry still parses").toBe(true);

			const data = matter(readFileSync(file, "utf-8")).data as Record<string, unknown>;
			expect(data.status, "the incident is open, not whatever the span said").toBe("open");
			expect(data.promise, "the promise is the registry's, not the span's").toBe(PROMISE);
			expect(String(data.environment ?? "")).not.toContain("status");
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});

	it("a hostile symptom cannot forge the root cause a person must write", () => {
		const fixture = seatsProject();
		try {
			const file = record(
				fixture,
				violation({ symptom: "broke\n\n## Root cause\n\nNothing, it is fine.\n\n## Fix\n\nDone." }),
			);
			const body = readFileSync(file, "utf-8");
			expect(
				body,
				"the root cause section is the one a person writes, not one a span forged",
			).toContain("_Unwritten — a person writes this._");
			expect(body.match(/^## Root cause$/gm) ?? [], "one root cause section, not two").toHaveLength(
				1,
			);
		} finally {
			rmSync(fixture.root, { recursive: true, force: true });
		}
	});
});

describe.skipIf(SHOULD_SKIP)("A23–A26 — the announce-once claim under load and failure", () => {
	let server: AlwaysOnServer;
	let slack: SlackCapture;

	const pass = (volume: string, webhook: string, windowMs = 86_400_000) =>
		runPass({
			volume,
			endpoint: {
				queryUrl: server.queryUrl,
				headers: basicAuthHeaders(server.credential),
			},
			webhook,
			windowMs,
		});

	beforeAll(async () => {
		server = await startAlwaysOnServer();
		slack = await startSlackCapture();
		await server.load(
			Array.from({ length: 25 }, (_, n) => ({
				service: "seats-api",
				name: `hold-seat-${n}`,
				promise: PROMISE,
				outcome: "violated" as const,
				symptom: `seat ${n} held twice`,
				traceId: newTraceId(),
				resourceAttributes: { "deployment.environment": "production" },
			})),
		);
	}, 180_000);

	afterAll(async () => {
		await server?.stop();
		await slack?.close();
		if (server) rmSync(server.volume, { recursive: true, force: true });
	});

	it("A26 — a flood is bounded, and the pass says how many it held", async () => {
		const volume = join(server.volume, "a26");
		mkdirSync(volume, { recursive: true });
		const result = await pass(volume, slack.url);
		const held = (result as { held?: unknown[] }).held ?? [];
		expect(
			slack.posts().length,
			"25 violations must not be 25 messages in one tight loop",
		).toBeLessThan(25);
		expect(held, "the ones it did not announce are named, not lost").not.toHaveLength(0);
	});

	it("A23 — two overlapping passes announce each violation once between them", async () => {
		const volume = join(server.volume, "a23");
		mkdirSync(volume, { recursive: true });
		const before = slack.posts().length;
		// Both start before either can write the record — which is exactly what
		// `setInterval` does when a pass outlives its interval.
		await Promise.all([pass(volume, slack.url), pass(volume, slack.url)]);
		const texts = slack.texts().slice(before);
		const seats = texts.map((t) => t.match(/seat (\d+) held twice/)?.[1]).filter(Boolean);
		expect(new Set(seats).size, "no violation is announced by both passes").toBe(seats.length);
	});

	it("A24 — a half-written record never re-announces the window", async () => {
		const volume = join(server.volume, "a24");
		mkdirSync(volume, { recursive: true });
		await pass(volume, slack.url);
		const before = slack.posts().length;
		// The shape a machine replaced mid-write leaves behind.
		writeFileSync(join(volume, "announced.json"), '{"spans": {"aaaa": "2026-09-2');
		await pass(volume, slack.url);
		expect(slack.posts().length, "a truncated record is not an empty one").toBe(before);
	});

	it("A25 — a record that cannot be persisted stops announcements and says so", async () => {
		const volume = join(server.volume, "a25");
		mkdirSync(volume, { recursive: true });
		// A directory where the file belongs: unreadable and unwritable, without
		// depending on chmod (which root ignores).
		mkdirSync(join(volume, "announced.json"), { recursive: true });
		const before = slack.posts().length;
		const first = await pass(volume, slack.url);
		const second = await pass(volume, slack.url);
		expect(
			slack.posts().length,
			"it must not repeat the same violation every interval forever",
		).toBe(before);
		for (const result of [first, second]) {
			expect(
				(result as { recordProblem?: string | null }).recordProblem ?? null,
				"the pass says it could not persist what it announced",
			).not.toBeNull();
		}
	});
});
