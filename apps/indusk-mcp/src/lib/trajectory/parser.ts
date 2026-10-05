import { type PhaseKind, parsePhaseRef } from "../impl-headings.js";

export type TrajectoryState =
	| "planned"
	| "writable"
	| "written"
	| "passing"
	| "blocked"
	| "skipped"
	| "unknown";

export type TrajectoryKind = "example" | "property" | "contract" | "approval" | "formal";

export type TrajectoryScope = "unit" | "integration" | "e2e";

export interface TrajectoryRow {
	id: string;
	asserts: string;
	/**
	 * The phase number from the cell — `3` for both `Phase 3` and `Test Phase
	 * 3`. It stays a bare number so every consumer written before test phases
	 * existed keeps working unchanged; the companion `*Kind` field carries
	 * which sequence it counts in, and `phaseOrdinal` puts the two on one
	 * timeline for callers that compare across them.
	 */
	writableAt: number;
	passesAt: number;
	/** Which sequence `writableAt` counts in. `"build"` when unspecified. */
	writableAtKind: PhaseKind;
	/** Which sequence `passesAt` counts in. `"build"` when unspecified. */
	passesAtKind: PhaseKind;
	state: TrajectoryState;
	kind?: TrajectoryKind;
	/**
	 * The row's test level as written: its `Level` cell, or its `Kind` cell in
	 * an impl written when the level was called a kind; null when the table
	 * has neither column. What `test_levels: required` checks against the five
	 * levels (`lib/test-levels.ts`). `kind` above is the older, optional style
	 * vocabulary, kept so impls written with it still parse.
	 */
	levelText?: string | null;
	/** The `For` cell as written, or null when the table has no For column. */
	purposeText?: string | null;
	/** What the row is for (planner-promises ADR D3); null when it does not say. */
	purpose?: RowPurpose | null;
	scope?: TrajectoryScope;
	/**
	 * Optional `Test` column — the test FILES backing this row, comma-separated.
	 *
	 * Files rather than test names or line numbers, because `atdawn verify` runs
	 * them through the project's own command and reads the exit code. That keeps
	 * attribution runner-agnostic: parsing a runner's structured output to match
	 * per-test tags would be more precise but would hardcode tool knowledge into
	 * core, which extensions own. Absent means the row is not red-test-checkable
	 * — reported as unverified, never counted as passed.
	 */
	test?: string[];
}

/**
 * What a test row is for: the promises it proves and the lessons it guards,
 * or the reason it needs neither. A cell of tokens only (`promise: <name>`,
 * `lesson: <name>`, comma-separated) names things; any other text is the
 * reason.
 */
export interface RowPurpose {
	promises: string[];
	lessons: string[];
	reason: string | null;
	/**
	 * Why the cell is neither tokens nor a reason (planner-promises A30), when
	 * it is not: it tries to name a promise or a lesson and does not, or it is
	 * only a mark. Read as a reason, such a cell made the row name nothing.
	 */
	malformed?: string;
}

/** Read a `For` cell. Null when it is empty. The hooks carry a copy. */
export function parsePurpose(cell: string): RowPurpose | null {
	const text = cell.trim();
	if (!text) return null;
	const promises: string[] = [];
	const lessons: string[] = [];
	for (const part of text.split(",")) {
		const m = /^(promise|lesson):\s*([a-z][a-z0-9-]*)$/.exec(part.trim());
		if (!m) return reasonOrMalformed(text);
		(m[1] === "promise" ? promises : lessons).push(m[2]);
	}
	return { promises, lessons, reason: null };
}

function reasonOrMalformed(text: string): RowPurpose {
	if (/\b(?:promise|lesson):/i.test(text)) {
		return {
			promises: [],
			lessons: [],
			reason: null,
			malformed:
				"names a promise or a lesson, but not as `promise: <name>` or `lesson: <name>` (the bare name, no backticks, nothing after it; several separated by commas)",
		};
	}
	if (text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length < 2) {
		return {
			promises: [],
			lessons: [],
			reason: null,
			malformed: "is a mark, not a reason: say why the row needs no promise or lesson",
		};
	}
	return { promises: [], lessons: [], reason: text };
}

