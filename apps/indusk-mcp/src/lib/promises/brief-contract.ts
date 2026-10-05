import { fencedLineMask } from "../impl-headings.js";

/**
 * The one reader of a brief's contract (planner-promises ADR D1).
 *
 * A brief in the new shape holds what the planning conversation produced:
 *
 * ```markdown
 * ## Expectations
 * 1. **{what we expect to follow}**
 *    - Measure: {how we would know}
 *    - Look: {when to check}
 * (or: None — {reason})
 *
 * ## Promises
 * ### This plan makes
 * 1. **`{name}`** ({kind}). {the sentence}
 * ### Existing promises
 * **Must not break**
 * - **`{name}`**. {why it is touched}
 * **Changes**
 * - **`{name}`**. {the new sentence}
 * **Replaces**
 * - **`{old-name}`**, by **`{new-name}`**.
 * ### Not promised
 * - {what was chosen not to promise}
 * ```
 *
 * A brief with no `## Promises` heading is `legacy` and nothing here applies
 * to it. Prose between the parts is allowed and ignored; lines inside a code
 * fence are not read at all.
 *
 * What is *not* allowed is a line that looks like part of the contract and
 * cannot be read as one: a label with words after it, a promise named under
 * none of the three lists, a list entry that names no promise. Each is a
 * `problem`, because the alternative is a list read as empty and a check that
 * passes having checked nothing.
 */

export interface BriefExpectation {
	/** The expectation as the brief names it: its bold lead, else its first sentence of text. */
	text: string;
	measure: string | null;
	look: string | null;
}

export interface BriefMade {
	name: string;
	/** The kind in brackets, or null when the brief gives none. */
	kind: string | null;
	sentence: string;
}

export interface BriefContract {
	shape: "contract";
	expectations: BriefExpectation[];
	/**
	 * The reason given with `None — {reason}`: `""` when the brief says `None`
	 * and gives no reason, `null` when it does not say it has none.
	 */
	noExpectations: string | null;
	makes: BriefMade[];
	mustNotBreak: string[];
	changes: Array<{ name: string; sentence: string }>;
	replaces: Array<{ old: string; by: string }>;
	/** Lines in the contract's sections that are not in its shape. */
	problems: string[];
}

export type ParsedBrief = { shape: "legacy" } | BriefContract;

const LISTS = {
	"must not break": "Must not break",
	changes: "Changes",
	replaces: "Replaces",
} as const;
type ListKey = keyof typeof LISTS;

const NAMED = /^\*\*`([^`]+)`\*\*/;
const NONE = /^none\b[\s.]*(?:[—–-]+\s*(.*))?$/i;

/** One line of a section, with its 1-based position in the brief. */
interface Line {
	text: string;
	n: number;
}

/** A list item or a numbered item with the lines wrapped under it joined. */
interface Item {
	/** The item's own text, wrapped lines joined with a space. */
	text: string;
	/** Its sub-bullets, each with its wrapped lines joined. */
	subs: string[];
	n: number;
}

/** A sentence with its wrapping undone: every run of whitespace one space. */
export const collapseSpace = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Whether a brief's sentence and the registry's are the same sentence. A
 * brief wraps its lines and the registry holds one paragraph, so they are
 * compared with their whitespace collapsed; the contract and confirm both ask
 * here.
 */
export function sameSentence(a: string, b: string): boolean {
	return collapseSpace(a) === collapseSpace(b);
}

/** The lines under the first heading of `level` whose title is `title`, up to the next heading at that level or above. */
function section(lines: Line[], level: number, title: string): Line[] | null {
	const heading = new RegExp(`^#{${level}}\\s+${title}\\s*$`, "i");
	const start = lines.findIndex((l) => heading.test(l.text));
	if (start === -1) return null;
	const boundary = new RegExp(`^#{1,${level}}\\s`);
	const rest = lines.slice(start + 1);
	const end = rest.findIndex((l) => boundary.test(l.text));
	return end === -1 ? rest : rest.slice(0, end);
}

/**
 * Top-level items of a section: lines that match `marker` (up to three
 * spaces in, as markdown allows), each
 * with what is wrapped or nested under it. A blank line ends an item's
 * wrapped text but not the item — a sub-bullet may follow one.
 */
