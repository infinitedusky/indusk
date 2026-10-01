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

/** The nearest directory at or above the package holding `pnpm-lock.yaml` — the workspace root — or null. */
function workspaceRoot() {
	let dir = pkgDir;
	for (;;) {
		if (existsSync(join(dir, "pnpm-lock.yaml"))) return dir;
		const up = dirname(dir);
		if (up === dir) return null;
		dir = up;
	}
}

/**
 * The install judged against the lockfile, which covers what the dependency
 * check above cannot: devDependencies (the build needs `typescript`), the other
 * workspace packages (`prepublishOnly` also builds `indusk-admin`), and a
 * version changed on a branch. pnpm records the lockfile it installed at
 * `node_modules/.pnpm/lock.yaml`; a merge that changed `pnpm-lock.yaml` without
 * an install leaves the two different. Null when they agree or there is no
 * lockfile; otherwise the reason.
 */
function lockfileDrift() {
	const root = workspaceRoot();
	if (!root) return null;
	const record = join(root, "node_modules", ".pnpm", "lock.yaml");
	if (!existsSync(record)) return "nothing records an install of pnpm-lock.yaml";
	const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf-8");
	return readFileSync(record, "utf-8") === lock
		? null
		: "pnpm-lock.yaml has changed since the last install";
}

const drift = lockfileDrift();
if (missing.length === 0 && drift) {
	process.stderr.write(
		[
			"",
			`Refusing to publish ${manifest.version}: ${drift}, so the build would run`,
			"against an install that does not match the lockfile — and fail, if at all,",
			"after npm has already authenticated.",
			"",
			"The ordinary cause: a dependency (or devDependency, or a version) changed on a",
			"plan branch and the branch was merged. Merging brings the lockfile, not the install.",
			"",
			"  pnpm install",
			"",
		].join("\n"),
	);
	process.exit(1);
}

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

console.info(
	`release-guard: ${declared.length} declared dependenc${declared.length === 1 ? "y" : "ies"} installed${workspaceRoot() ? ", install matches pnpm-lock.yaml" : ""} — ok`,
);
