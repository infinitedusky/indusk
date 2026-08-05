import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/**
 * Shared fixtures for the dawn-verify suite.
 *
 * Every assertion in this plan is about a REAL git repository — the whole point
 * of component 6 is reconstructing a phase boundary from committed state, so a
 * mocked git would test nothing. These helpers build throwaway repos with a
 * plan in them and let each test drive the history it needs.
 */

const execFileAsync = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The package's own hooks — the canonical copies, not a project's installed
 * ones. Fixtures get these at `.claude/hooks/` so `resolveGateScripts` finds a
 * real chain and the probe runs the REAL check-gates, never a stand-in.
 */
const packageHooksDir = join(here, "../../../hooks");

export async function git(cwd: string, ...args: string[]): Promise<string> {
	const { stdout } = await execFileAsync("git", args, { cwd });
	return stdout.trim();
}

/** The plan name every fixture uses unless told otherwise. */
export const FIXTURE_PLAN = "demo";

export interface TrajectoryRowSpec {
	id: string;
	asserts: string;
	/** The optional `Test` column — omitted entirely when undefined. */
	test?: string;
	/** A string emits the cell verbatim — how a malformed phase ref is built. */
	writableAt: number | string;
	passesAt: number | string;
	state: string;
}

export interface PhaseSpec {
	n: number;
	name: string;
	/** `[checked, text]` implementation items. */
	items: Array<[boolean, string]>;
	verification?: Array<[boolean, string]>;
	context?: Array<[boolean, string]>;
	document?: Array<[boolean, string]>;
}

export interface ImplSpec {
	rows: TrajectoryRowSpec[];
	phases: PhaseSpec[];
	/** Emit the `Test` column. Off by default so fixtures match legacy plans. */
	withTestColumn?: boolean;
}

function checkbox([checked, text]: [boolean, string]): string {
	return `- [${checked ? "x" : " "}] ${text}`;
}

/** Render a plan impl.md in the exact shape the gate scripts parse. */
export function buildImpl(spec: ImplSpec): string {
	const header = spec.withTestColumn
		? "| ID | Asserts | Test | Writable at | Passes at | State |\n|----|---------|------|-------------|-----------|-------|"
		: "| ID | Asserts | Writable at | Passes at | State |\n|----|---------|-------------|-----------|-------|";

	const phaseCell = (v: number | string) => (typeof v === "number" ? `Phase ${v}` : v);
	const rows = spec.rows.map((r) =>
		spec.withTestColumn
			? `| ${r.id} | ${r.asserts} | ${r.test ?? ""} | ${phaseCell(r.writableAt)} | ${phaseCell(r.passesAt)} | ${r.state} |`
			: `| ${r.id} | ${r.asserts} | ${phaseCell(r.writableAt)} | ${phaseCell(r.passesAt)} | ${r.state} |`,
	);

	const phases = spec.phases.map((p) => {
		const blocks = [`### Phase ${p.n}: ${p.name}`, "", ...p.items.map(checkbox), ""];
		for (const [gate, items] of [
			["Verification", p.verification],
			["Context", p.context],
			["Document", p.document],
		] as const) {
			blocks.push(
				`#### Phase ${p.n} ${gate}`,
				"",
				...(items ?? [[true, "(none needed)"] as [boolean, string]]).map(checkbox),
				"",
			);
		}
		return blocks.join("\n");
	});

	return [
		"---",
		'title: "Demo fixture — Implementation"',
		"date: 2026-08-05",
		"status: in-progress",
		"trajectory: required",
		// `auto` so bare opt-outs are legal without conversation proof; these
		// fixtures run headless, exactly like the guinea-pig plan.
		"gate_policy: auto",
		"---",
		"",
		"# Demo fixture",
		"",
		"## Test Trajectory",
		"",
		header,
		...rows,
		"",
		"### Trajectory Rationale",
		"",
		...spec.rows
			.filter((r) => typeof r.writableAt === "number" && r.writableAt >= 1)
			.map((r) => `- **${r.id}** \`Writable at: Phase ${r.writableAt}\` — fixture row.`),
		"",
		"## Checklist",
		"",
		...phases,
	].join("\n");
}

export interface FixtureOptions {
	plan?: string;
	impl: string;
	/** Extra files, keyed by repo-relative path. */
	files?: Record<string, string>;
	/** Contents of `.indusk/config.json`. */
	config?: unknown;
}

/** Build a throwaway git repo with a plan in it, committed as the baseline. */
export async function makeVerifyFixture(options: FixtureOptions): Promise<{
	root: string;
	plan: string;
	implPath: string;
	baselineSha: string;
}> {
	const root = await mkdtemp(join(tmpdir(), "dawn-verify-"));
	const plan = options.plan ?? FIXTURE_PLAN;
	const implRel = join(".indusk", "planning", plan, "impl.md");

	await writeFixtureFile(root, implRel, options.impl);
	await writeFixtureFile(
		root,
		join(".indusk", "config.json"),
		JSON.stringify(options.config ?? { verify: { testCommand: "node" } }, null, 2),
	);
	for (const [path, content] of Object.entries(options.files ?? {})) {
		await writeFixtureFile(root, path, content);
	}

	// A real consumer project carries the gate scripts; a fixture without them
	// would make the probe silently unavailable rather than genuinely exercised.
	await cp(packageHooksDir, join(root, ".claude", "hooks"), { recursive: true });

	await git(root, "init", "--initial-branch=main");
	await git(root, "config", "user.email", "dawn@test.local");
	await git(root, "config", "user.name", "Dawn Test");
	await git(root, "add", "-A");
	await git(root, "commit", "-m", "fixture baseline");

	return {
		root,
		plan,
		implPath: join(root, implRel),
		baselineSha: await git(root, "rev-parse", "HEAD"),
	};
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

/** Commit everything currently in the tree. */
export async function commitAll(root: string, message: string): Promise<string> {
	await git(root, "add", "-A");
	await git(root, "commit", "-m", message);
	return git(root, "rev-parse", "HEAD");
}

/**
 * A content hash of every file in the repo except `.git` — the instrument for
 * "verify changed nothing". Compares content, not just git's view, so a write
 * that git happens to ignore is still caught.
 */
export async function treeSnapshot(root: string): Promise<string> {
	const entries: string[] = [];
	async function walk(dir: string): Promise<void> {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			if (entry.name === ".git") continue;
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
				continue;
			}
			const content = await readFile(full);
			entries.push(`${relative(root, full)}:${createHash("sha256").update(content).digest("hex")}`);
		}
	}
	await walk(root);
	entries.sort();
	return entries.join("\n");
}

/** A node test script that exits 0 (green) or 1 (red) — runner-agnostic by design. */
export function nodeTestScript(passes: boolean): string {
	return passes
		? "process.exit(0);\n"
		: 'console.error("fixture assertion failed");\nprocess.exit(1);\n';
}
