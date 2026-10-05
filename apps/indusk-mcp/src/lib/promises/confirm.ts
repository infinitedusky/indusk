import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isUsableRelPath } from "../path-segment.js";
import { parseBriefContract } from "./brief-contract.js";
import { type CheckRefusal, checkPromises } from "./check.js";
import { citedNames } from "./citations.js";
import { setList, setScalar } from "./frontmatter-edit.js";
import { planFolderPath, planFolderStatus } from "./plan-folder.js";
import { type PromiseEntry, promiseTokenPattern, type Registry, readPromises } from "./registry.js";
import { type RowProof, rowProofs } from "./rows.js";
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
	/** The promise it replaced, retired with this confirmation. */
	retired?: string;
}

export type ConfirmResult =
	| { ok: true; confirmed: Confirmed[] }
	| {
			ok: false;
			refusals: CheckRefusal[] /** True when the registry was written before the refusal. */;
			written: boolean;
	  };

const registryFile = (p: PromiseEntry) => `.indusk/promises/${p.file}`;

/**
 * What the brief said this plan would do to existing promises, and has not:
 * a change that was never made, a replacement declared as a plain new promise.
 * Until this, a brief's Changes and Replaces lists were only sentences.
 */
function unmadeChanges(planRoot: string, plan: string, registry: Registry): CheckRefusal[] {
	const briefPath = join(planFolderPath(planRoot, plan), "brief.md");
	if (!existsSync(briefPath)) return [];
	const brief = parseBriefContract(readFileSync(briefPath, "utf-8"));
	if (brief.shape === "legacy") return [];
	const byName = new Map(registry.promises.map((p) => [p.name, p]));
	const file = `.indusk/planning/${plan}/brief.md`;
	const one = (s: string) => s.replace(/\s+/g, " ").trim();
	const out: CheckRefusal[] = [];
	for (const change of brief.changes) {
		const entry = byName.get(change.name);
		if (!entry) continue; // the contract's refusal, not this one's
		if (entry.owner !== plan || one(entry.statement) !== one(change.sentence)) {
			out.push({
				file,
				message: `${change.name}: the brief lists it under **Changes**, but the change was never made — the registry still says ${entry.owner} owns it${one(entry.statement) === one(change.sentence) ? "" : ` and it reads "${one(entry.statement)}"`}. Run \`indusk promises change ${change.name} --plan ${plan}\``,
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

/** Confirm every promise `plan` declared, or refuse naming each that is not proven. */
export async function confirmPlan(input: ConfirmInput): Promise<ConfirmResult> {
	const { planRoot, codeRoot, plan } = input;
	const refuse = (refusals: CheckRefusal[]): ConfirmResult => ({
		ok: false,
		refusals,
		written: false,
	});
	if (planFolderStatus(planRoot, plan) !== "active") {
		return refuse([
			{
				file: ".indusk/planning",
				message: `"${plan}" is not a plan folder under .indusk/planning/ — promises are confirmed while their plan is still open, before it archives`,
			},
		]);
	}
	const read = readPromises(planRoot);
	if (!read.ok && "problems" in read) {
		return refuse(
			read.problems.map((p) => ({ file: `.indusk/promises/${p.file}`, message: p.problem })),
		);
	}
	const registry: Registry = read.ok
		? read.registry
		: { dir: join(planRoot, ".indusk", "promises"), promises: [], incidents: [] };

	const implPath = join(planFolderPath(planRoot, plan), "impl.md");
	const implText = existsSync(implPath) ? readFileSync(implPath, "utf-8") : null;
	const proofs = rowProofs(registry, plan, implText);
	const refusals: CheckRefusal[] = unmadeChanges(planRoot, plan, registry);
	if (proofs.length === 0)
		return refusals.length > 0 ? refuse(refusals) : { ok: true, confirmed: [] };

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

	const byName = new Map(registry.promises.map((p) => [p.name, p]));
	const plans: Array<{ proof: RowProof; sites: string[]; retires: PromiseEntry | null }> = [];
	for (const proof of proofs) {
		const { promise } = proof;
		if (proof.refusal !== null) {
			refusals.push({ file: registryFile(promise), message: proof.refusal });
			continue;
		}
		let proven = true;
		for (const rel of proof.tests) {
			const state = carriesToken(codeRoot, rel, promise);
			if (state === "ok") continue;
			proven = false;
			refusals.push({
				file: registryFile(promise),
				message:
					state === "missing"
						? `${promise.name}: its row names the test ${rel}, which does not exist under ${codeRoot} — in a workbench, pass the plan's own worktree with --code-root`
						: `${promise.name}: its row names the test ${rel}, which does not carry "promise: ${promise.name}" — a test that proves a promise names it`,
			});
		}
		const sites = [promise.name, ...promise.aliases]
			.flatMap((n) => cited.get(n) ?? [])
			.filter((f, i, all) => all.indexOf(f) === i && !proof.tests.includes(f))
			.sort();
		if (promise.kind !== "structure" && sites.length === 0) {
			proven = false;
			refusals.push({
				file: registryFile(promise),
				message: `${promise.name}: no code under ${codeRoot} carries its token — a ${promise.kind} promise names the code that keeps it (a comment saying "promise: ${promise.name}" at the site)`,
			});
		}
		const retires = promise.supersedes ? (byName.get(promise.supersedes) ?? null) : null;
		if (retires && retires.state !== "retired") {
			const still = [retires.name, ...retires.aliases].flatMap((n) => cited.get(n) ?? []);
			if (still.length > 0) {
				proven = false;
				refusals.push({
					file: registryFile(promise),
					message: `${promise.name}: it replaces ${retires.name}, which ${[...new Set(still)].join(", ")} still ${still.length === 1 ? "names" : "name"} — a retired promise must not keep reporting; point each at ${promise.name}`,
				});
			}
		}
		if (proven)
			plans.push({ proof, sites, retires: retires?.state === "retired" ? null : retires });
	}
	if (refusals.length > 0) return refuse(refusals);

	const day = (input.now ?? new Date()).toISOString().slice(0, 10);
	const confirmed: Confirmed[] = [];
	for (const { proof, sites, retires } of plans) {
		const { promise } = proof;
		const path = join(registry.dir, promise.file);
		let text = readFileSync(path, "utf-8");
		text = setList(text, "tests", proof.tests);
		text = setList(text, "sites", sites);
		text = setScalar(text, "state", "enforced");
		text = appendHistory(
			text,
			`- ${day} — enforced when ${plan} closed: proven by ${proof.rows.map((r) => `row ${r.id}`).join(", ")}.`,
		);
		writeFileSync(path, text);
		if (retires) {
			const oldPath = join(registry.dir, retires.file);
			writeFileSync(
				oldPath,
				appendHistory(
					setScalar(readFileSync(oldPath, "utf-8"), "state", "retired"),
					`- ${day} — retired when ${plan} closed: replaced by \`${promise.name}\`.`,
				),
			);
		}
		confirmed.push({
			name: promise.name,
			tests: proof.tests,
			sites,
			...(retires ? { retired: retires.name } : {}),
		});
	}

	// ADR D5: the registry these writes leave has to pass its own check.
	const check = await checkPromises(planRoot, { codeRoot });
	if (!check.ok) return { ok: false, refusals: check.refusals, written: true };
	return { ok: true, confirmed };
}
