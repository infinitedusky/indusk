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

/**
 * What the registry says about this version: the version itself when it has
 * it, otherwise why not. `pnpm publish` exiting 0 is not that answer — 1.51.0
 * exited 0 and never reached the registry, and the note this writes said
 * "published". The lookup is the release guard's (`npm view`, bounded by
 * `--fetch-timeout`), tried a few times because a fresh publish can lag.
 */
function registryAnswer() {
	const attempts = 3;
	const waitMs = Number(process.env.RECORD_RELEASE_RETRY_MS ?? 5000);
	let last = "";
	for (let i = 0; i < attempts; i++) {
		if (i > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
		try {
			const out = execFileSync(
				"npm",
				["view", `${name}@${version}`, "version", "--fetch-timeout=10000"],
				{ encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
			).trim();
			if (out === version) return { confirmed: true };
			last = out ? `npm view returned ${out}` : "npm view returned nothing";
		} catch (err) {
			last = `npm view failed: ${
				String(err.stderr ?? err.message)
					.trim()
					.split("\n")[0]
			}`;
		}
	}
	return { confirmed: false, reason: last };
}

const { parseCurrentMd, serializeCurrentMd } = await import(
	join(pkgDir, "dist/lib/agents/current-md.js")
);
const { withLock } = await import(join(pkgDir, "dist/lib/agents/lock.js"));
// The release commit is the one whose message names this version — the same
// lookup the health line's version state does. HEAD is not it: a publish that
// took several attempts has usually moved HEAD by the time this runs.
const { readRepoVersionState } = await import(join(pkgDir, "dist/lib/version-state.js"));
const releaseCommit = readRepoVersionState(repoRoot)?.releaseCommit?.slice(0, 7) ?? null;

const currentMd = join(repoRoot, ".indusk", "current.md");
const from = releaseCommit
	? `from release commit ${releaseCommit}`
	: `with no \`chore(release): ${version}\` commit found`;
const answer = registryAnswer();
const what = answer.confirmed
	? `**${version} published** to npm`
	: `**${version}: publish reported success, but the registry did not confirm ${version}** (${answer.reason})`;
const line = `- ${new Date().toISOString().slice(0, 10)}: ${what} ${from} (\`pnpm release\`, recorded by \`scripts/record-release.js\`).`;

withLock(`${currentMd}.lock`, () => {
	const doc = parseCurrentMd(readFileSync(currentMd, "utf-8"));
	doc.sharedSection = `${doc.sharedSection.trimEnd()}\n${line}\n`;
	writeFileSync(currentMd, serializeCurrentMd(doc));
});
console.info(
	`record-release: noted ${version} in .indusk/current.md (Project (shared)) — commit it with the release.`,
);
if (!answer.confirmed) {
	console.info(
		`record-release: the registry did not confirm ${version} (${answer.reason}) — check \`npm view ${name} versions\` before calling it published.`,
	);
}
