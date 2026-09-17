import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git, REPO_ROOT, runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * hook-cwd-independence — A1–A5.
 *
 * Every hook is registered as `node .claude/hooks/<name>.js`, a path relative
 * to the directory Claude Code runs hooks in, which is the session's current
 * directory. After a Bash call that ends in a subdirectory the file is not
 * found, node exits 1, and the host treats that as non-blocking: the gate is
 * off and nothing says so. Observed on eight checkoffs in workbench-trust-fixes.
 *
 * Every assertion here crosses the boundary the bug lives on — the registered
 * command run through a shell in some cwd with `CLAUDE_PROJECT_DIR` set the
 * way the host sets it, or the built CLI writing a real settings file. A test
 * that imported the command constant would prove the string and nothing about
 * whether a gate fires.
 */

const PACKAGE_HOOKS = join(REPO_ROOT, "apps/indusk-mcp/hooks");
const INIT_TS = join(REPO_ROOT, "apps/indusk-mcp/src/bin/commands/init.ts");
const UPDATE_TS = join(REPO_ROOT, "apps/indusk-mcp/src/bin/commands/update.ts");
const REPO_SETTINGS = join(REPO_ROOT, ".claude/settings.json");

/** The form this plan registers: the host's project-root variable, quoted. */
const ABSOLUTE_COMMAND = /^node "\$\{CLAUDE_PROJECT_DIR:-\.\}"\/\.claude\/hooks\/([\w.-]+\.js)$/;
/** The form every project carried before it. */
const RELATIVE_COMMAND = /^node \.claude\/hooks\/([\w.-]+\.js)$/;

/** The six commands `init` wrote before this fix, verbatim from its `hookConfig`. */
const LEGACY_SETTINGS = {
	hooks: {
		PreToolUse: [
			{
				matcher: "Edit|Write",
				hooks: [
					{ type: "command", command: "node .claude/hooks/check-gates.js" },
					{ type: "command", command: "node .claude/hooks/validate-impl-structure.js" },
					{ type: "command", command: "node .claude/hooks/claude-md-budget.js" },
				],
			},
		],
		PostToolUse: [
			{
				matcher: "Edit|Write",
				hooks: [
					{ type: "command", command: "node .claude/hooks/gate-reminder.js" },
					{ type: "command", command: "node .claude/hooks/workbench-sync.js" },
				],
			},
			{
				matcher: "Bash",
				hooks: [{ type: "command", command: "node .claude/hooks/eval-trigger.js" }],
			},
		],
	},
	permissions: { allow: ["mcp__indusk__list_lessons"] },
};

type HookEntry = { matcher?: string; hooks?: { type?: string; command?: string }[] };
type Settings = { hooks?: Record<string, HookEntry[]>; [k: string]: unknown };

function readSettings(dir: string): Settings {
	return JSON.parse(readFileSync(join(dir, ".claude/settings.json"), "utf-8")) as Settings;
}

/** Every registered command, in document order. */
function hookCommands(settings: Settings): string[] {
	const out: string[] = [];
	for (const entries of Object.values(settings.hooks ?? {})) {
		for (const entry of entries)
			for (const h of entry.hooks ?? []) if (h.command) out.push(h.command);
	}
	return out;
}

let root: string;
let testHome: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "hook-cwd-"));
	testHome = join(root, "indusk-home");
	mkdirSync(testHome);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const ENV = () => ({ INDUSK_HOME: testHome, INDUSK_SKIP_SELF_UPDATE: "1" });

/** A flat project `indusk init` set up — the shape `detect-tooling-honesty.test.ts` uses. */
function initProject(): string {
	const dir = join(root, "fresh");
	mkdirSync(dir);
	writeFileSync(join(dir, "package.json"), '{"name":"fresh","version":"0.0.0"}\n');
	git(dir, ["init", "-q", "-b", "main"]);
	git(dir, ["add", "-A"]);
	git(dir, ["commit", "-qm", "init"]);
	const r = runCli(dir, ["init", "--local", "--no-index"], ENV());
	expect(r.code, `init failed:\n${r.stdout}\n${r.stderr}`).toBe(0);
	return dir;
}

/** A project initialized before this fix: hooks on disk, six relative commands registered. */
function seededProject(extraHook?: { type: string; command: string }): string {
	const dir = join(root, "seeded");
	mkdirSync(join(dir, ".claude/hooks"), { recursive: true });
	mkdirSync(join(dir, ".indusk"), { recursive: true });
	writeFileSync(join(dir, "package.json"), '{"name":"seeded","version":"0.0.0"}\n');
	writeFileSync(join(dir, ".indusk/config.json"), JSON.stringify({ otel: { role: "library" } }));
	cpSync(PACKAGE_HOOKS, join(dir, ".claude/hooks"), { recursive: true });
	const settings = structuredClone(LEGACY_SETTINGS);
	if (extraHook) settings.hooks.PreToolUse[0].hooks.push(extraHook);
	writeFileSync(join(dir, ".claude/settings.json"), `${JSON.stringify(settings, null, 2)}\n`);
	git(dir, ["init", "-q", "-b", "main"]);
	git(dir, ["add", "-A"]);
	git(dir, ["commit", "-qm", "seeded"]);
	return dir;
}

