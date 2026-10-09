import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { describe, expect, it } from "vitest";

/**
 * A23 — trajectory-row parsing has one definition under `hooks/`.
 *
 * The same structural shape as A13, and for the same reason: no behavioural
 * test can catch a divergence that has not happened yet. This one is not
 * hypothetical though — it already happened, inside this plan. `check-gates.js`
 * carried its own `parseTrajectoryFromBody` with a local `Phase N` regex, so
 * when `Test Phase N` became a legal cell it read every row as `NaN` and Gate A
 * matched nothing at all. Nothing failed loudly; the gate just stopped
 * enforcing.
 *
 * A duplicated parser does not announce itself when it falls behind. Counting
 * definitions is the only check that fires before the divergence does.
 */

const hooksDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks");

/** Hook files that define their own trajectory-row parser. */
async function definers(): Promise<string[]> {
	const files = await glob("*.js", { cwd: hooksDir, absolute: true });
	const hits: string[] = [];
	for (const file of files) {
		const source = await readFile(file, "utf8");
		// A definition, not a call — `function parseTrajectoryFromBody(`.
		if (/\bfunction\s+parseTrajectoryFromBody\s*\(/.test(source)) {
			hits.push(relative(hooksDir, file));
		}
	}
	return hits.sort();
}

describe("A23 — one trajectory-row parser under hooks/", () => {
	it("finds hook files to scan (sanity)", async () => {
		const files = await glob("*.js", { cwd: hooksDir });
		expect(files.length).toBeGreaterThan(3);
	});

	it("is defined exactly once", async () => {
		// The shared definition belongs in a `_`-prefixed hook-local module,
		// which both hooks import — the established pattern (`_hook-paths.js`,
		// `_impl-headings.js`): no settings entry, but it must live in `hooks/`
		// or the importing hook dies at load.
		expect(await definers()).toEqual(["_trajectory-parser.js"]);
	}, 30_000);
});

/**
 * workbench-trust-fixes A24 — the phase-and-checkbox-item walk has one
 * definition under `hooks/`. `check-gates.js` and `gate-reminder.js` each
 * carried it (gate-reminder's the same walk minus the item text, recognizing
 * one gate kind fewer) — the two-copy state `_trajectory-parser.js` was
 * extracted from, for the same reason: a duplicated parser diverges silently.
 */
async function itemWalkDefiners(): Promise<string[]> {
	const files = await glob("*.js", { cwd: hooksDir, absolute: true });
	const hits: string[] = [];
	for (const file of files) {
		const source = await readFile(file, "utf8");
		// The checkbox-item regex literal — the walk's fingerprint.
		if (source.includes("\\[([ x])\\]")) hits.push(relative(hooksDir, file));
	}
	return hits.sort();
}

describe("A24 — one phase/checkbox-item walk under hooks/", () => {
	it("is defined exactly once, in the shared module", async () => {
		expect(await itemWalkDefiners()).toEqual(["_impl-phases.js"]);
	}, 30_000);
});

/**
 * day-monitor A32 — where a commit lands has one reading under `hooks/`.
 * `eval-trigger.js` kept its own commit filter and took the repository from
 * the session's directory while `trunk-guard.js` read the command's `cd` and
 * `git -C`; a plan's worktree commits were evaluated as the trunk's HEAD.
 */
async function commitReadingDefiners(): Promise<string[]> {
	const files = await glob("*.js", { cwd: hooksDir, absolute: true });
	const hits: string[] = [];
	for (const file of files) {
		const source = await readFile(file, "utf8");
		if (/\bfunction\s+commitAnchor\s*\(|\bconst\s+COMMIT_RE\s*=/.test(source)) {
			hits.push(relative(hooksDir, file));
		}
	}
	return hits.sort();
}

describe("A32 — one reading of where a commit lands, under hooks/", () => {
	it("is defined exactly once", async () => {
		expect(await commitReadingDefiners()).toEqual(["_commit-anchor.js"]);
	}, 30_000);
});

/**
 * incident-recording A33, at cleanup — promise: one-definition-per-shared-rule.
 * The break inbox's reading — which entries a session has not been given,
 * which are still open, one per incident — is `lib/promises/inbox.ts`'s rule.
 * Under `hooks/` it has one port, as every hook-side copy of a library module
 * does; a hook carrying its own copy is the drift `_trajectory-parser.js` was
 * extracted to end.
 */
describe("A33 — one port of the inbox's reading under hooks/", () => {
	it("only _inbox.js reads the delivered marks", async () => {
		const files = await glob("*.js", { cwd: hooksDir, absolute: true });
		const hits: string[] = [];
		for (const file of files) {
			if ((await readFile(file, "utf8")).includes('"inbox-delivered.jsonl"')) {
				hits.push(relative(hooksDir, file));
			}
		}
		expect(hits.sort()).toEqual(["_inbox.js"]);
	}, 30_000);
});
