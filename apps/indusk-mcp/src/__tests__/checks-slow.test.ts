import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * release-checks-run-once — A1–A5: the slow tests run once for the same code.
 *
 * A fixture project declares a slow command (`sh slow.sh`) that writes a
 * marker file outside the repository and exits with `SLOW_EXIT`. Whether the
 * marker appears says whether `indusk checks slow` ran the tests; the record
 * of green runs lives in a temporary `INDUSK_HOME`.
 *
 * promise: slow-checks-run-once-per-tree
 */

let base: string;
let project: string;
let home: string;
let marker: string;

const config = {
	workflow: {
		steps: {
			land: { slow_tests: "sh slow.sh" },
			release: { version_file: "package.json", changelog: "CHANGELOG.md" },
		},
	},
};

function commit(cwd: string, message: string): void {
	git(cwd, ["add", "-A"]);
	git(cwd, ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", message]);
}

beforeEach(() => {
	base = realpathSync(mkdtempSync(join(tmpdir(), "checks-slow-")));
	project = join(base, "proj");
	home = join(base, "home");
	marker = join(base, "ran");
	mkdirSync(join(project, ".indusk"), { recursive: true });
	mkdirSync(join(project, "src"), { recursive: true });
	git(project, ["init", "-q", "-b", "main"]);
	writeFileSync(join(project, ".indusk", "config.json"), JSON.stringify(config));
	// biome-ignore lint/suspicious/noTemplateCurlyInString: a shell script's own parameter expansion
	writeFileSync(join(project, "slow.sh"), 'touch "$MARKER"\nexit "${SLOW_EXIT:-0}"\n');
	writeFileSync(
		join(project, "package.json"),
		`${JSON.stringify({ name: "p", version: "1.0.0" }, null, 2)}\n`,
	);
	writeFileSync(join(project, "CHANGELOG.md"), "# Changelog\n\n## [Unreleased]\n");
	writeFileSync(join(project, "src", "code.js"), "export const a = 1;\n");
	commit(project, "init");
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

const slow = (cwd: string, args: string[] = [], exit = 0) => {
	if (existsSync(marker)) rmSync(marker);
	const r = runCli(cwd, ["checks", "slow", ...args], {
		INDUSK_HOME: home,
		MARKER: marker,
		SLOW_EXIT: String(exit),
	});
	return { ...r, ran: existsSync(marker) };
};

describe.skipIf(SHOULD_SKIP)(
	"indusk checks slow — the slow tests run once for the same code",
	() => {
		it("A1: the same code with only a version bump and a changelog entry on top is covered by the green run", () => {
			const green = slow(project);
			expect(green.code, green.stderr).toBe(0);
			expect(green.ran).toBe(true);
			writeFileSync(
				join(project, "package.json"),
				`${JSON.stringify({ name: "p", version: "1.1.0" }, null, 2)}\n`,
			);
			writeFileSync(
				join(project, "CHANGELOG.md"),
				"# Changelog\n\n## [Unreleased]\n\n## [1.1.0]\n\n- a thing\n",
			);
			commit(project, "chore(release): 1.1.0");
			const release = slow(project, ["--unless-covered"]);
			expect(release.code, release.stderr).toBe(0);
			expect(release.ran, "the slow tests ran again").toBe(false);
			expect(release.stdout).toMatch(/covered by the green run at /);
		});

		it("A2: a change to a covered file since the green run runs the slow tests", () => {
			expect(slow(project).ran).toBe(true);
			writeFileSync(join(project, "src", "code.js"), "export const a = 2;\n");
			commit(project, "a code change");
			const release = slow(project, ["--unless-covered"]);
			expect(release.code, release.stderr).toBe(0);
			expect(release.ran).toBe(true);
		});

		it("A3: a run that exits non-zero records nothing", () => {
			const failed = slow(project, [], 1);
			expect(failed.ran).toBe(true);
			expect(failed.code).not.toBe(0);
			const release = slow(project, ["--unless-covered"]);
			expect(release.code, release.stderr).toBe(0);
			expect(release.ran, "a failed run covered the code").toBe(true);
		});

		it("A4: a run over uncommitted changes records nothing, and --unless-covered with them runs the tests", () => {
			writeFileSync(join(project, "src", "code.js"), "export const a = 3;\n");
			const dirty = slow(project);
			expect(dirty.code, dirty.stderr).toBe(0);
			expect(dirty.ran).toBe(true);
			const again = slow(project, ["--unless-covered"]);
			expect(again.ran, "a dirty run covered the code").toBe(true);
			commit(project, "the change, committed");
			const clean = slow(project, ["--unless-covered"]);
			expect(clean.ran, "nothing green covered the committed code").toBe(true);
		});

		it("A5: a green run in a plan's worktree covers the same code on main", () => {
			const worktree = join(base, "proj-plan");
			git(project, ["worktree", "add", "-q", "-b", "plan/x", worktree]);
			expect(slow(worktree).ran).toBe(true);
			const release = slow(project, ["--unless-covered"]);
			expect(release.code, release.stderr).toBe(0);
			expect(release.ran, "the worktree's green run was not found from main").toBe(false);
		});
	},
);
