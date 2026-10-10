import type { WorkflowSteps } from "../config.js";
import { type IncidentChange, recordTestFailure, type Suspects } from "../promises/incidents.js";
import { type PromiseEntry, readPromises } from "../promises/registry.js";
import type { ReopenResult } from "../promises/reopen.js";
import { ownerReopener } from "../promises/watch.js";
import { type BugfixPlan, openOrExtendBugfixPlan } from "./bugfix-plan.js";
import { failedFiles } from "./junit.js";
import { routeFailure } from "./route.js";
import type { FailedFile, SettledFailures } from "./run.js";

/**
 * A red slow run, settled (release-records-its-failures D4, D5): the failing
 * files are read from the declared JUnit report; when more than half the
 * report's files failed it is the environment and nothing else is said; else
 * the failing files are run once more through `slow_tests.rerun` (`{files}`
 * substituted) and the report is read again — a file the rerun does not leave
 * failing is a flake.
 *
 * promise: a-failure-is-read-from-the-report
 * promise: a-flake-opens-nothing
 */
export function settleFromReport(
	steps: WorkflowSteps,
	root: string,
	exec: (command: string) => { code: number },
): SettledFailures {
	const spec = steps.release?.slow_tests;
	if (!spec) return { failed: [], flakes: [] };
	const first = failedFiles(spec.report, root);
	if (!first.readable || first.files.size === 0) return { failed: [], flakes: [] };
	if (first.files.size * 2 > first.total) {
		return {
			failed: [],
			flakes: [],
			environment: { failed: first.files.size, total: first.total },
		};
	}
	const names = [...first.files.keys()].sort();
	let still = names;
	let last = first;
	if (spec.rerun) {
		exec(spec.rerun.replaceAll("{files}", names.join(" ")));
		const second = failedFiles(spec.report, root);
		if (second.readable) {
			still = names.filter((f) => second.files.has(f));
			last = second;
		}
	}
	return {
		failed: still.map((file) => ({ file, routed: "unrouted" })),
		flakes: names.filter((f) => !still.includes(f)),
		tests: Object.fromEntries(still.map((f) => [f, last.files.get(f) ?? first.files.get(f) ?? []])),
	};
}

/** What the release knows when it routes: which release, and what may have caused the failures. */
export interface RouteFacts {
	version: string;
	commit: string;
	now: Date;
	suspects: Suspects;
}

/** An incident a release opened or extended, and what reopening its owner did. */
export interface RoutedIncident extends IncidentChange {
	promise: string;
	owner: string;
	reopen: ReopenResult;
}

export interface Routed {
	/** Every failing file, with where it went: `incident <id>`, or `unrouted` when no row's promise claims it. */
	failed: FailedFile[];
	incidents: RoutedIncident[];
	/** The draft bugfix plans opened or extended for files no promise claims. */
	plans: BugfixPlan[];
	/** A bugfix plan that could not be opened or extended, with why: the file stays `unrouted`. */
	planProblems: string[];
	/** Plans whose impl could not be read while routing. */
	unreadable: string[];
	/** Why nothing was routed, when the registry could not be read. */
	refused?: string;
}

/**
 * Route each failing file (ADR D6, D7): a file whose rows' `For` names a
 * promise becomes an incident on each such promise — one per promise, every
 * file it claims in it — opened or extended through `recordTestFailure`, and
 * the owner reopened through the path `watch` uses. A file no promise in the
 * registry claims goes to a draft bugfix plan, opened or extended (D8).
 *
 * promise: a-failing-slow-test-breaks-its-promise
 */
