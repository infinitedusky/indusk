import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveReposRoot } from "../lib/worktree/repos.js";
import { CLI_BIN, git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * Resolving `repos_root` has ONE definition.
 *
 * It had four, and they disagreed. `workbench status` resolved it correctly
 * while `indusk update`'s materialization nudge read only the legacy
 * `sibling_parent`, never resolved a relative value, and looked up repos by
 * `name` rather than declared `path`. On a nested workbench it therefore
 * reported every repo missing and told the operator to run `workbench restore`
 * — which would have cloned a second copy of the repo to the sibling location
 * and relinked the trunks at it.
 *
 * That is the first defect in this family to recommend a destructive action, and
 * it is what makes a copy of this rule unacceptable rather than merely untidy.
 */

const SRC = resolve(new URL("../", import.meta.url).pathname);
let root: string;
afterEach(() => {
	if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

describe("resolveReposRoot is single-definition", () => {
	it("has exactly one definition under src/", () => {
		let out = "";
		try {
			out = execFileSync("grep", ["-rn", "export function resolveReposRoot", SRC], {
				encoding: "utf-8",
			});
		} catch {
			/* no matches */
		}
		// Excluding the test lane is load-bearing: this file contains the pattern
		// literal, so an unfiltered scan matches itself. The same trap is
		// documented in workbench-repos-single-definition.test.ts — an
		// enforcement grep whose scope includes its own source is green or red
		// for reasons that have nothing to do with the code.
		const hits = out
			.trim()
			.split("\n")
			.filter(Boolean)
			.filter((l) => !l.includes("/__tests__/"));
		expect(hits, `expected one definition, found:\n${hits.join("\n")}`).toHaveLength(1);
	});

	it("resolves a relative value against the workbench", () => {
		root = mkdtempSync(join(tmpdir(), "reposroot-"));
		mkdirSync(join(root, ".indusk"), { recursive: true });
		writeFileSync(
			join(root, ".indusk", "config.json"),
			JSON.stringify({ worktree: { shape: "workbench", repos_root: ".", repos: [{ name: "a" }] } }),
		);
		expect(resolveReposRoot(root)).toBe(root);
	});

	it("still reads the legacy sibling_parent", () => {
		root = mkdtempSync(join(tmpdir(), "reposroot-legacy-"));
		mkdirSync(join(root, ".indusk"), { recursive: true });
		writeFileSync(
			join(root, ".indusk", "config.json"),
			JSON.stringify({ worktree: { shape: "workbench", sibling_parent: "/tmp", repos: [] } }),
		);
		expect(resolveReposRoot(root)).toBe("/tmp");
	});
});

describe.skipIf(SHOULD_SKIP || !existsSync(CLI_BIN))(
	"update does not call a materialized repo missing",
	() => {
		it("stays silent for a nested workbench whose repo is present", { timeout: 90_000 }, () => {
			root = mkdtempSync(join(tmpdir(), "nudge-"));
			const wb = join(root, "app-workbench");
			const repo = join(wb, "app");
			mkdirSync(join(wb, ".indusk"), { recursive: true });
			mkdirSync(repo, { recursive: true });
			writeFileSync(
				join(wb, ".indusk", "config.json"),
				JSON.stringify({
					mode: "local",
					worktree: { shape: "workbench", repos_root: ".", repos: [{ name: "app" }] },
				}),
			);
			writeFileSync(join(repo, "package.json"), '{"name":"app","version":"0.0.0"}\n');
			git(repo, ["init", "-q", "-b", "main"]);
			git(repo, ["add", "-A"]);
			git(repo, ["commit", "-qm", "init"]);
			git(wb, ["init", "-q", "-b", "main"]);

			const r = runCli(wb, ["update"]);
			const out = `${r.stdout}${r.stderr}`;

			// Recommending `workbench restore` here would clone a second copy of
			// the repo beside the workbench and relink the trunk at it.
			expect(out, "the repo is present and nested").not.toMatch(/not materialized/);
			expect(out).not.toMatch(/workbench restore/);
		});
	},
);
