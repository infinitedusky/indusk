import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { git, type RunResult, runCli } from "./cli.js";
import { implText } from "./plan-fixture.js";
import {
	behaviourPromise,
	codeFilesFor,
	type PromiseProject,
	type PromiseProjectOptions,
	promiseProject,
} from "./promises-fixture.js";

/**
 * A project that declares `workflow.steps.release` in the ADR D2 shape
 * (release-records-its-failures, Test Phase 1), for tests that run
 * `indusk release` over the CLI boundary.
 *
 * The release command, the slow command and the rerun command are small
 * `sh` scripts committed in the project. They do four things and nothing
 * else, and each is observable from outside:
 *
 *  - append one word to `order.log` (`release`, `slow`, `rerun <files>`), so
 *    a test reads the order the runner ran them in;
 *  - copy prepared JUnit XML to the report path(s) the project declares;
 *  - print a decoy failure line, so a test can tell a runner that reads the
 *    report from one that reads what the command printed;
 *  - exit as told.
 *
 * Everything the scripts need arrives in `$FIXTURE_DIR`, a folder outside the
 * repository, so running them never dirties the tree the green-run key reads.
 * `order.log` and the artifact live there for the same reason.
 *
 * The record the runner appends is read from the project's home under the
 * pinned `INDUSK_HOME`, found by asking the CLI (`indusk eval home`), never
 * by rebuilding the path.
 */

/** Passing files a default report carries, so one failing file is never "more than half". */
export const PASSING_FILES = ["src/ok-one.test.ts", "src/ok-two.test.ts", "src/ok-three.test.ts"];

/** The default report path a project declares. */
export const REPORT_PATH = "test-results/system.junit.xml";

/**
 * A JUnit report in the shape vitest's `junit` reporter writes: one
 * `<testsuite name="<file>">` per test file, each `<testcase classname="<file>">`
 * and a `<failure>` child for a failed case.
 */
export function junitReport(
	failing: Record<string, string[]>,
	passing: string[] = PASSING_FILES,
): string {
	const suite = (file: string, failed: string[], passed: string[]): string => {
		const cases = [
			...failed.map(
				(name) =>
					`        <testcase classname="${file}" name="${name}" time="0.002">\n            <failure message="expected 1 to be 2" type="AssertionError">AssertionError: expected 1 to be 2</failure>\n        </testcase>`,
			),
			...passed.map(
				(name) =>
					`        <testcase classname="${file}" name="${name}" time="0.001">\n        </testcase>`,
			),
		];
		return `    <testsuite name="${file}" timestamp="2026-10-10T04:00:00.000Z" hostname="fixture" tests="${failed.length + passed.length}" failures="${failed.length}" errors="0" skipped="0" time="0.01">\n${cases.join("\n")}\n    </testsuite>`;
	};
	const suites = [
		...Object.entries(failing).map(([file, names]) => suite(file, names, ["a passing case"])),
		...passing.map((file) => suite(file, [], ["holds"])),
	];
	const failed = Object.values(failing).reduce((n, names) => n + names.length, 0);
	return `<?xml version="1.0" encoding="UTF-8" ?>\n<testsuites name="vitest tests" tests="${failed + suites.length}" failures="${failed}" errors="0" time="0.05">\n${suites.join("\n")}\n</testsuites>\n`;
}

export interface SlowSpec {
	/** Default `after`. */
	when?: "before" | "after";
	/** The slow command's exit code; default 0. */
	exit?: number;
	/**
	 * Reports the slow command writes: path relative to the project root →
	 * JUnit XML (or any text, for the unreadable case). Default: none written.
	 */
	reports?: Record<string, string>;
	/** The `report` glob declared; default `REPORT_PATH`. */
	report?: string;
	/** Declare a `rerun` command; what it writes and how it exits. */
	rerun?: { exit?: number; reports?: Record<string, string> };
}

export interface ReleaseProjectOptions extends Omit<PromiseProjectOptions, "extraConfig" | "git"> {
	/** `false` declares no `release.command`; otherwise the release command's exit, default 0. */
	command?: false | { exit?: number };
	/** `false` declares no `slow_tests`. Default: slow tests `after`, green, no report. */
	slow?: false | SlowSpec;
	doneWhen?: "published" | "green";
	/** The version in `package.json`; default `1.4.0`. */
	version?: string;
}

/** One line of `releases.jsonl`: the contract Build Phase 1 onward writes. */
export interface ReleaseRecord {
	version: string;
	commit: string;
	at: string;
	published: boolean;
	done: boolean;
	/** `green`, `red`, `skipped` (a green run covered the tree) or `not run`. */
	slow: string;
	/** Each failing file and where it was routed: `incident <id>` or `plan <name>`. */
	failed: Array<{ file: string; routed: string }>;
	flakes: string[];
	/** Present only when more than half the report's files failed. */
	environment?: { failed: number; total: number };
	/** Present only when routing the failures threw: why nothing was routed. */
	routing?: string;
}