export interface DeferredRow {
	name: string;
	reason: string;
	wouldRequire: string;
	mitigation: string;
}

export interface Trajectory {
	rows: TrajectoryRow[];
	deferred: DeferredRow[];
	present: boolean;
	/**
	 * Table lines whose cell count is not the header's (planner-promises A31).
	 * They are not rows — a cell cannot be matched to its column — so they are
	 * reported here rather than dropped without a word.
	 */
	misshapen?: MisshapenRow[];
}

/** A table line the parser could not read as a row: its first cell, and how many cells it has against the header's. */
export interface MisshapenRow {
	id: string;
	cells: number;
	expected: number;
}

/** The table lines whose cell count is not the header's. The hooks carry a copy. */
export function findMisshapenRows(tableLines: string[]): MisshapenRow[] {
	const pipeLines = tableLines.filter((line) => line.trim().startsWith("|"));
	if (pipeLines.length < 2) return [];
	const expected = parseTableRow(pipeLines[0]).length;
	return pipeLines.slice(2).flatMap((line) => {
		const cells = parseTableRow(line);
		if (cells.length === expected) return [];
		const first = /^\|\s*([^|]*)/.exec(line.trim())?.[1].trim() ?? "";
		return [{ id: first || "(a row with no ID)", cells: cells.length, expected }];
	});
}

const TRAJECTORY_HEADING = /^##\s+Test Trajectory\b/;
const DEFERRED_HEADING = /^###\s+Deferred Verification\b/;
const NEXT_SECTION_HEADING = /^#{1,3}\s+/;

const VALID_STATES: ReadonlySet<TrajectoryState> = new Set([
	"planned",
	"writable",
	"written",
	"passing",
	"blocked",
	"skipped",
	"unknown",
]);

/**
 * States in which a row's authoring obligation is discharged.
 *
 * **One definition on purpose.** The phase-close probe (`run/probe.ts`) and
 * `atdawn verify` (`verify/detect.ts`) both ask "has this row been dealt with?",
 * and if they answered differently a phase would close in one lane and not the
 * other. A second copy would not be a duplicated line — it would be a silent
 * divergence between two enforcement lanes, so the rule lives here.
 *
 * `hooks/check-gates.js` encodes the same set inline; that JS port is a
 * deliberate mirror under the existing hook-port convention (change the TS and
 * every JS port together), not an accidental third copy.
 */
export const TERMINAL_STATES: ReadonlySet<string> = new Set([
	"written",
	"passing",
	"skipped",
	"blocked",
]);

const VALID_KINDS: ReadonlySet<TrajectoryKind> = new Set([
	"example",
	"property",
	"contract",
	"approval",
	"formal",
]);

const VALID_SCOPES: ReadonlySet<TrajectoryScope> = new Set(["unit", "integration", "e2e"]);

/**
 * Parse a markdown table row into cells. Strips the leading/trailing pipe and
 * splits on unescaped pipes. Does NOT handle escaped pipes inside cell content
 * — the trajectory asserts column does not contain pipes in practice.
 */
function parseTableRow(line: string): string[] {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
	return trimmed
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());
}

/**
 * Normalize a header cell to a canonical key. Case-insensitive, trims
 * whitespace, maps variant spellings to canonical names.
 */
function normalizeHeader(header: string): string {
	const normalized = header.toLowerCase().replace(/\s+/g, " ").trim();
	const aliases: Record<string, string> = {
		id: "id",
		asserts: "asserts",
		"writable at": "writableAt",
		"passes at": "passesAt",
		state: "state",
		kind: "kind",
		level: "level",
		for: "for",
		scope: "scope",
	};
	return aliases[normalized] ?? normalized;
}

/**
 * Parse a "Phase N" / "Build Phase N" / "Test Phase N" cell into a number.
 * Returns NaN if the cell is not a valid phase reference — the validator
 * catches NaN and emits a specific error.
 */
