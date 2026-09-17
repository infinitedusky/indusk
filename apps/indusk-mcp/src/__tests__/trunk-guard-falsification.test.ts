import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runHook } from "./helpers/hook-runner.js";
import { git, initRepoWithCommit } from "./helpers/test-git.js";

/**
 * trunk-guard falsification — A8, A9, A10.
 *
 * The commit gate reads the Bash command text. Shell has more than one way
 * to say "commit this", and the shipped parser read exactly one: `git`
 * immediately followed by `commit`, in command position after `; & | (` or
 * the start of the line, judged against the event's cwd, with `-a` only as
 * a lone flag. Each case here is a spelling an agent uses every day.
 */

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/** A normal-mode project on `main` with one committed source file. */
function project(): string {
	const root = mkdtempSync(join(tmpdir(), "trunk-guard-f-"));
	roots.push(root);
	initRepoWithCommit(root);
	mkdirSync(join(root, ".indusk"), { recursive: true });
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(
		join(root, ".indusk", "config.json"),
		JSON.stringify({ mode: "local", verify: {} }),
	);
	writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
	git(root, ["add", "-A"]);
	git(root, ["commit", "-q", "-m", "seed"]);
	return root;
}

function stageSource(root: string): void {
	writeFileSync(join(root, "src", "a.ts"), "export const a = 2;\n");
	git(root, ["add", "src/a.ts"]);
}

function modifySourceUnstaged(root: string): void {
	writeFileSync(join(root, "src", "a.ts"), "export const a = 3;\n");
}

const bash = (cwd: string, command: string) => ({
	tool_name: "Bash",
	tool_input: { command },
	cwd,
});

describe("A8 — git options before the verb, and a cd in the same command", () => {
	it.each([
		"git -C REPO commit -m x",
		"git -c user.name=x commit -m x",
		"git --no-pager commit -m x",
		"git -C REPO --no-pager commit -q -m x",
	])("refuses `%s` on main with a source file staged", async (spelling) => {
		const root = project();
		stageSource(root);
		const r = await runHook("trunk-guard.js", bash(root, spelling.replaceAll("REPO", root)));
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/src\/a\.ts/);
	});

	it("judges `cd <repo> && git commit` against <repo>, not the event cwd", async () => {
		const root = project();
		stageSource(root);
		const elsewhere = mkdtempSync(join(tmpdir(), "trunk-guard-elsewhere-"));
		roots.push(elsewhere);
		const r = await runHook("trunk-guard.js", bash(elsewhere, `cd ${root} && git commit -m x`));
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/src\/a\.ts/);
	});

	it("judges `git -C <repo> commit` against <repo> from an unrelated cwd", async () => {
		const root = project();
		stageSource(root);
		const elsewhere = mkdtempSync(join(tmpdir(), "trunk-guard-elsewhere-"));
		roots.push(elsewhere);
		const r = await runHook("trunk-guard.js", bash(elsewhere, `git -C ${root} commit -m x`));
		expect(r.exitCode).toBe(2);
	});
});

describe("A9 — a commit wrapped in quotes or a substitution is still a commit", () => {
	it.each([
		'bash -c "git commit -m x"',
		"sh -c 'git commit -m x'",
		"out=$(git commit -m x)",
		"out=`git commit -m x`",
	])("refuses `%s` on main with a source file staged", async (spelling) => {
		const root = project();
		stageSource(root);
		const r = await runHook("trunk-guard.js", bash(root, spelling));
		expect(r.exitCode).toBe(2);
	});

	it.each([
		"git commitment -m x",
		"git log --grep 'git commit'",
	])("leaves `%s` alone — not a commit", async (spelling) => {
		const root = project();
		stageSource(root);
		const r = await runHook("trunk-guard.js", bash(root, spelling));
		expect(r.exitCode).toBe(0);
	});
});

describe("A10 — -a in a flag cluster and an explicit pathspec commit unstaged files", () => {
	it("refuses `git commit -am x` with a tracked source file modified and nothing staged", async () => {
		const root = project();
		modifySourceUnstaged(root);
		const r = await runHook("trunk-guard.js", bash(root, "git commit -am x"));
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/src\/a\.ts/);
	});

	it("refuses `git commit -m x src/a.ts` — the pathspec commits the file without staging", async () => {
		const root = project();
		modifySourceUnstaged(root);
		const r = await runHook("trunk-guard.js", bash(root, "git commit -m x src/a.ts"));
		expect(r.exitCode).toBe(2);
		expect(r.stderr).toMatch(/src\/a\.ts/);
	});

	it("refuses `git commit -m x -- src/a.ts` the same way", async () => {
		const root = project();
		modifySourceUnstaged(root);
		const r = await runHook("trunk-guard.js", bash(root, "git commit -m x -- src/a.ts"));
		expect(r.exitCode).toBe(2);
	});

	it("allows `git commit -m x` with nothing staged — there is nothing to judge", async () => {
		const root = project();
		modifySourceUnstaged(root);
		const r = await runHook("trunk-guard.js", bash(root, "git commit -m x"));
		expect(r.exitCode).toBe(0);
	});
});
