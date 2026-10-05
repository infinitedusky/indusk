/**
 * Deliberate port of `src/lib/trajectory/parser.ts` — reading the Test
 * Trajectory table and its Deferred Verification block.
 *
 * Hook-local (`_`-prefixed): imported by hooks, never registered as one, so it
 * needs no settings entry — but it must exist in `.claude/hooks/` or every
 * importer dies at load. `globSync("*.js")` copies it on init and update.
 *
 * **One definition, shared by both hooks, and pinned by A23.** `check-gates.js`
 * and `validate-impl-structure.js` each carried their own copy until this
 * extraction, and the copies had already diverged: check-gates' kept a local
 * `Phase N` regex, so when `Test Phase N` became a legal cell it read every row
 * as `NaN` and Gate A matched nothing. Nothing failed loudly — the gate simply
 * stopped enforcing. A duplicated parser does not announce itself when it falls
 * behind, which is why the guard counts definitions rather than testing
 * behaviour.
 *
 * Change `src/lib/trajectory/parser.ts` and this file together.
 */

import { parsePhaseRef } from "./_impl-headings.js";

/** Strip YAML frontmatter, if present. Callers may pass a body either way. */
export function stripFrontmatter(content) {
	const m = content.match(/^---\n[\s\S]*?\n---\n/);
	return m ? content.slice(m[0].length) : content;
}

export function parseTrajectoryFromBody(implBody) {
	const lines = implBody.split("\n");
	let inTrajectory = false;
	let inDeferred = false;
	const tableLines = [];
	const deferredLines = [];

	for (const line of lines) {
		if (/^##\s+Test Trajectory\b/.test(line)) {
			inTrajectory = true;
			inDeferred = false;
			continue;
		}
		if (!inTrajectory) continue;

		if (/^###\s+Deferred Verification\b/.test(line)) {
			inDeferred = true;
			continue;
		}

		if (/^#{1,3}\s+/.test(line) && !/^###\s+Deferred Verification\b/.test(line)) {
			const depth = (line.match(/^(#{1,6})/) || ["", ""])[1].length;
			if (depth <= 3) break;
		}

		if (inDeferred) deferredLines.push(line);
		else tableLines.push(line);
	}

	return {
		rows: parseTrajectoryTable(tableLines),
		deferred: parseDeferredBlock(deferredLines),
		misshapen: findMisshapenRows(tableLines),
	};
}

/** Port of `findMisshapenRows` in `src/lib/trajectory/parser.ts` (planner-promises A31). */
export function findMisshapenRows(tableLines) {
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

export function parseTableRow(line) {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
	return trimmed
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());
}

export function normalizeHeader(header) {
	const normalized = header.toLowerCase().replace(/\s+/g, " ").trim();
	const aliases = {
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
	return aliases[normalized] || normalized;
}

/**
 * Read a `For` cell: tokens only (`promise: <name>`, `lesson: <name>`,
 * comma-separated) name things; any other text is the reason. Null when
 * empty. Port of `parsePurpose` in `src/lib/trajectory/parser.ts`.
 */
export function parsePurpose(cell) {
	const text = cell.trim();
	if (!text) return null;
	const promises = [];
	const lessons = [];
	for (const part of text.split(",")) {
		const m = /^(promise|lesson):\s*([a-z][a-z0-9-]*)$/.exec(part.trim());
		if (!m) return reasonOrMalformed(text);
		(m[1] === "promise" ? promises : lessons).push(m[2]);
	}
	return { promises, lessons, reason: null };
}

/** Port of `reasonOrMalformed` in `src/lib/trajectory/parser.ts` (planner-promises A30). */
function reasonOrMalformed(text) {
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

export function parsePhaseRefNumber(cell) {
	return parsePhaseRef(cell)?.number ?? Number.NaN;
}

export function parsePhaseRefKind(cell) {
	return parsePhaseRef(cell)?.kind ?? "build";
}

export function parseTrajectoryTable(lines) {
	const pipeLines = lines.filter((l) => l.trim().startsWith("|"));
	if (pipeLines.length < 2) return [];
	const header = parseTableRow(pipeLines[0]);
	const sep = parseTableRow(pipeLines[1]);
	if (!sep.every((c) => /^:?-+:?$/.test(c))) return [];
	const keys = header.map(normalizeHeader);

	const rows = [];
	for (let i = 2; i < pipeLines.length; i++) {
		const cells = parseTableRow(pipeLines[i]);
		if (cells.length !== keys.length) continue;
		const rec = {};
		for (let j = 0; j < keys.length; j++) rec[keys[j]] = cells[j];
		if (!rec.id || !rec.asserts) continue;
		rows.push({
			id: rec.id.trim(),
			asserts: rec.asserts.trim(),
			writableAt: parsePhaseRefNumber(rec.writableAt || ""),
			passesAt: parsePhaseRefNumber(rec.passesAt || ""),
			writableAtKind: parsePhaseRefKind(rec.writableAt || ""),
			passesAtKind: parsePhaseRefKind(rec.passesAt || ""),
			// `state` is read by check-gates and ignored by the validator — and
			// the validator's copy of this parser did not produce it at all.
			// Unifying the two surfaced that immediately: without this field
			// every row reads as non-terminal and Gate A blocks everything. The
			// union of what both callers need is the only correct shape for a
			// shared parser, and a divergence in *fields* is exactly as silent
			// as the divergence in phase-reference parsing that motivated A23.
			state: (rec.state || "").toLowerCase().trim(),
			// The row's level as written — its `Level` cell, or `Kind` in an
			// impl written when the level was called a kind — or null when the
			// table has neither: `test_levels: required` checks it.
			level: (rec.level ?? rec.kind)?.trim() ?? null,
			// What the row is for (planner-promises): the `For` cell as
			// written, null when the table has no such column, and its reading.
			purposeText: rec.for === undefined ? null : rec.for.trim(),
			purpose: rec.for === undefined ? null : parsePurpose(rec.for),
		});
	}
	return rows;
}

export function parseDeferredBlock(lines) {
	const rows = [];
	let current = null;
	const flush = () => {
		if (current && current.name !== undefined) {
			rows.push({
				name: current.name,
				reason: current.reason || "",
				wouldRequire: current.wouldRequire || "",
				mitigation: current.mitigation || "",
			});
		}
		current = null;
	};
	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+$/, "");
		const nameMatch = line.match(/^-\s+\*\*(.+?)\*\*\s*(?:—\s*(.*))?$/);
		if (nameMatch) {
			flush();
			current = { name: nameMatch[1].trim() };
			const rest = nameMatch[2];
			if (rest) {
				const rm = rest.match(/reason:\s*([^—]+?)(?:\s*—|$)/i);
				const wm = rest.match(/would require:\s*([^—]+?)(?:\s*—|$)/i);
				const mm = rest.match(/mitigation:\s*(.+)$/i);
				if (rm) current.reason = rm[1].trim();
				if (wm) current.wouldRequire = wm[1].trim();
				if (mm) current.mitigation = mm[1].trim();
			}
			continue;
		}
		if (!current) continue;
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
