import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readConfig, writeConfig } from "../config.js";
import { isUsableSegment } from "../path-segment.js";
import { setScalar } from "./frontmatter-edit.js";
import { type PromiseEntry, promisesDir, readPromises } from "./registry.js";
import { PROMISE_KINDS, PROMISE_NAME, type PromiseKind } from "./vocabulary.js";

/**
 * The one writer of the promise registry (planner-promises ADR D4).
 *
 * A promise reaches the registry from a planning conversation through these
 * functions — the CLI's `promises declare | change | replace` and the MCP
 * tools of the same names — and never by a person typing a file. Until this
 * existed nothing wrote the registry at all: every promise was hand-written,
 * and nothing connected a plan's brief to what the registry held.
 *
 * Every refusal is a `PromiseWriteRefused` that names the promise, the plan
 * or the domain, and nothing is written when one is thrown.
 */
export class PromiseWriteRefused extends Error {}

const refuse = (message: string): never => {
	throw new PromiseWriteRefused(message);
};

const today = (now: Date) => now.toISOString().slice(0, 10);

/** A statement is one paragraph: the registry reads the body's first. */
function oneParagraph(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function activePlanDir(planRoot: string, plan: string): string {
	return join(planRoot, ".indusk", "planning", plan);
}

function requireOpenPlan(planRoot: string, plan: string): void {
	const dir = activePlanDir(planRoot, plan);
	if (!isUsableSegment(plan) || !existsSync(dir) || !statSync(dir).isDirectory()) {
		refuse(
			`"${plan}" is not a plan folder under .indusk/planning/ — a promise is declared, changed or replaced by a plan that is still open`,
		);
	}
}

function registryOrRefuse(planRoot: string) {
	const read = readPromises(planRoot);
	if (read.ok) return read.registry;
	if ("missing" in read) return null;
	return refuse(
		`the registry has a malformed entry — ${read.problems.map((p) => `${p.file}: ${p.problem}`).join("; ")}; fix it before writing another`,
	);
}

/**
 * The project's declared domains hold `domain`, or the project declares none
 * and this promise's becomes the first (A2). A project that declares domains
 * and not this one is refused: domains are declared in planning, never free.
 */
function requireDomain(planRoot: string, domain: string): () => void {
	const config = readConfig(planRoot);
	const declared = config?.promises?.domains;
	if (Array.isArray(declared) && declared.length > 0) {
		if (!declared.includes(domain)) {
			refuse(
				`domain "${domain}" is not declared — promises.domains in .indusk/config.json declares: ${declared.join(", ")}; use one of them, or declare "${domain}" there first`,
			);
		}
		return () => {};
	}
	if (!config) {
		return refuse(
			"no .indusk/config.json — a project's domains are declared there; run `indusk init` first",
		);
	}
	// Returned, not done: the config is written only once the promise can be.
	return () =>
		writeConfig(planRoot, {
			...config,
			promises: { ...config.promises, domains: [domain] },
		});
}

export interface DeclareInput {
	name: string;
	plan: string;
	kind: string;
	domain: string;
	statement: string;
	/** Set by `replacePromise`: the promise this one replaces. */
	supersedes?: string;
	now?: Date;
}

/** Write a new promise, `declared`, owned by `plan`. Returns its file path. */
export function declarePromise(planRoot: string, input: DeclareInput): string {
	const { name, plan, domain } = input;
	const statement = oneParagraph(input.statement);
	if (!PROMISE_NAME.test(name) || !isUsableSegment(name)) {
		refuse(`"${name}" is not a promise name: kebab-case, starting with a letter`);
	}
	if (!(PROMISE_KINDS as readonly string[]).includes(input.kind)) {
		refuse(`"${input.kind}" is not a kind: ${PROMISE_KINDS.join(" | ")}`);
	}
	if (statement === "") refuse(`${name}: a promise needs its sentence (--statement)`);
	if (domain.trim() === "") refuse(`${name}: a promise needs a domain (--domain)`);
	requireOpenPlan(planRoot, plan);

	const dir = promisesDir(planRoot);
	const path = join(dir, `${name}.md`);
	const registry = registryOrRefuse(planRoot);
	if (existsSync(path) || registry?.promises.some((p) => p.name === name)) {
		refuse(
			`${name}: the registry already holds this promise — to improve its sentence use \`indusk promises change ${name}\``,
		);
	}
	const alias = registry?.promises.find((p) => p.aliases.includes(name));
	if (alias) refuse(`${name}: this is an earlier name of "${alias.name}", which still resolves`);
	const declareDomain = requireDomain(planRoot, domain);

	const frontmatter = [
		`name: ${name}`,
		`kind: ${input.kind as PromiseKind}`,
		"lifetime: holds",
		"state: declared",
		`domain: ${domain}`,
		`owner: ${plan}`,
		"sites: []",
		"tests: []",
		"incidents: []",
		...(input.supersedes ? [`supersedes: ${input.supersedes}`] : []),
	];
	const origin = input.supersedes
		? `declared (${plan}), replacing \`${input.supersedes}\`, which is retired when ${plan} closes.`
		: `declared (${plan}), from its planning conversation.`;
	mkdirSync(dir, { recursive: true });
	declareDomain();
	writeFileSync(
		path,
		`---\n${frontmatter.join("\n")}\n---\n\n${statement}\n\n## History\n- ${today(input.now ?? new Date())} — ${origin}\n`,
	);
	return path;
}

export interface ChangeInput {
	name: string;
	plan: string;
	statement: string;
	reason: string;
	now?: Date;
}

/**
 * Improve a promise in place (ADR D4): its sentence is replaced, the changing
 * plan takes it over, and its History keeps the old sentence, the reason and
 * the plan that owned it before. Name, state, incidents and aliases are
 * untouched, so the marks that name it and its incidents stay attached.
 */
export function changePromise(planRoot: string, input: ChangeInput): PromiseEntry {
	const { name, plan } = input;
	const statement = oneParagraph(input.statement);
	const reason = oneParagraph(input.reason);
	const registry = registryOrRefuse(planRoot);
	const promise = registry?.promises.find((p) => p.name === name);
	if (!registry || !promise) {
		return refuse(`${name}: the registry does not hold this promise — nothing to change`);
	}
	if (promise.state === "retired") {
		refuse(`${name}: this promise is retired — a retired promise is replaced, not changed`);
	}
	if (statement === "") refuse(`${name}: a change needs the new sentence (--statement)`);
	if (reason === "") refuse(`${name}: a change needs its reason (--reason)`);
	requireOpenPlan(planRoot, plan);
	if (statement === promise.statement && promise.owner === plan) {
		refuse(`${name}: it already reads that way and ${plan} already owns it — nothing to change`);
	}

	const path = join(registry.dir, promise.file);
	let text = setScalar(readFileSync(path, "utf-8"), "owner", plan);
	text = replaceStatement(text, statement);
	const from =
		promise.owner === plan ? "" : ` Owned before by ${promise.owner}; ${plan} takes it over.`;
	text = appendHistory(
		text,
		`- ${today(input.now ?? new Date())} — changed by ${plan}: ${reason}. It read: "${promise.statement}"${from}`,
	);
	writeFileSync(path, text);
	return { ...promise, statement, owner: plan };
}

export interface ReplaceInput extends Omit<DeclareInput, "supersedes"> {
	/** The promise being replaced. */
	old: string;
}

/**
 * Replace a promise whose name no longer describes it (ADR D4): the new one
 * is declared carrying `supersedes: <old>`. The old one is untouched — it is
 * in force until the replacing plan closes, when `confirm` retires it.
 */
export function replacePromise(planRoot: string, input: ReplaceInput): string {
	const registry = registryOrRefuse(planRoot);
	const old = registry?.promises.find((p) => p.name === input.old);
	if (!old) {
		return refuse(`${input.old}: the registry does not hold this promise — nothing to replace`);
	}
	if (old.state === "retired") refuse(`${input.old}: this promise is already retired`);
	const { old: supersedes, ...declare } = input;
	return declarePromise(planRoot, { ...declare, supersedes });
}

/** The body after the frontmatter, split at its first paragraph. */
function replaceStatement(text: string, statement: string): string {
	const end = text.indexOf("\n---", 4);
	const head = text.slice(0, end + 4);
	const lines = text.slice(end + 4).split("\n");
	const first = lines.findIndex((l) => l.trim() !== "");
	if (first === -1 || lines[first].trim().startsWith("#")) {
		// No statement to replace (a malformed file would have been refused on
		// read); put the sentence where a statement goes.
		return `${head}\n\n${statement}\n${lines.join("\n")}`;
	}
	let last = first;
	while (
		last + 1 < lines.length &&
		lines[last + 1].trim() !== "" &&
		!lines[last + 1].trim().startsWith("#")
	) {
		last++;
	}
	lines.splice(first, last - first + 1, statement);
	return `${head}${lines.join("\n")}`;
}

/** Add `line` at the end of the file's `## History` section, creating the section when absent. */
export function appendHistory(text: string, line: string): string {
	const lines = text.replace(/\n+$/, "").split("\n");
	const heading = lines.findIndex((l) => /^## History\s*$/.test(l));
	if (heading === -1) return `${lines.join("\n")}\n\n## History\n${line}\n`;
	let end = heading + 1;
	while (end < lines.length && !/^## /.test(lines[end])) end++;
	// Skip back over blank lines so the entry sits directly under the last one.
	let insert = end;
	while (insert > heading + 1 && lines[insert - 1].trim() === "") insert--;
	lines.splice(insert, 0, line);
	return `${lines.join("\n")}\n`;
}
