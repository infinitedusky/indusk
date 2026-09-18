import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readConfig } from "../config.js";
import { git } from "../git.js";
import { isUsableSegment } from "../path-segment.js";
import { isRootsRefusal, resolveExecutionRoots } from "../worktree/roots.js";
import {
	type IncidentEntry,
	type PromiseEntry,
	promiseTokenPattern,
	type Registry,
	readPromises,
} from "./registry.js";
import {
	anyPromiseTokenPattern,
	PROMISE_KINDS,
	PROMISE_STATES,
	PROMISES_REL_DIR,
	type PromiseKind,
	type PromiseState,
} from "./vocabulary.js";

/**
 * `indusk promises check` — every way the registry can lie, refused by name
 * (day-promises ADR D2–D5, D9).
 *
 * Both directions, because each alone rots: every name cited in code or a
 * test must exist in the registry (a citation must not survive a rename and
 * point at nothing), and every `enforced` promise must carry the links its
 * kind requires (a promise must not be declared and never upheld). The check
 * proves a test *names* a promise; that it *validates* it is Day step 6.
 *
 * In a one-repo workbench the registry is plan-root state and sites and tests
 * are code-repo facts; zero or several declared repos refuse by name through
 * the one resolver. A missing or malformed registry is a refusal, never a
 * clean result — "could not check" is not a verdict.
 */

export interface CheckRefusal {
	/** Plan-root- or code-root-relative path, or the registry directory. */
	file: string;
	message: string;
}

export interface CheckSummary {
	promises: number;
	byState: Record<PromiseState, number>;
	byKind: Record<PromiseKind, number>;
	incidents: number;
}

export type CheckResult =
	| { ok: true; summary: CheckSummary; registry: Registry }
	| { ok: false; refusals: CheckRefusal[] };

const CONFIG_KEY = "promises.domains";

/** Files the reverse scan never reads: prose mentions names; code sites and tests are not prose. */
const PROSE_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst"]);

export function summarize(registry: Registry): CheckSummary {
	const byState = Object.fromEntries(PROMISE_STATES.map((s) => [s, 0])) as Record<
		PromiseState,
		number
	>;
	const byKind = Object.fromEntries(PROMISE_KINDS.map((k) => [k, 0])) as Record<
		PromiseKind,
		number
	>;
	for (const p of registry.promises) {
		byState[p.state] += 1;
		byKind[p.kind] += 1;
	}
	return {
		promises: registry.promises.length,
		byState,
		byKind,
		incidents: registry.incidents.length,
	};
}

/** One line: `4 promises — declared 0, enforced 3, … — behaviour 2, … — 1 incident`. */
export function formatSummary(s: CheckSummary): string {
	const states = PROMISE_STATES.map((st) => `${st} ${s.byState[st]}`).join(", ");
	const kinds = PROMISE_KINDS.map((k) => `${k} ${s.byKind[k]}`).join(", ");
	const incidents = `${s.incidents} incident${s.incidents === 1 ? "" : "s"}`;
	return `${s.promises} promise${s.promises === 1 ? "" : "s"} — ${states} — ${kinds} — ${incidents}`;
}

function declaredDomains(planRoot: string): string[] | null {
	const config = readConfig(planRoot) as { promises?: { domains?: unknown } } | null;
	const domains = config?.promises?.domains;
	if (!Array.isArray(domains)) return null;
	return domains.filter((d): d is string => typeof d === "string");
}

/** A registry entry's path as the refusal names it: plan-root-relative. */
function registryFile(rel: string): string {
	return `${PROMISES_REL_DIR}/${rel}`;
}

type OwnerStatus = "active" | "archived" | "missing";

function ownerStatus(planRoot: string, owner: string): OwnerStatus {
	if (!isUsableSegment(owner)) return "missing";
	if (existsSync(join(planRoot, ".indusk", "planning", owner))) return "active";
	if (existsSync(join(planRoot, ".indusk", "planning", "archive", owner))) return "archived";
	return "missing";
}

/** Whether `rel` under `codeRoot` exists and carries the token for `name`. */
function fileNames(codeRoot: string, rel: string, name: string): "missing" | "unnamed" | "named" {
	const abs = join(codeRoot, rel);
	if (!existsSync(abs) || !statSync(abs).isFile()) return "missing";
	return promiseTokenPattern(name).test(readFileSync(abs, "utf-8")) ? "named" : "unnamed";
}

function looksBinary(buf: Buffer): boolean {
	const head = buf.subarray(0, 8192);
	return head.includes(0);
}

