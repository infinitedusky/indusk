import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collapseSpace, parseBriefContract, sameSentence } from "./brief-contract.js";
import { type CheckRefusal, checkPromises } from "./check.js";
import { citedNames } from "./citations.js";
import {
	type ClauseTestRunner,
	clauseSignalHalf,
	clauseTestsHalf,
	type HalfResult,
	provableClauses,
	type SignalReader,
	writtenAsClauses,
} from "./clause-proof.js";
import { restsOnly } from "./clause-standing.js";
import { assertsSomething, carriesToken, namesClause } from "./clause-test-file.js";
import { setList, setScalar } from "./frontmatter-edit.js";
import { type PlanFolder, planFileRel, planFolderPath, planFolderStatus } from "./plan-folder.js";
import { contractDir, type PromiseEntry, type Registry, readPromises } from "./registry.js";
import {
	type NamingRow,
	type RowProof,
	readImpl,
	rowProofs,
	rowsNamingIn,
	rowsProvingClause,
} from "./rows.js";
import { appendHistory } from "./write.js";

/**
 * Closing confirms (planner-promises ADR D5): a plan closes with its promises
 * proven or it does not close.
 *
 * A promise is proven by the plan's own test rows: every row whose `For` names
 * it is `passing`, and the test files those rows name exist and carry its
 * token. `confirmPlan` then writes what the registry check will hold it to —
 * `tests:` from those rows, `sites:` from the other files that carry the
 * token, `state: enforced` — and retires what the promise replaces.
 *
 * Everything that can refuse is decided before anything is written, so a
 * refused confirm leaves the registry as it was.
 */

export interface ConfirmInput {
	planRoot: string;
	/** Where the plan's code and tests are. In a workbench before landing: the plan's own worktree. */
	codeRoot: string;
	plan: string;
	now?: Date;
	/** Runs the tests a clause's rows name, now (mark-first ADR D2). */
	runTests?: ClauseTestRunner;
	/** Asks the local daemon what each clause's signal reported (mark-first ADR D2). */
	readSignals?: SignalReader;
}

export interface Confirmed {
	name: string;
	tests: string[];
	sites: string[];
	/** It was already in force, and its links were brought up to date. */
	inForce: boolean;
	/** The promise it replaced, retired with this confirmation. */
	retired?: string;
}

/** What each half of a clause's proof judged, for a plan written as clauses; what the close's own signal reports. */
export interface ClauseHalves {
	tests: HalfResult;
	signal: HalfResult;
}

export type ConfirmResult =
	| { ok: true; confirmed: Confirmed[]; halves?: ClauseHalves }
	| {
			ok: false;
			refusals: CheckRefusal[];
			/** True when the registry was written before the refusal. */
			written: boolean;
			halves?: ClauseHalves;
	  };

const registryFile = (p: PromiseEntry) => `.indusk/promises/${p.file}`;

/**
 * What the brief said this plan would do to existing promises, and has not:
 * a change that was never made, a replacement declared as a plain new promise.
 * Until this, a brief's Changes and Replaces lists were only sentences.
 *
 * promise: a-changed-promise-keeps-its-history
 */
function unmadeChanges(folder: PlanFolder, registry: Registry): CheckRefusal[] {
	const { plan } = folder;
	const briefPath = join(folder.dir, "brief.md");
	if (!existsSync(briefPath)) return [];
	const brief = parseBriefContract(readFileSync(briefPath, "utf-8"));
	if (brief.shape === "legacy") return [];
	const byName = new Map(registry.promises.map((p) => [p.name, p]));
	const file = planFileRel(folder, "brief.md");
	const out: CheckRefusal[] = [];
	for (const change of brief.changes) {
		const entry = byName.get(change.name);
		if (!entry) continue; // the contract's refusal, not this one's
		if (entry.owner !== plan || !sameSentence(entry.statement, change.sentence)) {
			out.push({
				file,
				message: `${change.name}: the brief lists it under **Changes**, but the change was never made — the registry still says ${entry.owner} owns it${sameSentence(entry.statement, change.sentence) ? "" : ` and it reads "${collapseSpace(entry.statement)}"`}. Run \`indusk promises change ${change.name} --plan ${plan}\``,
			});
		}
	}
	for (const { old, by } of brief.replaces) {
		const entry = byName.get(by);
		if (entry && entry.supersedes !== old) {
			out.push({
				file,
				message: `${old}: the brief says ${by} replaces it, but ${by} does not record that (no \`supersedes: ${old}\`), so ${old} would never be retired — declare a replacement with \`indusk promises replace ${old} --by ${by}\``,
			});
		}
	}
	return out;
}

