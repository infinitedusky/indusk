import type { GreenRun } from "../checks/record.js";
import type { WorkflowSteps } from "../config.js";

/**
 * `indusk release` as a function of its inputs (release-records-its-failures
 * D1, D3): the declared release, run in the declared order. The commands, the
 * clock, the code key and the green-run record arrive as `deps`, so the order
 * and the outcome rules are unit-testable without a process, a git tree or a
 * home directory.
 *
 * Order: slow tests if `when: before` (a red run stops here), the release
 * `command` (a failure stops here: no slow tests after it), slow tests if
 * `when: after`. A slow run a fully green run already covered is skipped.
 * Outcome: `done_when: published` is done once the command succeeds;
 * `done_when: green` only when the slow run is green (or was covered).
 *
 * Commands are what the project declares, run as written from the project
 * root — never a path of dusk's own.
 *
 * promise: a-release-runs-as-its-project-declares
 * promise: slow-checks-run-once-per-tree
 * promise: landing-and-release-name-the-projects-commands
 */
export interface ReleaseDeps {
	steps: WorkflowSteps;
	/** Run a shell command from the project root; the exit code. */
	exec(command: string): { code: number };
	now(): Date;
	/** The key of the code the slow tests cover now, or `null` when there is no honest key. */
	codeKey(): string | null;
	/** The latest fully green run that covered `key`. */
	coveringRun(key: string): GreenRun | null;
	/** Record a fully green slow run, as `indusk checks slow` would. */
	recordGreen(run: { key: string; at: string; command: string }): void;
	/**
	 * The seam where a red slow run's failures are read, rerun and routed
	 * (Build Phases 2–4). Absent: no failure is read, and a red run records
	 * `failed: []`.
	 */
	settleFailures?(slow: SlowRun): SettledFailures;
}

/** One failing file and where it was routed: `incident <id>` or `plan <name>`. */
export interface FailedFile {
	file: string;
	routed: string;
}

export interface SettledFailures {
	failed: FailedFile[];
	flakes: string[];
	environment?: { failed: number; total: number };
	/** The failed tests' names per failing file, from the report: what an incident names; not on the record. */
	tests?: Record<string, string[]>;
}

export interface SlowRun {
	command: string;
	exit: number;
}

export type SlowResult = "green" | "red" | "skipped" | "not run";

export interface ReleaseOutcome {
	/** `false` when the project declares no release command; nothing ran. */
	declared: boolean;
	published: boolean;
	done: boolean;
	slow: {
		ran: boolean;
		green: boolean;
		skipped: boolean;
		result: SlowResult;
		/** The green run that covered the code, when the slow run was skipped. */
		covering?: GreenRun;
	};
	/** What the run records on the release record. */
	recorded: SettledFailures;
	/** What a reader should look at when the release is published and not done, or a run was red. */
	openFailures: string[];
}

const EMPTY: SettledFailures = { failed: [], flakes: [] };

export function runRelease(deps: ReleaseDeps): ReleaseOutcome {
	const release = deps.steps.release ?? {};
	const slowSpec = release.slow_tests;
	const outcome: ReleaseOutcome = {
		declared: Boolean(release.command),
		published: false,
		done: false,
		slow: { ran: false, green: false, skipped: false, result: "not run" },
		recorded: EMPTY,
		openFailures: [],
	};
	if (!release.command) return outcome;

	const runSlow = (): boolean => {
		if (!slowSpec) return true;
		const key = deps.codeKey();
		const covering = key ? deps.coveringRun(key) : null;
		if (covering) {
			outcome.slow = { ran: false, green: true, skipped: true, result: "skipped", covering };
			return true;
		}
		const at = deps.now().toISOString();
		const run: SlowRun = { command: slowSpec.command, exit: deps.exec(slowSpec.command).code };
		const green = run.exit === 0;
		outcome.slow = { ran: true, green, skipped: false, result: green ? "green" : "red" };
		if (green) {
			if (key && deps.codeKey() === key) deps.recordGreen({ key, at, command: slowSpec.command });
			return true;
		}
		outcome.recorded = deps.settleFailures?.(run) ?? EMPTY;
		outcome.openFailures = outcome.recorded.failed.length
			? outcome.recorded.failed.map((f) => f.file)
			: [slowSpec.command];
		return false;
	};

	if (slowSpec?.when === "before" && !runSlow()) return outcome;
	outcome.published = deps.exec(release.command).code === 0;
	if (!outcome.published) return outcome;
	if (slowSpec?.when === "after") runSlow();

	outcome.done = release.done_when === "green" ? outcome.slow.green || !slowSpec : true;
	return outcome;
}
