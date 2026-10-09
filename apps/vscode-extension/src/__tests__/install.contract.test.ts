import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runTests } from "@vscode/test-electron";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * vscode-extension A16 — system tier: the packaged extension installs into
 * VS Code with one `indusk` command, activates in a project with InDusk, and
 * stays inactive in one without. VS Code is not ours; this is the contract.
 *
 * Skipped by name without VS Code on this machine.
 */

const APP = resolve(__dirname, "..", "..");
const CLI = resolve(APP, "..", "indusk-mcp", "dist", "bin", "cli.js");
const VSCODE = "/Applications/Visual Studio Code.app/Contents/MacOS/Code";
const haveVSCode = existsSync(VSCODE) && spawnSync("code", ["--version"]).status === 0;

describe.skipIf(!haveVSCode)("A16 — install and activation in a real VS Code", () => {
	const extensionsDir = mkdtempSync(join(tmpdir(), "a16-ext-"));
	let install = { status: null as number | null, output: "" };

	beforeAll(() => {
		const r = spawnSync("node", [CLI, "editor", "install", "--extensions-dir", extensionsDir], {
			encoding: "utf-8",
			env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
		});
		install = { status: r.status, output: `${r.stdout}${r.stderr}` };
	});

	it("`indusk editor install` puts the extension into VS Code", () => {
		expect(install.status, install.output).toBe(0);
		const listed = spawnSync("code", ["--list-extensions", "--extensions-dir", extensionsDir], {
			encoding: "utf-8",
		});
		expect(listed.stdout).toContain("infinitedusky.indusk");
	});

	/** Every log line VS Code wrote under a user-data-dir, joined. */
	function logsUnder(dir: string): string {
		const lines: string[] = [];
		const walk = (d: string) => {
			for (const e of readdirSync(d, { withFileTypes: true })) {
				if (e.isDirectory()) walk(join(d, e.name));
				else if (e.name.endsWith(".log")) lines.push(readFileSync(join(d, e.name), "utf-8"));
			}
		};
		if (existsSync(dir)) walk(dir);
		return lines.join("\n");
	}

	async function activeIn(withInDusk: boolean): Promise<{ found: boolean; active: boolean }> {
		const workspace = mkdtempSync(join(tmpdir(), withInDusk ? "a16-indusk-" : "a16-plain-"));
		if (withInDusk) {
			mkdirSync(join(workspace, ".indusk"));
			writeFileSync(join(workspace, ".indusk", "config.json"), "{}\n");
		}
		const installed = readdirSync(extensionsDir).find((d) => d.startsWith("infinitedusky.indusk-"));
		if (!installed) throw new Error(`nothing installed in ${extensionsDir}`);
		const out = join(workspace, "..", `${workspace.split("/").pop()}.json`);
		process.env.A16_OUT = out;
		// A terminal inside VS Code (or Cursor) exports this; it makes the test
		// VS Code start as plain Node and run the workspace path as a script.
		delete process.env.ELECTRON_RUN_AS_NODE;
		const userData = mkdtempSync(join(tmpdir(), "a16-u-"));
		await runTests({
			vscodeExecutablePath: VSCODE,
			extensionDevelopmentPath: join(__dirname, "fixtures", "activation-probe-ext"),
			extensionTestsPath: join(__dirname, "activation-probe.cjs"),
			launchArgs: [
				workspace,
				"--disable-workspace-trust",
				"--extensions-dir",
				extensionsDir,
				// macOS caps a socket path near 103 characters; a worktree path is longer.
				"--user-data-dir",
				userData,
			],
		});
		// A5: ours was loaded as an installed extension, never as a development one.
		expect(logsUnder(userData)).not.toMatch(/Loading development extension.*infinitedusky\.indusk/);
		return JSON.parse(readFileSync(out, "utf-8"));
	}

	it("activates in a project with InDusk", async () => {
		expect(install.status, install.output).toBe(0);
		expect(await activeIn(true)).toEqual({ found: true, active: true });
	});

	it("stays inactive in a project without", async () => {
		expect(install.status, install.output).toBe(0);
		expect(await activeIn(false)).toEqual({ found: true, active: false });
	});
});
