import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git, initRepoWithCommit } from "./test-git.js";

/**
 * The one trunk-guard test project.
 *
 * `trunk-guard.test.ts`, `trunk-guard-falsification.test.ts` and
 * `trunk-guard-release-message.test.ts` each built their own — a git repo on
 * `main` with a source file and an `.indusk/` config — and the three had
 * drifted in what they seeded. This is their union: every allow-listed kind
 * of file the guard judges (plan document, lessons, settings, `CLAUDE.md`,
 * `AGENTS.md`), one packaged source file and a root `package.json`, all
 * committed so a test stages only what it means to.
 *
 * Extracted by release-ritual's cleanup phase.
 */

const roots: string[] = [];

/** A normal-mode project on `main`, committed. Call {@link removeTrunkProjects} in `afterEach`. */
export function trunkProject(config: object = { mode: "local", verify: {} }): string {
	const root = mkdtempSync(join(tmpdir(), "trunk-guard-"));
	roots.push(root);
	initRepoWithCommit(root);
	mkdirSync(join(root, ".indusk", "planning", "p"), { recursive: true });
	mkdirSync(join(root, ".claude", "lessons"), { recursive: true });
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify(config));
	writeFileSync(join(root, ".indusk", "planning", "p", "brief.md"), "# p\n");
	writeFileSync(join(root, ".indusk", "current.md"), "# Operational State\n");
	writeFileSync(join(root, ".indusk", "notes.md"), "# notes\n");
	writeFileSync(join(root, ".claude", "lessons", "l.md"), "# l\n");
	writeFileSync(join(root, ".claude", "settings.json"), "{}\n");
	writeFileSync(join(root, "CLAUDE.md"), "# c\n");
	writeFileSync(join(root, "AGENTS.md"), "# a\n");
	writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
	writeFileSync(join(root, "package.json"), '{"name":"p","version":"1.0.0"}\n');
	git(root, ["add", "-A"]);
	git(root, ["commit", "-q", "-m", "seed"]);
	return root;
}

export function removeTrunkProjects(): void {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
}

/** Write `rel` (relative to `root`) and stage it. */
export function stage(root: string, rel: string, body: string): void {
	writeFileSync(join(root, rel), body);
	git(root, ["add", rel]);
}

/** The PreToolUse event Claude Code sends for a Bash call. */
export const bash = (cwd: string, command: string) => ({
	tool_name: "Bash",
	tool_input: { command },
	cwd,
});

/** The PreToolUse event Claude Code sends for an Edit of `rel`. */
export const edit = (root: string, rel: string) => ({
	tool_name: "Edit",
	tool_input: { file_path: join(root, rel), old_string: "a", new_string: "b" },
	cwd: root,
});
