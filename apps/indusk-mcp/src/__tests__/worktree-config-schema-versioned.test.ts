import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	ensureShareableScaffolding,
	missingIgnoreRules,
	topUpManagedIgnore,
} from "../lib/worktree/shareable.js";
import { CLI_BIN, runCli, SHOULD_SKIP } from "./helpers/cli.js";
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

const SCHEMA_REL = ".indusk/worktree-configs/config.schema.json";

let wb: VersionedWorkbench | undefined;

afterEach(() => {
	wb?.cleanup();
	wb = undefined;
});

/**
 * Run the extension's own hook the way its manifest does. `INDUSK_BIN` points
 * the hook's bare `indusk` at this build rather than whatever is installed
 * globally.
 */
function enableWorktree(root: string) {
	return runCli(root, ["worktree", "_on-enable"], { INDUSK_BIN: `node ${CLI_BIN}` });
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

		// The fixture hand-writes a minimal `.gitignore` (the repo dirs only).
		// A real workbench's comes from the scaffolding generator, which is the
		// artifact under test here — so replace it with the real one.
		rmSync(join(wb.root, ".gitignore"));
		ensureShareableScaffolding(wb.root, [{ name: "alpha" }]);

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

	/**
	 * Falsification-of-the-falsification (A8). A6 above declares no `worktrees`,
	 * so `allLocationsDeclared` is false for its fixture and it exercises the
	 * flat branch only. `refuseIfIgnoreCannotHold` returns early for a declared
	 * layout — correctly, since it needs no deny-by-default rule — and the
	 * ignore top-up sat behind that return, so a declared workbench whose ignore
	 * file predates this change never gained the schema rule and kept offering
	 * the file to its shared repo.
	 *
	 * Driven through `workbench sync` rather than the library function: the fix
	 * changes that function's signature, so a unit test naming it would fail to
	 * LOAD today rather than fail its assertion — an absent test wearing a
	 * failure's clothes. The CLI is a boundary that exists now, and sync does
	 * its ignore maintenance before it needs a remote.
	 *
	 * The rule reaching a declared layout must not bring the root deny rule with
	 * it: appending `/*\/` there inverts an ignore file this code refuses to
	 * rewrite on purpose.
	 */
	it("a declared layout gains the machine-local rule and not the flat deny rule", () => {
		wb = makeVersionedWorkbench({
			repos: [{ name: "alpha", worktrees: "wts" }],
			shape: "workbench",
		});
		const ignorePath = join(wb.root, ".gitignore");
		writeFileSync(
			ignorePath,
			["# InDusk managed", "/alpha", "/wts/", ".indusk/extensions/*/.env", ""].join("\n"),
		);

		const r = runCli(wb.root, ["workbench", "sync"], { INDUSK_BIN: `node ${CLI_BIN}` });
		const body = readFileSync(ignorePath, "utf-8");
		expect(
			body,
			`the declared layout never received the machine-local rule:\n${r.stdout}`,
		).toContain(SCHEMA_REL);
		expect(
			body,
			"the flat layout's deny-by-default rule was imposed on a declared one",
		).not.toContain("\n/*/");
	});
});