/** What a proven promise's confirmation will write. */
interface Ready {
	proof: RowProof;
	/** The test files that prove it: the rows', then any it already listed that still do. */
	tests: string[];
	/** The files that carry its token and that no row names as a test. */
	sites: string[];
	/** The promise it replaces, when that one is still in force. */
	retires: PromiseEntry | null;
}

/**
 * The clauses whose proving rows name a test file that does not carry
 * `clause: <promise>/<clause>` (A22): a clause is proved by a test that names
 * the clause, not only the promise. A resting clause has no row to ask.
 */
function clauseTokenRefusals(
	promise: PromiseEntry,
	rows: readonly NamingRow[],
	codeRoot: string,
): string[] {
	const out: string[] = [];
	for (const clause of promise.clauses ?? []) {
		if (clause.kind === "rests-on") continue;
		const files = new Set(rowsProvingClause(rows, clause.name).flatMap((r) => r.tests));
		for (const rel of files) {
			if (!namesClause(codeRoot, rel, promise, clause.name)) {
				out.push(
					`${promise.name}: clause ${clause.name}: its row names the test ${rel}, which does not carry "clause: ${promise.name}/${clause.name}" — a test that proves a clause names it`,
				);
			} else if (!assertsSomething(codeRoot, rel)) {
				out.push(
					`${promise.name}: clause ${clause.name}: the test ${rel} carries the clause's token and asserts nothing (no \`expect(\` or \`assert(\` call outside comments and imports) — a test that proves a clause checks it`,
				);
			}
		}
	}
	return out;
}

/**
 * The half of "is it proven" that needs the code: why `proof` cannot be
 * confirmed against `codeRoot`, or what to write when it can. `cited` is the
 * code root's token scan, read once for every promise; `rowTests` is every
 * file any row of the plan names as a test, none of which is a code site
 * (A41).
 */
function judge(
	proof: RowProof,
	codeRoot: string,
	cited: Map<string, string[]>,
	byName: Map<string, PromiseEntry>,
	rowTests: ReadonlySet<string>,
): Ready | { refusals: string[] } {
	const { promise } = proof;
	if (proof.refusal !== null) return { refusals: [proof.refusal] };
	const refusals: string[] = [];
	for (const rel of proof.tests) {
		const state = carriesToken(codeRoot, rel, promise);
		if (state === "missing") {
			refusals.push(
				`${promise.name}: its row names the test ${rel}, which does not exist under ${codeRoot} — in a workbench, pass the plan's own worktree with --code-root`,
			);
		} else if (state === "unnamed") {
			refusals.push(
				`${promise.name}: its row names the test ${rel}, which does not carry "promise: ${promise.name}" — a test that proves a promise names it`,
			);
		}
	}
	refusals.push(...clauseTokenRefusals(promise, proof.rows, codeRoot));
	// A promise in force keeps the tests it listed that still prove it; one
	// that moved or was deleted is dropped, so the plan that moved it closes
	// without a hand edit (A40).
	const kept =
		promise.state === "declared"
			? []
			: promise.tests.filter((rel) => carriesToken(codeRoot, rel, promise) === "ok");
	const tests = [...new Set([...proof.tests, ...kept])];
	const citing = (p: PromiseEntry) => [
		...new Set([p.name, ...p.aliases].flatMap((n) => cited.get(n) ?? [])),
	];
	const sites = citing(promise)
		.filter((f) => !tests.includes(f) && !rowTests.has(f))
		.sort();
	if (promise.kind !== "structure" && sites.length === 0 && !restsOnly(promise)) {
		refusals.push(
			`${promise.name}: no code under ${codeRoot} carries its token — a ${promise.kind} promise names the code that keeps it (a comment saying "promise: ${promise.name}" at the site); a test is not that code`,
		);
	}
	const replaced = promise.supersedes ? (byName.get(promise.supersedes) ?? null) : null;
	const retires = replaced && replaced.state !== "retired" ? replaced : null;
	if (retires) {
		const still = citing(retires);
		if (still.length > 0) {
			refusals.push(
				`${promise.name}: it replaces ${retires.name}, which ${still.join(", ")} still ${still.length === 1 ? "names" : "name"} — a retired promise must not keep reporting; point each at ${promise.name}`,
			);
		}
	}
	return refusals.length > 0 ? { refusals } : { proof, tests, sites, retires };
}

