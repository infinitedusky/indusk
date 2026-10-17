// a-new-project-starts-instrumented, Test Phase 1: T24 - the carried item. The seat-holds
// example (the demo `indusk demo` copies) writes its promise signal through a copy of the
// package's signal helper template, no longer by hand, and `indusk init` on a fresh copy
// adds no second OpenTelemetry setup, since the example keeps its own provider.
//
// Both files are read inside the test, so a missing helper fails an assertion naming it
// rather than the load of this file.
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, REPO_ROOT, runCli, SHOULD_SKIP } from "./helpers/cli.js";

const EXAMPLE = join(REPO_ROOT, "examples", "seat-holds");
const TEMPLATE = join(REPO_ROOT, "apps", "indusk-mcp", "templates", "signal.ts");

const read = (path: string): string | null =>
	existsSync(path) ? readFileSync(path, "utf-8") : null;

const copies: string[] = [];
afterEach(() => {
	for (const d of copies.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A fresh copy of the example in a repository of its own, as `indusk demo` makes it. */
function freshCopy(): string {
	const dir = mkdtempSync(join(tmpdir(), "demo-signal-helper-"));
	copies.push(dir);
	cpSync(EXAMPLE, dir, { recursive: true, filter: (src) => !src.includes("node_modules") });
	git(dir, ["init", "-q"]);
	return dir;
}

describe("demo-signal-helper", () => {
	it("T24: the example's signal helper is a byte-for-byte copy of the template", () => {
		const template = read(TEMPLATE);
		expect(template, "the package ships templates/signal.ts").not.toBeNull();
		const copy = read(join(EXAMPLE, "src", "signal.ts"));
		expect(copy, "the example has src/signal.ts").not.toBeNull();
		expect(copy).toBe(template);
	});

	it("T24: the example's server writes its signal through the helper, and its telemetry file no longer sets the promise by hand", () => {
		const server = read(join(EXAMPLE, "src", "server.ts")) ?? "";
		expect(server, "server.ts imports the helper").toMatch(/from\s+["']\.\/signal\.js["']/);
		const telemetry = read(join(EXAMPLE, "src", "telemetry.ts")) ?? "";
		expect(telemetry, "telemetry.ts sets the promise by hand").not.toContain('"indusk.promise"');
	});

	it.skipIf(SHOULD_SKIP)(
		"T24: init on a fresh copy adds no instrumentation, logger or exporter of its own",
		() => {
			const dir = freshCopy();
			const r = runCli(dir, ["init"], { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1" });
			expect(r.code, `init exit\n${r.stderr}`).toBe(0);
			const added = ["instrumentation.ts", "logger.ts", "filtering-exporter.ts"].filter((f) =>
				existsSync(join(dir, "src", f)),
			);
			expect(added, "init added these to the example").toEqual([]);
		},
	);

	// Build Phase 5, T31: the demo ships as InDusk wrote it, so init finds nothing changed.
	it.skipIf(SHOULD_SKIP)(
		"T31: init on a fresh copy writes nothing beside any file and never says a file was changed",
		() => {
			const dir = freshCopy();
			const r = runCli(dir, ["init"], { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1" });
			expect(r.code, `init exit\n${r.stderr}`).toBe(0);
			const beside = readdirSync(dir, { recursive: true, encoding: "utf-8" }).filter(
				(f) => f.endsWith(".indusk-new") && !f.includes("node_modules"),
			);
			expect(beside, "files written beside").toEqual([]);
			expect(`${r.stdout}${r.stderr}`).not.toContain("you changed");
		},
	);
});
