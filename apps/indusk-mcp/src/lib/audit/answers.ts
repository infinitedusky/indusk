import { fencedLineMask } from "../impl-headings.js";

/**
 * The one reader of `audit.md` and `plan-review.md` (audit-concerns-are-answered,
 * ADR D2, D6, D8, D9): what each finding says would show it breaking, what the plan's
 * agent answered, which answers are dismissals or amendments the person must see, and
 * whether the file is complete. A pure read over text; the command prints it and the
 * planning loop's state is built from it.
 *
 * promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes
 * promise: an-audit-concern-gets-a-solution — the reader that refuses an unanswered finding,
 * a signal naming no clause, or an answer with no text.
 */

/** What the post-build audit asks of the code, as the reader's headings. */
export const AUDIT_QUESTIONS = [
	"Does each row prove its promise's sentence, or something narrower?",
	"What does the diff change that no row touches?",
	"What does the code do that the brief never promised?",
	"Which rejected ADR alternative does the code quietly take?",
] as const;

/** What the plan review asks of the plan's documents, before any code exists. */
export const PLAN_REVIEW_QUESTIONS = [
	"Do the planned tests prove each promise's sentence, or something narrower?",
	"Does the impl build what each promise claims, and nothing it does not?",
	"Which skip reason would you not accept?",
	"What else would have to change for each promise to hold?",
] as const;

/** The heading of the agent's closing section; not a question, never a finding's. */
export const CAUSES_HEADING = "What let these through?";

export type AnswerKind = "fix" | "signal" | "amendment" | "nothing";

export interface Finding {
	question: string;
	/** The finding's text, without its list marker. */
	finding: string;
	/** 1-based line of the finding in the file. */
	line: number;
	breaksWhen: string | null;
	answer: { kind: AnswerKind; text: string } | null;
}

export interface Dismissal {
	question: string;
	finding: string;
	reason: string;
}

export interface Amendment {
	question: string;
	finding: string;
	part: string;
}

export interface AuditAnswers {
	findings: Finding[];
	/** Findings with no `breaks when:` line. */
	incomplete: Finding[];
	/** Findings with no `answer:` line. */
	unanswered: Finding[];
	/** Signal answers naming no `clause: <promise>/<clause>`. */
	noClause: Finding[];
	dismissals: Dismissal[];
	amendments: Amendment[];
	/** Questions with no heading in the file. */
	missingQuestions: string[];
	/** Findings exist and the `What let these through?` section does not. */
	missingCauses: boolean;
}

export interface ReadOptions {
	questions?: readonly string[];
	/** Whether the closing causes section is required; the post-build audit's alone. */
	causes?: boolean;
	/**
	 * The `<promise>/<clause>` pairs the registry holds. When given, a signal answer
	 * naming a pair outside it names no clause; absent, only the shape is checked.
	 */
	clauses?: ReadonlySet<string>;
}

const ANSWER = /^\s+- answer:\s*(fix|signal|amendment|nothing)\b\s*(?:[—–-]+\s*)?(.*)$/;
const BREAKS_WHEN = /^\s+- breaks when:\s*(.*)$/;
const CLAUSE = /clause:\s*([^\s/;]+\/[^\s;]+)/;
const EMPTY_QUESTION = /^(nothing|none)\.?$/i;

export function readAuditAnswers(text: string, options: ReadOptions = {}): AuditAnswers {
	const questions = options.questions ?? AUDIT_QUESTIONS;
	const wantCauses = options.causes ?? questions === AUDIT_QUESTIONS;
	const findings: Finding[] = [];
	const headings = new Set<string>();
	let section: string | null = null;
	let current: Finding | null = null;
	let causes = false;

	const lines = text.split("\n");
	const fenced = fencedLineMask(lines);

	for (const [i, raw] of lines.entries()) {
		if (fenced[i]) continue;
		const heading = /^##\s+(.+?)\s*$/.exec(raw);
		if (heading) {
			section = heading[1];
			headings.add(section);
			current = null;
			if (section === CAUSES_HEADING) causes = true;
			continue;
		}
		if (section === null || section === CAUSES_HEADING) continue;
		const item = /^- (.+)$/.exec(raw);
		if (item) {
			current = null;
			if (EMPTY_QUESTION.test(item[1].trim())) continue;
			current = {
				question: section,
				finding: item[1].trim(),
				line: i + 1,
				breaksWhen: null,
				answer: null,
			};
			findings.push(current);
			continue;
		}
		if (!current) continue;
		const breaks = BREAKS_WHEN.exec(raw);
		if (breaks && current.breaksWhen === null) {
			current.breaksWhen = breaks[1].trim();
			continue;
		}
		const answer = ANSWER.exec(raw);
		const answerText = answer?.[2].trim();
		if (answer && answerText && current.answer === null) {
			current.answer = { kind: answer[1] as AnswerKind, text: answerText };
		}
	}

	return {
		findings,
		incomplete: findings.filter((f) => !f.breaksWhen),
		unanswered: findings.filter((f) => !f.answer),
		noClause: findings.filter(
			(f) => f.answer?.kind === "signal" && !namesClause(f.answer.text, options.clauses),
		),
		dismissals: findings
			.filter((f) => f.answer?.kind === "nothing")
			.map((f) => ({ question: f.question, finding: f.finding, reason: f.answer?.text ?? "" })),
		amendments: findings
			.filter((f) => f.answer?.kind === "amendment")
			.map((f) => ({ question: f.question, finding: f.finding, part: f.answer?.text ?? "" })),
		missingQuestions: questions.filter((q) => !headings.has(q)),
		missingCauses: wantCauses && findings.length > 0 && !causes,
	};
}

function namesClause(text: string, held: ReadonlySet<string> | undefined): boolean {
	const named = CLAUSE.exec(text)?.[1];
	return named !== undefined && (held === undefined || held.has(named));
}

/** Whether a read leaves nothing for the plan's agent to do: no open finding, no missing question or section. */
export function isAnswered(read: AuditAnswers): boolean {
	return (
		read.incomplete.length === 0 &&
		read.unanswered.length === 0 &&
		read.noClause.length === 0 &&
		read.missingQuestions.length === 0 &&
		!read.missingCauses
	);
}

/**
 * What the person is shown or the plan's agent must still do, one line each: the
 * open findings first, then the dismissals and amendment answers the person sees.
 */
export function describeAnswers(
	read: AuditAnswers,
	file: string,
): { open: string[]; shown: string[] } {
	const open = [
		...read.incomplete.map((f) => `${file}:${f.line} has no "breaks when:" line — ${f.finding}`),
		...read.unanswered.map((f) => `${file}:${f.line} has no answer — ${f.finding}`),
		...read.noClause.map(
			(f) =>
				`${file}:${f.line} answers with a signal naming no clause the registry holds — ${f.finding}`,
		),
		...read.missingQuestions.map((q) => `${file} has no section for: ${q}`),
		...(read.missingCauses ? [`${file} has findings and no "${CAUSES_HEADING}" section`] : []),
	];
	const shown = [
		...read.dismissals.map((d) => `${d.question} — ${d.finding} — nothing: ${d.reason}`),
		...read.amendments.map((a) => `${a.question} — ${a.finding} — amendment: ${a.part}`),
	];
	return { open, shown };
}
