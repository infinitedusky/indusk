import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { isUsableRelPath } from "../path-segment.js";
import { clauseTokenPattern } from "../tokens.js";
import { type PromiseEntry, promiseTokenPattern } from "./registry.js";

/**
 * Readers of a clause's test file — the one job behind three questions the
 * closing rule asks of it: does it name the promise, does it name the clause,
 * does it assert anything. The closing rule judges; these only read.
 */

/** The file's text, or `null` when `rel` is unusable, missing or not a file. */
function readTestFile(codeRoot: string, rel: string): string | null {
	const abs = join(codeRoot, rel);
	if (!isUsableRelPath(rel) || !existsSync(abs) || !statSync(abs).isFile()) return null;
	return readFileSync(abs, "utf-8");
}

export function carriesToken(
	codeRoot: string,
	rel: string,
	p: PromiseEntry,
): "missing" | "unnamed" | "ok" {
	const text = readTestFile(codeRoot, rel);
	if (text === null) return "missing";
	return [p.name, ...p.aliases].some((n) => promiseTokenPattern(n).test(text)) ? "ok" : "unnamed";
}

/** Whether the test file `rel` names one clause of `p`, by the promise's name or an earlier one. */
export function namesClause(
	codeRoot: string,
	rel: string,
	p: PromiseEntry,
	clause: string,
): boolean {
	const text = readTestFile(codeRoot, rel);
	if (text === null) return true; // missing: the token check's refusal
	return [p.name, ...p.aliases].some((n) => clauseTokenPattern(n, clause).test(text));
}

/**
 * Whether a test file asserts anything: at least one assertion call —
 * `expect(`, `assert(`, or a member of either called (`expect.soft(`,
 * `assert.equal(`) — once comments and import statements are set aside, so
 * the name `assert` in an import or the word in a comment is not one
 * (mark-first A29 and A37, decision D-3 — each form shipped because a scan of
 * every plan's clause tests in dusk found none it would refuse). A file that
 * cannot be read is the token check's refusal, not this one's.
 */
export function assertsSomething(codeRoot: string, rel: string): boolean {
	const text = readTestFile(codeRoot, rel);
	if (text === null) return true;
	return ASSERTION_CALL.test(withoutCommentsOrImports(text));
}

/** An assertion call: `expect` or `assert`, through any members, then `(`. */
const ASSERTION_CALL = /\b(?:expect|assert)(?:\s*\.\s*\w+)*\s*\(/;

/**
 * Source text without block comments, line comments or import statements.
 * Coarse on purpose: a `//` inside a string on the same line as the file's only
 * assertion would hide it, which only refuses more, never accepts a file that
 * asserts nothing; `://` (a URL) is left alone.
 */
function withoutCommentsOrImports(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1")
		.replace(/^\s*import\b[\s\S]*?\bfrom\s*["'][^"']+["'];?/gm, "")
		.replace(/^\s*import\s*["'][^"']+["'];?/gm, "");
}
