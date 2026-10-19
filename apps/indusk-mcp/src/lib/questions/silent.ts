import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The save-time check's rule (`hooks/validate-decided-unattended.js`), as a read over a
 * plan's saved documents, so a step that ends can report the clause the hook enforces
 * (`never-decided-silently`). The hook cannot import this library, so this is its
 * port: change the two together; `silent-parity.test.ts` runs the same cases through both.
 *
 * clause: a-decision-is-a-question/never-decided-silently
 */
const DECIDED = /\bdecided unattended\b/i;
const REFERENCE = /\bquestion:\s*([A-Za-z0-9_-]+)/;
/** A reader's answer, not a choice: never checked. */
const NOT_CHECKED = new Set(["plan-review.md", "audit.md", "retrospective.md"]);

export interface SilentDecision {
	file: string;
	line: number;
	why: string;
}

/** The lines of one document that record a choice with no question, or a made-up one. */
export function silentIn(
	text: string,
	recorded: ReadonlySet<string>,
): { line: number; why: string }[] {
	const lines = text.split("\n");
	const out: { line: number; why: string }[] = [];
	lines.forEach((l, i) => {
		if (!DECIDED.test(l)) return;
		const ref = REFERENCE.exec(l) ?? REFERENCE.exec(lines[i + 1] ?? "");
		if (!ref)
			out.push({
				line: i + 1,
				why: "records a choice as decided unattended with no `question: <id>`",
			});
		else if (!recorded.has(ref[1] ?? ""))
			out.push({
				line: i + 1,
				why: `cites question ${ref[1]}, which the plan's record does not hold`,
			});
	});
	return out;
}

/** Every such line across a plan folder's documents. */
export function silentDecisions(planDir: string, recorded: ReadonlySet<string>): SilentDecision[] {
	if (!existsSync(planDir)) return [];
	return readdirSync(planDir)
		.filter((f) => f.endsWith(".md") && !NOT_CHECKED.has(f))
		.flatMap((file) =>
			silentIn(readFileSync(join(planDir, file), "utf-8"), recorded).map((p) => ({ file, ...p })),
		);
}
