#!/usr/bin/env node
/**
 * check-install.js — every declared dependency is actually installed.
 *
 * Publishing 1.54.0 failed *after* `npm whoami`, halfway through
 * `prepublishOnly`: `@opentelemetry/context-async-hooks` was declared in
 * `package.json` and never linked into `apps/indusk-mcp/node_modules`. The
 * dependency had arrived on a plan branch, and merging a branch brings the
 * manifest change, not the install — trunk had not run `pnpm install` since.
 *
 * That is the ordinary case, not an exotic one, and it costs a login to find
 * out. This runs first, off the network, in a second.
 *
 * Its own script rather than a step inside `release-guard.sh` because the
 * guard's last check asks the npm registry and so cannot be run hermetically;
 * this one is pure filesystem and is tested directly.
 *
 * Usage: node scripts/check-install.js [packageDir]   (default: the package
 * this script lives in). Exit 0 = every dependency resolves.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8"));

// Only real dependencies: optional ones are allowed to be absent by
// definition (the telemetry binaries are platform-split), and peers are the
// consumer's to provide.
const declared = Object.keys(manifest.dependencies ?? {});

/** Node's own resolution order: node_modules beside the package, then upward. */
function installed(name) {
	let dir = pkgDir;
	for (;;) {
		if (existsSync(join(dir, "node_modules", ...name.split("/"), "package.json"))) return true;
		const up = dirname(dir);
		if (up === dir || dir === parse(dir).root) return false;
		dir = up;
	}
}

const missing = declared.filter((name) => !installed(name));

if (missing.length > 0) {
	process.stderr.write(
		[
			"",
			`Refusing to publish ${manifest.version}.`,
			"",
			`${missing.length} declared dependenc${missing.length === 1 ? "y is" : "ies are"} not installed, so the build would fail`,
			"after npm has already authenticated:",
			"",
			...missing.map((name) => `      ${name}`),
			"",
			"The ordinary cause: the dependency arrived on a plan branch and the branch was",
			"merged. Merging brings the manifest change, not the install.",
			"",
			"  pnpm install",
			"",
		].join("\n"),
	);
	process.exit(1);
}

console.log(
	`release-guard: ${declared.length} declared dependenc${declared.length === 1 ? "y" : "ies"} installed — ok`,
);