function parsePhaseReference(cell: string): number {
	return parsePhaseRef(cell)?.number ?? Number.NaN;
}

/** Which sequence a phase cell counts in. Build when unspecified. */
function parsePhaseReferenceKind(cell: string): PhaseKind {
	return parsePhaseRef(cell)?.kind ?? "build";
}

function parseState(cell: string): TrajectoryState {
	const normalized = cell.toLowerCase().trim();
	if (VALID_STATES.has(normalized as TrajectoryState)) {
		return normalized as TrajectoryState;
	}
	return "unknown";
}

function parseOptionalKind(cell: string): TrajectoryKind | undefined {
	const normalized = cell.toLowerCase().trim();
	if (!normalized) return undefined;
	if (VALID_KINDS.has(normalized as TrajectoryKind)) {
		return normalized as TrajectoryKind;
	}
	return undefined;
}

/**
 * Parse the optional `Test` cell into file paths. Comma-separated, backticks
 * stripped (authors write them as code spans). Empty → undefined, which the
 * verifier reads as "not checkable", distinct from "checked and passed".
 */
function parseOptionalTestRefs(cell: string): string[] | undefined {
	const refs = cell
		.split(",")
		.map((ref) =>
			ref
				.trim()
				.replace(/^`+|`+$/g, "")
				.trim(),
		)
		.filter((ref) => ref.length > 0);
	return refs.length > 0 ? refs : undefined;
}

function parseOptionalScope(cell: string): TrajectoryScope | undefined {
	const normalized = cell.toLowerCase().trim();
	if (!normalized) return undefined;
	if (VALID_SCOPES.has(normalized as TrajectoryScope)) {
		return normalized as TrajectoryScope;
	}
	return undefined;
}

/**
 * Extract the block of lines under `## Test Trajectory` up to the next
 * heading of equal or lesser depth. The trajectory block includes the
 * main table; the `### Deferred Verification` subsection is extracted
 * separately.
 */
function extractTrajectoryBlock(lines: string[]): {
	tableLines: string[];
	deferredLines: string[];
} {
	let inTrajectory = false;
	let inDeferred = false;
	const tableLines: string[] = [];
	const deferredLines: string[] = [];

	for (const line of lines) {
		if (TRAJECTORY_HEADING.test(line)) {
			inTrajectory = true;
			inDeferred = false;
			continue;
		}
		if (!inTrajectory) continue;

		if (DEFERRED_HEADING.test(line)) {
			inDeferred = true;
			continue;
		}

		// A new top-level or second-level heading ends the trajectory block.
		// A third-level heading other than Deferred Verification also ends it.
		if (NEXT_SECTION_HEADING.test(line) && !DEFERRED_HEADING.test(line)) {
			const depth = line.match(/^(#{1,6})/)?.[1].length ?? 0;
			if (depth <= 2) break;
			// A ### heading that isn't Deferred Verification ends the trajectory
			if (depth === 3) break;
		}

		if (inDeferred) {
			deferredLines.push(line);
		} else {
			tableLines.push(line);
		}
	}

	return { tableLines, deferredLines };
}

/**
 * Parse a Deferred Verification block. Each deferred item is a top-level
 * bullet with three sub-bullets:
 *
 * - **{name}**
 *   - reason: {text}
 *   - would require: {text}
 *   - mitigation: {text}
 */
function parseDeferredBlock(lines: string[]): DeferredRow[] {
	const rows: DeferredRow[] = [];
	let current: Partial<DeferredRow> | null = null;

	const flush = () => {
		if (current && current.name !== undefined) {
			rows.push({
				name: current.name,
				reason: current.reason ?? "",
				wouldRequire: current.wouldRequire ?? "",
				mitigation: current.mitigation ?? "",
			});
		}
		current = null;
	};

	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+$/, "");
		// Top-level bullet with bolded name: - **{name}**
		const nameMatch = line.match(/^-\s+\*\*(.+?)\*\*\s*(?:—\s*(.*))?$/);
		if (nameMatch) {
			flush();
			current = { name: nameMatch[1].trim() };
			// Handle inline one-line form: - **Name** — reason: X — would require: Y — mitigation: Z
			const rest = nameMatch[2];
			if (rest) {
				const reasonMatch = rest.match(/reason:\s*([^—]+?)(?:\s*—|$)/i);
				const wrMatch = rest.match(/would require:\s*([^—]+?)(?:\s*—|$)/i);
				const mitMatch = rest.match(/mitigation:\s*(.+)$/i);
				if (reasonMatch) current.reason = reasonMatch[1].trim();
				if (wrMatch) current.wouldRequire = wrMatch[1].trim();
				if (mitMatch) current.mitigation = mitMatch[1].trim();
			}
			continue;
		}

		if (!current) continue;

		// Sub-bullet: - reason: / - would require: / - mitigation:
		const subMatch = line.match(/^\s+-\s+(reason|would require|mitigation):\s*(.*)$/i);
		if (subMatch) {
			const key = subMatch[1].toLowerCase();
			const value = subMatch[2].trim();
			if (key === "reason") current.reason = value;
			else if (key === "would require") current.wouldRequire = value;
			else if (key === "mitigation") current.mitigation = value;
		}
	}
	flush();

	return rows;
}

