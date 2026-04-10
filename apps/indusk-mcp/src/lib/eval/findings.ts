/**
 * Tracks eval finding resolution state.
 *
 * Findings persist as "unresolved" until explicitly fixed or ignored.
 * The eval hook surfaces unresolved findings on every jj describe.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { EvalScorecard } from "./types.js";

export type FindingState = "unresolved" | "fixed" | "ignored";

export interface FindingEntry {
	state: FindingState;
	questionId: string;
	severity: string;
	finding: string;
	changeId: string;
}

type FindingsMap = Record<string, FindingEntry>;

function getFindingsPath(projectRoot: string): string {
	return join(projectRoot, ".indusk", "eval", "findings.json");
}

function readFindings(projectRoot: string): FindingsMap {
	const path = getFindingsPath(projectRoot);
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return {};
	}
}

function writeFindings(projectRoot: string, findings: FindingsMap): void {
	const path = getFindingsPath(projectRoot);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(findings, null, 2)}\n`);
}

export function getUnresolvedFindings(projectRoot: string): Array<{ key: string } & FindingEntry> {
	const findings = readFindings(projectRoot);
	return Object.entries(findings)
		.filter(([, entry]) => entry.state === "unresolved")
		.map(([key, entry]) => ({ key, ...entry }));
}

export function getAllFindings(projectRoot: string): Array<{ key: string } & FindingEntry> {
	const findings = readFindings(projectRoot);
	return Object.entries(findings).map(([key, entry]) => ({ key, ...entry }));
}

export function markFinding(projectRoot: string, key: string, state: FindingState): boolean {
	const findings = readFindings(projectRoot);
	if (!findings[key]) return false;
	findings[key].state = state;
	writeFindings(projectRoot, findings);
	return true;
}

export function ingestScorecard(projectRoot: string, scorecard: EvalScorecard): number {
	const findings = readFindings(projectRoot);
	let added = 0;

	for (const q of scorecard.questions) {
		if (q.answer === "yes") continue; // no finding for passing questions
		const key = `${scorecard.changeId}:${q.id}`;
		if (!findings[key]) {
			findings[key] = {
				state: "unresolved",
				questionId: q.id,
				severity: q.severity,
				finding: q.finding,
				changeId: scorecard.changeId,
			};
			added++;
		}
	}

	if (added > 0) {
		writeFindings(projectRoot, findings);
	}
	return added;
}
