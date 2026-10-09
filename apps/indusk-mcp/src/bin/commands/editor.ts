import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `indusk editor install` (vscode-extension): put the InDusk extension into
 * VS Code, and into Cursor when its CLI is found. The `.vsix` ships in the
 * package's `editor/`; in the monorepo it is the extension app's build.
 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

export function vsixPath(): string | null {
	for (const candidate of [
		join(packageRoot, "editor", "indusk.vsix"),
		join(packageRoot, "..", "vscode-extension", "dist", "indusk.vsix"),
	]) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

export async function editorInstall(opts: { extensionsDir?: string } = {}): Promise<void> {
	const vsix = vsixPath();
	if (!vsix) {
		console.error(
			"No InDusk extension package found (editor/indusk.vsix). In the dusk repository, build it with `pnpm --filter indusk package`.",
		);
		process.exitCode = 2;
		return;
	}
	const editors = [
		{ name: "VS Code", cli: "code" },
		{ name: "Cursor", cli: "cursor" },
	].filter((e) => spawnSync(e.cli, ["--version"], { stdio: "ignore" }).status === 0);
	if (editors.length === 0) {
		console.error(
			"Neither VS Code's `code` command nor Cursor's `cursor` was found. In VS Code, run “Shell Command: Install 'code' command in PATH” from the Command Palette, then run this again.",
		);
		process.exitCode = 2;
		return;
	}
	let failed = 0;
	for (const e of editors) {
		const args = [
			"--install-extension",
			vsix,
			"--force",
			...(opts.extensionsDir ? ["--extensions-dir", opts.extensionsDir] : []),
		];
		const r = spawnSync(e.cli, args, { encoding: "utf-8" });
		if (r.status === 0) console.info(`Installed the InDusk extension into ${e.name}.`);
		else {
			failed += 1;
			console.error(
				`Installing into ${e.name} failed (exit ${r.status}): ${(r.stderr || r.stdout).trim()}`,
			);
		}
	}
	if (failed > 0) process.exitCode = 1;
	else
		console.info("Open a project that uses InDusk: each promise shows at the line that keeps it.");
}
