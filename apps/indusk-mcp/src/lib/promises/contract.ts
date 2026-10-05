import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { LESSONS_REL_DIR } from "../lessons/state.js";
import { parseTrajectory, type Trajectory } from "../trajectory/parser.js";
import {
	validateRowPurpose,
	validateRowShape,
	validateTestLevels,
} from "../trajectory/validator.js";
import { type BriefContract, parseBriefContract } from "./brief-contract.js";
import { type PlanFolder, planFolderPath, planFolderStatus, planFolders } from "./plan-folder.js";
import { type PromiseEntry, type Registry, readPromises } from "./registry.js";
import { PROMISES_REL_DIR } from "./vocabulary.js";

/**
 * A plan's contract (planner-promises ADR D2): its brief, its test rows and
 * the registry have to agree before the plan builds.
 *
 * One check, three callers — `indusk promises contract <plan>`, the impl hook
 * (which runs that command, never a second reader), and `indusk promises
 * check` for every active plan. Each refusal names the promise, the
 * expectation or the row:
 *
 * - a promise the brief makes is not in the registry, is owned by another
 *   plan, or is not the one the brief describes (its sentence or kind differs);
 * - a promise the brief keeps, changes or replaces does not exist or is
 *   already retired;
 * - an expectation has no measure or no time to look;
 * - a row names a promise the registry does not hold, a retired promise, or
 *   a lesson with no file;
 * - a row names a promise another plan owns that the brief does not list.
 *
 * A brief with no `## Promises` heading was written before this and is not
 * held to any of it. An ARCHIVED plan is held only to what its own brief says
 * (its shape, its expectations): the registry is what later plans have made
 * of it since, and a promise an archived plan made may rightly be changed,
 * taken over or retired by now.
 */

export interface ContractRefusal {
	/** Plan-root-relative path of the document the refusal is about. */
	file: string;
	message: string;
}

export interface ContractSummary {
	plan: string;
	/**
	 * `no-brief`: the folder has no brief (a spike), so there is nothing to
	 * hold. `draft`: its brief is still a draft, which the sweep over every
	 * plan does not hold yet.
	 */
	shape: "contract" | "legacy" | "no-brief" | "draft";
	archived: boolean;
	makes: number;
	kept: number;
	changes: number;
	replaces: number;
	expectations: number;
}

export type ContractResult =
	| { ok: true; summary: ContractSummary }
	| { ok: false; refusals: ContractRefusal[] };

