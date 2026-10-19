import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { describe, expect, it } from "vitest";
import * as hookVerdicts from "../../hooks/_clause-verdicts.js";
import { parsePurpose as hookParsePurpose } from "../../hooks/_trajectory-parser.js";
import * as libVerdicts from "../lib/promises/clause-verdicts.js";
import { token } from "../lib/tokens.js";
import { parsePurpose as libParsePurpose } from "../lib/trajectory/parser.js";

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

/**
 * plans-are-promises A14 — the library's row-purpose reader and the hook's
 * port of it read every `For` cell the same way, the clause form included.
 * A regression guard over two copies that must not drift; they have before
 * (A23 above is the same story for the trajectory parser).
 */
describe("plans-are-promises A14 — one reading of a row's purpose, in both copies", () => {
	const cells = [
		token("promise", "a"),
		"lesson: b",
		"clause: a/c",
		`${token("promise", "a")}, clause: a/c`,
		"clause: a",
		"clause: a/",
		"a regression guard over the old seat map",
		"",
	];

	it.each(cells)("reads %j the same in the library and the hook", (cell) => {
		expect(hookParsePurpose(cell)).toEqual(libParsePurpose(cell));
	});

	it("reads a clause cell as a clause in both", () => {
		for (const read of [libParsePurpose, hookParsePurpose]) {
			const purpose = read("clause: a/c") as { clauses?: unknown } | null;
			expect(purpose?.clauses).toEqual([{ promise: "a", clause: "c" }]);
		}
	});
});

/**
 * a-run-can-be-trusted, Build Phase 3 — the shell guard's decision file has one writer
 * under `hooks/`, `_clause-verdicts.js`, the port of `lib/promises/clause-verdicts.ts`'s
 * writing half; the two write the same lines, read the plan folders the same way and pair
 * a guard's line with its witness's by the same key.
 */
describe("a-run-can-be-trusted — one port of the plan-write decisions under hooks/", () => {
	it("only _clause-verdicts.js names the decision file", async () => {
		const files = await glob("*.js", { cwd: hooksDir, absolute: true });
		const hits: string[] = [];
		for (const file of files) {
			if ((await readFile(file, "utf8")).includes('"plan-write-decisions.jsonl"')) {
				hits.push(relative(hooksDir, file));
			}
		}
		expect(hits.sort()).toEqual(["_clause-verdicts.js"]);
	}, 30_000);

	it("names the same files and folder in both copies", () => {
		expect(hookVerdicts.DECISIONS_FILE).toBe(libVerdicts.DECISIONS_FILE);
		expect(hookVerdicts.PENDING_DIR).toBe(libVerdicts.PENDING_DIR);
	});

	it("appends the same line, snapshots the same folders and pairs by the same key", () => {
		const root = mkdtempSync(join(tmpdir(), "verdict-port-"));
		try {
			for (const dir of ["p", "q/notes", "archive/old", "archive/other"]) {
				mkdirSync(join(root, ".indusk", "planning", dir), { recursive: true });
			}
			writeFileSync(join(root, ".indusk", "planning", "p", "impl.md"), "x");
			writeFileSync(join(root, ".indusk", "planning", "q", "notes", "one.md"), "yy");
			writeFileSync(join(root, ".indusk", "planning", "master.md"), "m");
			writeFileSync(join(root, ".indusk", "planning", "archive", "old", "brief.md"), "b");
			writeFileSync(join(root, ".indusk", "planning", "archive", "other", "brief.md"), "c");
			const lib = libVerdicts.planFolderSnapshot(root, ["old"]);
			expect(hookVerdicts.planFolderSnapshot(root, ["old"])).toEqual(lib);
			expect(Object.keys(lib).sort()).toEqual([
				".indusk/planning/archive/old/brief.md",
				".indusk/planning/p/impl.md",
				".indusk/planning/q/notes/one.md",
			]);
			const after = { ...lib, ".indusk/planning/p/impl.md": [2, 1] as [number, number] };
			expect(hookVerdicts.changedFiles(lib, after)).toEqual(libVerdicts.changedFiles(lib, after));

			const line = {
				kind: "decision" as const,
				toolUseId: "t",
				at: "2026-10-19T00:00:00.000Z",
				command: "cat x",
				cwd: root,
				decision: "allowed" as const,
				files: [],
				before: lib,
			};
			hookVerdicts.appendDecision(join(root, "h1"), line);
			libVerdicts.appendDecision(join(root, "h2"), line);
			expect(readFileSync(join(root, "h1", hookVerdicts.DECISIONS_FILE), "utf8")).toBe(
				readFileSync(join(root, "h2", libVerdicts.DECISIONS_FILE), "utf8"),
			);
			for (const event of [
				{ tool_use_id: "toolu_01/abc", tool_input: { command: "ls" } },
				{ session_id: "s", tool_input: { command: "ls" } },
				{},
			]) {
				expect(hookVerdicts.toolUseKey(event)).toBe(libVerdicts.toolUseKey(event));
			}
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
