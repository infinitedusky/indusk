import type { Trajectory } from "../trajectory/parser.js";
import { type BriefContract, collapseSpace, sameSentence } from "./brief-contract.js";
import { parseClausePlan } from "./clause-plan.js";
import type { PromiseEntry } from "./registry.js";

/**
 * An opted-in brief (`clauses: required`) states every promise it makes as
 * clauses, and the registry's promise file holds the same ones (plans-are-
 * promises ADR D4). A promise the registry does not hold, or another plan owns,
 * is `madeRefusals`' to report.
 */
// promise: a-plan-holds-the-promises-it-lands
export function clauseRefusals(
	brief: BriefContract,
	plan: string,
	byName: Map<string, PromiseEntry>,
): string[] {
	if (!brief.clausesRequired) return [];
	const out: string[] = [];
	for (const made of brief.makes) {
		const entry = byName.get(made.name);
		if (made.clauses.length === 0) {
			out.push(
				`${made.name}: the brief opts in to clauses (\`clauses: required\`), but states none for this promise — list each split and limit, and each promise it rests on, as a sub-entry under it`,
			);
		}
		if (!entry || entry.owner !== plan) continue;
		const held = new Map((entry.clauses ?? []).map((c) => [c.name, c]));
		const stated = new Set(made.clauses.map((c) => c.name));
		for (const c of made.clauses) {
			const registered = held.get(c.name);
			if (!registered) {
				out.push(
					`${made.name}: the clause "${c.name}" is in the brief but not in the registry — declare the promise with \`--clause "${c.name} (${c.kind === "rests-on" ? `rests on ${c.restsOn}` : `${c.kind}). ${collapseSpace(c.sentence)}`}"\``,
				);
				continue;
			}
			if (registered.kind !== c.kind) {
				out.push(
					`${made.name}: the clause "${c.name}" is a ${c.kind} in the brief and a ${registered.kind} in the registry — make them one`,
				);
			} else if ((registered.restsOn ?? null) !== (c.restsOn ?? null)) {
				out.push(
					`${made.name}: the clause "${c.name}" rests on ${c.restsOn ?? "nothing"} in the brief and on ${registered.restsOn ?? "nothing"} in the registry — make them one`,
				);
			} else if (!sameSentence(c.sentence, registered.statement ?? "")) {
				out.push(
					`${made.name}: the clause "${c.name}" has a different sentence in the brief and in the registry — the brief: "${collapseSpace(c.sentence)}"; the registry: "${collapseSpace(registered.statement ?? "")}". Make them one`,
				);
			}
		}
		for (const name of held.keys()) {
			if (!stated.has(name)) {
				out.push(
					`${made.name}: the clause "${name}" is in the registry but not in the brief — add it under the promise, or declare the promise again without it`,
				);
			}
		}
	}
	return out;
}

/**
 * The clause plan holds a section for every promise the brief makes and every
 * clause it states, each clause with a signal (plans-are-promises ADR D5). Asked
 * only once `test-plan.md` exists, so a plan whose brief was just accepted is
 * not refused for a document it has not written yet.
 */
// promise: a-plan-holds-the-promises-it-lands
export function clausePlanRefusals(brief: BriefContract, clausePlanText: string): string[] {
	if (!brief.clausesRequired) return [];
	const plan = parseClausePlan(clausePlanText);
	const out: string[] = [];
	for (const made of brief.makes) {
		const section = plan.promises.find((p) => p.name === made.name);
		if (!section) {
			out.push(
				`${made.name}: the clause plan (test-plan.md) has no section for this promise — add "## \`${made.name}\`" with a "### \`clause\`" under it for each of its clauses`,
			);
			continue;
		}
		for (const clause of made.clauses) {
			const sub = section.clauses.find((c) => c.name === clause.name);
			if (!sub) {
				out.push(
					`${made.name}: the clause plan (test-plan.md) has no section for the clause "${clause.name}" — add "### \`${clause.name}\`" under "## \`${made.name}\`"`,
				);
			} else if (sub.signal === null) {
				out.push(
					`${made.name}: the clause "${clause.name}" has no signal in the clause plan — add "- Signal: {where it is read; upheld when …; broken reports …}" under its heading`,
				);
			}
		}
	}
	return out;
}

/**
 * An opted-in plan with an impl: every split and limit clause is named by some
 * row (ADR D6). A resting clause is proved by its promise in force, no row.
 */
// promise: a-plan-holds-the-promises-it-lands
export function clauseRowRefusals(brief: BriefContract, trajectory: Trajectory): string[] {
	if (!brief.clausesRequired) return [];
	const named = new Set(
		trajectory.rows.flatMap((r) =>
			(r.purpose?.clauses ?? []).map((c) => `${c.promise}/${c.clause}`),
		),
	);
	const out: string[] = [];
	for (const made of brief.makes) {
		for (const clause of made.clauses) {
			if (clause.kind === "rests-on" || named.has(`${made.name}/${clause.name}`)) continue;
			out.push(
				`${made.name}: no row in the impl names the clause "${clause.name}" — a row's For cell says \`clause: ${made.name}/${clause.name}\` for the test that proves it`,
			);
		}
	}
	return out;
}
