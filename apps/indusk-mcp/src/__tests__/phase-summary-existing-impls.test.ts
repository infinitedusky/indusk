import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";

/**
 * A12 of the story-first-phases impl — a regression guard, green from the
 * start, with no red phase by design. Not a promise's test: the shape
 * `phase_summary: required` is opt-in, and this holds that every impl in the
 * repository that has not opted in is still judged by the save check exactly
 * as it was before the rule existed.
 *
 * The verdicts in `phase-summary-existing-impls.verdicts.json` were taken
 * before the rule landed: the exit code the save check gave each impl's own
 * text when written, keyed by the text's hash. An impl edited since has a
 * different hash and is not judged here (its verdict may move for its own
 * reasons); one that is byte-for-byte what it was must give the same exit.
 * Nothing starts a server and nothing waits: one spawned node per impl, with
 * `INDUSK_BIN=true` so the plan-contract check, which needs the installed
 * CLI, answers "no objection" and leaves only the structural rules in play.
 *
 * To retake the snapshot (only when the hook's verdict on an old impl is
 * meant to move): `INDUSK_WRITE_IMPL_VERDICTS=1 pnpm exec vitest run
 * src/__tests__/phase-summary-existing-impls.test.ts`.
 */

const ROOT = resolve(import.meta.dirname, "../../../..");
const VERDICTS = join(import.meta.dirname, "phase-summary-existing-impls.verdicts.json");

interface Verdict {
	/** The plan, for a reader of the snapshot; the hash is the key. */
	impl: string;
	exitCode: number;
}

function implFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = join(dir, e.name);
		if (e.isDirectory()) return implFiles(p);
		return e.name === "impl.md" ? [p] : [];
	});
}

const hash = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 16);

async function verdictOf(path: string, content: string): Promise<number> {
	const r = await runHook(
		"validate-impl-structure.js",
		{ tool_name: "Write", tool_input: { file_path: path, content }, cwd: ROOT },
		{ cwd: ROOT, env: { INDUSK_BIN: "true" } },
	);
	return r.exitCode;
}

/** Existing impls that have not opted in, as [path, text]. */
function notOptedIn(): Array<[string, string]> {
	return implFiles(join(ROOT, ".indusk", "planning"))
		.map((p): [string, string] => [p, readFileSync(p, "utf-8")])
		.filter(
			([, text]) => !/^phase_summary:/m.test(text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? ""),
		);
}

describe("phase-summaries A12 — an impl that has not opted in validates exactly as before", () => {
	if (process.env.INDUSK_WRITE_IMPL_VERDICTS) {
		it("retakes the snapshot", async () => {
			const out: Record<string, Verdict> = {};
			for (const [path, text] of notOptedIn()) {
				out[hash(text)] = { impl: relative(ROOT, path), exitCode: await verdictOf(path, text) };
			}
			writeFileSync(VERDICTS, `${JSON.stringify(out, null, "\t")}\n`);
			expect(Object.keys(out).length).toBeGreaterThan(0);
		}, 120_000);
		return;
	}

	const snapshot = JSON.parse(readFileSync(VERDICTS, "utf-8")) as Record<string, Verdict>;

	it("holds a snapshot of the repository's impls", () => {
		expect(Object.keys(snapshot).length, "impls in the snapshot").toBeGreaterThan(50);
	});

	it("gives every unchanged impl the verdict it gave before the rule", async () => {
		const judged = notOptedIn().filter(([, text]) => snapshot[hash(text)]);
		expect(judged.length, "impls still as they were when the snapshot was taken").toBeGreaterThan(
			0,
		);
		const moved: string[] = [];
		for (const [path, text] of judged) {
			const was = snapshot[hash(text)].exitCode;
			const now = await verdictOf(path, text);
			if (now !== was) moved.push(`${relative(ROOT, path)}: exit ${was} before, ${now} now`);
		}
		expect(moved, "impls whose verdict moved").toEqual([]);
	}, 120_000);
});
