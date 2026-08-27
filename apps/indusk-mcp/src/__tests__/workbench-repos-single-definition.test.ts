import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkbenchRepos } from "../lib/worktree/repos.js";

/**
 * The repo set has ONE resolver in TypeScript, and its reduction is ported
 * once into the hook lane.
 *
 * Structural rather than behavioural on purpose: no behavioural test can catch
 * a divergence that has not happened yet, and the divergence this guards is
 * silent by construction — `worktree.ts`, `stray-state-audit.ts` and
 * `_hook-paths.js` each hand-rolled a private copy of the config shape before
 * this plan, and nothing type-checks the JS one. Same shape of guard as
 * `shared-resolution.test.ts` and `impl-headings.test.ts`.
 */

const PKG = resolve(__dirname, "..", "..");
const SRC = join(PKG, "src");

/**
 * Grep `dir`, excluding the test lane and comment lines.
 *
 * Both exclusions are load-bearing and both were learned by this file failing
 * on itself: a scan for `export function readWorkbenchRepos` matched THIS
 * file's own pattern literal, and a scan for the raw config field matched
 * prose in a docstring. An enforcement grep whose scope includes its own
 * source is green or red for reasons that have nothing to do with the code —
 * the same class of blind spot as `scm-rip-out-grep`'s.
 */
function grepCode(pattern: string, dir: string): string[] {
	let out: string;
	try {
		out = execFileSync("grep", ["-rn", "--include", "*.ts", "-E", pattern, dir], {
			encoding: "utf-8",
		});
	} catch {
		return []; // grep exits 1 on no matches
	}
	return out
		.trim()
		.split("\n")
		.filter(Boolean)
		.filter((line) => !line.includes("/__tests__/"))
		.filter((line) => {
			const code = line.slice(line.indexOf(":", line.indexOf(":") + 1) + 1).trim();
			return !code.startsWith("*") && !code.startsWith("//") && !code.startsWith("/*");
		});
}

describe("readWorkbenchRepos is single-definition", () => {
	it("has exactly one definition under src/", () => {
		const hits = grepCode("export function readWorkbenchRepos", SRC);
		expect(hits, `expected one definition, found:\n${hits.join("\n")}`).toHaveLength(1);
		expect(hits[0]).toContain("lib/worktree/repos.ts");
	});

	it("leaves no consumer reading worktree.wrapped_repo directly in TypeScript", () => {
		// Reading the raw field skips the reduction, which is where the
		// backward-compatibility guarantee actually lives. `repos.ts` itself is
		// the one place allowed to look at it.
		const hits = grepCode("worktree\\?\\.wrapped_repo|worktree\\.wrapped_repo", SRC).filter(
			(l) => !l.includes("lib/worktree/repos.ts") && !l.includes("/lib/config.ts"),
		);
		expect(hits, `these bypass readWorkbenchRepos:\n${hits.join("\n")}`).toHaveLength(0);
	});

	it("the hook lane's port is marked as a deliberate port of this module", () => {
		// The port cannot import the TS module, so the only thing holding the
		// two together is a reader who knows to change both. Name the pairing
		// in the file, and pin that the naming exists.
		const hook = readFileSync(join(PKG, "hooks", "_hook-paths.js"), "utf-8");
		expect(hook).toContain("declaredRepoNames");
		expect(hook).toMatch(/port of .*readWorkbenchRepos|readWorkbenchRepos.*repos\.ts/s);
	});
});

describe("the bash lane resolves the repo set once", () => {
	const EXT = join(PKG, "extensions", "worktree");

	it("defines _read_workbench_repos exactly once", () => {
		const hits = (() => {
			try {
				return execFileSync("grep", ["-rn", "-E", "^_read_workbench_repos\\(\\)", EXT], {
					encoding: "utf-8",
				})
					.trim()
					.split("\n")
					.filter(Boolean);
			} catch {
				return [];
			}
		})();
		expect(hits, `expected one definition, found:\n${hits.join("\n")}`).toHaveLength(1);
		expect(hits[0]).toContain("scripts/lib/workbench-helpers.sh");
	});

	it("leaves no script reading the singular field directly", () => {
		// `_read_workbench_field wrapped_repo` skips the reduction. In the shell
		// lane that bypass is invisible — no compiler, no types, and the failure
		// surfaces as a workbench that silently refuses to make a worktree.
		let hits: string[] = [];
		try {
			hits = execFileSync("grep", ["-rn", "_read_workbench_field wrapped_repo", EXT], {
				encoding: "utf-8",
			})
				.trim()
				.split("\n")
				.filter(Boolean);
		} catch {
			hits = [];
		}
		expect(hits, `these bypass _read_workbench_repos:\n${hits.join("\n")}`).toHaveLength(0);
	});

	it("marks the helper as a deliberate port of the TypeScript resolver", () => {
		const helpers = readFileSync(join(EXT, "scripts", "lib", "workbench-helpers.sh"), "utf-8");
		expect(helpers).toMatch(/DELIBERATE PORT/i);
		expect(helpers).toContain("repos.ts");
	});
});