export interface ReleaseProject extends PromiseProject {
	/** The folder outside the repository the scripts read and write. */
	dir: string;
	/** `run` an `indusk` command in the project with the fixture's env. */
	run(args: string[]): RunResult;
	/** `indusk release`. */
	release(): RunResult;
	/** `indusk checks slow`: records a green run at the current commit; throws if it is not green. */
	recordGreenRun(): void;
	/** Change what the slow command writes and how it exits, for a later release. */
	setSlow(slow: Pick<SlowSpec, "exit" | "reports" | "rerun">): void;
	/** What the scripts logged, one entry per line. */
	orderLog(): string[];
	/** The release record's lines; empty when none was written. */
	records(): ReleaseRecord[];
	/** The incident files under `.indusk/promises/incidents/`, by file name. */
	incidentFiles(): string[];
	incident(file: string): string;
	/** Local branch names. */
	branches(): string[];
	/** The worktree a branch is checked out in, or null. */
	worktreeOf(branch: string): string | null;
	/** Commit a file; returns the short sha. */
	commit(path: string, content: string, message: string): string;
	/** Commit a version bump in `package.json`. */
	bump(version: string): void;
	cleanup(): void;
}

const RELEASE_SH = `echo release >> "$FIXTURE_DIR/order.log"
echo built > "$FIXTURE_DIR/artifact.txt"
exit "$(cat "$FIXTURE_DIR/release.exit")"
`;

const copyReports = (list: string) =>
	`while read -r dest src; do mkdir -p "$(dirname "$dest")"; cp "$FIXTURE_DIR/$src" "$dest"; done < "$FIXTURE_DIR/${list}"\n`;

const SLOW_SH = `echo slow >> "$FIXTURE_DIR/order.log"
echo "FAIL src/decoy.test.ts > printed by the runner, never reported"
${copyReports("slow-reports.txt")}exit "$(cat "$FIXTURE_DIR/slow.exit")"
`;

const RERUN_SH = `echo "rerun $*" >> "$FIXTURE_DIR/order.log"
${copyReports("rerun-reports.txt")}exit "$(cat "$FIXTURE_DIR/rerun.exit")"
`;

function writeReports(dir: string, list: string, xmlDir: string, reports: Record<string, string>) {
	mkdirSync(join(dir, xmlDir), { recursive: true });
	const lines = Object.entries(reports).map(([dest, xml], i) => {
		const src = `${xmlDir}/${i}.xml`;
		writeFileSync(join(dir, src), xml);
		return `${dest} ${src}`;
	});
	writeFileSync(join(dir, list), `${lines.join("\n")}${lines.length ? "\n" : ""}`);
}

function writeSlow(dir: string, slow: Pick<SlowSpec, "exit" | "reports" | "rerun">): void {
	writeFileSync(join(dir, "slow.exit"), `${slow.exit ?? 0}\n`);
	writeReports(dir, "slow-reports.txt", "slow-xml", slow.reports ?? {});
	writeFileSync(join(dir, "rerun.exit"), `${slow.rerun?.exit ?? 0}\n`);
	writeReports(dir, "rerun-reports.txt", "rerun-xml", slow.rerun?.reports ?? {});
}

/** `workflow.steps.release` as the options say, in the ADR D2 shape. */
function declaredRelease(opts: ReleaseProjectOptions): Record<string, unknown> {
	const slow = opts.slow === undefined ? {} : opts.slow;
	const release: Record<string, unknown> = {
		version_file: "package.json",
		changelog: "CHANGELOG.md",
		covers: ["src"],
	};
	if (opts.command !== false) release.command = "sh release.sh";
	if (slow !== false) {
		release.slow_tests = {
			command: "sh slow.sh",
			report: slow.report ?? REPORT_PATH,
			when: slow.when ?? "after",
			...(slow.rerun ? { rerun: "sh rerun.sh {files}" } : {}),
		};
	}
	if (opts.doneWhen) release.done_when = opts.doneWhen;
	return release;
}

