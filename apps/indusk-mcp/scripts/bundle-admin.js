#!/usr/bin/env node
/**
 * bundle-admin.js — copies the admin app's pre-built Next.js production
 * output into apps/indusk-mcp/admin/ for inclusion in the published tarball.
 *
 * Run by `prepublishOnly` on indusk-mcp publish, AFTER `pnpm --filter
 * indusk-admin build` produces the .next/ output. Variant A3 from the
 * admin-ui-hosting ADR.
 *
 * What gets copied (everything next start needs at runtime):
 *   - .next/                  → the production build output (server + static)
 *   - public/                 → static assets (if any — Next.js convention)
 *   - package.json            → name + scripts (we run `next start`)
 *   - next.config.ts          → runtime config (turbopack root, etc.)
 *
 * What does NOT get copied (intentional exclusions):
 *   - node_modules/           → npm resolves these from indusk-mcp's deps
 *   - src/                    → source not needed; built output is in .next/
 *   - test-fixtures/          → testing only
 *   - vitest.config.ts        → testing only
 *   - tsconfig.json           → built output is JS
 *   - .next/cache/            → ephemeral build cache, slow to round-trip via npm
 *
 * The destination apps/indusk-mcp/admin/ is .gitignore'd; only its existence
 * via the package.json `files: ["admin"]` entry pulls it into the tarball.
 */

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
const ADMIN_SRC = join(REPO_ROOT, "apps/indusk-admin");
const ADMIN_DEST = resolve(HERE, "../admin");

function log(msg) {
	process.stdout.write(`[bundle-admin] ${msg}\n`);
}

function fatal(msg) {
	process.stderr.write(`[bundle-admin] FATAL: ${msg}\n`);
	process.exit(1);
}

if (!existsSync(ADMIN_SRC)) {
	fatal(`admin app source not found at ${ADMIN_SRC}`);
}

const nextDir = join(ADMIN_SRC, ".next");
if (!existsSync(nextDir)) {
	fatal(
		`admin app has not been built — ${nextDir} does not exist. Run \`pnpm --filter indusk-admin build\` first.`,
	);
}

// Clean previous bundle
if (existsSync(ADMIN_DEST)) {
	log(`removing previous bundle at ${ADMIN_DEST}`);
	rmSync(ADMIN_DEST, { recursive: true, force: true });
}

mkdirSync(ADMIN_DEST, { recursive: true });

const items = [
	{ src: ".next", dst: ".next", required: true },
	{ src: "public", dst: "public", required: false },
	{ src: "package.json", dst: "package.json", required: true },
	{ src: "next.config.ts", dst: "next.config.ts", required: true },
];

for (const item of items) {
	const srcPath = join(ADMIN_SRC, item.src);
	const dstPath = join(ADMIN_DEST, item.dst);
	if (!existsSync(srcPath)) {
		if (item.required) fatal(`required source ${item.src} not found at ${srcPath}`);
		log(`skipping optional ${item.src} (not present)`);
		continue;
	}
	log(`copying ${item.src} → admin/${item.dst}`);
	cpSync(srcPath, dstPath, {
		recursive: true,
		// Exclude:
		//   - .next/cache  — webpack/turbopack cache, ephemeral
		//   - .next/dev    — leftover from running `next dev` in the same dir;
		//                    can balloon to >200 MB and is unrelated to production
		filter: (s) => !s.includes(".next/cache") && !s.includes(".next/dev"),
	});
}

// Report sizes
function dirSizeMB(dir) {
	if (!existsSync(dir)) return 0;
	try {
		const out = execSync(`du -sk "${dir}"`, { encoding: "utf-8" });
		const kb = Number.parseInt(out.split(/\s+/)[0], 10);
		return Math.round((kb / 1024) * 10) / 10;
	} catch {
		return 0;
	}
}

const totalMB = dirSizeMB(ADMIN_DEST);
log(`bundle complete: admin/ is ${totalMB} MB`);

// Sanity-check the bundle: .next/ must contain BUILD_ID at minimum
const buildIdFile = join(ADMIN_DEST, ".next/BUILD_ID");
if (!existsSync(buildIdFile)) {
	fatal(
		"admin/.next/BUILD_ID not found in bundle — Next.js build output appears corrupt or incomplete.",
	);
}

log("done");
