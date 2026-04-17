import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

export type HypothesisOutcome = "fix-in-scope" | "spawn-plan" | "accept-finding";

export interface HypothesisEntry {
	kind: "hypothesis";
	hypothesis: string;
	testPath: string | null;
	outcome: HypothesisOutcome;
	note?: string;
	timestamp: string;
}

export interface TerminatorEntry {
	kind: "terminator";
	reason: string;
	timestamp: string;
}

export type LogEntry = HypothesisEntry | TerminatorEntry;

export interface MalformedLine {
	lineNumber: number;
	content: string;
	reason: string;
}

const VALID_OUTCOMES: ReadonlySet<HypothesisOutcome> = new Set([
	"fix-in-scope",
	"spawn-plan",
	"accept-finding",
]);

function logPath(planRoot: string): string {
	return join(planRoot, "falsification.md");
}

function headerFor(planRoot: string): string {
	return `# Falsification Log — ${basename(planRoot)}\n\nAppend-only record of the /falsify bounty hunt for this plan. Never edit in place; entries are appended via \`appendHypothesis\` and \`markTerminated\` from \`apps/indusk-mcp/src/lib/falsification/log.ts\`.\n\n`;
}

/**
 * Append a confirmed-hypothesis entry to the plan's falsification log.
 * Creates the log file with a header if it doesn't yet exist. Throws if
 * the log is already terminated (a new hypothesis after a terminator is a
 * sign the ritual was restarted incorrectly — see `isFalsificationComplete`
 * and start a new plan or explicitly un-terminate first).
 */
export function appendHypothesis(
	planRoot: string,
	entry: Omit<HypothesisEntry, "kind" | "timestamp">,
): HypothesisEntry {
	const path = logPath(planRoot);
	const existing = existsSync(path) ? readFalsificationLog(planRoot) : [];
	if (existing.length > 0 && existing[existing.length - 1].kind === "terminator") {
		throw new Error(
			`Falsification log at ${path} is already terminated. Start a new plan or remove the terminator before appending.`,
		);
	}
	if (!existsSync(path)) {
		writeFileSync(path, headerFor(planRoot), "utf-8");
	}

	const stored: HypothesisEntry = {
		kind: "hypothesis",
		hypothesis: entry.hypothesis,
		testPath: entry.testPath,
		outcome: entry.outcome,
		note: entry.note,
		timestamp: new Date().toISOString(),
	};

	appendFileSync(path, renderHypothesis(stored), "utf-8");
	return stored;
}

/**
 * Append a terminator entry marking the falsification ritual complete for
 * this plan. No further hypotheses can be appended after this. The reason
 * is the user-confirmed rationale for termination (e.g., "investigated
 * concurrency, race conditions, partial-write paths, and type-narrowing
 * gaps; no in-scope failure remained").
 */
export function markTerminated(planRoot: string, reason: string): TerminatorEntry {
	if (!reason.trim()) {
		throw new Error("markTerminated requires a non-empty reason.");
	}
	const path = logPath(planRoot);
	const existing = existsSync(path) ? readFalsificationLog(planRoot) : [];
	if (existing.length > 0 && existing[existing.length - 1].kind === "terminator") {
		throw new Error(`Falsification log at ${path} is already terminated.`);
	}
	if (!existsSync(path)) {
		writeFileSync(path, headerFor(planRoot), "utf-8");
	}

	const stored: TerminatorEntry = {
		kind: "terminator",
		reason: reason.trim(),
		timestamp: new Date().toISOString(),
	};

	appendFileSync(path, renderTerminator(stored), "utf-8");
	return stored;
}

/**
 * Read the falsification log for a plan. Returns an empty array if the log
 * file does not exist. Malformed entries are skipped (not thrown) and
 * surfaced via the optional `onMalformed` callback, matching the semantic
 * graph event log's resilience pattern.
 */