/**
 * Parse the trajectory table. Returns rows parsed from the GFM table under
 * `## Test Trajectory`. Unknown column headers are ignored. Rows with
 * missing required columns are skipped — the validator catches structural
 * problems and surfaces them.
 */
function parseTrajectoryTable(lines: string[]): TrajectoryRow[] {
	const tableLines = lines.filter((line) => line.trim().startsWith("|"));
	if (tableLines.length < 2) return [];

	const headerCells = parseTableRow(tableLines[0]);
	const separator = parseTableRow(tableLines[1]);
	// Separator row looks like |----|----|... — every cell is dashes/colons
	const isSeparator = separator.every((cell) => /^:?-+:?$/.test(cell));
	if (!isSeparator) return [];

	const columnKeys = headerCells.map(normalizeHeader);
	const rows: TrajectoryRow[] = [];

	for (let i = 2; i < tableLines.length; i++) {
		const cells = parseTableRow(tableLines[i]);
		if (cells.length !== columnKeys.length) continue;

		const record: Record<string, string> = {};
		for (let j = 0; j < columnKeys.length; j++) {
			record[columnKeys[j]] = cells[j];
		}

		const id = record.id?.trim();
		const asserts = record.asserts?.trim();
		if (!id || !asserts) continue;

		rows.push({
			id,
			asserts,
			writableAt: parsePhaseReference(record.writableAt ?? ""),
			passesAt: parsePhaseReference(record.passesAt ?? ""),
			writableAtKind: parsePhaseReferenceKind(record.writableAt ?? ""),
			passesAtKind: parsePhaseReferenceKind(record.passesAt ?? ""),
			state: parseState(record.state ?? ""),
			kind: parseOptionalKind(record.kind ?? ""),
			levelText: (record.level ?? record.kind)?.trim() ?? null,
			purposeText: record.for === undefined ? null : record.for.trim(),
			purpose: record.for === undefined ? null : parsePurpose(record.for),
			scope: parseOptionalScope(record.scope ?? ""),
			test: parseOptionalTestRefs(record.test ?? ""),
		});
	}

	return rows;
}

/**
 * Parse a Test Trajectory from an impl.md body (the content after the
 * frontmatter). Returns an empty trajectory with `present: false` when the
 * `## Test Trajectory` section is absent. Never throws — errors are surfaced
 * by the validator, not the parser.
 */
export function parseTrajectory(body: string): Trajectory {
	const lines = body.split("\n");
	const hasTrajectory = lines.some((line) => TRAJECTORY_HEADING.test(line));
	if (!hasTrajectory) {
		return { rows: [], deferred: [], present: false };
	}

	const { tableLines, deferredLines } = extractTrajectoryBlock(lines);
	const rows = parseTrajectoryTable(tableLines);
	const deferred = parseDeferredBlock(deferredLines);

	return { rows, deferred, present: true, misshapen: findMisshapenRows(tableLines) };
}
