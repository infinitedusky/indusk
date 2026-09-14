import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * worktree-config-schema-pointer — A1–A4.
 *
 * The worktree extension materializes `.indusk/worktree-configs/<repo>.json`
 * from a template whose `$schema` said `../../config.schema.json`. From the
 * config's directory that names `<workbench>/config.schema.json`, a file no
 * project has: enabling an extension copies only its manifest into the
 * project, so the schema never left the package. Editors lost validation and
 * nothing else noticed — the validator loads the schema from the package and
 * never reads the pointer.
 *
 * Every test here reaches the hook over the process boundary: the real
 * `on_enable.sh`, run through the real CLI, on a workbench fixture. The fix
 * ships the schema beside the configs and points the template at it.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const PACKAGE_SCHEMA = join(REPO_ROOT, "apps/indusk-mcp/extensions/worktree/config.schema.json");
const TEMPLATE = join(
	REPO_ROOT,
	"apps/indusk-mcp/extensions/worktree/templates/worktree-config.template.json",
);
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let root: string;
let cloneDir: string;
let workbenchDir: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "wt-schema-pointer-"));
	cloneDir = join(root, "demo");
	workbenchDir = join(root, "demo-workbench");
	mkdirSync(cloneDir, { recursive: true });
	mkdirSync(workbenchDir, { recursive: true });

	const gitOpts = { cwd: cloneDir, stdio: "ignore" as const };
	spawnSync("git", ["init", "-q", "-b", "main"], gitOpts);
	writeFileSync(join(cloneDir, "README.md"), "# demo\n");
	writeFileSync(
		join(cloneDir, "package.json"),
		JSON.stringify({ name: "demo", version: "0.0.0" }, null, 2),
	);
	spawnSync("git", ["add", "-A"], gitOpts);
	spawnSync(
		"git",
		["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "initial"],
		gitOpts,
	);

	// The on_enable hook merges pnpm scripts into the workbench package.json.
	writeFileSync(
		join(workbenchDir, "package.json"),
		JSON.stringify({ name: "demo-workbench", version: "0.0.0", private: true }, null, 2),
	);
});

afterEach(() => {
	if (existsSync(root)) rmSync(root, { recursive: true, force: true });
});

function runCli(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1", INDUSK_BIN: `node ${CLI_BIN}` },
		timeout: 60_000,
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/** First enable goes through `init --workbench`, which enables the worktree extension. */
function initWorkbench(): void {
	const r = runCli(workbenchDir, [
		"init",
		"--workbench",
		"--wrapped-repo",
		"demo",
		"--sibling-parent",
		root,
		"--no-index",
	]);
	expect(r.code, `init failed:\n${r.stderr}`).toBe(0);
}

/**
 * A later enable cannot go through `extensions enable` (it short-circuits on
 * "already enabled"), so it runs the hook the way the manifest does:
 * `indusk worktree _on-enable`, cwd at the workbench.
 */
function reEnable(): void {
	const r = runCli(workbenchDir, ["worktree", "_on-enable"]);
	expect(r.code, `_on-enable failed:\n${r.stderr}`).toBe(0);
}

const configPath = () => join(workbenchDir, ".indusk", "worktree-configs", "demo.json");
const siblingSchema = () => join(workbenchDir, ".indusk", "worktree-configs", "config.schema.json");

describe.skipIf(SHOULD_SKIP)("worktree-config-schema-pointer", () => {
	it("A1: the starter config's $schema resolves to a file that exists", { timeout: 90_000 }, () => {
		initWorkbench();
		const cfg = JSON.parse(readFileSync(configPath(), "utf-8")) as { $schema?: string };
		expect(typeof cfg.$schema).toBe("string");
		const resolved = resolve(dirname(configPath()), cfg.$schema as string);
		expect(existsSync(resolved), `$schema "${cfg.$schema}" resolves to ${resolved}`).toBe(true);
	});

	it("A2: the schema beside the configs matches the package's and is refreshed on re-enable", {
		timeout: 90_000,
	}, () => {
		initWorkbench();
		expect(existsSync(siblingSchema()), "no schema beside the configs after enable").toBe(true);
		expect(readFileSync(siblingSchema(), "utf-8")).toBe(readFileSync(PACKAGE_SCHEMA, "utf-8"));

		// A stale or damaged sibling is replaced by the package's copy on the next enable.
		writeFileSync(siblingSchema(), '{"stale": true}\n');
		reEnable();
		expect(readFileSync(siblingSchema(), "utf-8")).toBe(readFileSync(PACKAGE_SCHEMA, "utf-8"));
	});

	it("A3: a pre-existing config is left untouched while its sibling schema is written", {
		timeout: 90_000,
	}, () => {
		const seeded = '{"trunk_branch":"keep-me"}\n';
		mkdirSync(dirname(configPath()), { recursive: true });
		writeFileSync(configPath(), seeded);
		initWorkbench();
		expect(readFileSync(configPath(), "utf-8")).toBe(seeded);
		expect(existsSync(siblingSchema()), "schema not written beside a pre-existing config").toBe(
			true,
		);
	});

	it("A4: the shipped template's $schema does not climb out of the configs folder", () => {
		const template = JSON.parse(readFileSync(TEMPLATE, "utf-8")) as { $schema?: string };
		expect(template.$schema).toBeDefined();
		expect(template.$schema).not.toMatch(/\.\.\//);
	});
});
