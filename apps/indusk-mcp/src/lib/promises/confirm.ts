import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isUsableRelPath } from "../path-segment.js";
import { collapseSpace, parseBriefContract, sameSentence } from "./brief-contract.js";
import { type CheckRefusal, checkPromises } from "./check.js";
import { citedNames } from "./citations.js";
import { setList, setScalar } from "./frontmatter-edit.js";
import { planFolderPath, planFolderStatus } from "./plan-folder.js";
import { type PromiseEntry, promiseTokenPattern, type Registry, readPromises } from "./registry.js";
import { type RowProof, readImpl, rowProofs, rowsNamingIn } from "./rows.js";
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

function carriesToken(
	codeRoot: string,
	rel: string,
	p: PromiseEntry,
): "missing" | "unnamed" | "ok" {
	const abs = join(codeRoot, rel);
	if (!isUsableRelPath(rel) || !existsSync(abs) || !statSync(abs).isFile()) return "missing";
	const text = readFileSync(abs, "utf-8");
	return [p.name, ...p.aliases].some((n) => promiseTokenPattern(n).test(text)) ? "ok" : "unnamed";
}

export interface ConfirmInput {
	planRoot: string;
	/** Where the plan's code and tests are. In a workbench before landing: the plan's own worktree. */
	codeRoot: string;
	plan: string;
	now?: Date;
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

export type ConfirmResult =
	| { ok: true; confirmed: Confirmed[] }
	| {
			ok: false;
			refusals: CheckRefusal[];
			/** True when the registry was written before the refusal. */
			written: boolean;
	  };

const registryFile = (p: PromiseEntry) => `.indusk/promises/${p.file}`;

/**
 * What the brief said this plan would do to existing promises, and has not:
 * a change that was never made, a replacement declared as a plain new promise.
 * Until this, a brief's Changes and Replaces lists were only sentences.
 *
 * promise: a-changed-promise-keeps-its-history
 */
function unmadeChanges(planDir: string, plan: string, registry: Registry): CheckRefusal[] {
	const briefPath = join(planDir, "brief.md");
	if (!existsSync(briefPath)) return [];
	const brief = parseBriefContract(readFileSync(briefPath, "utf-8"));
	if (brief.shape === "legacy") return [];
	const byName = new Map(registry.promises.map((p) => [p.name, p]));
	const file = `${planDir.slice(planDir.lastIndexOf(".indusk"))}/brief.md`;
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
	if (promise.kind !== "structure" && sites.length === 0) {
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
			: `- ${day} — enforced, confirmed for ${plan}: proven by ${proof.rows.map((r) => `row ${r.id}`).join(", ")}.`,
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
	const planDir = planFolderPath(planRoot, plan, status === "archived");
	const read = readPromises(planRoot);
	if (!read.ok && "problems" in read) {
		return refuse(
			read.problems.map((p) => ({ file: `.indusk/promises/${p.file}`, message: p.problem })),
		);
	}
	const registry: Registry = read.ok
		? read.registry
		: { dir: join(planRoot, ".indusk", "promises"), promises: [], incidents: [] };

	const implPath = join(planDir, "impl.md");
	const implText = existsSync(implPath) ? readFileSync(implPath, "utf-8") : null;
	const implRead = implText === null ? null : readImpl(implText);
	if (implRead && !implRead.ok) {
		return refuse([
			{
				file: `${planDir.slice(planDir.lastIndexOf(".indusk"))}/impl.md`,
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
	const proofs = rowProofs(candidates, plan, implText);
	const refusals: CheckRefusal[] = unmadeChanges(planDir, plan, registry);
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

	const day = (input.now ?? new Date()).toISOString().slice(0, 10);
	const confirmed = ready
		.map((r) => enforce(registry, plan, r, day))
		.filter((c): c is Confirmed => c !== null);

	// ADR D5: the registry these writes leave has to pass its own check.
	const check = await checkPromises(planRoot, { codeRoot });
	if (!check.ok) return { ok: false, refusals: check.refusals, written: confirmed.length > 0 };
	return { ok: true, confirmed };
}
