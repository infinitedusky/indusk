/**
 * Stale-section sweep for `.indusk/current.md` (indusk-makeover Phase 1).
 *
 * The display TTL (`agents.stale_ttl_minutes`, default 60) governs what
 * `agent list` SHOWS; it never removes content. Before this module, expired
 * session sections stayed in the file forever — every `/catchup` re-read every
 * dead session ever written. The sweep is the decay half: sections whose
 * `Last updated` exceeds the SWEEP TTL (`agents.sweep_ttl_minutes`, default
 * 7 days — deliberately much longer than the display TTL, so merely-quiet
 * sessions are not evicted) are MOVED to an append-only archive at
 * `.indusk/archive/current-md-archive.md`. Archive, never delete — recovery
 * is a copy-paste from the archive file.
 *
 * Invariants (trajectory rows A9/A10):
 * - The `## Project (shared)` section and the preamble are never touched.
 * - Sections at or newer than the TTL boundary are kept.
 * - Malformed `Last updated` timestamps are KEPT (never archive on bad input —
 *   same posture as `pruneStaleSections`).
 * - All mutation happens inside the same file lock as every other current.md
 *   writer (`<projectRoot>/.indusk/current.md.lock`).
 */

import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { getSweepTtlMinutes } from "../config.js";
import type { AgentSection } from "./current-md.js";
import { parseCurrentMd, serializeCurrentMd, serializeSectionBlock } from "./current-md.js";
import { withLock } from "./lock.js";

export interface SweepOptions {
	/** Override the sweep TTL. Defaults to `agents.sweep_ttl_minutes` (10080 = 7 days). */
	ttlMinutes?: number;
	/** Report what would be swept without mutating anything. */
	dryRun?: boolean;
	/** Injectable clock for tests. */
	now?: Date;
	/** Lock acquisition timeout override (tests). */
	lockTimeoutMs?: number;
}

export interface SweepResult {
	/** Sections moved to the archive (or that WOULD move, under dryRun). */
	swept: AgentSection[];
	/** Sections kept because they're fresh. */
	keptFresh: number;
	/** Sections kept because their timestamp didn't parse. */
	keptMalformed: number;
	dryRun: boolean;
	/** Absolute path of the archive file (may not exist if nothing was ever swept). */
	archivePath: string;
}

/**
 * Sweep expired session sections out of `.indusk/current.md` into the archive.
 * No-op (empty result) when current.md doesn't exist.
 */
export function sweepStaleSections(projectRoot: string, opts: SweepOptions = {}): SweepResult {
	const currentPath = join(projectRoot, ".indusk/current.md");
	const archivePath = join(projectRoot, ".indusk/archive/current-md-archive.md");
	const dryRun = opts.dryRun === true;
	const empty: SweepResult = { swept: [], keptFresh: 0, keptMalformed: 0, dryRun, archivePath };
	if (!existsSync(currentPath)) return empty;

	const ttlMinutes = opts.ttlMinutes ?? getSweepTtlMinutes(projectRoot);
	const now = opts.now ?? new Date();
	const cutoffMs = now.getTime() - ttlMinutes * 60_000;

	const run = (): SweepResult => {
		const content = readFileSync(currentPath, "utf-8");
		const doc = parseCurrentMd(content);

		const swept: AgentSection[] = [];
		const kept: AgentSection[] = [];
		let keptMalformed = 0;
		for (const section of doc.sections) {
			const t = Date.parse(section.lastUpdated);
			if (Number.isNaN(t)) {
				kept.push(section);
				keptMalformed++;
				continue;
			}
			// Strictly-older-than: a section exactly at the boundary is kept.
			if (t < cutoffMs) {
				swept.push(section);
			} else {
				kept.push(section);
			}
		}

		const result: SweepResult = {
			swept,
			keptFresh: kept.length - keptMalformed,
			keptMalformed,
			dryRun,
			archivePath,
		};
		if (swept.length === 0 || dryRun) return result;

		// Append to the archive FIRST, then rewrite current.md — a crash between
		// the two duplicates a section into the archive (harmless, append-only)
		// rather than losing it.
		mkdirSync(dirname(archivePath), { recursive: true });
		const entry = [
			`## Swept ${now.toISOString()} (ttl ${ttlMinutes}m)`,
			"",
			...swept.map((s) => serializeSectionBlock(s)),
		].join("\n");
		appendFileSync(archivePath, `${entry}\n---\n\n`);

		// Preamble + shared section pass through untouched (A10).
		doc.sections = kept;
		const tmpPath = `${currentPath}.tmp-sweep-${process.pid}`;
		writeFileSync(tmpPath, serializeCurrentMd(doc));
		renameSync(tmpPath, currentPath);

		return result;
	};

	const lockOpts = opts.lockTimeoutMs !== undefined ? { timeoutMs: opts.lockTimeoutMs } : undefined;
	return withLock(`${currentPath}.lock`, run, lockOpts);
}
