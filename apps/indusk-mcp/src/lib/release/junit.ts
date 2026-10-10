import { readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
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

function walkSuite(suite: Node, root: string, out: FailedFiles, seen: Set<string>): void {
	for (const inner of list(suite.testsuite)) walkSuite(inner, root, out, seen);
	for (const tc of list(suite.testcase)) {
		const raw =
			attr(tc, "file") ?? attr(tc, "classname") ?? attr(suite, "file") ?? attr(suite, "name");
		if (!raw) continue;
		const file = repoRelative(raw, root);
		seen.add(file);
		if (list(tc.failure).length === 0 && list(tc.error).length === 0) continue;
		const names = out.files.get(file) ?? [];
		names.push(attr(tc, "name") ?? "(unnamed)");
		out.files.set(file, names);
	}
}

const UNREADABLE = (): FailedFiles => ({ readable: false, files: new Map(), total: 0 });

export function failedFiles(reportGlobs: string | string[], root: string): FailedFiles {
	const out = UNREADABLE();
	const paths = globSync(reportGlobs, { cwd: root, absolute: true, nodir: true }).sort();
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
		for (const suite of suites) walkSuite(suite, root, out, seen);
	}
	out.total = seen.size;
	out.readable = true;
	return out;
}