export function releaseProject(opts: ReleaseProjectOptions = {}): ReleaseProject {
	const dir = mkdtempSync(join(tmpdir(), "release-fixture-"));
	const homeBase = mkdtempSync(join(tmpdir(), "release-home-"));
	const version = opts.version ?? "1.4.0";
	const slow = opts.slow === undefined ? {} : opts.slow;

	writeFileSync(
		join(dir, "release.exit"),
		`${opts.command === false ? 0 : (opts.command?.exit ?? 0)}\n`,
	);
	writeSlow(dir, slow === false ? {} : slow);

	const release = declaredRelease(opts);

	const { command: _c, slow: _s, doneWhen: _d, version: _v, files, ...rest } = opts;
	const project = promiseProject({
		...rest,
		files: {
			"package.json": `${JSON.stringify({ name: "fixture", version }, null, 2)}\n`,
			"CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n",
			".gitignore": "test-results/\n",
			"src/app.ts": "export const app = 1;\n",
			"release.sh": RELEASE_SH,
			"slow.sh": SLOW_SH,
			"rerun.sh": RERUN_SH,
			...files,
		},
		extraConfig: { workflow: { steps: { land: { slow_tests: "true" }, release } } },
	});

	const env = { INDUSK_HOME: homeBase, FIXTURE_DIR: dir };
	const run = (args: string[]) => runCli(project.root, args, env);
	const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf-8") : "");
	const incidentsDir = join(project.planRoot, ".indusk", "promises", "incidents");

	const self: ReleaseProject = {
		...project,
		dir,
		run,
		release: () => run(["release"]),
		recordGreenRun() {
			const r = run(["checks", "slow"]);
			if (r.code !== 0)
				throw new Error(`fixture: checks slow was not green: ${r.stdout}${r.stderr}`);
		},
		setSlow: (next) => writeSlow(dir, next),
		orderLog: () => read(join(dir, "order.log")).split("\n").filter(Boolean),
		records() {
			const home = run(["eval", "home"]).stdout.trim();
			if (!home) return [];
			return read(join(home, "releases.jsonl"))
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line) as ReleaseRecord);
		},
		incidentFiles: () => (existsSync(incidentsDir) ? readdirSync(incidentsDir).sort() : []),
		incident: (file) => read(join(incidentsDir, file)),
		branches: () =>
			git(project.root, ["branch", "--format=%(refname:short)"]).stdout.split("\n").filter(Boolean),
		worktreeOf(branch) {
			const blocks = git(project.root, ["worktree", "list", "--porcelain"]).stdout.split("\n\n");
			for (const block of blocks) {
				if (block.includes(`branch refs/heads/${branch}`)) {
					return /^worktree (.+)$/m.exec(block)?.[1] ?? null;
				}
			}
			return null;
		},
		commit(path, content, message) {
			const full = join(project.root, path);
			mkdirSync(dirname(full), { recursive: true });
			writeFileSync(full, content);
			git(project.root, ["add", path]);
			const c = git(project.root, ["commit", "-q", "-m", message]);
			if (c.code !== 0) throw new Error(`fixture: commit failed: ${c.stderr}`);
			return git(project.root, ["rev-parse", "--short", "HEAD"]).stdout.trim();
		},
		bump(next) {
			self.commit(
				"package.json",
				`${JSON.stringify({ name: "fixture", version: next }, null, 2)}\n`,
				`chore(release): ${next}`,
			);
		},
		cleanup() {
			for (const p of [project.root, `${project.root}-worktrees`, dir, homeBase]) {
				rmSync(p, { recursive: true, force: true });
			}
		},
	};
	return self;
}

/** The incident id a file name stands for. */
export const incidentId = (file: string): string => file.replace(/\.md$/, "");

/** The promise a row names, its owner (an archived plan), and the files the routing tests fail. */
export const PROMISE = "seat-released";
export const OWNER = "seat-holds";
/** The promise's own test, named by row R1, whose `For` names the promise. */
export const CLAIMED_FILE = "src/seat-released.test.ts";
/** Named by row R2, whose `For` names no promise. */
export const GUARD_FILE = "src/seat-guard.test.ts";
/** Named by no row at all. */
export const ORPHAN_FILE = "src/orphan-flow.test.ts";

/**
 * A release project whose archived owner plan has two rows: R1 proves a
 * promise through `CLAIMED_FILE`, R2 names `GUARD_FILE` and no promise.
 * `ORPHAN_FILE` is named by nothing. The three routing cases of the ADR, one
 * project; the tests choose which file the slow run fails.
 */
export function routingProject(opts: ReleaseProjectOptions = {}): ReleaseProject {
	return releaseProject({
		domains: ["seating"],
		archivedPlans: [OWNER],
		planFiles: {
			[`archive/${OWNER}/impl.md`]: implText(OWNER, {
				status: "completed",
				columns: ["Level", "For", "Test"],
				rows: [
					{
						id: "R1",
						cells: { Level: "unit", For: `promise: ${PROMISE}`, Test: CLAIMED_FILE },
					},
					{
						id: "R2",
						cells: { Level: "unit", For: "a regression guard", Test: GUARD_FILE },
					},
				],
			}),
		},
		promises: [behaviourPromise(PROMISE, { owner: OWNER, domain: "seating" })],
		...opts,
		files: {
			...codeFilesFor(PROMISE),
			[GUARD_FILE]: 'export const guard = "no promise token here";\n',
			[ORPHAN_FILE]: 'export const orphan = "named by no row";\n',
			...opts.files,
		},
	});
}
