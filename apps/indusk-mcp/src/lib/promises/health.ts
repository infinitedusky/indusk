import { join } from "node:path";
import { recorded } from "./incidents.js";
import { readPromises } from "./registry.js";
import { readPromiseMarks } from "./telemetry.js";

/**
 * What a session should be told about the promises (day-always-on, ADR D9).
 *
 * The raising half of the loop. A violation that nobody hears about is not
 * raised, and the agent answering "what's next" is where a developer actually
 * hears things — so this is the shape that answer needs: per behaviour
 * promise, what broke in the window, what is already written down as an
 * incident, and **what broke that nobody has written down yet**.
 *
 * That third number is the one that matters. Violations already carrying an
 * open incident are work someone has seen; `unrecorded` is work nobody has,
 * and it is what `indusk promises watch` would record if it ran now.
 *
 * Reads through `readPromiseMarks` — the same call `status`, `watch` and the
 * admin use — so this cannot disagree with the CLI about what happened. Two
 * surfaces reporting different violation counts is worse than one surface.
 */

export interface PromiseHealthRow {
	name: string;
	kind: string;
	state: string;
	owner: string;
	/** Violations in the window. */
	violations: number;
	/** The query hit Jaeger's limit: `violations` is a lower bound. */
	atLeast?: boolean;
	/** Open incidents for this promise. */
	incidents: number;
	/** Violations whose traces no incident records — what `watch` would open. */
	unrecorded: number;
	/** The unrecorded traces themselves, newest first, so a reader can go look. */
	unrecordedTraces: string[];
	/** ISO time of the newest mark, or null when nothing was seen. */
	lastSeen: string | null;
}

export interface PromiseHealthReport {
	/** Which Jaeger answered — the local daemon or the project's named server. */
	source: string;
	/** The window these numbers cover. */
	since: string;
	promises: PromiseHealthRow[];
	/** Promises with unrecorded violations, newest-first — the "what's next" answer. */
	needsAttention: string[];
}

export async function promiseHealth(
	root: string,
	opts: { sinceMs?: number; timeoutMs?: number; now?: Date } = {},
): Promise<PromiseHealthReport> {
	const read = readPromises(root);
	// A malformed entry does not hide its neighbours: the partial registry is
	// still read, exactly as the admin and `check` treat it. Only a registry
	// that is not there at all is nothing to report on.
	const registry = read.ok ? read.registry : "partial" in read ? read.partial : null;
	if (!registry) {
		throw new Error(`no promise registry at ${"missing" in read ? read.missing : root}`);
	}

	const marks = await readPromiseMarks(root, registry, opts);
	const rows: PromiseHealthRow[] = [];

	for (const promise of registry.promises) {
		if (promise.kind !== "behaviour" || promise.state === "retired") continue;
		const seen = marks.byPromise.get(promise.name);
		const violations = seen?.violations ?? [];

		const mine = registry.incidents.filter((i) => i.promise === promise.name);
		const known = new Set(mine.flatMap((i) => recorded(join(registry.dir, i.file)).traces));
		const unrecordedTraces = [
			...new Set(violations.filter((v) => !known.has(v.traceId)).map((v) => v.traceId)),
		];

		rows.push({
			name: promise.name,
			kind: promise.kind,
			state: promise.state,
			owner: promise.owner,
			violations: violations.length,
			...(seen?.truncated ? { atLeast: true } : {}),
			incidents: mine.filter((i) => i.status === "open").length,
			unrecorded: unrecordedTraces.length,
			unrecordedTraces,
			lastSeen:
				[violations[0]?.at, seen?.lastUpheld?.at]
					.filter((d): d is Date => d !== undefined)
					.sort((a, b) => b.getTime() - a.getTime())[0]
					?.toISOString() ?? null,
		});
	}

	return {
		source: marks.queryUrl,
		since: marks.since.toISOString(),
		promises: rows,
		needsAttention: rows.filter((r) => r.unrecorded > 0).map((r) => r.name),
	};
}
