import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { MarkedSpan, MarkedSpansResult } from "../../lib/promises/telemetry.js";
import {
	behaviourPromise,
	codeFilesFor,
	type IncidentSpec,
	type PromiseProject,
	promiseProject,
} from "./promises-fixture.js";

/**
 * The recording writer's fixture (incident-recording): a project with one
 * behaviour promise, its owner archived on the trunk, and a production
 * source; a production read that answers violations without a Jaeger; and
 * readers for what a pass leaves. Shared by the writer's tests and the tests
 * of what it leaves in the home (inbox, heard record, reminders).
 */

export const PROMISE = "seat-released";
export const OWNER = "seat-holds";
export const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
export const JAEGER = { url: "https://jaeger.example", credential_env: "IR_TEST_JAEGER" };

export const OWNER_IMPL = `---\ntitle: "${OWNER}"\nstatus: completed\n---\n\n# ${OWNER}\n\n## Checklist\n\n### Build Phase 1: Build\n\n- [x] built\n`;

export function violation(trace: string, at = "2026-10-08T20:00:00Z"): MarkedSpan {
	return {
		promise: PROMISE,
		outcome: "violated",
		traceId: trace,
		spanId: "00f067aa0ba902b7",
		service: "seat-holds",
		operation: "release",
		at: new Date(at),
		symptom: "a held seat was not released",
		environment: "production",
	} as MarkedSpan;
}

/** A production read that answers `spans` as violations of PROMISE, after yielding once. */
export function answering(spans: (string | MarkedSpan)[]) {
	return async (): Promise<MarkedSpansResult> => {
		await new Promise((r) => setImmediate(r));
		return {
			queryUrl: JAEGER.url,
			since: new Date("2026-10-01T00:00:00Z"),
			byPromise: new Map([
				[
					PROMISE,
					{
						violations: spans.map((s) => (typeof s === "string" ? violation(s) : s)),
						truncated: false,
						lastUpheld: null,
					},
				],
			]),
		};
	};
}

/**
 * An archived owner on the trunk and, unless `jaeger` is null, a production
 * source. `cleanup` removes it.
 */
export function recordingProject(
	opts: { jaeger?: object | null; incidents?: IncidentSpec[]; extraPromises?: object } = {},
): PromiseProject & { cleanup: () => void } {
	const jaeger = opts.jaeger === undefined ? JAEGER : opts.jaeger;
	const fx = promiseProject({
		archivedPlans: [OWNER],
		planFiles: { [`archive/${OWNER}/impl.md`]: OWNER_IMPL },
		promises: [
			behaviourPromise(PROMISE, {
				owner: OWNER,
				domain: "seating",
				...(opts.incidents?.length
					? { state: "known-violated", incidents: opts.incidents.map((i) => i.id) }
					: {}),
			}),
		],
		incidents: opts.incidents,
		files: codeFilesFor(PROMISE),
		extraConfig: {
			promises: { domains: ["seating"], ...(jaeger ? { jaeger } : {}), ...opts.extraPromises },
		},
	});
	return { ...fx, cleanup: () => rmSync(fx.root, { recursive: true, force: true }) };
}

export function incidentsIn(root: string): string[] {
	const dir = join(root, ".indusk", "promises", "incidents");
	return existsSync(dir) ? readdirSync(dir) : [];
}

/** A JSON-lines file in the home, parsed; empty when absent. */
export function jsonLines<T = Record<string, unknown>>(home: string, name: string): T[] {
	const path = join(home, name);
	if (!existsSync(path)) return [];
	return readFileSync(path, "utf-8")
		.split("\n")
		.filter((l) => l.trim())
		.map((l) => JSON.parse(l) as T);
}
