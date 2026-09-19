import { getQuietWindowDays } from "./config.js";
import { type IncidentChange, recordViolations } from "./incidents.js";
import { readPromises } from "./registry.js";
import { type ReopenResult, reopenOwner } from "./reopen.js";
import { markedSpans } from "./telemetry.js";
import type { IncidentSource } from "./vocabulary.js";

/**
 * One monitor pass (day-monitor, ADR D5): read what Jaeger saw over the quiet
 * window, record each behaviour promise's new violations as an incident, and
 * send each promise's owner back to work with a Maintenance phase. Writes plan
 * documents and commits nothing — the person commits them. Throws
 * `JaegerUnreachable` rather than reporting a quiet window it never read.
 */

export interface WatchResult {
	changes: (IncidentChange & { promise: string; owner: string; reopen: ReopenResult })[];
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
	const marks = await markedSpans({
		promises: behaviour.map((p) => p.name),
		since: new Date(now.getTime() - getQuietWindowDays(planRoot) * 86_400_000),
	});
	const changes: WatchResult["changes"] = [];
	for (const promise of behaviour) {
		const violations = marks.byPromise.get(promise.name)?.violations ?? [];
		if (violations.length === 0) continue;
		const change = recordViolations(read.registry, promise, violations, opts.source, now);
		if (!change) continue;
		const reopen = reopenOwner(planRoot, promise.owner, change.id);
		changes.push({ ...change, promise: promise.name, owner: promise.owner, reopen });
	}
	return { changes };
}