/**
 * An impl whose Phase 2 checkoff Gate B must refuse: T1 passes at Phase 1 and
 * is still `written`. `check-gates` compares the incoming content with the file
 * on disk, so `before` lands there first.
 */
const GATE_B_FRONTMATTER = [
	"---",
	'title: "Demo"',
	"status: in-progress",
	"trajectory: required",
	"gate_policy: auto",
	"---",
	"",
	"# Demo",
	"",
	"## Test Trajectory",
	"",
	"| ID | Asserts | Writable at | Passes at | State |",
	"|----|---------|-------------|-----------|-------|",
	"| T1 | a thing is true | Phase 0 | Phase 1 | written |",
	"",
	"## Checklist",
	"",
	"### Phase 1: Thing",
	"",
	"- [x] do the thing",
	"",
	"#### Phase 1 Verification",
	"- [x] T1 passes",
	"",
	"### Phase 2: Next thing",
	"",
].join("\n");
const GATE_B_BEFORE = `${GATE_B_FRONTMATTER}- [ ] do the next thing\n`;
const GATE_B_AFTER = `${GATE_B_FRONTMATTER}- [x] do the next thing\n`;

/** Run a registered command the way the host does: through a shell, in `cwd`, with the project-root variable set. */
function runRegistered(command: string, projectDir: string, cwd: string, event: unknown) {
	const r = spawnSync("sh", ["-c", command], {
		cwd,
		encoding: "utf-8",
		input: JSON.stringify(event),
		env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
	});
	return { code: r.status ?? -1, stderr: r.stderr ?? "" };
}

describe.skipIf(SHOULD_SKIP)("hook-cwd-independence (CLI boundary)", () => {
	it("A1: the registered check-gates command refuses a Gate B checkoff from a subdirectory exactly as from the root", {
		timeout: 90_000,
	}, () => {
		const dir = initProject();
		const command = hookCommands(readSettings(dir)).find((c) => c.includes("check-gates.js"));
		expect(command, "init registered no check-gates command").toBeDefined();

		const planDir = join(dir, ".indusk/planning/demo");
		mkdirSync(planDir, { recursive: true });
		const implPath = join(planDir, "impl.md");
		writeFileSync(implPath, GATE_B_BEFORE);
		const sub = join(dir, "apps/x");
		mkdirSync(sub, { recursive: true });

		const event = (cwd: string) => ({
			tool_name: "Write",
			tool_input: { file_path: implPath, content: GATE_B_AFTER },
			cwd,
		});
		const fromRoot = runRegistered(command as string, dir, dir, event(dir));
		const fromSub = runRegistered(command as string, dir, sub, event(sub));

		expect(fromRoot.code, `root run:\n${fromRoot.stderr}`).toBe(2);
		expect(fromRoot.stderr).toMatch(/Trajectory blocks phase advance/);
		expect(fromSub.code, `subdirectory run:\n${fromSub.stderr}`).toBe(2);
		expect(fromSub.stderr).toBe(fromRoot.stderr);
	});

	it("A2: init registers every hook by the project-root variable, none relative", {
		timeout: 90_000,
	}, () => {
		const commands = hookCommands(readSettings(initProject()));
		expect(commands.length).toBeGreaterThanOrEqual(6);
		for (const c of commands)
			expect(c, `relative hook command registered: ${c}`).toMatch(ABSOLUTE_COMMAND);
	});

	it("A3: update rewrites the six relative commands and changes nothing else", {
		timeout: 90_000,
	}, () => {
		const dir = seededProject();
		const before = readSettings(dir);
		const r = runCli(dir, ["update"], ENV());
		expect(r.code, `update failed:\n${r.stdout}\n${r.stderr}`).toBe(0);
		const after = readSettings(dir);

		const expected = structuredClone(before);
		let rewritten = 0;
		for (const entries of Object.values(expected.hooks ?? {})) {
			for (const entry of entries) {
				for (const h of entry.hooks ?? []) {
					const m = h.command?.match(RELATIVE_COMMAND);
					if (m) {
						h.command = `node "\${CLAUDE_PROJECT_DIR:-.}"/.claude/hooks/${m[1]}`;
						rewritten++;
					}
				}
			}
		}
		expect(rewritten).toBe(6);
		// trunk-guard (2026-09-17): update also ensures the trunk guard under
		// both PreToolUse matchers — the one addition a modern update makes to a
		// legacy settings file beyond the rewrite.
		const guard = {
			type: "command",
			command: 'node "${CLAUDE_PROJECT_DIR:-.}"/.claude/hooks/trunk-guard.js',
		};
		const pre = expected.hooks?.PreToolUse ?? [];
		pre.find((e) => e.matcher === "Edit|Write")?.hooks?.push(guard);
		pre.push({ matcher: "Bash", hooks: [guard] });
		expect(after).toEqual(expected);
	});

	it("A4: a second update changes zero bytes, and a customized command survives both", {
		timeout: 120_000,
	}, () => {
		const custom = { type: "command", command: "node .claude/hooks/check-gates.js --strict" };
		const dir = seededProject(custom);
		const settingsPath = join(dir, ".claude/settings.json");

		expect(runCli(dir, ["update"], ENV()).code).toBe(0);
		const afterFirst = readFileSync(settingsPath, "utf-8");
		const commands = hookCommands(JSON.parse(afterFirst) as Settings);
		expect(commands).toContain(custom.command);
		// six rewritten + the trunk guard's two registrations
		expect(commands.filter((c) => ABSOLUTE_COMMAND.test(c))).toHaveLength(8);
		expect(commands.filter((c) => RELATIVE_COMMAND.test(c))).toHaveLength(0);

		expect(runCli(dir, ["update"], ENV()).code).toBe(0);
		expect(readFileSync(settingsPath, "utf-8")).toBe(afterFirst);
	});
});

