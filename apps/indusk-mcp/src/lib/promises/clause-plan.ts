import { fencedLineMask } from "../impl-headings.js";

/**
 * The clause plan (plans-are-promises ADR D5): `test-plan.md` for a plan that
 * states its promises as clauses. One `## \`promise\`` section per promise,
 * one `### \`clause\`` subsection per clause, each clause carrying a
 * `- Signal:` line saying where it is read, what counts as upheld and what it
 * reports when broken. Anything else in the document is prose and is left
 * alone; headings inside a code fence are not headings.
 */

export interface ClausePlanClause {
	name: string;
	/** The text after `- Signal:`, or null when the clause has no signal line or it is empty. */
	signal: string | null;
}

export interface ClausePlanPromise {
	name: string;
	clauses: ClausePlanClause[];
}

export interface ClausePlan {
	promises: ClausePlanPromise[];
}

const PROMISE_HEADING = /^##\s+`([a-z][a-z0-9-]*)`/;
const CLAUSE_HEADING = /^###\s+`([a-z][a-z0-9-]*)`/;
const SIGNAL_LINE = /^[-*]\s+Signal:\s*(.*)$/i;

/** Read a clause plan's sections. A document with none yields no promises. */
export function parseClausePlan(text: string): ClausePlan {
	const lines = text.split("\n");
	const fenced = fencedLineMask(lines);
	const promises: ClausePlanPromise[] = [];
	let promise: ClausePlanPromise | null = null;
	let clause: ClausePlanClause | null = null;
	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) continue;
		const line = lines[i];
		const p = PROMISE_HEADING.exec(line);
		if (p) {
			promise = { name: p[1], clauses: [] };
			promises.push(promise);
			clause = null;
			continue;
		}
		if (/^##\s/.test(line)) {
			promise = null;
			clause = null;
			continue;
		}
		const c = CLAUSE_HEADING.exec(line);
		if (c) {
			clause = { name: c[1], signal: null };
			promise?.clauses.push(clause);
			continue;
		}
		const s = SIGNAL_LINE.exec(line.trim());
		if (s && clause && clause.signal === null && s[1].trim()) clause.signal = s[1].trim();
	}
	return { promises };
}
