// promise: dusk-installs-its-own-build
//
// admin-builds-with-the-planning-reader, T1: the planning reader is loaded by the
// admin, whose production bundler tries to resolve a path built from
// `import.meta.url` when the module loads and fails the build. The reader asks the
// package root for the shipped impl hook when it runs instead.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { induskMcpPackageRoot } from "../package-root.js";

const SOURCE = join(induskMcpPackageRoot(), "src", "lib", "build", "read-planning.ts");

it("T1 the reader builds no hook path from its own location when it loads", () => {
	const text = readFileSync(SOURCE, "utf-8");
	expect(text).not.toMatch(
		/const IMPL_HOOK = join\(\s*dirname\(fileURLToPath\(import\.meta\.url\)\)/,
	);
	expect(text).toMatch(
		/induskMcpPackageRoot\(\)[\s\S]{0,40}"hooks"[\s\S]{0,40}"validate-impl-structure\.js"/,
	);
	// Turbopack reads a start of `"node"` with a script path as loading a script and resolves the
	// path at build time; the running Node binary is not read that way. The hook is started
	// asynchronously, so the server keeps answering while it runs (admin-pages-load-fast).
	expect(text).not.toMatch(/(?:spawnSync|startProgram)\("node",/);
	expect(text).toMatch(/startProgram\(process\.execPath,/);
});

it("T1 the shipped impl hook is where the package root says", () => {
	expect(existsSync(join(induskMcpPackageRoot(), "hooks", "validate-impl-structure.js"))).toBe(
		true,
	);
});
