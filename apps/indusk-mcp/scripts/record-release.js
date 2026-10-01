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
const { name, version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8"));

const { parseCurrentMd, serializeCurrentMd } = await import(
	join(pkgDir, "dist/lib/agents/current-md.js")
);
const { withLock } = await import(join(pkgDir, "dist/lib/agents/lock.js"));
// The release commit is the one whose message names this version — the same
// lookup the health line's version state does. HEAD is not it: a publish that
// took several attempts has usually moved HEAD by the time this runs.
const { readRepoVersionState } = await import(join(pkgDir, "dist/lib/version-state.js"));
const { recordPendingRelease, clearPendingRelease, registryHasVersion } = await import(
	join(pkgDir, "dist/lib/pending-release.js")
);

// `pnpm publish` exiting 0 means npm accepted the upload, not that anyone can
// install it: npm's publish-time malware scan holds a new version for about
// five minutes, fifteen or more at peak, and answers 404 meanwhile. Record
// what was uploaded, so `indusk upgrade` can report on this version while npm
// scans it, and write the note now, saying which of the two it is.
const uploadedAt = new Date().toISOString();
recordPendingRelease({ name, version, uploadedAt });

// One look, never a wait: the release must not block on npm's scan. The
// pending record above is how `indusk upgrade` reports on this version
// until npm serves it.
const answer = registryHasVersion(name, version);
if (answer.state === "live") clearPendingRelease();
const releaseCommit = readRepoVersionState(repoRoot)?.releaseCommit?.slice(0, 7) ?? null;

const currentMd = join(repoRoot, ".indusk", "current.md");
const from = releaseCommit
	? `from release commit ${releaseCommit}`
	: `with no \`chore(release): ${version}\` commit found`;
const what =
	answer.state === "live"
		? `**${version} published** to npm`
		: answer.state === "absent"
			? `**${version} uploaded, still in npm's publish-time scan** — not installable for ~5 min (15+ at peak); \`indusk upgrade\` reports on it until it is live`
			: `**${version} uploaded; npm could not be asked whether it is live** (${answer.reason})`;
const line = `- ${new Date().toISOString().slice(0, 10)}: ${what} ${from} (\`pnpm release\`, recorded by \`scripts/record-release.js\`).`;

withLock(`${currentMd}.lock`, () => {
	const doc = parseCurrentMd(readFileSync(currentMd, "utf-8"));
	doc.sharedSection = `${doc.sharedSection.trimEnd()}\n${line}\n`;
	writeFileSync(currentMd, serializeCurrentMd(doc));
});
console.info(
	`record-release: noted ${version} in .indusk/current.md (Project (shared)) — commit it with the release.`,
);
console.info(
	answer.state === "live"
		? `record-release: ${version} is live — run \`indusk upgrade\`.`
		: `record-release: ${version} is in npm's publish-time scan (usually ~5 min) — \`indusk upgrade\` will say when it is live. Nothing to wait for here.`,
);
