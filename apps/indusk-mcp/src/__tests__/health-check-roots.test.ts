import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveCheckRoots, runHealthCheck } from "../lib/health.js";

/**
 * Health checks run where the code is, not where `.indusk/` is.
 *
 * An extension's checks are shell strings in a manifest — `test -f
 * instrumentation.py`, `python -c "import opentelemetry"`. A manifest cannot call
 * a TypeScript path helper, so making every extension author write
 * workbench-aware shell is both fragile and something they will not do.
 *
 * Instead the runner supplies the cwd: each check runs once per declared repo.
 * The shell stays naive and becomes correct, and every manifest that already
 * ships is fixed without being edited.
 *
 * The property that must NOT be lost, from the defect report that found this:
 * *a scope fix that turns something green immediately is a relaxation in
 * disguise.* A workbench with no instrumentation anywhere still fails.
 */

let root: string;
afterEach(() => {
	if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

function workbench(repos: string[], files: Record<string, string> = {}): string {
	root = mkdtempSync(join(tmpdir(), "health-roots-"));
	mkdirSync(join(root, ".indusk"), { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({
			worktree: { shape: "workbench", repos_root: ".", repos: repos.map((name) => ({ name })) },
		}),
	);
	for (const name of repos) mkdirSync(join(root, name), { recursive: true });
	for (const [rel, body] of Object.entries(files)) {
		const p = join(root, rel);
		mkdirSync(join(p, ".."), { recursive: true });
		writeFileSync(p, body);
	}
	return root;
}

describe("resolveCheckRoots", () => {
	it("returns each declared repo in a workbench", () => {
		const wb = workbench(["alpha", "beta"]);
		expect(resolveCheckRoots(wb)).toEqual([join(wb, "alpha"), join(wb, "beta")]);
	});

	it("returns the project itself when it is not a workbench", () => {
		root = mkdtempSync(join(tmpdir(), "plain-"));
		mkdirSync(join(root, ".indusk"), { recursive: true });
		writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ mode: "local" }));
		expect(resolveCheckRoots(root)).toEqual([root]);
	});
});

describe("runHealthCheck", () => {
	it("passes when the file exists in a declared repo, not the wrapper", () => {
		// The defect exactly: instrumentation lives in the app repo, the check ran
		// at the wrapper, and so could never find it.
		const wb = workbench(["alpha"], { "alpha/instrumentation.py": "# otel\n" });
		const r = runHealthCheck(wb, { name: "otel", command: "test -f instrumentation.py" });
		expect(r.ok).toBe(true);
		expect(r.satisfiedBy).toBe(join(wb, "alpha"));
	});

	it("still fails when nothing satisfies it anywhere", () => {
		// The load-bearing half. A scope fix that goes green on an empty project
		// has relaxed the check rather than repaired it.
		const wb = workbench(["alpha", "beta"]);
		const r = runHealthCheck(wb, { name: "otel", command: "test -f instrumentation.py" });
		expect(r.ok).toBe(false);
		expect(r.triedRoots).toHaveLength(2);
	});

	it("reports which repo satisfied it when several are declared", () => {
		const wb = workbench(["alpha", "beta"], { "beta/instrumentation.py": "# otel\n" });
		const r = runHealthCheck(wb, { name: "otel", command: "test -f instrumentation.py" });
		expect(r.ok).toBe(true);
		expect(r.satisfiedBy).toBe(join(wb, "beta"));
	});
});
