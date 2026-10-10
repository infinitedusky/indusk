import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import matter from "gray-matter";
import { setList, setScalar } from "./frontmatter-edit.js";
import {
	ensurePromiseCarries,
	type IncidentChange,
	incidentText,
	iso,
	newIncidentId,
	oneLine,
	provenBy,
	recorded,
	SUSPECTS,
	stringList,
} from "./incidents.js";
import type { PromiseEntry, Registry } from "./registry.js";
import { INCIDENTS_SUBDIR } from "./vocabulary.js";

/**
 * A release's incident (release-records-its-failures D7, D9), written beside
 * the watcher's in `incidents.ts` and sharing its file shape: `tests:` and
 * `release:` evidence where a watcher's is `traces:`, and the suspects in the body.
 */

/**
 * The commits that may have broken a slow test (release-records-its-failures
 * D9): `git log <since>..HEAD` over the slow tests' `covers` paths. `since` is
 * null when the last green slow run recorded no commit — none are named then,
 * and the incident says why.
 */
export interface Suspects {
	since: string | null;
	/** Why none are named, when `since` is null. */
	unnamed?: string;
	covers: string[];
	/** `<short sha> <subject>`, newest first. */
	commits: string[];
}

/** One release's failure of the tests that prove a promise (ADR D7). */
export interface TestFailure {
	/** Each failing file, with the names of its tests that failed. */
	tests: { file: string; names: string[] }[];
	release: { version: string; commit: string };
	suspects: Suspects;
	now: Date;
}

/** `<file> > <test>`, the runner's own spelling, once per failed test; the file alone when no test is named. */
function testItems(failure: TestFailure): string[] {
	return failure.tests.flatMap((t) =>
		t.names.length > 0 ? t.names.map((n) => `${t.file} > ${n}`) : [t.file],
	);
}

function releaseItem(release: TestFailure["release"]): string {
	return `${release.version} at ${release.commit.slice(0, 7)}`;
}

/** One release's block under `## Suspects`: what failed in it, and the commits since the last green run. */
export function suspectsBlock(failure: TestFailure): string {
	const { release, suspects } = failure;
	const failed = testItems(failure)
		.map((t) => `\`${oneLine(t)}\``)
		.join(", ");
	const head = `Release ${release.version} (${release.commit.slice(0, 7)}) — failing: ${failed}.`;
	const paths = suspects.covers.map((c) => `\`${c}\``).join(", ");
	if (suspects.since === null) {
		return `${head}\n\nNone named: ${suspects.unnamed ?? "the last green slow run recorded no commit to count from"}.`;
	}
	const since = suspects.since.slice(0, 7);
	if (suspects.commits.length === 0) {
		return `${head}\n\nNo commit since the last green slow run (${since}) touched ${paths}.`;
	}
	return `${head}\n\nCommits since the last green slow run (${since}) touching ${paths}:\n\n${suspects.commits
		.map((c) => `- ${oneLine(c)}`)
		.join("\n")}`;
}

/** `block` appended to the incident's `## Suspects`, which is added before `## Proven by` when absent. */
function withSuspects(text: string, block: string): string {
	const heading = `\n## ${SUSPECTS}\n`;
	const at = text.indexOf(heading);
	if (at !== -1) {
		const next = text.indexOf("\n## ", at + heading.length);
		const end = next === -1 ? text.length : next;
		return `${text.slice(0, end).replace(/\n*$/, "")}\n\n${block}\n${text.slice(end)}`;
	}
	const before = ["\n## Proven by\n", "\n## Root cause\n"]
		.map((h) => text.indexOf(h))
		.find((i) => i !== -1);
	if (before === undefined) return `${text.replace(/\n*$/, "")}\n${heading}\n${block}\n`;
	return `${text.slice(0, before)}${heading}\n${block}\n${text.slice(before)}`;
}

/**
 * Record a release's failure of `promise`'s tests (release-records-its-failures
 * D7): an incident whose evidence is `tests:` and `release:` where a
 * watcher's is `traces:`, with the suspects in its body — or, when the
 * promise has an open incident (a release's or a watcher's), that incident
 * extended: the new tests and release added, the release's block appended to
 * its suspects, `last_seen` moved forward. A release already recorded on it
 * is not recorded twice. Opened or extended, the promise is made to carry it
 * (`ensurePromiseCarries`), exactly as a watcher's incident; the caller
 * reopens the owner, as `watch` does.
 *
 * promise: a-failing-slow-test-breaks-its-promise
 */
export function recordTestFailure(
	registry: Registry,
	promise: PromiseEntry,
	failure: TestFailure,
	/** Ids an opened incident must not take: those the owner's Maintenance phases name. */
	avoid: ReadonlySet<string> = new Set(),
): IncidentChange {
	const now = iso(failure.now);
	const open = registry.incidents.find((i) => i.promise === promise.name && i.status === "open");
	if (open) {
		const path = join(registry.dir, open.file);
		const before = readFileSync(path, "utf-8");
		const data = matter(before).data as Record<string, unknown>;
		const releases = stringList(data.release);
		const item = releaseItem(failure.release);
		let text = setList(before, "tests", [
			...new Set([...stringList(data.tests), ...testItems(failure).map(oneLine)]),
		]);
		if (!releases.includes(item)) {
			text = setList(text, "release", [...releases, item]);
			text = withSuspects(text, suspectsBlock(failure));
		}
		const lastSeen = recorded(path).lastSeen;
		if (!lastSeen || lastSeen < now) text = setScalar(text, "last_seen", now);
		if (text !== before) writeFileSync(path, text);
		ensurePromiseCarries(registry, promise, open.id);
		return { id: open.id, kind: "extended", traces: [] };
	}

	const dir = join(registry.dir, INCIDENTS_SUBDIR);
	mkdirSync(dir, { recursive: true });
	const id = newIncidentId(dir, promise.name, now.slice(0, 10), avoid);
	const files = failure.tests.map((t) => t.file).join(", ");
	writeFileSync(
		join(dir, `${id}.md`),
		incidentText({
			id,
			promise: promise.name,
			source: "release",
			opened: now,
			lastSeen: now,
			evidence: [
				...yamlList("tests", testItems(failure)),
				...yamlList("release", [releaseItem(failure.release)]),
			],
			symptom: `Release ${failure.release.version}: ${files} failed in the slow tests and was still failing when the release recorded it.`,
			environment: null,
			suspects: suspectsBlock(failure),
			provenBy: provenBy(resolve(registry.dir, "..", ".."), promise),
		}),
	);
	ensurePromiseCarries(registry, promise, id);
	return { id, kind: "opened", traces: [] };
}

/** A frontmatter block list, each value a YAML double-quoted string (JSON's spelling is YAML's). */
function yamlList(key: string, values: string[]): string[] {
	return [`${key}:`, ...values.map((v) => `  - ${JSON.stringify(oneLine(v))}`)];
}
