// clause: a-new-project-reports-from-its-first-run/a-newer-template-is-offered-not-forced
//
// a-new-project-starts-instrumented, Build Phase 1: T10 - what the scaffold does with one
// file, decided from what is on disk, what InDusk recorded writing there and the newer
// rendering. A file whose content is not what InDusk recorded is never overwritten.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decideFile, scaffoldPlan } from "./plan.js";

const h = (s: string) => createHash("sha256").update(s).digest("hex");
const NEW = "rendered v2";

describe("what the scaffold does with one file", () => {
	it.each([
		[{ current: null, recorded: null }, "create"],
		[{ current: null, recorded: h("rendered v1") }, "create"],
		[{ current: "rendered v1", recorded: h("rendered v1") }, "refresh"],
		[{ current: NEW, recorded: h(NEW) }, "refresh"],
		[{ current: NEW, recorded: h("rendered v1") }, "record"],
		[{ current: "edited", recorded: h("rendered v1") }, "beside"],
		[{ current: NEW, recorded: null }, "record"],
		[{ current: "someone else's", recorded: null }, "beside"],
	] as const)("T10: %j → %s", (file, action) => {
		expect(decideFile({ ...file, rendered: NEW }).action).toBe(action);
	});
	it("T10: never overwrites a file whose content is not what InDusk recorded", () => {
		for (const current of ["edited", "", "rendered v2 plus a line"]) {
			expect(decideFile({ current, recorded: h("rendered v1"), rendered: NEW }).action).not.toBe(
				"refresh",
			);
		}
	});
});

describe("the scaffold for a target, from what was read", () => {
	const target = (files: Record<string, string>) => ({
		name: "homework-gate",
		rel: "",
		exists: true,
		present: (f: string) => f in files,
		hasSrc: false,
		current: (p: string) => files[p] ?? null,
	});
	const reads = (record: Record<string, string>) => ({
		record,
		force: false,
		render: (template: string, service: string) => `${template} for ${service}`,
	});

	it("a target with no app marker gets no files; one with a package file gets the Node files", () => {
		expect(scaffoldPlan([target({ "README.md": "" })], reads({}))[0]?.runtime).toBeNull();
		const [node] = scaffoldPlan([target({ "package.json": "{}" })], reads({}));
		expect(node?.runtime).toBe("node");
		expect(node?.files.map((f) => [f.path, f.action])).toContainEqual([
			"instrumentation.ts",
			"create",
		]);
	});

	it("a recorded file already at the newest rendering is a refresh that changes nothing", () => {
		const rendered = "instrumentation.ts for homework-gate";
		const [node] = scaffoldPlan(
			[target({ "package.json": "{}", "instrumentation.ts": rendered })],
			reads({ "instrumentation.ts": h(rendered) }),
		);
		const file = node?.files.find((f) => f.path === "instrumentation.ts");
		expect(file).toMatchObject({ action: "refresh", current: true });
	});
});

// clause: an-app-writes-its-signal-from-a-helper-it-owns/a-signal-names-its-promise-and-clause
//
// Build Phase 2: the helper goes into every server app; an app that sets up
// OpenTelemetry itself gets the helper and its settings, and nothing else.
describe("the signal helper and an app's own OpenTelemetry setup", () => {
	const target = (files: Record<string, string>, hasSrc = false) => ({
		name: "app",
		rel: "",
		exists: true,
		present: (f: string) => f in files,
		hasSrc,
		current: (p: string) => files[p] ?? null,
	});
	const reads = (record: Record<string, string> = {}) => ({
		record,
		force: false,
		render: (template: string) => template,
	});
	const paths = (files: Record<string, string>, record?: Record<string, string>, hasSrc = false) =>
		scaffoldPlan([target(files, hasSrc)], reads(record))[0]?.files.map((f) => f.path);
	const pkg = (deps: Record<string, string>) => JSON.stringify({ dependencies: deps });

	it("a Node, Next.js and Python app each get a helper; the Python one is not named signal.py", () => {
		expect(paths({ "package.json": "{}" })).toContain("signal.ts");
		expect(paths({ "package.json": "{}" }, {}, true)).toContain("src/signal.ts");
		expect(paths({ "next.config.js": "", "package.json": "{}" })).toContain("src/signal.ts");
		expect(paths({ "requirements.txt": "flask" })).toContain("indusk_signal.py");
		expect(paths({ "requirements.txt": "flask" })).not.toContain("signal.py");
	});

	it("a browser-only app gets no helper", () => {
		expect(paths({ "vite.config.ts": "", "package.json": "{}" })).not.toContain("signal.ts");
	});

	it.each([
		["@opentelemetry/sdk-node"],
		["@opentelemetry/sdk-trace-node"],
		["@opentelemetry/sdk-trace-web"],
		["@vercel/otel"],
	])("an app depending on %s gets only the helper and its settings", (name) => {
		expect(paths({ "package.json": pkg({ [name]: "1" }) }, {}, true)).toEqual([
			"src/telemetry-settings.ts",
			"src/signal.ts",
		]);
	});

	it("a Python app naming opentelemetry-sdk gets only the helper", () => {
		expect(paths({ "requirements.txt": "flask\nopentelemetry-sdk==1.2\n" })).toEqual([
			"indusk_signal.py",
		]);
	});

	it("a browser-only app with its own setup gets nothing", () => {
		const files = {
			"vite.config.ts": "",
			"package.json": pkg({ "@opentelemetry/sdk-trace-web": "1" }),
		};
		expect(paths(files)).toEqual([]);
	});

	it("a setup InDusk wrote stays InDusk's after its packages are installed", () => {
		const files = { "package.json": pkg({ "@opentelemetry/sdk-node": "1" }) };
		const written = paths(files, { "instrumentation.ts": "abc" });
		expect(written).toContain("instrumentation.ts");
	});
});
