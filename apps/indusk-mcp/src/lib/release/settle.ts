import type { WorkflowSteps } from "../config.js";
import { type IncidentChange, recordTestFailure, type Suspects } from "../promises/incidents.js";
import { type PromiseEntry, readPromises } from "../promises/registry.js";
import type { ReopenResult } from "../promises/reopen.js";
import { ownerReopener } from "../promises/watch.js";
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
 * registry claims stays `unrouted`: a bugfix plan's (Build Phase 4).
 *
 * promise: a-failing-slow-test-breaks-its-promise
 */
export async function routeFailures(
	root: string,
	settled: SettledFailures,
	facts: RouteFacts,
): Promise<Routed> {
	const unrouted: Routed = { failed: settled.failed, incidents: [], unreadable: [] };
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

	const unreadable = new Set<string>();
	const claims = new Map<string, string[]>();
	for (const { file } of settled.failed) {
		const route = routeFailure(root, file);
		for (const plan of route.unreadable) unreadable.add(plan);
		for (const name of route.promises) {
			const promise = live(first.registry.promises, name);
			if (promise) claims.set(promise.name, [...(claims.get(promise.name) ?? []), file]);
		}
	}

	const incidents: RoutedIncident[] = [];
	const byFile = new Map<string, string[]>();
	for (const [name, files] of claims) {
		// Read again per promise: the incident one promise opened is on disk now.
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

	return {
		failed: settled.failed.map(({ file }) => {
			const ids = byFile.get(file);
			return { file, routed: ids ? ids.map((id) => `incident ${id}`).join(", ") : "unrouted" };
		}),
		incidents,
		unreadable: [...unreadable].sort(),
	};
}

/** The registry's live promise a row names, by its name or an earlier one; none when retired or unknown. */
function live(promises: PromiseEntry[], name: string): PromiseEntry | undefined {
	return promises.find(
		(p) => p.state !== "retired" && (p.name === name || p.aliases.includes(name)),
	);
}
