import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { induskMcpPackageRoot } from "./package-root.js";

const ENV = "INDUSK_MCP_PACKAGE_ROOT";
const OWN_ROOT = join(import.meta.dirname, "..", "..");

function packageDir(name?: string): string {
	const dir = mkdtempSync(join(tmpdir(), "package-root-"));
	if (name) writeFileSync(join(dir, "package.json"), JSON.stringify({ name }));
	return dir;
}

describe("induskMcpPackageRoot", () => {
	let saved: string | undefined;
	beforeEach(() => {
		saved = process.env[ENV];
		delete process.env[ENV];
	});
	afterEach(() => {
		if (saved === undefined) delete process.env[ENV];
		else process.env[ENV] = saved;
	});

	it("T2 finds the root from where the code sits when no root is handed", () => {
		expect(induskMcpPackageRoot()).toBe(OWN_ROOT);
	});

	// promise: an-accepted-brief-is-planned-unasked
	it("T3 returns a handed root that holds this package", () => {
		const handed = packageDir("@infinitedusky/indusk-mcp");
		process.env[ENV] = handed;
		expect(induskMcpPackageRoot()).toBe(handed);
	});

	it.each([
		["empty", () => ""],
		["a folder with no package.json", () => packageDir()],
		["another package", () => packageDir("other")],
	])("T4 ignores a handed root that is %s", (_label, make) => {
		process.env[ENV] = make();
		expect(induskMcpPackageRoot()).toBe(OWN_ROOT);
	});
});