describe("hook-cwd-independence (source)", () => {
	it("A5: init.ts, update.ts and this repository's settings register no relative hook command", () => {
		const offenders: string[] = [];
		for (const file of [INIT_TS, UPDATE_TS]) {
			readFileSync(file, "utf-8")
				.split("\n")
				.forEach((line, i) => {
					if (line.includes("node .claude/hooks/"))
						offenders.push(`${file}:${i + 1}: ${line.trim()}`);
				});
		}
		for (const c of hookCommands(readSettings(REPO_ROOT))) {
			if (RELATIVE_COMMAND.test(c)) offenders.push(`${REPO_SETTINGS}: ${c}`);
		}
		expect(offenders, offenders.join("\n")).toEqual([]);
	});
});

/**
 * Phase 2 falsification — two ways the fix can be wrong that none of A1–A5
 * can see, because every one of them runs with the variable set and starts
 * from a project with no settings file.
 */
describe.skipIf(SHOULD_SKIP)("hook-cwd-independence (falsification)", () => {
	it("A6: with CLAUDE_PROJECT_DIR unset, the registered command from the root still loads and refuses", {
		timeout: 90_000,
	}, () => {
		// A host that does not set the variable must get the old cwd-relative
		// gate, not `node /.claude/hooks/x.js`, which loads from nowhere.
		const dir = initProject();
		const command = hookCommands(readSettings(dir)).find((c) => c.includes("check-gates.js"));
		expect(command).toBeDefined();

		const planDir = join(dir, ".indusk/planning/demo");
		mkdirSync(planDir, { recursive: true });
		const implPath = join(planDir, "impl.md");
		writeFileSync(implPath, GATE_B_BEFORE);
		const event = {
			tool_name: "Write",
			tool_input: { file_path: implPath, content: GATE_B_AFTER },
			cwd: dir,
		};

		const env = { ...process.env };
		delete env.CLAUDE_PROJECT_DIR;
		const r = spawnSync("sh", ["-c", command as string], {
			cwd: dir,
			encoding: "utf-8",
			input: JSON.stringify(event),
			env,
		});
		expect(r.status, `unset-variable run:\n${r.stderr}`).toBe(2);
		expect(r.stderr).toMatch(/Trajectory blocks phase advance/);
	});

	it("A7: init re-run over a project carrying the relative form leaves every registration absolute, once — no duplicates", {
		timeout: 90_000,
	}, () => {
		// init merges by command string; six absolute commands look new next
		// to six relative ones, and the relative ones would then be
		// rewritten by update into six more — every hook running twice.
		const dir = seededProject();
		const r = runCli(dir, ["init", "--local", "--no-index"], ENV());
		expect(r.code, `init failed:\n${r.stdout}\n${r.stderr}`).toBe(0);

		const commands = hookCommands(readSettings(dir));
		expect(commands.filter((c) => RELATIVE_COMMAND.test(c))).toEqual([]);
		// six legacy hooks rewritten + trunk-guard under two matchers = eight, each once
		expect(commands.filter((c) => ABSOLUTE_COMMAND.test(c))).toHaveLength(8);
		expect(commands).toHaveLength(8);
		expect(new Set(commands.map((c) => c)).size, "a command registered twice").toBe(7);
	});
});
