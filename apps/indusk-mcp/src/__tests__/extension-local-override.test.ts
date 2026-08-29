import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadExtension, resolveManifestPath } from "../lib/extension-loader.js";

/**
 * `manifest.local.json` — the escape hatch that makes forking unnecessary.
 *
 * `.indusk/extensions/` is package-owned by contract: `update` flat-copies the
 * built-in over it on any hash mismatch, with no merge and no local-preserve
 * path. A project that hand-edits a manifest has parked a fork inside a
 * directory whose entire purpose is to be replaced, and then relies on it.
 *
 * The tempting fix — make `update` preserve local edits — is worse. It pins the
 * project to a stale fork permanently and hides every upstream improvement
 * behind it. Observed: 1.39.1 improved the otel manifest and a preserved fork
 * would have silently masked that.
 *
 * So the override is a SEPARATE file that update never writes, merged over the
 * built-in at load. Upstream keeps arriving; the local change keeps applying;
 * neither is silent.
 */

let root: string;
afterEach(() => {
	if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

function ext(builtIn: object, local?: object): string {
	root = mkdtempSync(join(tmpdir(), "ext-override-"));
	const dir = join(root, "otel");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "manifest.json"), JSON.stringify(builtIn, null, 2));
	if (local) writeFileSync(join(dir, "manifest.local.json"), JSON.stringify(local, null, 2));
	return root;
}

const BUILTIN = {
	name: "otel",
	description: "OpenTelemetry",
	provides: {
		health_checks: [
			{ name: "otel-instrumentation-exists", command: "test -f instrumentation.ts" },
			{ name: "otel-packages-installed", command: "python -c 'import opentelemetry'" },
		],
	},
};

describe("manifest.local.json overrides by name", () => {
	it("replaces one check and leaves the rest of the manifest alone", () => {
		const base = ext(BUILTIN, {
			provides: {
				health_checks: [
					{ name: "otel-packages-installed", command: "backend/.venv/bin/python -c 'import opentelemetry'" },
				],
			},
		});
		const m = loadExtension(resolveManifestPath(base, "otel") as string);
		const checks = m?.provides.health_checks ?? [];

		expect(checks).toHaveLength(2);
		expect(checks.find((c) => c.name === "otel-packages-installed")?.command).toContain(".venv");
		// The untouched check still comes from upstream — that is the point.
		expect(checks.find((c) => c.name === "otel-instrumentation-exists")?.command).toBe(
			"test -f instrumentation.ts",
		);
		expect(m?.description).toBe("OpenTelemetry");
	});

	it("keeps receiving upstream changes to checks it does not override", () => {
		// The failure a preserve-local-edits rule would have caused: upstream
		// improves a check, the fork masks it, nobody finds out.
		const improved = structuredClone(BUILTIN);
		improved.provides.health_checks[0].command =
			"test -f instrumentation.ts || test -f src/instrumentation.py";
		const base = ext(improved, {
			provides: {
				health_checks: [{ name: "otel-packages-installed", command: "backend/.venv/bin/python -c x" }],
			},
		});
		const m = loadExtension(resolveManifestPath(base, "otel") as string);
		expect(
			m?.provides.health_checks?.find((c) => c.name === "otel-instrumentation-exists")?.command,
		).toContain("src/instrumentation.py");
	});

	it("adds a check the built-in does not have", () => {
		const base = ext(BUILTIN, {
			provides: { health_checks: [{ name: "otel-venv-present", command: "test -d .venv" }] },
		});
		const m = loadExtension(resolveManifestPath(base, "otel") as string);
		expect(m?.provides.health_checks).toHaveLength(3);
	});

	it("is a no-op when absent", () => {
		const base = ext(BUILTIN);
		const m = loadExtension(resolveManifestPath(base, "otel") as string);
		expect(m?.provides.health_checks).toHaveLength(2);
	});

	it("does not silently swallow a malformed override", () => {
		// A broken override that degraded to "built-in only" would reinstate the
		// silence this exists to remove.
		root = mkdtempSync(join(tmpdir(), "ext-bad-"));
		const dir = join(root, "otel");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "manifest.json"), JSON.stringify(BUILTIN));
		writeFileSync(join(dir, "manifest.local.json"), "{ not json");
		expect(() => loadExtension(join(dir, "manifest.json"))).toThrow(/manifest\.local\.json/);
	});
});

describe("every named-entry array merges by name, not just health_checks", () => {
	const WITH_VERIFY = {
		name: "otel",
		description: "OpenTelemetry",
		provides: {
			health_checks: [{ name: "hc-a", command: "true" }],
			verification: [
				{ name: "typecheck", command: "npx tsc --noEmit" },
				{ name: "lint", command: "biome check" },
			],
		},
	};

	it("replaces one verification entry and keeps the others from upstream", () => {
		// Before: `{...manifest.provides, ...local.provides}` replaced the whole
		// `verification` array, so an override that wanted to fix ONE command had
		// to restate every other one — and then silently froze them, which is the
		// forking this mechanism exists to avoid.
		const base = ext(WITH_VERIFY, {
			provides: { verification: [{ name: "typecheck", command: "backend/.venv/bin/mypy ." }] },
		});
		const m = loadExtension(resolveManifestPath(base, "otel") as string);
		const v = m?.provides.verification ?? [];

		expect(v).toHaveLength(2);
		expect(v.find((e) => e.name === "typecheck")?.command).toContain("mypy");
		expect(v.find((e) => e.name === "lint")?.command).toBe("biome check");
	});

	it("leaves health_checks alone when the override only touches verification", () => {
		const base = ext(WITH_VERIFY, {
			provides: { verification: [{ name: "typecheck", command: "x" }] },
		});
		const m = loadExtension(resolveManifestPath(base, "otel") as string);
		expect(m?.provides.health_checks).toHaveLength(1);
	});
});
