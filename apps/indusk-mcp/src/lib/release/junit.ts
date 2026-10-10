import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { globSync } from "glob";

/**
 * Which test files failed, read from the declared JUnit report and nothing
 * the runner printed (release-records-its-failures D4). A report spread over
 * several files (one per package) is read as one.
 *
 * promise: a-failure-is-read-from-the-report
 */
export interface FailedFiles {
	/** `false` when no report matched or any matching one could not be parsed. */
	readable: boolean;
	/** Each failed test file (repo-relative) → the names of its failed cases. */
	files: Map<string, string[]>;
	/** Each test file the report(s) carry with no failed case: the only files that passed. */
	passed: Set<string>;
	/** How many test files the report(s) carry, failed or not. */
	total: number;
}

interface Node {
	[key: string]: unknown;
}

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	isArray: (name) => ["testsuites", "testsuite", "testcase", "failure", "error"].includes(name),
});

const list = (value: unknown): Node[] => (Array.isArray(value) ? (value as Node[]) : []);
const attr = (node: Node, name: string): string | undefined => {
	const v = node[`@_${name}`];
	return typeof v === "string" && v ? v : undefined;
};

function repoRelative(file: string, root: string): string {
	const slashed = file.replaceAll("\\", "/");
	const rel = isAbsolute(slashed) ? relative(root, slashed).replaceAll("\\", "/") : slashed;
	return rel.replace(/^\.\//, "");
}

/**
 * Vitest names a file relative to the package it ran in (`src/x.test.ts`), and
 * a report lives inside that package (`apps/app/test-results/*.xml`). A relative
 * name that is no file at the repo root but is one under a directory above the
 * report is that package's file: made repo-relative. A name that is a file
 * nowhere stays as written.
 */
function underReport(file: string, root: string, report: string): string {
	if (isAbsolute(file) || existsSync(join(root, file))) return file;
	for (let dir = dirname(report); dir.startsWith(root) && dir !== root; dir = dirname(dir)) {
		if (existsSync(join(dir, file))) return relative(root, join(dir, file)).replaceAll("\\", "/");
	}
	return file;
}

function walkSuite(
	suite: Node,
	root: string,
	out: FailedFiles,
	seen: Set<string>,
	report: string,
): void {
	for (const inner of list(suite.testsuite)) walkSuite(inner, root, out, seen, report);
	for (const tc of list(suite.testcase)) {
		const raw =
			attr(tc, "file") ?? attr(tc, "classname") ?? attr(suite, "file") ?? attr(suite, "name");
		if (!raw) continue;
		const file = underReport(repoRelative(raw, root), root, report);
		seen.add(file);
		if (list(tc.failure).length === 0 && list(tc.error).length === 0) continue;
		const names = out.files.get(file) ?? [];
		names.push(attr(tc, "name") ?? "(unnamed)");
		out.files.set(file, names);
	}
}

const UNREADABLE = (): FailedFiles => ({
	readable: false,
	files: new Map(),
	passed: new Set(),
	total: 0,
});

/**
 * `since`, when given, is when the slow run began: a report file last modified
 * before it is an earlier run's and is not read (never deleted — a broad glob
 * would reach a project's own files). Whole seconds, since a filesystem may
 * truncate a modification time to one.
 */
export function failedFiles(
	reportGlobs: string | string[],
	root: string,
	since?: Date,
): FailedFiles {
	const out = UNREADABLE();
	const floor = since ? Math.floor(since.getTime() / 1000) * 1000 : undefined;
	const paths = globSync(reportGlobs, { cwd: root, absolute: true, nodir: true })
		.filter((path) => floor === undefined || statSync(path).mtimeMs >= floor)
		.sort();
	if (paths.length === 0) return out;
	const seen = new Set<string>();
	for (const path of paths) {
		let doc: Node;
		try {
			const xml = readFileSync(path, "utf-8");
			if (XMLValidator.validate(xml) !== true) return UNREADABLE();
			doc = parser.parse(xml) as Node;
		} catch {
			return UNREADABLE();
		}
		const suites = [
			...list(doc.testsuite),
			...list(doc.testsuites).flatMap((s) => list(s.testsuite)),
		];
		if (suites.length === 0 && list(doc.testsuites).length === 0) {
			return UNREADABLE();
		}
		for (const suite of suites) walkSuite(suite, root, out, seen, path);
	}
	out.passed = new Set([...seen].filter((f) => !out.files.has(f)));
	out.total = seen.size;
	out.readable = true;
	return out;
}
