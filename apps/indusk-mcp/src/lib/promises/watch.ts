import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { livePlanCopy } from "../worktree/plan-worktrees.js";
import { type IncidentChange, recordViolations } from "./incidents.js";
import { readPromises } from "./registry.js";
import { maintenanceIncidentIds, ownerDir, type ReopenResult, reopenOwner } from "./reopen.js";
import { readPromiseMarks } from "./sources.js";
import type { IncidentSource } from "./vocabulary.js";

/**
 * One monitor pass (day-monitor, ADR D5): read what Jaeger saw over the quiet
 * window, record each behaviour promise's new violations as an incident, and
 * send each promise's owner back to work with a Maintenance phase. Writes plan
 * documents and commits nothing — the person commits them. Throws
 * `JaegerUnreachable` rather than reporting a quiet window it never read.
 */

/**
 * One thing a run did to an incident. `unowned` is an open incident from an
 * earlier run whose owner carries no Maintenance phase for it — a reopen that
 * failed then, retried now (watch-reopen-collision A6) — and has no new traces.
 */
export interface WatchChange {
	id: string;
	kind: IncidentChange["kind"] | "unowned";
	traces: string[];
	promise: string;
	owner: string;
	reopen: ReopenResult;
}

export interface WatchResult {
	source: string;
	changes: WatchChange[];
}

type OwnerCopy = { ok: true; liveDir?: string } | { ok: false; detail: string };

/**
 * Where the owner is being worked: an active plan assigned to a worktree is
 * reopened in that worktree's copy, which is the one `list_plans` and the
 * admin read — not in the trunk's stale copy, where nobody would see it and
 * the landing merge would conflict (day-monitor A29). Resolved once per
 * promise, so the ids the allocator avoids come from the copy the reopen
 * writes to.
 */
async function ownerCopy(planRoot: string, owner: string): Promise<OwnerCopy> {
	const live = await livePlanCopy(planRoot, owner);
	if (!live.ok) return { ok: false, detail: `${live.file}: ${live.problem}` };
	const liveDir =
		live.copy.source === "worktree" && existsSync(live.copy.dir) ? live.copy.dir : undefined;
	return { ok: true, liveDir };
}

/** The incident ids the owner's Maintenance phases already name; none without an owner or an impl. */
function idsTakenByOwner(planRoot: string, owner: string, copy: OwnerCopy): Set<string> {
	if (!copy.ok) return new Set();
	const dir = copy.liveDir ?? ownerDir(planRoot, owner);
	const impl = dir ? join(dir, "impl.md") : null;
	return impl && existsSync(impl) ? maintenanceIncidentIds(readFileSync(impl, "utf-8")) : new Set();
}

export async function watchPromises(
	planRoot: string,
	opts: { source: IncidentSource; now?: Date },
): Promise<WatchResult> {
	const now = opts.now ?? new Date();
	const read = readPromises(planRoot);
	if (!read.ok) {
		throw new Error(
			"missing" in read
				? `no promise registry at ${read.missing}`
				: `the registry has malformed entries: ${read.problems.map((p) => `${p.file}: ${p.problem}`).join("; ")}`,
		);
	}
	const behaviour = read.registry.promises.filter(
		(p) => p.kind === "behaviour" && p.state !== "retired",
	);
	// `--source` chooses what is read, not only what is written on the incident
	// (promise-sources, ADR D6): `deployed` reads production, and is refused
	// when the project names none; `local`, `smoke` and `desk` read the laptop.
	const marks = await readPromiseMarks(planRoot, read.registry, {
		now,
		source: opts.source === "deployed" ? "production" : "local",
	});
	// Which Jaeger answered travels with the result: with a remote source a
	// reader must never have to guess whether they are looking at production
	// or at the laptop they are sitting in front of.
	const source = marks.queryUrl;
	const changes: WatchResult["changes"] = [];
	for (const promise of behaviour) {
		const violations = marks.byPromise.get(promise.name)?.violations ?? [];
		const open = read.registry.incidents.filter(
			(i) => i.promise === promise.name && i.status === "open",
		);
		if (violations.length === 0 && open.length === 0) continue;
		const copy = await ownerCopy(planRoot, promise.owner);
		const reopenFor = (id: string, kind: "opened" | "extended"): ReopenResult =>
			copy.ok
				? reopenOwner(planRoot, promise.owner, id, promise.name, copy.liveDir, kind)
				: { reopened: false, reason: "copy-problem", detail: copy.detail };

		const avoid = idsTakenByOwner(planRoot, promise.owner, copy);
		const change =
			violations.length > 0
				? recordViolations(read.registry, promise, violations, opts.source, now, avoid)
				: null;
		if (change) {
			const reopen = reopenFor(change.id, change.kind);
			changes.push({ ...change, promise: promise.name, owner: promise.owner, reopen });
		}

		// An open incident from an earlier run whose owner carries no phase for
		// it was left unowned by a reopen that failed then. Retry it every run:
		// a quiet window must still repair it, or say it cannot (A6).
		const owned = idsTakenByOwner(planRoot, promise.owner, copy);
		for (const incident of open) {
			if (incident.id === change?.id || owned.has(incident.id)) continue;
			changes.push({
				id: incident.id,
				kind: "unowned",
				traces: [],
				promise: promise.name,
				owner: promise.owner,
				reopen: reopenFor(incident.id, "extended"),
			});
		}
	}
	return { changes, source };
}

export interface WatchReport {
	out: string[];
	err: string[];
	/** 1 when an incident did not reach its owner; the person reading the exit code is told. */
	exitCode: 0 | 1;
}

/**
 * What `promises watch` says about a run, and how it exits. One rule for every
 * reopen that did not happen (watch-reopen-collision): an incident — opened
 * or extended — that did not reach its owner (a collision, an owner that is
 * not a plan folder, a worktree record that could not be read) prints an
 * error and fails the run, because a violation no plan owns, reported as
 * success, is the one outcome the monitor exists to prevent. `already` — the
 * owner carries the phase — is the normal second pass, and stays quiet.
 */
export function watchReport(result: WatchResult): WatchReport {
	const out = [`Read from Jaeger at ${result.source}.`];
	const err: string[] = [];
	if (result.changes.length === 0) {
		out.push("No new violations — nothing recorded.");
		return { out, err, exitCode: 0 };
	}
	let missed = false;
	for (const c of result.changes) {
		const n = c.traces.length;
		out.push(
			c.kind === "unowned"
				? `unowned ${c.id} (${c.promise}: open, and ${c.owner} has no Maintenance phase for it)`
				: `${c.kind} ${c.id} (${c.promise}, ${n} new trace${n === 1 ? "" : "s"})`,
		);
		const r = c.reopen;
		if (r.reopened) {
			out.push(`  reopened ${c.owner}: Build Phase ${r.phase}: Maintenance — ${c.id}`);
			continue;
		}
		if (r.reason === "copy-problem") {
			err.push(
				`  ${c.owner} was not reopened — its worktree assignment could not be read: ${r.detail}`,
			);
		} else if (r.reason === "no-owner") {
			err.push(`  owner "${c.owner}" is not a plan folder — nothing was reopened`);
		} else if (r.reason === "collision") {
			err.push(
				`  ${c.owner} was not reopened — its impl already has "${r.heading}", which this new incident did not write; nothing was appended`,
			);
		}
		// `already` is the one non-reopen that is not a miss: the owner carries the phase.
		if (r.reason !== "already") missed = true;
	}
	out.push("\nWritten, not committed: review the incidents and commit them.");
	return { out, err, exitCode: missed ? 1 : 0 };
}