export async function routeFailures(
	root: string,
	settled: SettledFailures,
	facts: RouteFacts,
): Promise<Routed> {
	const unrouted: Routed = {
		failed: settled.failed,
		incidents: [],
		plans: [],
		planProblems: [],
		unreadable: [],
	};
	if (settled.failed.length === 0) return unrouted;
	const first = readPromises(root);
	if (!first.ok) {
		// A registry that cannot be read is no place to write an incident.
		return {
			...unrouted,
			refused:
				"missing" in first
					? `no promise registry at ${first.missing}`
					: `the promise registry has malformed entries: ${first.problems.map((p) => p.file).join(", ")}`,
		};
	}

	const { claims, unreadable } = claimsOf(root, settled.failed, first.registry.promises);
	const incidents: RoutedIncident[] = [];
	const byFile = new Map<string, string[]>();
	for (const [name, files] of claims) {
		// Read again for each promise, since the incident one opened is on disk now.
		const read = readPromises(root);
		const registry = read.ok ? read.registry : first.registry;
		const promise = live(registry.promises, name);
		if (!promise) continue;
		const owner = await ownerReopener(root, promise);
		const change = recordTestFailure(
			registry,
			promise,
			{
				tests: files.map((file) => ({ file, names: settled.tests?.[file] ?? [] })),
				release: { version: facts.version, commit: facts.commit },
				suspects: facts.suspects,
				now: facts.now,
			},
			owner.taken(),
		);
		const reopen = owner.reopen(change.id, change.kind);
		incidents.push({ ...change, promise: promise.name, owner: promise.owner, reopen });
		for (const file of files) byFile.set(file, [...(byFile.get(file) ?? []), change.id]);
	}

	const { failed, plans, planProblems } = await routeUnclaimed(root, settled, byFile, facts);
	return { failed, incidents, plans, planProblems, unreadable };
}

/** Each failing file an incident claimed says so; every other one goes to its bugfix plan (D8). */
async function routeUnclaimed(
	root: string,
	settled: SettledFailures,
	incidentsByFile: Map<string, string[]>,
	facts: RouteFacts,
): Promise<{ failed: FailedFile[]; plans: BugfixPlan[]; planProblems: string[] }> {
	const plans: BugfixPlan[] = [];
	const planProblems: string[] = [];
	const failed: FailedFile[] = [];
	for (const { file } of settled.failed) {
		const ids = incidentsByFile.get(file);
		if (ids) {
			failed.push({ file, routed: ids.map((id) => `incident ${id}`).join(", ") });
			continue;
		}
		try {
			const plan = await openOrExtendBugfixPlan(root, {
				file,
				names: settled.tests?.[file] ?? [],
				rows: routeFailure(root, file).rows,
				release: { version: facts.version, commit: facts.commit },
				suspects: facts.suspects,
				now: facts.now,
			});
			if (!plans.some((p) => p.plan === plan.plan)) plans.push(plan);
			failed.push({ file, routed: `plan ${plan.plan}` });
		} catch (err) {
			planProblems.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
			failed.push({ file, routed: "unrouted" });
		}
	}
	return { failed, plans, planProblems };
}

/**
 * Which live promise claims which failing files: each promise a naming row's
 * `For` cell names, with every file it claims, and the impls that could not
 * be read on the way.
 */
function claimsOf(
	root: string,
	failed: FailedFile[],
	promises: PromiseEntry[],
): { claims: Map<string, string[]>; unreadable: string[] } {
	const unreadable = new Set<string>();
	const claims = new Map<string, string[]>();
	for (const { file } of failed) {
		const route = routeFailure(root, file);
		for (const plan of route.unreadable) unreadable.add(plan);
		for (const name of route.promises) {
			const promise = live(promises, name);
			if (promise) claims.set(promise.name, [...(claims.get(promise.name) ?? []), file]);
		}
	}
	return { claims, unreadable: [...unreadable].sort() };
}

/** The registry's live promise a row names, by its name or an earlier one; none when retired or unknown. */
function live(promises: PromiseEntry[], name: string): PromiseEntry | undefined {
	return promises.find(
		(p) => p.state !== "retired" && (p.name === name || p.aliases.includes(name)),
	);
}
