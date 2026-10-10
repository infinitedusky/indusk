import { existsSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { type IncidentChange, recordTestFailure, type Suspects } from "../promises/incidents.js";
import { planFolders } from "../promises/plan-folder.js";
import { type PromiseEntry, readPromises } from "../promises/registry.js";
import type { ReopenResult } from "../promises/reopen.js";
import { readImpl } from "../promises/rows.js";
import { ownerReopener } from "../promises/watch.js";
import { type BugfixPlan, openOrExtendBugfixPlan } from "./bugfix-plan.js";
import type { FailedFile, SettledFailures } from "./run.js";

/**
 * Where a failing slow test goes (release-records-its-failures D6): every
 * impl, active and archived, is read through the trajectory parser, and the
 * rows whose `Test` cell names the file are collected. The promises those
 * rows' `For` cells name are the file's claimants; a file no row's promise
 * claims is unclaimed — a bugfix plan's, not an incident's.
 *
 * Reads plan documents only. An impl that cannot be read is named, never
 * skipped: "no row names it" must not be what a broken impl looks like.
 *
 * promise: a-failing-slow-test-breaks-its-promise
 */

/** A row naming the failing file, and the plan whose impl holds it. */
export interface RoutingRow {
	plan: string;
	archived: boolean;
	id: string;
	/** The promises the row's `For` names; empty for a row that names none. */
	promises: string[];
}

export interface Route {
	/** Each promise any naming row claims, once, in row order. */
	promises: string[];
	/** Every row whose `Test` cell names the file. */
	rows: RoutingRow[];
	/** Plans whose impl could not be read. */
	unreadable: string[];
}

/** A test path as a row and a JUnit report both spell it: repo-relative, no `./`. */
function normalise(path: string): string {
	return posix.normalize(path.trim()).replace(/^\.\//, "");
}

export function routeFailure(root: string, file: string): Route {
	const want = normalise(file);
	const rows: RoutingRow[] = [];
	const unreadable: string[] = [];
	for (const folder of planFolders(root)) {
		const implPath = join(folder.dir, "impl.md");
		if (!existsSync(implPath)) continue;
		const impl = readImpl(readFileSync(implPath, "utf-8"));
		if (!impl.ok) {
			unreadable.push(folder.plan);
			continue;
		}
		for (const row of impl.trajectory.rows) {
			if (!(row.test ?? []).some((t) => normalise(t) === want)) continue;
			rows.push({
				plan: folder.plan,
				archived: folder.archived,
				id: row.id,
				promises: row.purpose?.promises ?? [],
			});
		}
	}
	return { promises: [...new Set(rows.flatMap((r) => r.promises))], rows, unreadable };
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