function items(lines: Line[], marker: RegExp): Item[] {
	const out: Item[] = [];
	let current: Item | null = null;
	let target: "text" | "sub" = "text";
	for (const line of lines) {
		const top = marker.exec(line.text);
		if (top) {
			current = { text: line.text.slice(top[0].length), subs: [], n: line.n };
			out.push(current);
			target = "text";
			continue;
		}
		if (!current) continue;
		if (line.text.trim() === "") continue;
		if (!/^\s/.test(line.text)) {
			// Prose back at column 0: the item is over.
			current = null;
			continue;
		}
		const sub = /^\s+[-*]\s+(.*)$/.exec(line.text);
		if (sub) {
			current.subs.push(sub[1]);
			target = "sub";
		} else if (target === "sub") {
			current.subs[current.subs.length - 1] += ` ${line.text.trim()}`;
		} else {
			current.text += ` ${line.text.trim()}`;
		}
	}
	for (const item of out) {
		item.text = collapseSpace(item.text);
		item.subs = item.subs.map(collapseSpace);
	}
	return out;
}

const NUMBERED = /^ {0,3}\d+\.\s+/;
const BULLET = /^ {0,3}[-*]\s+/;
/** An entry under "This plan makes": numbered as the template writes it, or bulleted. */
const ENTRY = /^ {0,3}(?:\d+\.|[-*])\s+/;
/** A line that starts with a promise's name, as an entry does. */
const NAMES_A_PROMISE = /^\s*(?:(?:\d+\.|[-*])\s+)?\*\*`([^`]+)`\*\*/;
const LABEL = /^\*\*(must not break|changes|replaces)\*\*(.*)$/i;
/** The template's own placeholder, `{how we would know}`: not a measure. */
const PLACEHOLDER = /^\{[^}]*\}$/;

/** The value of a `- Measure: …` sub-bullet (the label may be bold); null when absent or empty. */
function labelled(subs: string[], label: string): string | null {
	const pattern = new RegExp(`^\\**${label}\\**\\s*:\\**\\s*(.*)$`, "i");
	for (const sub of subs) {
		const m = pattern.exec(sub);
		if (m) return m[1].trim() === "" || PLACEHOLDER.test(m[1].trim()) ? null : m[1].trim();
	}
	return null;
}

function readExpectations(lines: Line[]): Pick<BriefContract, "expectations" | "noExpectations"> {
	const expectations = items(lines, NUMBERED).map((item): BriefExpectation => {
		const bold = /^\*\*(.+?)\*\*/.exec(item.text);
		return {
			text: bold ? bold[1].trim() : item.text,
			measure: labelled(item.subs, "Measure"),
			look: labelled(item.subs, "Look"),
		};
	});
	if (expectations.length > 0) return { expectations, noExpectations: null };
	for (const line of lines) {
		const none = NONE.exec(line.text.trim());
		if (none) return { expectations, noExpectations: (none[1] ?? "").trim() };
	}
	return { expectations, noExpectations: null };
}

function readMakes(lines: Line[], problems: string[], read: Set<number>): BriefMade[] {
	const makes: BriefMade[] = [];
	for (const item of items(lines, ENTRY)) {
		read.add(item.n);
		const m = /^\*\*`([^`]+)`\*\*\s*(?:\(([^)]*)\))?[.:]?\s*(.*)$/.exec(item.text);
		if (!m) {
			problems.push(
				`line ${item.n}: under "This plan makes", an entry does not start with the promise's name as **\`name\`** (kind). — "${item.text}"`,
			);
			continue;
		}
		makes.push({ name: m[1], kind: m[2]?.trim() || null, sentence: m[3].trim() });
	}
	return makes;
}

