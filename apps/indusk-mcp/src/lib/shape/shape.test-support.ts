import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach } from "vitest";
import { recordPhaseStart } from "./boundary.js";

/**
 * Fixtures for the Shape suite.
 *
 * Shape's input is "what did this phase change", which is a git question — so
 * these build real throwaway repos rather than mocking git. Same conclusion the
 * verify suite reached for the same reason.
 */

const execFileAsync = promisify(execFile);

export async function git(cwd: string, ...args: string[]): Promise<string> {
	const { stdout } = await execFileAsync("git", args, { cwd });
	return stdout.trim();
}

export async function writeFixtureFile(
	root: string,
	relPath: string,
	content: string,
): Promise<void> {
	const full = join(root, relPath);
	await mkdir(dirname(full), { recursive: true });
	await writeFile(full, content, "utf8");
}

/**
 * Register a self-cleaning set of throwaway roots for the calling suite.
 *
 * Every shape test file needs the same two things — somewhere to put repos, and
 * an afterEach that removes them — and five copies of that block is five places
 * for a leak to hide. Call once at module scope:
 *
 *     const roots = trackedRoots();
 *     roots.push(await makeRepo());
 */
export function trackedRoots(): string[] {
	const roots: string[] = [];
	afterEach(async () => {
		await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
	});
	return roots;
}

/** A throwaway repo with phase N of `plan` already opened at HEAD. */
export async function repoWithPhaseOpen(
	phase: number,
	plan = "demo",
	at = "2026-08-09T00:00:00.000Z",
): Promise<string> {
	const root = await makeRepo();
	await recordPhaseStart(root, {
		plan,
		phase,
		sha: await git(root, "rev-parse", "HEAD"),
		at,
	});
	return root;
}

/** A throwaway git repo with an initial commit. */
export async function makeRepo(prefix = "shape"): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), `${prefix}-`));
	await writeFixtureFile(root, "README.md", "# fixture\n");
	await git(root, "init", "--initial-branch=main");
	await git(root, "config", "user.email", "shape@test.local");
	await git(root, "config", "user.name", "Shape Test");
	await git(root, "add", "-A");
	await git(root, "commit", "-m", "baseline");
	return root;
}

export async function commitAll(root: string, message: string): Promise<string> {
	await git(root, "add", "-A");
	await git(root, "commit", "-m", message);
	return git(root, "rev-parse", "HEAD");
}

/** Mark an extension enabled the way `.indusk/extensions/` records it. */
export async function enableExtension(root: string, name: string): Promise<void> {
	await writeFixtureFile(
		root,
		join(".indusk", "extensions", name, "manifest.json"),
		JSON.stringify({ name, provides: { skill: true } }, null, 2),
	);
}

/** A package-side extension with a skill the rule collector can read. */
export async function packageExtension(
	packageRoot: string,
	name: string,
	skill: string,
): Promise<void> {
	await writeFixtureFile(packageRoot, join("extensions", name, "skill.md"), skill);
}

/** A minimal impl.md whose Phase N gates are in a known state. */
export function implWithPhase(options: {
	phase: number;
	items: Array<[boolean, string]>;
	verification: Array<[boolean, string]>;
}): string {
	const box = ([checked, text]: [boolean, string]) => `- [${checked ? "x" : " "}] ${text}`;
	return [
		"---",
		'title: "Fixture"',
		"status: in-progress",
		"trajectory: required",
		"gate_policy: auto",
		"---",
		"",
		"# Fixture",
		"",
		"## Checklist",
		"",
		`### Phase ${options.phase}: Fixture phase`,
		"",
		...options.items.map(box),
		"",
		`#### Phase ${options.phase} Verification`,
		"",
		...options.verification.map(box),
		"",
		`#### Phase ${options.phase} Context`,
		"",
		"- [x] (none needed)",
		"",
		`#### Phase ${options.phase} Document`,
		"",
		"- [x] (none needed)",
		"",
	].join("\n");
}
