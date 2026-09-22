import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/**
 * release-ritual — T6, T7: the release proves its install before npm sees it.
 *
 * Publishing 1.54.0 failed *after* `npm whoami`, halfway through
 * `prepublishOnly`, because `@opentelemetry/context-async-hooks` was declared
 * in `package.json` and never linked into `apps/indusk-mcp/node_modules`. The
 * dependency arrived on a plan branch; merging brings the manifest, not the
 * install, and trunk had not run `pnpm install` since the merge.
 *
 * The check is its own script rather than a step inside `release-guard.sh`,
 * because the guard's last check asks the npm registry and cannot be run
 * hermetically. This one is pure filesystem, so it is tested directly.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, "../../scripts/check-install.js");

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A package directory declaring `deps`, with `linked` present under node_modules. */
function pkg(deps: string[], linked: string[]): string {
	const root = mkdtempSync(join(tmpdir(), "check-install-"));
	roots.push(root);
	writeFileSync(
		join(root, "package.json"),
		JSON.stringify({
			name: "fixture",
			version: "1.0.0",
			dependencies: Object.fromEntries(deps.map((d) => [d, "^1.0.0"])),
		}),
	);
	for (const name of linked) {
		const dir = join(root, "node_modules", ...name.split("/"));
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
	}
	return root;
}

function run(pkgDir: string): { code: number; out: string } {
	try {
		const out = execFileSync("node", [SCRIPT, pkgDir], { encoding: "utf-8", stdio: "pipe" });
		return { code: 0, out };
	} catch (err) {
		const e = err as { status?: number; stdout?: string; stderr?: string };
		return { code: e.status ?? -1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
	}
}

describe("T6 — a declared dependency that is not installed", () => {
	it("refuses, names the dependency and names `pnpm install`", () => {
		const root = pkg(["@opentelemetry/context-async-hooks", "gray-matter"], ["gray-matter"]);
		const r = run(root);
		expect(r.code, r.out).not.toBe(0);
		expect(r.out).toContain("@opentelemetry/context-async-hooks");
		expect(r.out, "it says the command that fixes it").toContain("pnpm install");
	});

	it("explains the ordinary cause — a dependency merged but never installed", () => {
		const root = pkg(["@opentelemetry/context-async-hooks"], []);
		const r = run(root);
		expect(r.code, "a crash is not an explanation").not.toBe(0);
		expect(r.out).toMatch(/merged|branch/i);
	});
});

describe("T7 — a tree whose install is current", () => {
	it("passes", () => {
		const root = pkg(["gray-matter", "@opentelemetry/api"], ["gray-matter", "@opentelemetry/api"]);
		const r = run(root);
		expect(r.code, r.out).toBe(0);
	});

	it("passes a package that declares nothing", () => {
		const root = pkg([], []);
		expect(run(root).code).toBe(0);
	});
});