export interface ContractOptions {
	/**
	 * The impl to judge in place of the one on disk: the impl hook asks before
	 * a write lands, so the rows that matter are the ones being written.
	 */
	implText?: string;
	/** The registry, when the caller has already read it. */
	registry?: Registry;
	/**
	 * Leave a brief whose status is `draft` unchecked. A draft is the planning
	 * conversation read back: its promises are saved when the person accepts
	 * it, so until then the registry rightly does not hold them. The sweep
	 * over every plan sets this, or one unfinished conversation would turn
	 * every `pnpm test` red; asking about one plan by name does not, because
	 * that question is "what does acceptance still need?".
	 */
	skipDraft?: boolean;
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

const relPlanFile = (folder: PlanFolder, file: string) =>
	`.indusk/planning/${folder.archived ? "archive/" : ""}${folder.plan}/${file}`;

function resolveFolder(planRoot: string, plan: string): PlanFolder | string {
	const status = planFolderStatus(planRoot, plan);
	if (status === "active" || status === "archived") {
		const archived = status === "archived";
		return { plan, archived, dir: planFolderPath(planRoot, plan, archived) };
	}
	return `"${plan}" is not a plan folder under .indusk/planning/ or .indusk/planning/archive/ — there is no plan to check`;
}

/** The registry to check against: empty when there is none yet, a refusal when it cannot be read. */
function registryFor(planRoot: string, given?: Registry): Registry | ContractRefusal[] {
	if (given) return given;
	const read = readPromises(planRoot);
	if (read.ok) return read.registry;
	if ("missing" in read) return { dir: read.missing, promises: [], incidents: [] };
	return read.problems.map((p) => ({
		file: `${PROMISES_REL_DIR}/${p.file}`,
		message: `${p.problem} — the registry cannot be read, so no plan's contract can be checked against it`,
	}));
}

// promise: an-expectation-says-how-it-is-measured
function expectationRefusals(brief: BriefContract): string[] {
	const out: string[] = [];
	if (brief.expectations.length === 0) {
		if (brief.noExpectations === null) {
			out.push(
				'the brief lists no expectations and does not say it has none — list each under "## Expectations" with its Measure and its Look, or write "None — {reason}" there',
			);
		} else if (brief.noExpectations === "") {
			out.push(
				'the brief says it has no expectations without the reason — write "None — {reason}"',
			);
		}
	}
	for (const e of brief.expectations) {
		if (e.measure === null) {
			out.push(
				`expectation "${e.text}" has no measure — add "- Measure: {how we would know}" under it`,
			);
		}
		if (e.look === null) {
			out.push(
				`expectation "${e.text}" has no time to look — add "- Look: {when to check}" under it`,
			);
		}
	}
	return out;
}

// promise: a-briefs-promises-are-in-the-registry
function madeRefusals(
	brief: BriefContract,
	plan: string,
	byName: Map<string, PromiseEntry>,
): string[] {
	const out: string[] = [];
	for (const made of brief.makes) {
		const entry = byName.get(made.name);
		if (!entry) {
			out.push(
				`${made.name}: the brief says ${plan} makes this promise, but the registry does not hold it — write it with \`indusk promises declare ${made.name} --plan ${plan}\``,
			);
			continue;
		}
		if (entry.owner !== plan) {
			out.push(
				`${made.name}: the brief says ${plan} makes this promise, but the registry says ${entry.owner} owns it — if ${plan} is improving it, list it under **Changes** instead`,
			);
			continue;
		}
		if (oneLine(made.sentence) !== oneLine(entry.statement)) {
			out.push(
				`${made.name}: its sentence in the brief is not its sentence in the registry — the brief: "${oneLine(made.sentence)}"; the registry: "${oneLine(entry.statement)}". Make them one (\`indusk promises change ${made.name}\` rewrites the registry's)`,
			);
		}
		if (made.kind !== null && made.kind !== entry.kind) {
			out.push(
				`${made.name}: its kind in the brief is ${made.kind} and in the registry ${entry.kind} — the registry's is what the watcher and the check read; make them one`,
			);
		}
	}
	return out;
}

function existingRefusals(brief: BriefContract, byName: Map<string, PromiseEntry>): string[] {
	const out: string[] = [];
	const lists: Array<[string, string[]]> = [
		["Must not break", brief.mustNotBreak],
		["Changes", brief.changes.map((c) => c.name)],
	];
	for (const [list, names] of lists) {
		for (const name of names) {
			const entry = byName.get(name);
			if (!entry) {
				out.push(`${name}: listed under **${list}**, but the registry does not hold it`);
			} else if (entry.state === "retired") {
				out.push(
					`${name}: listed under **${list}**, but it is already retired — nothing is left to ${list === "Changes" ? "change" : "keep"}`,
				);
			}
		}
	}
	const made = new Set(brief.makes.map((m) => m.name));
	for (const { old, by } of brief.replaces) {
		const entry = byName.get(old);
		if (!entry) {
			out.push(`${old}: listed under **Replaces**, but the registry does not hold it`);
			continue;
		}
		if (!made.has(by)) {
			out.push(
				`${old}: the brief says ${by} replaces it, but ${by} is not among the promises this plan makes`,
			);
		}
		// Retired by this very replacement is the plan having closed, not an error.
		if (entry.state === "retired" && byName.get(by)?.supersedes !== old) {
			out.push(
				`${old}: listed under **Replaces**, but it is already retired — nothing is left to replace`,
			);
		}
	}
	return out;
}

// promise: every-test-says-what-it-is-for
/**
 * What each row names, against the registry. `brief` is null for a plan
 * whose brief predates promises, or that has none: such a plan cannot list
 * another plan's promise, so only the existence rules apply (A33).
 */
function rowRefusals(
	planRoot: string,
	plan: string,
	brief: BriefContract | null,
	trajectory: Trajectory,
	byName: () => Map<string, PromiseEntry>,
): string[] {
	const out: string[] = [];
	const addressed = new Set(
		brief === null
			? []
			: [
					...brief.makes.map((m) => m.name),
					...brief.mustNotBreak,
					...brief.changes.map((c) => c.name),
					...brief.replaces.map((r) => r.old),
				],
	);
	for (const row of trajectory.rows) {
		for (const name of row.purpose?.promises ?? []) {
			const entry = byName().get(name);
			if (!entry) {
				out.push(`row ${row.id} names "promise: ${name}", which the registry does not hold`);
			} else if (entry.state === "retired") {
				out.push(
					`row ${row.id} names "promise: ${name}", which is retired — a test cannot vouch for a promise nobody makes`,
				);
			} else if (brief !== null && entry.owner !== plan && !addressed.has(name)) {
				out.push(
					`row ${row.id} names "promise: ${name}", which ${entry.owner} owns — a plan that tests another plan's promise says so in its brief: list it under **Must not break**, **Changes** or **Replaces**`,
				);
			}
		}
		for (const name of row.purpose?.lessons ?? []) {
			if (!existsSync(join(planRoot, LESSONS_REL_DIR, `${name}.md`))) {
				out.push(
					`row ${row.id} names "lesson: ${name}", but ${LESSONS_REL_DIR}/${name}.md does not exist`,
				);
			}
		}
	}
	return out;
}

/** Does `plan`'s brief, its rows and the registry agree? */
export function checkPlanContract(
	planRoot: string,
	plan: string,
	opts: ContractOptions = {},
): ContractResult {
	const folder = resolveFolder(planRoot, plan);
	if (typeof folder === "string") {
		return { ok: false, refusals: [{ file: ".indusk/planning", message: folder }] };
	}
	return checkFolder(planRoot, folder, opts);
}

/** The impl as the contract reads it: its frontmatter and its trajectory, or why it cannot be read. */
type ImplRead =
	| { ok: true; frontmatter: Record<string, unknown>; trajectory: Trajectory }
	| { ok: false; error: string };

function readImpl(text: string): ImplRead {
	let parsed: { data: Record<string, unknown>; content: string };
	try {
		const r = matter(text);
		parsed = { data: r.data as Record<string, unknown>, content: r.content };
	} catch (err) {
		return { ok: false, error: (err as Error).message.split("\n")[0] };
	}
	if (text.trimStart().startsWith("---") && Object.keys(parsed.data).length === 0) {
		return { ok: false, error: "its frontmatter could not be parsed (no fields read)" };
	}
	return { ok: true, frontmatter: parsed.data, trajectory: parseTrajectory(parsed.content) };
}

/**
 * The rows' own shape, for an impl past `draft` that opts in (A29). The hook
 * judges these too, but only on an edit whose text holds a phase heading or
 * an unchecked item; here they hold for a file any tool wrote. The rules are
 * the validator's, never a second reading of a cell.
 */
function rowRuleRefusals(impl: Extract<ImplRead, { ok: true }>): string[] {
	const fm = impl.frontmatter;
	if (fm.status === undefined || fm.status === "draft") return [];
	const purpose = fm.test_purpose === "required";
	const levels = fm.test_levels === "required" || fm.test_kinds === "required";
	return [
		...validateRowShape(impl.trajectory, purpose),
		...validateTestLevels(impl.trajectory, levels),
		...validateRowPurpose(impl.trajectory, purpose),
	].map((e) => e.message);
}

function checkFolder(planRoot: string, folder: PlanFolder, opts: ContractOptions): ContractResult {
	const { plan } = folder;
	const summary: ContractSummary = {
		plan,
		shape: "no-brief",
		archived: folder.archived,
		makes: 0,
		kept: 0,
		changes: 0,
		replaces: 0,
		expectations: 0,
	};
	const briefPath = join(folder.dir, "brief.md");
	const briefText = existsSync(briefPath) ? readFileSync(briefPath, "utf-8") : null;
	const parsed = briefText === null ? null : parseBriefContract(briefText);
	// A brief written before promises, or none, is held to no list; its rows still are.
	const brief = parsed?.shape === "contract" ? parsed : null;
	if (parsed?.shape === "legacy") summary.shape = "legacy";

	const implFile = relPlanFile(folder, "impl.md");
	const implPath = join(folder.dir, "impl.md");
	const implText = opts.implText ?? (existsSync(implPath) ? readFileSync(implPath, "utf-8") : null);
	// An archived plan is held only to its own brief; its impl is history.
	const impl = folder.archived || implText === null ? null : readImpl(implText);
	const building =
		impl?.ok === true &&
		impl.frontmatter.status !== undefined &&
		impl.frontmatter.status !== "draft";

	// A draft brief is the conversation read back; the sweep holds it once the
	// plan is building, whatever the brief's own status says (A39).
	if (
		brief !== null &&
		opts.skipDraft &&
		!building &&
		/^status:\s*["']?draft\b/m.test((briefText ?? "").split("\n---")[0])
	) {
		return { ok: true, summary: { ...summary, shape: "draft" } };
	}

	const briefFile = relPlanFile(folder, "brief.md");
	const refusals: ContractRefusal[] =
		brief === null
			? []
			: [...brief.problems, ...expectationRefusals(brief)].map((message) => ({
					file: briefFile,
					message,
				}));

	if (!folder.archived) {
		let registryRead: Registry | ContractRefusal[] | null = null;
		const registry = () => {
			registryRead ??= registryFor(planRoot, opts.registry);
			return registryRead;
		};
		let names: Map<string, PromiseEntry> | null = null;
		const byName = () => {
			if (names) return names;
			names = new Map<string, PromiseEntry>();
			const r = registry();
			if (Array.isArray(r)) return names;
			// An earlier name still resolves: a brief or a row may use it.
			for (const p of r.promises) for (const alias of p.aliases) names.set(alias, p);
			for (const p of r.promises) names.set(p.name, p);
			return names;
		};

		if (brief !== null) {
			for (const message of [
				...madeRefusals(brief, plan, byName()),
				...existingRefusals(brief, byName()),
			]) {
				refusals.push({ file: briefFile, message });
			}
		}
		if (impl && !impl.ok) {
			refusals.push({
				file: implFile,
				message: `${plan}'s impl cannot be read, so its rows cannot be checked: ${impl.error}`,
			});
		} else if (impl?.ok) {
			for (const message of [
				...rowRuleRefusals(impl),
				...rowRefusals(planRoot, plan, brief, impl.trajectory, byName),
			]) {
				refusals.push({ file: implFile, message });
			}
		}
		const r = registryRead as Registry | ContractRefusal[] | null;
		if (Array.isArray(r)) refusals.push(...r);
	}

	if (refusals.length > 0) return { ok: false, refusals };
	if (brief === null) return { ok: true, summary };
	return {
		ok: true,
		summary: {
			...summary,
			shape: "contract",
			makes: brief.makes.length,
			kept: brief.mustNotBreak.length,
			changes: brief.changes.length,
			replaces: brief.replaces.length,
			expectations: brief.expectations.length,
		},
	};
}

/** One line saying what was checked, for a contract that holds. */
export function formatContract(s: ContractSummary): string {
	if (s.shape === "no-brief") return `${s.plan}: no brief — its rows name nothing that is missing`;
	if (s.shape === "draft") {
		return `${s.plan}: its brief is a draft — held to the contract once it is accepted`;
	}
	if (s.shape === "legacy") {
		return `${s.plan}: its brief was written before promises were part of one — its rows name nothing that is missing`;
	}
	const n = (count: number, noun: string) => `${count} ${noun}`;
	const held = s.archived
		? "its brief is in shape (archived: the registry is later plans' to change)"
		: "its brief, its rows and the registry agree";
	return `${s.plan}: ${held} — ${n(s.makes, "made")}, ${n(s.kept, "kept")}, ${n(s.changes, "changed")}, ${n(s.replaces, "replaced")}; ${n(s.expectations, `expectation${s.expectations === 1 ? "" : "s"}`)}`;
}

/**
 * The contract of every plan folder, active and archived: the summaries of
 * those that hold, the refusals of those that do not. A draft brief is not
 * held yet (`skipDraft`).
 */
export function checkAllContracts(
	planRoot: string,
	opts: { activeOnly?: boolean; registry?: Registry } = {},
): { summaries: ContractSummary[]; refusals: ContractRefusal[] } {
	const summaries: ContractSummary[] = [];
	const refusals: ContractRefusal[] = [];
	for (const folder of planFolders(planRoot)) {
		if (opts.activeOnly && folder.archived) continue;
		const result = checkFolder(planRoot, folder, { registry: opts.registry, skipDraft: true });
		if (result.ok) summaries.push(result.summary);
		else refusals.push(...result.refusals);
	}
	return { summaries, refusals };
}