/** What proved a promise, for its history: its rows, or the promises a promise made only of resting clauses rests on. */
function provenBy(proof: RowProof): string {
	if (proof.rows.length > 0) return proof.rows.map((r) => `row ${r.id}`).join(", ");
	const on = (proof.promise.clauses ?? []).flatMap((c) => (c.restsOn ? [c.restsOn] : []));
	return `the promises it rests on, in force: ${on.join(", ")}`;
}

const same = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Write one confirmation, or nothing when there is nothing to change. What
 * it replaces is retired first: a run stopped between the two writes leaves
 * the old promise retired and the new one still to enforce, which the next
 * run finishes (A42).
 */
function enforce(registry: Registry, plan: string, ready: Ready, day: string): Confirmed | null {
	const { proof, tests, sites, retires } = ready;
	const { promise } = proof;
	if (retires) {
		const oldPath = join(registry.dir, retires.file);
		writeFileSync(
			oldPath,
			appendHistory(
				setScalar(readFileSync(oldPath, "utf-8"), "state", "retired"),
				`- ${day} — retired, confirmed for ${plan}: replaced by \`${promise.name}\`.`,
			),
		);
	}
	const inForce = promise.state !== "declared";
	const unchanged = inForce && same(tests, promise.tests) && same(sites, promise.sites);
	if (unchanged) {
		return retires ? { name: promise.name, tests, sites, retired: retires.name, inForce } : null;
	}
	const path = join(registry.dir, promise.file);
	let text = readFileSync(path, "utf-8");
	text = setList(text, "tests", tests);
	text = setList(text, "sites", sites);
	if (!inForce) text = setScalar(text, "state", "enforced");
	text = appendHistory(
		text,
		inForce
			? `- ${day} — links updated, confirmed for ${plan}: tests ${tests.join(", ")}; sites ${sites.join(", ") || "none"}.`
			: `- ${day} — enforced, confirmed for ${plan}: proven by ${provenBy(proof)}.`,
	);
	writeFileSync(path, text);
	return {
		name: promise.name,
		tests,
		sites,
		inForce,
		...(retires ? { retired: retires.name } : {}),
	};
}

/**
 * Confirm the promises `plan` holds, or refuse naming each that is not
 * proven: every one it declared becomes `enforced`, and every one in force
 * that its rows name has its links brought up to date (A40). A plan that
 * closed without confirming is confirmed from its archived folder (A43).
 *
 * promise: a-closed-plan-kept-its-promises
 */
