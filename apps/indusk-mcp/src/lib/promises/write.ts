import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readConfig, writeConfig } from "../config.js";
import { isUsableSegment } from "../path-segment.js";
import { setScalar } from "./frontmatter-edit.js";
import { planFolderStatus } from "./plan-folder.js";
import {
	contractDir,
	firstParagraph,
	type PromiseEntry,
	parseFrontmatter,
	promiseProblem,
	type Registry,
	readPromises,
} from "./registry.js";
import { PROMISE_KINDS, PROMISE_NAME, type PromiseKind } from "./vocabulary.js";

/**
 * The one writer of the promise registry (planner-promises ADR D4).
 *
 * A promise reaches the registry from a planning conversation through these
 * functions — the CLI's `promises declare | change | replace | withdraw` and the MCP
 * tools of the same names — and never by a person typing a file. Until this
 * existed nothing wrote the registry at all: every promise was hand-written,
 * and nothing connected a plan's brief to what the registry held.
 *
 * Every refusal is a `PromiseWriteRefused` that names the promise, the plan
 * or the domain, and nothing is written when one is thrown.
 */
export class PromiseWriteRefused extends Error {}

// Declared, not inferred: TypeScript treats a call as ending the path only
// when the function's `never` is on its declaration.
function refuse(message: string): never {
	throw new PromiseWriteRefused(message);
}

const today = (now: Date) => now.toISOString().slice(0, 10);

/** A statement is one paragraph: the registry reads the body's first. */
function oneParagraph(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function requireOpenPlan(planRoot: string, plan: string): void {
	if (planFolderStatus(planRoot, plan) !== "active") {
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

/** Write a new promise, `declared`, owned by `plan`. Returns its file path. *
 * promise: a-briefs-promises-are-in-the-registry
 */
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

	const dir = contractDir(planRoot);
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
	const text = `---\n${frontmatter.join("\n")}\n---\n\n${statement}\n\n## History\n- ${today(input.now ?? new Date())} — ${origin}\n`;
	requireReadable(name, text);
	mkdirSync(dir, { recursive: true });
	declareDomain();
	writeFileSync(path, text);
	return path;
}

/**
 * The writer applies its reader's rule (planner-promises A37). A domain YAML
 * reads as a number, a boolean or a mapping, or a sentence that begins with a
 * heading, wrote a file the registry could not read, and every promise command
 * refused from then on. The text is read back before anything is written.
 */
function requireReadable(name: string, text: string): void {
	const parsed = parseFrontmatter(text);
	if ("error" in parsed) {
		refuse(
			`${name}: written as given, this promise could not be read back (${parsed.error.split("\n")[0]}) — a domain is one word such as \`seating\`, with no colon; nothing was written`,
		);
	}
	const problem = promiseProblem(parsed.data, name, firstParagraph(parsed.content));
	if (problem !== null) {
		refuse(
			`${name}: written as given, the registry could not read this promise back: ${problem} — a domain is a word such as \`seating\`, not a number or true/false, and the sentence is plain text that does not begin with #; nothing was written`,
		);
	}
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
 *
 * promise: a-changed-promise-keeps-its-history
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
	requireReadable(name, text);
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
 *
 * promise: a-changed-promise-keeps-its-history
 */
export function replacePromise(planRoot: string, input: ReplaceInput): string {
	const registry = registryOrRefuse(planRoot);
	const old = registry?.promises.find((p) => p.name === input.old);
	if (!old) {
		return refuse(`${input.old}: the registry does not hold this promise — nothing to replace`);
	}
	if (old.state === "retired") refuse(`${input.old}: this promise is already retired`);
	if (input.name === input.old) refuse(`${input.old}: a promise does not replace itself`);
	const already = registry?.promises.find((p) => p.name === input.name);
	if (registry && already) return recordReplacement(registry, already, input);
	const { old: supersedes, ...declare } = input;
	return declarePromise(planRoot, { ...declare, supersedes });
}

/**
 * The replacement is already declared, plainly (planner-promises A38): the
 * planner saved it with `declare`, and closing refused because nothing said
 * what it replaces. The link is recorded on it; its sentence is the one it
 * was declared with. Only a promise this plan declared, still `declared`, that
 * replaces nothing else.
 */
function recordReplacement(registry: Registry, promise: PromiseEntry, input: ReplaceInput): string {
	const { name, plan, old } = input;
	if (promise.owner !== plan || promise.state !== "declared") {
		refuse(
			`${name}: the registry already holds this promise, ${promise.state} and owned by ${promise.owner} — a replacement is a promise ${plan} declares`,
		);
	}
	if (promise.supersedes && promise.supersedes !== old) {
		refuse(`${name}: it already replaces ${promise.supersedes}; a promise replaces one other`);
	}
	const path = join(registry.dir, promise.file);
	if (promise.supersedes === old) return path;
	let text = setScalar(readFileSync(path, "utf-8"), "supersedes", old);
	text = appendHistory(
		text,
		`- ${today(input.now ?? new Date())} — recorded as replacing \`${old}\`, which is retired when ${plan} closes.`,
	);
	requireReadable(name, text);
	writeFileSync(path, text);
	return path;
}

export interface WithdrawInput {
	name: string;
	plan: string;
}

/**
 * Take back a promise that was never in force (planner-promises A28): a
 * planning conversation dropped it, or gave it a better name. Its file is
 * removed. Only a `declared` promise, and only by the plan that declared it —
 * a promise in force has a history and tests vouching for it, and leaves the
 * registry by being replaced, never by being deleted. Returns the path
 * removed.
 */
export function withdrawPromise(planRoot: string, input: WithdrawInput): string {
	const { name, plan } = input;
	const registry = registryOrRefuse(planRoot);
	const promise = registry?.promises.find((p) => p.name === name);
	if (!registry || !promise) {
		return refuse(`${name}: the registry does not hold this promise — nothing to withdraw`);
	}
	// An archived plan may still hold a promise it never confirmed (A43).
	const status = planFolderStatus(planRoot, plan);
	if (status !== "active" && status !== "archived") {
		refuse(`"${plan}" is not a plan folder under .indusk/planning/ or .indusk/planning/archive/`);
	}
	if (promise.owner !== plan) {
		refuse(
			`${name}: ${promise.owner} declared this promise, not ${plan} — a promise is withdrawn by the plan that made it`,
		);
	}
	if (promise.state !== "declared") {
		refuse(
			`${name}: this promise is ${promise.state}, not declared — only a promise that was never in force is withdrawn; one in force is replaced (\`indusk promises replace\`)`,
		);
	}
	if (promise.incidents.length > 0) {
		refuse(
			`${name}: it lists ${promise.incidents.join(", ")} — a promise with an incident has a history, and that is not withdrawn`,
		);
	}
	const replacement = registry.promises.find((p) => p.supersedes === name);
	if (replacement) {
		refuse(
			`${name}: ${replacement.name} records that it replaces this promise — withdraw ${replacement.name} first`,
		);
	}
	const path = join(registry.dir, promise.file);
	rmSync(path);
	return path;
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
