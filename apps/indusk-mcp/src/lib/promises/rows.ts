import matter from "gray-matter";
import { parseTrajectory } from "../trajectory/parser.js";
import type { PromiseEntry, Registry } from "./registry.js";

/**
 * The test rows that name a promise (planner-promises ADR D3, D5, D6).
 *
 * A row's `For` cell is the one link between a test and the promise it
 * proves. Two readers need it: closing a plan (do the plan's rows prove what
 * it declared?) and an incident (which rows were vouching for what broke?).
 * Both read rows through here. Reads impl text only — no code root, no git —
 * so the retrospective's gate and the admin can ask it for any plan.
 */

/** A row of an impl that names the promise. */
export interface NamingRow {
	id: string;
	state: string;
	/** The test files in the row's `Test` cell. */
	tests: string[];
}

/** The rows of `implText` whose `For` names the promise, by its name or an earlier one. */
export function rowsNamingIn(
	implText: string,
	promise: Pick<PromiseEntry, "name" | "aliases">,
): NamingRow[] {
	const names = new Set([promise.name, ...promise.aliases]);
	return parseTrajectory(matter(implText).content)
		.rows.filter((r) => r.purpose?.promises.some((n) => names.has(n)))
		.map((r) => ({ id: r.id, state: r.state, tests: r.test ?? [] }));
}

export interface RowProof {
	promise: PromiseEntry;
	rows: NamingRow[];
	/** The test files the rows name, in row order, once each. */
	tests: string[];
	/** Why the rows do not prove it, or null when they do. */
	refusal: string | null;
}

/**
 * What a plan's rows say about each promise it declared: the half of
 * "is it proven" that needs only the impl. `confirmPlan` adds the half that
 * needs the code (the test files exist and carry the token).
 */
export function rowProofs(registry: Registry, plan: string, implText: string | null): RowProof[] {
	return registry.promises
		.filter((p) => p.owner === plan && p.state === "declared")
		.map((promise): RowProof => {
			const rows = implText === null ? [] : rowsNamingIn(implText, promise);
			const tests = [...new Set(rows.flatMap((r) => r.tests))];
			const open = rows.filter((r) => r.state !== "passing");
			let refusal: string | null = null;
			if (rows.length === 0) {
				refusal = `${promise.name}: no test row of ${plan} names it — a promise is proven by a row whose For cell names it`;
			} else if (open.length > 0) {
				refusal = `${promise.name}: ${open.map((r) => `row ${r.id} is ${r.state}`).join(", ")} — every row that names a promise passes before the plan closes`;
			} else if (tests.length === 0) {
				refusal = `${promise.name}: ${rows.map((r) => `row ${r.id}`).join(", ")} ${rows.length === 1 ? "names" : "name"} it but no test file — a row's Test cell says which files prove it`;
			}
			return { promise, rows, tests, refusal };
		});
}