describe("the singular reduces to the plural", () => {
	it("is the backward-compatibility guarantee, not a claim about one", () => {
		const { mkdtempSync, mkdirSync, writeFileSync } =
			require("node:fs") as typeof import("node:fs");
		const { tmpdir } = require("node:os") as typeof import("node:os");

		const mk = (worktree: unknown): string => {
			const root = mkdtempSync(join(tmpdir(), "repos-red-"));
			mkdirSync(join(root, ".indusk"), { recursive: true });
			writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify({ worktree }));
			return root;
		};

		expect(readWorkbenchRepos(mk({ wrapped_repo: "solo" }))).toEqual([{ name: "solo" }]);
		expect(
			readWorkbenchRepos(mk({ repos: [{ name: "a" }, { name: "b", remote: "git@x:b.git" }] })),
		).toEqual([{ name: "a" }, { name: "b", remote: "git@x:b.git" }]);
		// repos[] wins when both are present — otherwise a half-migrated config
		// silently keeps using the legacy field.
		expect(readWorkbenchRepos(mk({ wrapped_repo: "old", repos: [{ name: "new" }] }))).toEqual([
			{ name: "new" },
		]);
	});

	it("drops names that are not clean path segments, and dedupes", () => {
		const { mkdtempSync, mkdirSync, writeFileSync } =
			require("node:fs") as typeof import("node:fs");
		const { tmpdir } = require("node:os") as typeof import("node:os");
		const root = mkdtempSync(join(tmpdir(), "repos-red-"));
		mkdirSync(join(root, ".indusk"), { recursive: true });
		writeFileSync(
			join(root, ".indusk", "config.json"),
			JSON.stringify({
				worktree: {
					repos: [
						{ name: "../escape" },
						{ name: "a/b" },
						{ name: ".." },
						{ name: "" },
						{ name: "good" },
						{ name: "good" },
						"not-an-object",
					],
				},
			}),
		);
		// Degrade to structure-loss, never a traversal.
		expect(readWorkbenchRepos(root)).toEqual([{ name: "good" }]);
	});
});

describe("A27 — reserved names are refused as declared paths", () => {
	it("drops `.git`, `.indusk`, `.claude` rather than joining them", () => {
		// The guard blocks traversal but not COLLISION: these are single clean
		// segments, so `worktrees: ".git"` would place worktrees inside the
		// workbench's own git directory, and `path: ".indusk"` would resolve a
		// trunk onto InDusk's state.
		const { mkdtempSync, mkdirSync, writeFileSync } = require("node:fs") as typeof import("node:fs");
		const { tmpdir } = require("node:os") as typeof import("node:os");

		const mk = (repo: Record<string, unknown>): string => {
			const root = mkdtempSync(join(tmpdir(), "reserved-"));
			mkdirSync(join(root, ".indusk"), { recursive: true });
			writeFileSync(
				join(root, ".indusk", "config.json"),
				JSON.stringify({ worktree: { shape: "workbench", repos: [repo] } }),
			);
			return root;
		};

		for (const reserved of [".git", ".indusk", ".claude"]) {
			const byPath = readWorkbenchRepos(mk({ name: "alpha", path: reserved }));
			expect(byPath[0]?.path, `path: ${reserved} must be dropped`).toBeUndefined();

			const byWorktrees = readWorkbenchRepos(mk({ name: "alpha", worktrees: reserved }));
			expect(byWorktrees[0]?.worktrees, `worktrees: ${reserved} must be dropped`).toBeUndefined();
		}
	});
});

/**
 * A31 / A32 — the workbench's layout facts have one definition each.
 *
 * Same structural shape as the resolver guards above, for the same reason: a
 * divergence here is silent. A name missing from one reserved set renders a
 * machine directory as a worktree (or hides a real one), and a drifted
 * attribution reads exactly like a correct one — the words are the
 * `worktreeOwner` docblock's own.
 *
 * Both facts were re-authored, not shared, when this plan added the
 * `workbench` command group beside `worktree` — which is precisely the moment
 * the rule of three says to lift them out.
 */
describe("A31 — the reserved root-directory set is single-definition", () => {
	it("has exactly one definition under src/", () => {
		const hits = grepCode("RESERVED_ROOT_DIRS", SRC).filter((l) => /const RESERVED_ROOT_DIRS/.test(l));
		expect(hits, `expected one definition, found:\n${hits.join("\n")}`).toHaveLength(1);
	});

	it("leaves no command hand-rolling its own reserved set", () => {
		// The tell is the literal set of names, not the variable holding it: both
		// copies spelled `.indusk` and `node_modules` inline inside a `new Set([`.
		const hits = grepCode('"node_modules",', join(SRC, "bin"));
		expect(
			hits,
			`a reserved-directory list is still inline in a command:\n${hits.join("\n")}`,
		).toHaveLength(0);
	});

	it("names `docs`, and carries the reason with it", () => {
		// D7's reserved workbench-root docs directory. Absent from the set it
		// renders as a worktree — which is how the POC's `docs/` looked before
		// anyone noticed, and the sentence that says so must survive the move.
		const source = readFileSync(join(SRC, "lib", "worktree", "layout.ts"), "utf-8");
		expect(source).toContain('"docs"');
		expect(source).toMatch(/renders as a worktree/);
	});
});

describe("A32 — worktree-to-repo attribution is single-definition", () => {
	it("has exactly one definition under src/", () => {
		const hits = grepCode("function worktreeOwner", SRC);
		expect(hits, `expected one definition, found:\n${hits.join("\n")}`).toHaveLength(1);
	});

	it("leaves no second caller asking git for the common dir directly", () => {
		// The primitive, not the name: both copies were the same `rev-parse
		// --git-common-dir` spawn under different function names, so scanning for
		// the name alone would have called two copies one.
		const hits = grepCode("git-common-dir", SRC).filter(
			(l) => !l.includes("lib/worktree/layout.ts"),
		);
		expect(
			hits,
			`attribution is being re-derived outside the shared module:\n${hits.join("\n")}`,
		).toHaveLength(0);
	});

	it("keeps the reasoning that makes the git call non-negotiable", () => {
		const source = readFileSync(join(SRC, "lib", "worktree", "layout.ts"), "utf-8");
		expect(source).toMatch(/wrong attribution reads exactly like a right one/);
	});
});
