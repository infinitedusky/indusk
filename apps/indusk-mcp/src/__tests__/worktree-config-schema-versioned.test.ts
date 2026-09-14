import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { missingIgnoreRules, topUpManagedIgnore } from "../lib/worktree/shareable.js";
import { makeVersionedWorkbench, type VersionedWorkbench } from "./helpers/versioned-workbench.js";

/**
 * worktree-config-schema-pointer falsification — A6.
 *
 * `on_enable` now writes `.indusk/worktree-configs/config.schema.json`, a
 * package-owned file whose contents track the installed version. Both
 * generated ignore files for a versioned workbench un-ignore all of
 * `.indusk/` and then deny a short machine-local list, so without a rule of
 * its own the schema is offered to `workbench sync` — committed into the
 * shared context repo, where two teammates on different package versions
 * rewrite it at each other on every enable.
 *
 * The rule has to reach two places: the files the generator writes, and an
 * ignore file written before the rule existed (`topUpManagedIgnore`, guarded
 * on the managed marker, reported by `missingIgnoreRules`).
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);
const SCHEMA_REL = ".indusk/worktree-configs/config.schema.json";

let wb: VersionedWorkbench | undefined;

afterEach(() => {
	wb?.cleanup();
	wb = undefined;
});

/** Run the extension's own hook the way its manifest does. */
function enableWorktree(root: string): { code: number; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, "worktree", "_on-enable"], {
		cwd: root,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1", INDUSK_BIN: `node ${CLI_BIN}` },
		timeout: 60_000,
	});
	return { code: r.status ?? -1, stderr: r.stderr ?? "" };
}

/**
 * `--untracked-files=all` is load-bearing, not a flourish. Plain `--porcelain`
 * collapses an untracked DIRECTORY to one line (`?? .indusk/worktree-configs/`),
 * so a filter looking for the schema's path finds nothing and the test passes
 * while git is in fact offering the file. Caught by this test passing before
 * the ignore rule existed.
 */
function porcelain(root: string): string[] {
	const r = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], {
		cwd: root,
		encoding: "utf-8",
	});
	return (r.stdout ?? "").trim().split("\n").filter(Boolean);
}

describe.skipIf(SHOULD_SKIP)("A6 — the schema is machine-local, never shared", () => {
	it("git does not offer the schema after an enable in a versioned workbench", () => {
		wb = makeVersionedWorkbench({ repos: [{ name: "alpha" }], shape: "workbench" });
		writeFileSync(
			join(wb.root, "package.json"),
			'{"name":"wb","version":"0.0.0","private":true}\n',
		);

		const r = enableWorktree(wb.root);
		expect(r.code, `_on-enable failed:\n${r.stderr}`).toBe(0);
		expect(existsSync(join(wb.root, SCHEMA_REL)), "hook wrote no schema").toBe(true);

		const dirty = porcelain(wb.root);
		expect(
			dirty.filter((line) => line.includes("worktree-configs/config.schema.json")),
			`git offers the package-owned schema for commit:\n${dirty.join("\n")}`,
		).toEqual([]);
	});

	it("an ignore file written before the rule reports it missing and gains it on top-up", () => {
		wb = makeVersionedWorkbench({ repos: [{ name: "alpha" }], shape: "workbench" });
		const ignorePath = join(wb.root, ".gitignore");

		// A workbench scaffolded by an older InDusk: managed marker, the root
		// deny rule and the secrets rule, but nothing about the schema.
		writeFileSync(
			ignorePath,
			["# InDusk managed", "/*/", "!/.indusk/", ".indusk/extensions/*/.env", ""].join("\n"),
		);

		expect(missingIgnoreRules(wb.root).join("\n")).toContain("config.schema.json");
		expect(topUpManagedIgnore(wb.root), "top-up declined a managed file missing the rule").toBe(
			true,
		);
		expect(readFileSync(ignorePath, "utf-8")).toContain(SCHEMA_REL);
		expect(missingIgnoreRules(wb.root)).toEqual([]);
	});
});
