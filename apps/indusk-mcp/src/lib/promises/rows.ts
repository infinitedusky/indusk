import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { parseTrajectory, type Trajectory } from "../trajectory/parser.js";
import { planFolders } from "./plan-folder.js";
import { type PromiseEntry, parseFrontmatter } from "./registry.js";

/**
 * The test rows that name a promise (planner-promises ADR D3, D5, D6).
 *
 * A row's `For` cell is the one link between a test and the promise it
 * proves. Two readers need it: closing a plan (do the plan's rows prove what
 * it declared?) and an incident (which rows were vouching for what broke?).
 * Both read rows through here. Reads plan documents only — no code root, no
 * git — so the retrospective's gate and the admin can ask it for any plan.
 */

/** A row of an impl that names the promise. */
export interface NamingRow {
	id: string;
	state: string;
	/** The test files in the row's `Test` cell. */
	tests: string[];
	/** The clauses of this promise the row says it proves (`clause: <promise>/<clause>`). */
	clauses?: string[];
}

/** The rows of `implText` whose `For` names the promise, by its name or an earlier one. */
export function rowsNamingIn(
	implText: string,
	promise: Pick<PromiseEntry, "name" | "aliases">,
): NamingRow[] {
	const names = new Set([promise.name, ...promise.aliases]);
	return parseTrajectory(matter(implText).content)
		.rows.filter((r) => r.purpose?.promises.some((n) => names.has(n)))
		.map((r) => ({
			id: r.id,
			state: r.state,
			tests: r.test ?? [],
			clauses: (r.purpose?.clauses ?? []).filter((c) => names.has(c.promise)).map((c) => c.clause),
		}));
}

/** A row naming the promise, and the plan whose impl holds it. */
export interface PlanRow extends NamingRow {
	plan: string;
	archived: boolean;
}

/**
 * Every row, in every plan's impl, active and archived, whose `For` names the
 * promise (ADR D6): what was vouching for it. A promise a later plan changed
 * is named by rows in both plans. An impl that cannot be read is named in
 * `unreadable`, never skipped: "no row names it" must not be what a broken
 * file looks like.
 */
export function rowsNaming(
	planRoot: string,
	promise: Pick<PromiseEntry, "name" | "aliases">,
): { rows: PlanRow[]; unreadable: string[] } {
	const rows: PlanRow[] = [];
	const unreadable: string[] = [];
	for (const folder of planFolders(planRoot)) {
		const implPath = join(folder.dir, "impl.md");
		if (!existsSync(implPath)) continue;
		try {
			for (const row of rowsNamingIn(readFileSync(implPath, "utf-8"), promise)) {
				rows.push({ ...row, plan: folder.plan, archived: folder.archived });
			}
		} catch {
			unreadable.push(folder.plan);
		}
	}
	return { rows, unreadable };
}

/**
 * `rowsNaming` for many promises at once: each impl is read and parsed once,
 * not once per promise, which is what a dashboard of every promise needs.
 * Keyed by promise name; every promise has an entry, empty when no row names it.
 */
export function rowsNamingEach(
	planRoot: string,
	promises: readonly Pick<PromiseEntry, "name" | "aliases">[],
): Map<string, { rows: PlanRow[]; unreadable: string[] }> {
	const out = new Map(
		promises.map((p) => [p.name, { rows: [] as PlanRow[], unreadable: [] as string[] }]),
	);
	const byAlias = new Map(
		promises.flatMap((p) => [p.name, ...p.aliases].map((n) => [n, p.name] as const)),
	);
	for (const folder of planFolders(planRoot)) {
		const implPath = join(folder.dir, "impl.md");
		if (!existsSync(implPath)) continue;
		let parsed: Trajectory;
		try {
			parsed = parseTrajectory(matter(readFileSync(implPath, "utf-8")).content);
		} catch {
			for (const held of out.values()) held.unreadable.push(folder.plan);
			continue;
		}
		for (const r of parsed.rows) {
			const named = new Set((r.purpose?.promises ?? []).flatMap((n) => byAlias.get(n) ?? []));
			for (const name of named) {
				out.get(name)?.rows.push({
					id: r.id,
					state: r.state,
					tests: r.test ?? [],
					plan: folder.plan,
					archived: folder.archived,
				});
			}
		}
	}
	return out;
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
 * Why a promise stated as clauses is not proved clause by clause, or null
 * (plans-are-promises ADR D6): each split and limit clause wants a passing
 * row with a test file, and each clause resting on another promise wants that
 * promise in force. Names the clause. A promise with no clauses has none to ask.
 */
function clauseRefusal(
	promise: PromiseEntry,
	rows: readonly NamingRow[],
	registry: readonly PromiseEntry[],
): string | null {
	const found: string[] = [];
	for (const clause of promise.clauses ?? []) {
		if (clause.kind === "rests-on") {
			const base = registry.find(
				(p) => p.name === clause.restsOn || p.aliases.includes(clause.restsOn ?? ""),
			);
			if (base?.state !== "enforced") {
				found.push(
					`clause ${clause.name} rests on ${clause.restsOn}, which is ${base ? base.state : "not in the registry"} — it must be in force`,
				);
			}
			continue;
		}
		const proving = rows.filter((r) => r.clauses?.includes(clause.name));
		if (proving.length === 0) {
			found.push(
				`clause ${clause.name}: no test row names it — \`clause: ${promise.name}/${clause.name}\``,
			);
		} else if (proving.some((r) => r.state !== "passing")) {
			found.push(
				`clause ${clause.name}: ${proving
					.filter((r) => r.state !== "passing")
					.map((r) => `row ${r.id} is ${r.state}`)
					.join(", ")}`,
			);
		} else if (!proving.some((r) => r.tests.length > 0)) {
			found.push(`clause ${clause.name}: its rows name no test file`);
		}
	}
	return found.length === 0 ? null : `${promise.name}: ${found.join("; ")}`;
}

/**
 * What a plan's rows say about each promise it declared: the half of
 * "is it proven" that needs only the impl. `confirmPlan` adds the half that
 * needs the code (the test files exist and carry the token). `registry` is
 * every promise, which a clause resting on another reads to see it in force.
 */
export function rowProofs(
	promises: readonly PromiseEntry[],
	plan: string,
	implText: string | null,
	registry: readonly PromiseEntry[] = promises,
): RowProof[] {
	return promises.map((promise): RowProof => {
		const rows = implText === null ? [] : rowsNamingIn(implText, promise);
		const tests = [...new Set(rows.flatMap((r) => r.tests))];
		const open = rows.filter((r) => r.state !== "passing");
		// A promise stated as clauses is refused by clause first: it names the gap precisely.
		let refusal: string | null = clauseRefusal(promise, rows, registry);
		if (refusal !== null) {
			return { promise, rows, tests, refusal };
		}
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

/** An impl as the promise modules read it: its frontmatter and its trajectory, or why it cannot be read. */
export type ImplRead =
	| { ok: true; frontmatter: Record<string, unknown>; trajectory: Trajectory }
	| { ok: false; error: string };

/** Read an impl's frontmatter and trajectory, or say why it cannot be read — never throw (A35). */
export function readImpl(text: string): ImplRead {
	// An impl may have no frontmatter at all; one that opens a block must parse.
	if (!text.trimStart().startsWith("---")) {
		return { ok: true, frontmatter: {}, trajectory: parseTrajectory(text) };
	}
	const parsed = parseFrontmatter(text);
	if ("error" in parsed) return { ok: false, error: parsed.error.split("\n")[0] };
	return { ok: true, frontmatter: parsed.data, trajectory: parseTrajectory(parsed.content) };
}
