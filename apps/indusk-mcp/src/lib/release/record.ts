import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bookkeepingRoots } from "../bookkeeping/roots.js";
import type { WorkflowSteps } from "../config.js";
import type { FailedFile, ReleaseOutcome } from "./run.js";

/**
 * The release record (release-records-its-failures D10): one JSON line per
 * release in the project's home, `releases.jsonl`, the same file from every
 * checkout. It is what the brief's first expectation counts: releases that
 * published on their first run, against all releases.
 *
 * promise: a-release-runs-as-its-project-declares
 */
export interface ReleaseRecord {
	version: string;
	commit: string;
	at: string;
	published: boolean;
	done: boolean;
	slow: string;
	failed: FailedFile[];
	flakes: string[];
	environment?: { failed: number; total: number };
	/** Why routing the failures threw, when it did: the release is recorded regardless. */
	routing?: string;
}

export function releaseRecordPath(anyCheckout: string): string {
	return join(bookkeepingRoots(anyCheckout).home, "releases.jsonl");
}

export function recordRelease(anyCheckout: string, record: ReleaseRecord): void {
	mkdirSync(bookkeepingRoots(anyCheckout).home, { recursive: true });
	appendFileSync(releaseRecordPath(anyCheckout), `${JSON.stringify(record)}\n`);
}

/** The record a finished release leaves. */
export function recordOf(
	outcome: ReleaseOutcome,
	facts: { version: string; commit: string; at: Date; routing?: string },
): ReleaseRecord {
	return {
		version: facts.version,
		commit: facts.commit,
		at: facts.at.toISOString(),
		published: outcome.published,
		done: outcome.done,
		slow: outcome.slow.result,
		failed: outcome.recorded.failed,
		flakes: outcome.recorded.flakes,
		...(outcome.recorded.environment ? { environment: outcome.recorded.environment } : {}),
		...(facts.routing === undefined ? {} : { routing: facts.routing }),
	};
}

/** The version in `release.version_file`: a JSON `version`, else the first `version = ` line; `unknown` when none. */
export function releaseVersion(root: string, steps: WorkflowSteps): string {
	const file = steps.release?.version_file;
	if (!file) return "unknown";
	let text: string;
	try {
		text = readFileSync(join(root, file), "utf-8");
	} catch {
		return "unknown";
	}
	try {
		const v = (JSON.parse(text) as { version?: unknown }).version;
		if (typeof v === "string") return v;
	} catch {
		// not JSON: a TOML or similar line below
	}
	return /^\s*version\s*[=:]\s*["']?([^"'\s]+)/m.exec(text)?.[1] ?? "unknown";
}
