// clause: a-new-project-reports-from-its-first-run/the-scaffold-sits-where-the-app-runs
//
// a-new-project-starts-instrumented, Test Phase 1: T1, T2 - where `indusk init` and
// `indusk update` write the OpenTelemetry scaffold in a workbench. The app runs in the
// declared code repo, so the instrumentation belongs there, never at the workbench root;
// a repo with no app yet is named, and `update` scaffolds it once one appears.
//
// Run through the built CLI on a workbench made the way init-workbench.test.ts makes one
// (declared repo, `--workbench --wrapped-repo --sibling-parent`). No daemon is started.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

const REPO = "homework-gate";
/** Every file the scaffold writes, by name; none may sit at a workbench root. */
const SCAFFOLD_FILES = [
	"instrumentation.ts",
	"src/instrumentation.ts",
	"instrumentation.py",
	"logger.ts",
	"src/logger.ts",
	"filtering-exporter.ts",
	"src/filtering-exporter.ts",
];

interface Bench {
	root: string;
	repo: string;
	workbench: string;
	env: Record<string, string>;
}

const made: string[] = [];
afterEach(() => {
	for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A code repo (a git repository with `files` committed) beside an empty workbench. */
function bench(files: Record<string, string>): Bench {
	const root = mkdtempSync(join(tmpdir(), "init-scaffold-placement-"));
	made.push(root);
	const repo = join(root, REPO);
	const workbench = join(root, `${REPO}-workbench`);
	mkdirSync(repo, { recursive: true });
	mkdirSync(workbench, { recursive: true });
	git(repo, ["init", "-q", "-b", "main"]);
	for (const [rel, content] of Object.entries(files)) {
		mkdirSync(join(repo, rel, ".."), { recursive: true });
		writeFileSync(join(repo, rel), content);
	}
	git(repo, ["add", "-A"]);
	git(repo, ["commit", "-q", "-m", "initial"]);
	writeFileSync(
		join(workbench, "package.json"),
		JSON.stringify({ name: `${REPO}-workbench`, version: "0.0.0", private: true }),
	);
	return {
		root,
		repo,
		workbench,
		env: { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1", INDUSK_HOME: join(root, "home") },
	};
}

function initWorkbench(b: Bench) {
	return runCli(
		b.workbench,
		["init", "--workbench", "--wrapped-repo", REPO, "--sibling-parent", b.root, "--no-index"],
		b.env,
	);
}

const scaffoldAt = (dir: string) => SCAFFOLD_FILES.filter((f) => existsSync(join(dir, f)));

describe.skipIf(SHOULD_SKIP)("init-scaffold-placement", () => {
	it("T1: init writes the Next.js instrumentation into the declared code repo, and none at the workbench root", () => {
		const b = bench({
			"README.md": "# app\n",
			"package.json": JSON.stringify({ name: REPO, dependencies: { next: "16.0.0" } }),
			"next.config.js": "module.exports = {};\n",
		});
		const r = initWorkbench(b);
		expect(r.code, `init exit\n${r.stderr}`).toBe(0);

		const instrumentation = join(b.repo, "instrumentation.ts");
		expect(existsSync(instrumentation), "the Next.js instrumentation is in the code repo").toBe(
			true,
		);
		expect(readFileSync(instrumentation, "utf-8")).toContain("@vercel/otel");
		expect(scaffoldAt(b.workbench), "the workbench root holds scaffold files").toEqual([]);
	});

	it("T2: a code repo with no app yet is named and left alone; update scaffolds it once a package file appears", () => {
		const b = bench({ "README.md": "# nothing here yet\n" });
		const r = initWorkbench(b);
		expect(r.code, `init exit\n${r.stderr}`).toBe(0);

		const lines = r.stdout.split("\n");
		const told = lines.find((l) => /no app yet/i.test(l));
		expect(told, "init says the repo has no app yet").toBeDefined();
		expect(told, "the line names the repo").toContain(REPO);
		expect(scaffoldAt(b.repo), "nothing is written into the empty repo").toEqual([]);
		expect(scaffoldAt(b.workbench), "nothing is written at the workbench root").toEqual([]);

		// An app appears in the repo: a package file and a source folder.
		writeFileSync(join(b.repo, "package.json"), JSON.stringify({ name: REPO, version: "0.0.0" }));
		mkdirSync(join(b.repo, "src"), { recursive: true });
		writeFileSync(join(b.repo, "src", "index.ts"), "export {};\n");

		const u = runCli(b.workbench, ["update"], b.env);
		expect(u.code, `update exit\n${u.stderr}`).toBe(0);
		expect(existsSync(join(b.repo, "src", "instrumentation.ts")), "update scaffolds the repo").toBe(
			true,
		);
		expect(scaffoldAt(b.workbench), "still nothing at the workbench root").toEqual([]);
	});

	// Build Phase 4, T25: Next.js loads `instrumentation.ts` from the folder that holds
	// `app/` or `pages/`, so a project made with `--src-dir` needs it in `src/`.
	it.each(["src/app/page.tsx", "src/pages/index.tsx"])(
		"T25: a Next.js app with %s gets its setup file in src/, importing its settings from beside it",
		(page) => {
			const b = bench({
				"package.json": JSON.stringify({ name: REPO, dependencies: { next: "16.0.0" } }),
				"next.config.js": "module.exports = {};\n",
				[page]: "export default function Page() { return null; }\n",
			});
			const r = initWorkbench(b);
			expect(r.code, `init exit\n${r.stderr}`).toBe(0);

			const inSrc = join(b.repo, "src", "instrumentation.ts");
			expect(existsSync(inSrc), "the setup file is in src/, where Next.js looks").toBe(true);
			expect(existsSync(join(b.repo, "instrumentation.ts")), "none at the root").toBe(false);
			const text = readFileSync(inSrc, "utf-8");
			expect(text).toMatch(/from "\.\/telemetry-settings"/);
			expect(
				existsSync(join(b.repo, "src", "telemetry-settings.ts")),
				"the settings sit beside it",
			).toBe(true);
		},
	);

	it("T25: a Next.js app without src/app or src/pages keeps the setup file at the root", () => {
		const b = bench({
			"package.json": JSON.stringify({ name: REPO, dependencies: { next: "16.0.0" } }),
			"next.config.js": "module.exports = {};\n",
			"app/page.tsx": "export default function Page() { return null; }\n",
		});
		const r = initWorkbench(b);
		expect(r.code, `init exit\n${r.stderr}`).toBe(0);
		expect(existsSync(join(b.repo, "instrumentation.ts"))).toBe(true);
		expect(existsSync(join(b.repo, "src", "instrumentation.ts"))).toBe(false);
		expect(readFileSync(join(b.repo, "instrumentation.ts"), "utf-8")).toMatch(
			/from "\.\/src\/telemetry-settings"/,
		);
	});
});
