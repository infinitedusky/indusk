#!/usr/bin/env node
/**
 * record-release.js — after a successful publish, leave the mark an agent reads.
 *
 * `pnpm release` is run by a human (npm's one-time password cannot be entered
 * by an agent), and on 2026-09-17 nothing about that publish reached any file
 * an agent reads at catchup, so an agent kept reporting the version as
 * unpublished for an hour. This appends one line to `.indusk/current.md`'s
 * Project (shared) region — the file every session reads first — under the
 * same file lock every other writer of that file takes.
 *
 * Runs from `apps/indusk-mcp` (the `release` script's cwd). Imports the built
 * library, which exists because `prepublishOnly` just built it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, "..");
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	cwd: pkgDir,
	encoding: "utf-8",
}).trim();
const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8")).version;
const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
	cwd: repoRoot,
	encoding: "utf-8",
}).trim();

const { parseCurrentMd, serializeCurrentMd } = await import(
	join(pkgDir, "dist/lib/agents/current-md.js")
);
const { withLock } = await import(join(pkgDir, "dist/lib/agents/lock.js"));

const currentMd = join(repoRoot, ".indusk", "current.md");
const line = `- ${new Date().toISOString().slice(0, 10)}: **${version} published** to npm from release commit ${head} (\`pnpm release\`, recorded by \`scripts/record-release.js\`).`;

withLock(`${currentMd}.lock`, () => {
	const doc = parseCurrentMd(readFileSync(currentMd, "utf-8"));
	doc.sharedSection = `${doc.sharedSection.trimEnd()}\n${line}\n`;
	writeFileSync(currentMd, serializeCurrentMd(doc));
});
console.info(
	`record-release: noted ${version} in .indusk/current.md (Project (shared)) — commit it with the release.`,
);
