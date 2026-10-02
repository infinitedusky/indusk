import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CLI_BIN, runCli } from "./helpers/cli.js";
import { git, initRepoWithCommit } from "./helpers/test-git.js";

/**
 * context-tiers — A11: `indusk context check-pointers` walks every context
 * file, not only the root, and a `lesson:` token is a pointer.
 *
 * Under the tiers a rule's body lives behind a pointer — a path in a nested
 * file, or a lesson name in an enforcer's message — so a dead pointer in any
 * of them is a lost rule, and the check that guards against that must read
 * all of them. Driven through the built CLI, which is the surface a project
 * runs.
 */

const roots: string[] = [];
afterEach(() => {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function project(): string {
	const root = mkdtempSync(join(tmpdir(), "context-tiers-pointers-"));
	roots.push(root);
	initRepoWithCommit(root);
	mkdirSync(join(root, ".indusk"), { recursive: true });
	mkdirSync(join(root, "apps/real"), { recursive: true });
	mkdirSync(join(root, "sub"), { recursive: true });
	mkdirSync(join(root, ".claude/lessons"), { recursive: true });
	writeFileSync(join(root, "package.json"), '{"name":"p","version":"1.0.0"}\n');
	writeFileSync(join(root, ".indusk/config.json"), JSON.stringify({ mode: "local" }));
	writeFileSync(join(root, "apps/real/thing.ts"), "export const t = 1;\n");
	writeFileSync(join(root, ".claude/lessons/real-lesson.md"), "# A real lesson\n");
	writeFileSync(
		join(root, "CLAUDE.md"),
		"# p\n\n## Conventions\n\n- see `apps/real/thing.ts` and `lesson: real-lesson`\n",
	);
	writeFileSync(
		join(root, "sub/CLAUDE.md"),
		"# sub\n\n- the rule body is at `apps/nothing/here.ts`\n- failing test names `lesson: no-such-lesson`\n",
	);
	git(root, ["add", "-A"]);
	git(root, ["commit", "-q", "-m", "pointers"]);
	return root;
}

describe("A11 — check-pointers reads every context file", () => {
	it("fails on a dead path and a dead lesson in a nested file, naming the file and each pointer", () => {
		expect(
			existsSync(CLI_BIN),
			"build the CLI first — a missing binary must not read as a result",
		).toBe(true);
		const root = project();
		const r = runCli(root, ["context", "check-pointers"]);
		const out = `${r.stdout}\n${r.stderr}`;
		expect(r.code, `the nested file holds two dead pointers — ${out}`).toBe(1);
		expect(out).toContain("sub/CLAUDE.md");
		expect(out).toContain("apps/nothing/here.ts");
		expect(out).toContain("no-such-lesson");
		expect(out, "the live pointers in the root are not reported").not.toContain("real-lesson");
	});
});
