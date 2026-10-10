// promise: init-writes-no-vendor-into-an-app
//
// browser-telemetry-leftovers, Test Phase 1: A5, A6, A7 — what `indusk init`
// writes and says about the OpenTelemetry scaffold, run through the built CLI
// on three temporary projects.
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, REPO_ROOT, runCli, SHOULD_SKIP } from "./helpers/cli.js";

const VENDORS = ["dash0", "datadog", "newrelic", "honeycomb", "sentry", "posthog"];
const vendorIn = (text: string) => VENDORS.filter((v) => text.toLowerCase().includes(v));

type Kind = "react-spa" | "nextjs" | "node";

const made: string[] = [];
afterEach(() => {
	for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function project(kind: Kind): string {
	const dir = mkdtempSync(join(tmpdir(), `init-browser-otel-${kind}-`));
	made.push(dir);
	git(dir, ["init", "-q"]);
	const deps =
		kind === "react-spa"
			? { react: "19.0.0", vite: "6.0.0" }
			: kind === "nextjs"
				? { next: "16.0.0", react: "19.0.0" }
				: { express: "5.0.0" };
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: `app-${kind}`, version: "0.0.0", dependencies: deps }),
	);
	if (kind === "react-spa") {
		writeFileSync(join(dir, "vite.config.ts"), "export default {};\n");
		mkdirSync(join(dir, "src"), { recursive: true });
	}
	if (kind === "nextjs") {
		writeFileSync(join(dir, "next.config.js"), "module.exports = {};\n");
		mkdirSync(join(dir, "src"), { recursive: true });
	}
	return dir;
}

/** The [OpenTelemetry] section of init's stdout, lines only. */
function otelLines(stdout: string): string[] {
	const lines = stdout.split("\n");
	const start = lines.findIndex((l) => l.trim() === "[OpenTelemetry]");
	if (start < 0) return [];
	const rest = lines.slice(start + 1);
	const end = rest.findIndex((l) => /^\[.+\]$/.test(l.trim()));
	return end < 0 ? rest : rest.slice(0, end);
}

const createdPaths = (lines: string[]) =>
	lines.map((l) => /^\s*create: (\S+)/.exec(l)?.[1]).filter((p): p is string => Boolean(p));

describe.skipIf(SHOULD_SKIP)("init-browser-telemetry", () => {
	it("A5: init writes no vendor-naming file, and each created-file line names the file and the OpenTelemetry SDK", () => {
		for (const kind of ["react-spa", "nextjs", "node"] as const) {
			const dir = project(kind);
			const r = runCli(dir, ["init"]);
			expect(r.code, `${kind}: init exit\n${r.stderr}`).toBe(0);

			const lines = otelLines(r.stdout);
			const created = createdPaths(lines);
			expect(created.length, `${kind}: init created no instrumentation file`).toBeGreaterThan(0);

			// No file init wrote for telemetry names or imports a vendor.
			for (const rel of created) {
				const file = join(dir, rel);
				expect(existsSync(file), `${kind}: ${rel} was announced but not written`).toBe(true);
				expect(vendorIn(readFileSync(file, "utf-8")), `${kind}: ${rel} names a vendor`).toEqual([]);
			}

			// Nor does init say a vendor's SDK is what it wrote.
			expect(vendorIn(lines.join("\n")), `${kind}: init prints a vendor name`).toEqual([]);

			// The browser scaffolds say what they created: the file and the OTel SDK.
			if (kind !== "node") {
				for (const line of lines.filter((l) => /^\s*create:/.test(l))) {
					const rel = /^\s*create: (\S+)/.exec(line)?.[1] ?? "";
					expect(line, `${kind}: line names its file`).toContain(rel);
					expect(line, `${kind}: line names the OpenTelemetry SDK`).toMatch(/opentelemetry|otel/i);
				}
			}
		}
	});

	it("A6: no instrumentation template names or imports an observability vendor", () => {
		const dir = join(REPO_ROOT, "apps/indusk-mcp/templates");
		const names = readdirSync(dir).filter(
			(f) =>
				(f.startsWith("instrumentation") || f === "filtering-exporter.ts" || f === "logger.ts") &&
				!/\.test\.ts$/.test(f),
		);
		expect(names.length).toBeGreaterThan(0);
		for (const f of names) {
			expect(vendorIn(readFileSync(join(dir, f), "utf-8")), `${f} names a vendor`).toEqual([]);
		}
	});

	it("A7: init for a React SPA and a Next.js app prints the propagation setting and the traceparent CORS requirement", () => {
		const settings = {
			"react-spa": "VITE_OTEL_PROPAGATE_TO",
			nextjs: "NEXT_PUBLIC_OTEL_PROPAGATE_TO",
		} as const;
		for (const kind of ["react-spa", "nextjs"] as const) {
			const r = runCli(project(kind), ["init"]);
			expect(r.code, `${kind}: init exit\n${r.stderr}`).toBe(0);
			const text = otelLines(r.stdout).join("\n");
			expect(text, `${kind}: names the setting`).toContain(settings[kind]);
			expect(text, `${kind}: says the API must allow traceparent`).toMatch(/traceparent/);
			expect(text, `${kind}: says it is a CORS setting`).toMatch(/CORS/i);
		}
	});
});