/** Every tracked or untracked-but-not-ignored file under the code root. */
async function scannableFiles(codeRoot: string): Promise<string[]> {
	const out = await git(codeRoot, "ls-files", "--cached", "--others", "--exclude-standard", "-z");
	return out
		.split("\0")
		.map((f) => f.trim())
		.filter((f) => f !== "")
		.filter((f) => !PROSE_EXTENSIONS.has(extensionOf(f)))
		.filter((f) => !f.startsWith(`${PROMISES_REL_DIR}/`) && !f.startsWith(".indusk/"))
		.sort();
}

function extensionOf(file: string): string {
	const base = file.slice(file.lastIndexOf("/") + 1);
	const dot = base.lastIndexOf(".");
	return dot < 0 ? "" : base.slice(dot);
}

/** name → files that carry its token, across the code root. */
async function citedNames(codeRoot: string): Promise<Map<string, string[]>> {
	const cited = new Map<string, string[]>();
	for (const rel of await scannableFiles(codeRoot)) {
		const abs = join(codeRoot, rel);
		if (!existsSync(abs) || !statSync(abs).isFile()) continue;
		const buf = readFileSync(abs);
		if (looksBinary(buf)) continue;
		const text = buf.toString("utf-8");
		const pattern = anyPromiseTokenPattern();
		for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
			const name = m[1];
			const files = cited.get(name) ?? [];
			if (!files.includes(rel)) files.push(rel);
			cited.set(name, files);
		}
	}
	return cited;
}

function linkRefusals(
	codeRoot: string,
	p: PromiseEntry,
	refusals: CheckRefusal[],
): { sites: number; tests: number } {
	let sites = 0;
	let tests = 0;
	for (const [kind, list] of [
		["code site", p.sites],
		["test", p.tests],
	] as const) {
		for (const rel of list) {
			const state = fileNames(codeRoot, rel, p.name);
			if (state === "missing") {
				refusals.push({
					file: registryFile(p.file),
					message: `${p.name}: ${rel} is listed as a ${kind} but does not exist under ${codeRoot}`,
				});
			} else if (state === "unnamed") {
				refusals.push({
					file: registryFile(p.file),
					message: `${p.name}: ${rel} is listed as a ${kind} but does not carry "promise: ${p.name}"`,
				});
			} else if (kind === "code site") sites += 1;
			else tests += 1;
		}
	}
	return { sites, tests };
}

function stateRefusals(
	planRoot: string,
	codeRoot: string,
	p: PromiseEntry,
	incidentsById: Map<string, IncidentEntry>,
	refusals: CheckRefusal[],
): void {
	const owner = ownerStatus(planRoot, p.owner);
	if (owner === "missing") {
		refusals.push({
			file: p.file,
			message: `${p.name}: owner "${p.owner}" is not a plan folder under .indusk/planning/ or .indusk/planning/archive/`,
		});
	}

	for (const id of p.incidents) {
		const incident = incidentsById.get(id);
		if (!incident) {
			refusals.push({
				file: registryFile(p.file),
				message: `${p.name}: incident "${id}" does not exist under ${PROMISES_REL_DIR}/incidents/`,
			});
		} else if (incident.promise !== p.name) {
			refusals.push({
				file: registryFile(p.file),
				message: `${p.name}: incident "${id}" names promise "${incident.promise}", not this one`,
			});
		}
	}

	switch (p.state) {
		case "declared": {
			if (owner === "archived") {
				refusals.push({
					file: registryFile(p.file),
					message: `${p.name}: declared, but its owner "${p.owner}" is archived — the plan closed without establishing it; mark it enforced with its links, or known-violated with the incident that says why`,
				});
			}
			break;
		}
		case "enforced": {
			const { sites, tests } = linkRefusals(codeRoot, p, refusals);
			if (tests === 0) {
				refusals.push({
					file: registryFile(p.file),
					message: `${p.name}: enforced ${p.kind} promise has no test naming it (a test file listed under \`tests:\` carrying "promise: ${p.name}")`,
				});
			}
			if (p.kind !== "structure" && sites === 0) {
				refusals.push({
					file: registryFile(p.file),
					message: `${p.name}: enforced ${p.kind} promise has no code site naming it (a file listed under \`sites:\` carrying "promise: ${p.name}")`,
				});
			}
			if (p.lifetime === "established" && owner === "archived") {
				refusals.push({
					file: registryFile(p.file),
					message: `${p.name}: an established-lifetime promise is still enforced after its owner "${p.owner}" archived — it was proved once and cannot break again, so it should be retired`,
				});
			}
			break;
		}
		case "known-violated": {
			linkRefusals(codeRoot, p, refusals);
			const open = p.incidents.filter((id) => incidentsById.get(id)?.status === "open");
			if (open.length === 0) {
				refusals.push({
					file: registryFile(p.file),
					message: `${p.name}: known-violated with no open incident — the state is evidence, not an excuse; record the incident under ${PROMISES_REL_DIR}/incidents/ or change the state`,
				});
			}
			break;
		}
		case "retired":
			break;
	}
}