export async function confirmPlan(input: ConfirmInput): Promise<ConfirmResult> {
	const { planRoot, codeRoot, plan } = input;
	const refuse = (refusals: CheckRefusal[]): ConfirmResult => ({
		ok: false,
		refusals,
		written: false,
	});
	const status = planFolderStatus(planRoot, plan);
	if (status !== "active" && status !== "archived") {
		return refuse([
			{
				file: ".indusk/planning",
				message: `"${plan}" is not a plan folder under .indusk/planning/ or .indusk/planning/archive/`,
			},
		]);
	}
	const archived = status === "archived";
	const folder: PlanFolder = { plan, archived, dir: planFolderPath(planRoot, plan, archived) };
	const read = readPromises(planRoot);
	if (!read.ok && "problems" in read) {
		return refuse(
			read.problems.map((p) => ({ file: `.indusk/promises/${p.file}`, message: p.problem })),
		);
	}
	const registry: Registry = read.ok
		? read.registry
		: { dir: contractDir(planRoot), promises: [], incidents: [] };

	const implPath = join(folder.dir, "impl.md");
	const implText = existsSync(implPath) ? readFileSync(implPath, "utf-8") : null;
	const implRead = implText === null ? null : readImpl(implText);
	if (implRead && !implRead.ok) {
		return refuse([
			{
				file: planFileRel(folder, "impl.md"),
				message: `${plan}'s impl cannot be read, so the rows that prove its promises cannot be: ${implRead.error}`,
			},
		]);
	}
	const candidates = registry.promises.filter(
		(p) =>
			p.owner === plan &&
			(p.state === "declared" ||
				(p.state === "enforced" && implText !== null && rowsNamingIn(implText, p).length > 0)),
	);
	const proofs = rowProofs(candidates, plan, implText, registry.promises);
	const refusals: CheckRefusal[] = unmadeChanges(folder, registry);
	if (proofs.length === 0) {
		return refusals.length > 0 ? refuse(refusals) : { ok: true, confirmed: [] };
	}

	let cited: Map<string, string[]>;
	try {
		cited = await citedNames(codeRoot);
	} catch (err) {
		return refuse([
			{
				file: codeRoot,
				message: `cannot scan ${codeRoot} for promise tokens (not a git repository?): ${(err as Error).message}`,
			},
		]);
	}

	// Decide everything, then write: a refused confirm leaves the registry as it was.
	const byName = new Map(registry.promises.map((p) => [p.name, p]));
	const rowTests = new Set(
		implRead?.ok ? implRead.trajectory.rows.flatMap((r) => r.test ?? []) : [],
	);
	const ready: Ready[] = [];
	for (const proof of proofs) {
		const verdict = judge(proof, codeRoot, cited, byName, rowTests);
		if ("refusals" in verdict) {
			for (const message of verdict.refusals) {
				refusals.push({ file: registryFile(proof.promise), message });
			}
		} else ready.push(verdict);
	}
	if (refusals.length > 0) return refuse(refusals);

	// A plan written as clauses closes on what the system says now, not on its
	// rows' State cells (mark-first ADR D2); a plan written before keeps the rule above.
	const byClause = writtenAsClauses(folder)
		? await clauseHalves(folder, ready, codeRoot, input)
		: null;
	if (byClause && byClause.refusals.length > 0) {
		return {
			...refuse(byClause.refusals),
			...(byClause.halves ? { halves: byClause.halves } : {}),
		};
	}
	const halves = byClause?.halves ? { halves: byClause.halves } : {};

	const day = (input.now ?? new Date()).toISOString().slice(0, 10);
	const confirmed = ready
		.map((r) => enforce(registry, plan, r, day))
		.filter((c): c is Confirmed => c !== null);

	// ADR D5: the registry these writes leave has to pass its own check.
	const check = await checkPromises(planRoot, { codeRoot });
	if (!check.ok) {
		return { ok: false, refusals: check.refusals, written: confirmed.length > 0, ...halves };
	}
	return { ok: true, confirmed, ...halves };
}

/**
 * The two halves of a clause's proof for a plan written as clauses: its tests
 * run now, then its signal read from the daemon, over every promise of the
 * close with a split or limit clause. Refused outright when the caller handed
 * in no runner or no reader: a plan written as clauses never closes on its
 * State cells alone.
 */
async function clauseHalves(
	folder: PlanFolder,
	ready: readonly Ready[],
	codeRoot: string,
	input: ConfirmInput,
): Promise<{ refusals: CheckRefusal[]; halves?: ClauseHalves }> {
	const file = planFileRel(folder, "impl.md");
	const proving = ready
		.map((r) => ({ promise: r.proof.promise, rows: r.proof.rows }))
		.filter((h) => provableClauses(h.promise).length > 0);
	if (proving.length === 0) return { refusals: [] };
	const { runTests, readSignals } = input;
	if (!runTests || !readSignals) {
		const missing = [
			...(runTests ? [] : ["no test runner"]),
			...(readSignals ? [] : ["no signal reader"]),
		];
		return {
			refusals: [
				{
					file,
					message: `${folder.plan} is written as clauses (\`clauses: required\`), so closing runs each clause's tests now and asks the daemon for its signal — this close was given ${missing.join(" and ")}; close it with \`indusk promises confirm ${folder.plan}\``,
				},
			],
		};
	}
	const halves: ClauseHalves = {
		tests: await clauseTestsHalf(proving, codeRoot, runTests),
		signal: await clauseSignalHalf(proving, readSignals),
	};
	const refusals = [...halves.tests.refusals, ...halves.signal.refusals].map((message) => ({
		file,
		message,
	}));
	return { refusals, halves };
}