function readExisting(
	lines: Line[],
	problems: string[],
	read: Set<number>,
): Pick<BriefContract, "mustNotBreak" | "changes" | "replaces"> {
	const out = {
		mustNotBreak: [] as string[],
		changes: [] as Array<{ name: string; sentence: string }>,
		replaces: [] as Array<{ old: string; by: string }>,
	};
	// Split the section at its labels; what comes before the first is preamble.
	const groups: Array<{ list: ListKey | null; lines: Line[] }> = [{ list: null, lines: [] }];
	for (const line of lines) {
		const label = LABEL.exec(line.text);
		if (!label) {
			groups[groups.length - 1].lines.push(line);
			continue;
		}
		const list = label[1].toLowerCase() as ListKey;
		if (!/^:?\s*$/.test(label[2])) {
			problems.push(
				`line ${line.n}: the label **${LISTS[list]}** must be on its own line, with its promises listed under it — "${line.text.trim()}"`,
			);
		}
		groups.push({ list, lines: [] });
	}
	for (const group of groups) {
		for (const item of items(group.lines, BULLET)) {
			read.add(item.n);
			const named = NAMED.exec(item.text);
			if (group.list === null) {
				// Preamble is prose. A bullet there that names a promise is an
				// entry no list holds, and nothing would check it.
				if (named) {
					problems.push(
						`line ${item.n}: \`${named[1]}\` is named under "Existing promises" but under none of **Must not break**, **Changes** or **Replaces**`,
					);
				}
				continue;
			}
			if (!named) {
				problems.push(
					`line ${item.n}: under **${LISTS[group.list]}**, an entry does not start with a promise's name as **\`name\`** — "${item.text}"`,
				);
				continue;
			}
			const rest = item.text.slice(named[0].length);
			if (group.list === "must not break") out.mustNotBreak.push(named[1]);
			else if (group.list === "changes") {
				out.changes.push({ name: named[1], sentence: rest.replace(/^[.:]?\s*/, "").trim() });
			} else {
				const by = /^,?\s*by\s+\*\*`([^`]+)`\*\*/i.exec(rest);
				if (!by) {
					problems.push(
						`line ${item.n}: under **Replaces**, \`${named[1]}\` does not say what replaces it, as **\`${named[1]}\`**, by **\`new-name\`**.`,
					);
					continue;
				}
				out.replaces.push({ old: named[1], by: by[1] });
			}
		}
	}
	return out;
}

/**
 * What the Promises section says that no list read (A32): a line that starts
 * with a promise's name but is not an entry of any list, and a label outside
 * "### Existing promises". Either way the promise would be checked by
 * nothing, which is the failure this reader exists to prevent.
 */
function unreadLines(promises: Line[], read: Set<number>): string[] {
	const existing = new Set((section(promises, 3, "Existing promises") ?? []).map((l) => l.n));
	const notPromised = new Set((section(promises, 3, "Not promised") ?? []).map((l) => l.n));
	const out: string[] = [];
	for (const line of promises) {
		if (notPromised.has(line.n)) continue;
		const label = LABEL.exec(line.text);
		if (label && !existing.has(line.n)) {
			out.push(
				`line ${line.n}: the label **${LISTS[label[1].toLowerCase() as ListKey]}** is not under "### Existing promises", so nothing reads the promises listed under it`,
			);
			continue;
		}
		const named = NAMES_A_PROMISE.exec(line.text);
		if (named && !read.has(line.n)) {
			out.push(
				`line ${line.n}: \`${named[1]}\` is written in the Promises section, but no list reads it — an entry goes under "### This plan makes", or under one of the three labels in "### Existing promises"`,
			);
		}
	}
	return out;
}

/** Read a brief's contract. `legacy` when it has no `## Promises` heading and none of the parts beneath it. */
export function parseBriefContract(text: string): ParsedBrief {
	const raw = text.split("\n");
	const fenced = fencedLineMask(raw);
	const lines: Line[] = raw
		.map((t, i) => ({ text: t.replace(/\s+$/, ""), n: i + 1 }))
		.filter((_, i) => !fenced[i]);

	const promises = section(lines, 2, "Promises");
	if (promises === null) {
		// A brief written in the new parts without the heading that holds them
		// is out of shape, not one written before the parts existed.
		const newParts = lines.filter(
			(l) =>
				/^##\s+Expectations\s*$/i.test(l.text) ||
				/^###\s+This plan makes\s*$/i.test(l.text) ||
				LABEL.test(l.text),
		);
		if (newParts.length === 0) return { shape: "legacy" };
		return {
			shape: "contract",
			...readExpectations(section(lines, 2, "Expectations") ?? []),
			makes: [],
			mustNotBreak: [],
			changes: [],
			replaces: [],
			problems: [
				`line ${newParts[0].n}: the brief is written in the parts of a contract but has no "## Promises" heading above them, so none of its promises is read — add "## Promises" above "### This plan makes"`,
			],
		};
	}

	const problems: string[] = [];
	const read = new Set<number>();
	const makes = section(promises, 3, "This plan makes");
	if (makes === null) {
		problems.push(
			'"## Promises" has no "### This plan makes" section — the promises this plan makes are listed there, or it says None.',
		);
	}
	const made = makes === null ? [] : readMakes(makes, problems, read);
	const existing = readExisting(section(promises, 3, "Existing promises") ?? [], problems, read);
	problems.push(...unreadLines(promises, read));
	return {
		shape: "contract",
		...readExpectations(section(lines, 2, "Expectations") ?? []),
		makes: made,
		...existing,
		problems,
	};
}