export function readFalsificationLog(
	planRoot: string,
	opts?: { onMalformed?: (malformed: MalformedLine) => void },
): LogEntry[] {
	const path = logPath(planRoot);
	if (!existsSync(path)) return [];

	const content = readFileSync(path, "utf-8");
	const entries: LogEntry[] = [];
	const sectionRegex = /^##\s+(Hypothesis|Terminated)\s+(.+?)\s*$/gm;

	const matches = [...content.matchAll(sectionRegex)];
	for (let i = 0; i < matches.length; i++) {
		const match = matches[i];
		const [, kind, timestamp] = match;
		const start = (match.index ?? 0) + match[0].length;
		const end = i + 1 < matches.length ? (matches[i + 1].index ?? content.length) : content.length;
		const body = content.slice(start, end).trim();

		if (kind === "Hypothesis") {
			const entry = parseHypothesisBody(body, timestamp);
			if ("lineNumber" in entry) {
				opts?.onMalformed?.(entry);
			} else {
				entries.push(entry);
			}
		} else if (kind === "Terminated") {
			const entry = parseTerminatorBody(body, timestamp);
			if ("lineNumber" in entry) {
				opts?.onMalformed?.(entry);
			} else {
				entries.push(entry);
			}
		}
	}

	return entries;
}

/**
 * True iff the plan's falsification log exists AND its last entry is a
 * terminator. False for a missing log, a log with only hypotheses (ritual
 * started but not terminated), or an empty log file.
 */
export function isFalsificationComplete(planRoot: string): boolean {
	const entries = readFalsificationLog(planRoot);
	if (entries.length === 0) return false;
	return entries[entries.length - 1].kind === "terminator";
}

// ---------------------------------------------------------------
// Rendering (writing entries to markdown)
// ---------------------------------------------------------------

function renderHypothesis(entry: HypothesisEntry): string {
	const lines = [
		`## Hypothesis ${entry.timestamp}`,
		"",
		`**Hypothesis:** ${entry.hypothesis}`,
		`**Test:** ${entry.testPath ?? "(not written)"}`,
		`**Outcome:** ${entry.outcome}`,
	];
	if (entry.note) {
		lines.push(`**Note:** ${entry.note}`);
	}
	lines.push("", "");
	return lines.join("\n");
}

function renderTerminator(entry: TerminatorEntry): string {
	return [`## Terminated ${entry.timestamp}`, "", `**Reason:** ${entry.reason}`, "", ""].join("\n");
}

// ---------------------------------------------------------------
// Parsing (reading entries from markdown)
// ---------------------------------------------------------------

function parseHypothesisBody(body: string, timestamp: string): HypothesisEntry | MalformedLine {
	const hypothesisMatch = body.match(/^\*\*Hypothesis:\*\*\s+(.+)$/m);
	const testMatch = body.match(/^\*\*Test:\*\*\s+(.+)$/m);
	const outcomeMatch = body.match(/^\*\*Outcome:\*\*\s+([a-z-]+)$/m);
	const noteMatch = body.match(/^\*\*Note:\*\*\s+(.+)$/m);

	if (!hypothesisMatch || !outcomeMatch) {
		return {
			lineNumber: 0,
			content: body,
			reason: "Hypothesis entry missing required fields (hypothesis or outcome)",
		};
	}

	const outcome = outcomeMatch[1] as HypothesisOutcome;
	if (!VALID_OUTCOMES.has(outcome)) {
		return {
			lineNumber: 0,
			content: body,
			reason: `Invalid outcome "${outcome}"; must be one of ${[...VALID_OUTCOMES].join(", ")}`,
		};
	}

	const testRaw = testMatch?.[1]?.trim() ?? "(not written)";
	return {
		kind: "hypothesis",
		hypothesis: hypothesisMatch[1].trim(),
		testPath: testRaw === "(not written)" ? null : testRaw,
		outcome,
		note: noteMatch?.[1]?.trim(),
		timestamp,
	};
}

function parseTerminatorBody(body: string, timestamp: string): TerminatorEntry | MalformedLine {
	const reasonMatch = body.match(/^\*\*Reason:\*\*\s+(.+)$/m);
	if (!reasonMatch) {
		return {
			lineNumber: 0,
			content: body,
			reason: "Terminator entry missing required Reason field",
		};
	}
	return {
		kind: "terminator",
		reason: reasonMatch[1].trim(),
		timestamp,
	};
}