export async function checkPromises(planRootIn: string): Promise<CheckResult> {
	const roots = resolveExecutionRoots(planRootIn);
	if (isRootsRefusal(roots))
		return { ok: false, refusals: [{ file: planRootIn, message: roots.error }] };
	const { planRoot, codeRoot } = roots;

	const read = readPromises(planRoot);
	if (!read.ok) {
		if ("missing" in read) {
			return {
				ok: false,
				refusals: [
					{
						file: read.missing,
						message: `no promise registry at ${read.missing} — create ${PROMISES_REL_DIR}/<name>.md for each promise (see /reference/cli/promises)`,
					},
				],
			};
		}
		return {
			ok: false,
			refusals: read.problems.map((p) => ({
				file: `${PROMISES_REL_DIR}/${p.file}`,
				message: p.problem,
			})),
		};
	}
	const { registry } = read;
	const refusals: CheckRefusal[] = [...domainRefusals(planRoot, registry)];

	const incidentsById = new Map(registry.incidents.map((i) => [i.id, i]));
	for (const p of registry.promises) stateRefusals(planRoot, codeRoot, p, incidentsById, refusals);

	const byName = new Map(registry.promises.map((p) => [p.name, p]));
	for (const i of registry.incidents) {
		if (!byName.has(i.promise)) {
			refusals.push({
				file: registryFile(i.file),
				message: `${i.id}: names promise "${i.promise}", which is not in the registry`,
			});
		}
	}

	// The reverse direction: every token anywhere under the code root.
	let cited: Map<string, string[]>;
	try {
		cited = await citedNames(codeRoot);
	} catch (err) {
		return {
			ok: false,
			refusals: [
				...refusals,
				{
					file: codeRoot,
					message: `cannot scan ${codeRoot} for promise tokens (not a git repository?): ${(err as Error).message}`,
				},
			],
		};
	}
	refusals.push(...citationRefusals(cited, registry));

	if (refusals.length > 0) {
		refusals.sort((a, b) => a.file.localeCompare(b.file) || a.message.localeCompare(b.message));
		return { ok: false, refusals };
	}
	return { ok: true, summary: summarize(registry), registry };
}

/** Domains are declared in planning, never free: every promise's domain is on the list. */
function domainRefusals(planRoot: string, registry: Registry): CheckRefusal[] {
	const refusals: CheckRefusal[] = [];
	const domains = declaredDomains(planRoot);
	for (const p of registry.promises) {
		if (domains === null || domains.length === 0) {
			refusals.push({
				file: registryFile(p.file),
				message: `${p.name}: domain "${p.domain}" is not declared — ${CONFIG_KEY} in .indusk/config.json is ${domains === null ? "missing" : "empty"}; declare the project's domains there`,
			});
			break;
		}
		if (!domains.includes(p.domain)) {
			refusals.push({
				file: registryFile(p.file),
				message: `${p.name}: domain "${p.domain}" is not declared (${CONFIG_KEY} in .indusk/config.json declares: ${domains.join(", ")})`,
			});
		}
	}
	return refusals;
}

/** Every token under the code root names a registered, unretired promise (aliases resolve). */
function citationRefusals(cited: Map<string, string[]>, registry: Registry): CheckRefusal[] {
	const byName = new Map(registry.promises.map((p) => [p.name, p]));
	const aliases = new Map<string, PromiseEntry>();
	for (const p of registry.promises) for (const a of p.aliases) aliases.set(a, p);

	const refusals: CheckRefusal[] = [];
	for (const [name, files] of [...cited.entries()].sort()) {
		const entry = byName.get(name) ?? aliases.get(name);
		for (const rel of files) {
			if (!entry) {
				refusals.push({
					file: rel,
					message: `names "promise: ${name}", which is not in the registry (${PROMISES_REL_DIR}/${name}.md does not exist)`,
				});
			} else if (entry.state === "retired") {
				refusals.push({
					file: rel,
					message: `names "promise: ${name}", which is retired${entry.supersededBy ? ` (superseded by ${entry.supersededBy})` : ""} — a retired promise must not keep reporting; remove the mark or point it at the successor`,
				});
			}
		}
	}
	return refusals;
}
