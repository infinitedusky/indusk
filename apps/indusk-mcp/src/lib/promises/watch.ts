import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { livePlanCopy } from "../worktree/plan-worktrees.js";
import { type IncidentChange, recordViolations } from "./incidents.js";
import { readPromises } from "./registry.js";
import { maintenanceIncidentIds, ownerDir, type ReopenResult, reopenOwner } from "./reopen.js";
import { readPromiseMarks } from "./telemetry.js";
import type { IncidentSource } from "./vocabulary.js";

/**
 * One monitor pass (day-monitor, ADR D5): read what Jaeger saw over the quiet
 * window, record each behaviour promise's new violations as an incident, and
 * send each promise's owner back to work with a Maintenance phase. Writes plan
 * documents and commits nothing — the person commits them. Throws
 * `JaegerUnreachable` rather than reporting a quiet window it never read.
 */

export interface WatchResult {
	source: string;
	changes: (IncidentChange & { promise: string; owner: string; reopen: ReopenResult })[];
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
	const marks = await readPromiseMarks(planRoot, read.registry, { now });
	// Which Jaeger answered travels with the result: with a remote source a
	// reader must never have to guess whether they are looking at production
	// or at the laptop they are sitting in front of.
	const source = marks.queryUrl;
	const changes: WatchResult["changes"] = [];
	for (const promise of behaviour) {
		const violations = marks.byPromise.get(promise.name)?.violations ?? [];
		if (violations.length === 0) continue;
		const copy = await ownerCopy(planRoot, promise.owner);
		const avoid = idsTakenByOwner(planRoot, promise.owner, copy);
		const change = recordViolations(read.registry, promise, violations, opts.source, now, avoid);
		if (!change) continue;
		const reopen: ReopenResult = copy.ok
			? reopenOwner(planRoot, promise.owner, change.id, promise.name, copy.liveDir)
			: { reopened: false, reason: "copy-problem", detail: copy.detail };
		changes.push({ ...change, promise: promise.name, owner: promise.owner, reopen });
	}
	return { changes, source };
}
