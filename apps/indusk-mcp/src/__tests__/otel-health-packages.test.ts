// clause: a-new-project-reports-from-its-first-run/the-scaffold-sits-where-the-app-runs
// promise: a-new-project-reports-from-its-first-run
//
// a-new-project-starts-instrumented, Build Phase 6: T34 - the otel extension's
// installed-packages health check, run as its manifest writes it, in apps holding only
// what each runtime's scaffold installs: a Next.js app has `@vercel/otel`, a browser app
// `@opentelemetry/sdk-trace-web`, a Node app `@opentelemetry/sdk-node`. An app with none
// fails. PATH holds only node, so a Python OpenTelemetry on this machine cannot pass the
// check for an app that has none.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

const MANIFEST = join(REPO_ROOT, "apps/indusk-mcp/extensions/otel/manifest.json");
const check: string = JSON.parse(readFileSync(MANIFEST, "utf-8")).provides.health_checks.find(
	(c: { name: string }) => c.name === "otel-packages-installed",
).command;

const made: string[] = [];
afterEach(() => {
	for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A temporary app holding a stub of each named package; the check's exit code there. */
function runIn(packages: string[]): number | null {
	const app = mkdtempSync(join(tmpdir(), "otel-health-packages-"));
	made.push(app);
	for (const pkg of packages) {
		const dir = join(app, "node_modules", pkg);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name: pkg, main: "index.js" }));
		writeFileSync(join(dir, "index.js"), "module.exports = {};\n");
	}
	return spawnSync("sh", ["-c", check], {
		cwd: app,
		env: { PATH: `${dirname(process.execPath)}:/bin` },
	}).status;
}

describe("T34 — the otel health check knows each kind of scaffolded app", () => {
	it("T34 passes for a Next.js app holding @vercel/otel", () => {
		expect(runIn(["@vercel/otel"])).toBe(0);
	});

	it("T34 passes for a browser app holding @opentelemetry/sdk-trace-web", () => {
		expect(runIn(["@opentelemetry/sdk-trace-web"])).toBe(0);
	});

	it("T34 passes for a Node app holding @opentelemetry/sdk-node", () => {
		expect(runIn(["@opentelemetry/sdk-node"])).toBe(0);
	});

	it("T34 fails for an app holding no OpenTelemetry", () => {
		expect(runIn([])).not.toBe(0);
	});
});
