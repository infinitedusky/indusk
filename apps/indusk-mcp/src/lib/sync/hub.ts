/**
 * Hub push/pull rule distribution (indusk-makeover Phase 5).
 *
 * InDusk is the hub; projects are the spokes. A rule proven general in one
 * project is PROMOTED into the machine-global hub channel
 * (`$INDUSK_HOME/hub/lessons/community-*.md`); every project PULLS the hub
 * channel (plus the package's bundled community lessons) at catchup cadence
 * or via `indusk sync pull`.
 *
 * Invariants (trajectory rows A13/A14):
 * - Pull is ADDITIVE ONLY: a project's existing lesson file is never
 *   overwritten. Same-content → skip (idempotent); different-content →
 *   conflict reported, local wins.
 * - Promote is refuse-on-conflict: an existing hub lesson with different
 *   content is never clobbered.
 * - Provenance is stamped on promote (source project + timestamp) and
 *   travels with the lesson into every pulling project.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

function induskHome(): string {
	return process.env.INDUSK_HOME ?? join(homedir(), ".indusk");
}

export function getHubLessonsDir(): string {
	return join(induskHome(), "hub/lessons");
}

function getHubManifestPath(): string {
	return join(induskHome(), "hub/manifest.json");
}

interface HubManifest {
	version: number;
	updated: string;
}

function readManifest(): HubManifest | null {
	const p = getHubManifestPath();
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, "utf-8"));
	} catch {
		return null;
	}
}

function bumpManifest(now: Date): number {
	const current = readManifest();
	const version = (current?.version ?? 0) + 1;
	mkdirSync(join(induskHome(), "hub"), { recursive: true });
	writeFileSync(
		getHubManifestPath(),
		`${JSON.stringify({ version, updated: now.toISOString() }, null, "\t")}\n`,
	);
	return version;
}

function hash(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

export interface PromoteResult {
	status: "promoted" | "already-promoted" | "conflict" | "not-found";
	hubPath?: string;
	hubVersion?: number;
	detail?: string;
}

/**
 * Promote a project lesson into the hub channel. `name` accepts the bare
 * lesson name with or without `.md` / `community-` prefix; the hub copy is
 * always `community-` prefixed.
 */
export function promoteLesson(
	projectRoot: string,
	name: string,
	now: Date = new Date(),
): PromoteResult {
	const bare = basename(name, ".md");
	const sourceCandidates = [bare, bare.replace(/^community-/, "")].map((n) =>
		join(projectRoot, ".claude/lessons", `${n}.md`),
	);
	const sourcePath = sourceCandidates.find((p) => existsSync(p));
	if (!sourcePath) {
		return { status: "not-found", detail: `no lesson '${bare}' in .claude/lessons/` };
	}

	const hubName = bare.startsWith("community-") ? bare : `community-${bare}`;
	const hubDir = getHubLessonsDir();
	const hubPath = join(hubDir, `${hubName}.md`);

	const source = readFileSync(sourcePath, "utf-8");
	const provenance = `\n— promoted from \`${basename(projectRoot)}\` at ${now.toISOString()}\n`;
	const stamped = `${source.trimEnd()}\n${provenance}`;

	if (existsSync(hubPath)) {
		const existing = readFileSync(hubPath, "utf-8");
		// Same source content (ignoring the provenance stamp) → idempotent.
		const existingBody = existing.replace(/\n— promoted from `[^`]+` at [^\n]+\n?$/m, "").trimEnd();
		if (hash(existingBody) === hash(source.trimEnd())) {
			return { status: "already-promoted", hubPath };
		}
		return {
			status: "conflict",
			hubPath,
			detail: "hub already has a lesson by this name with different content — resolve manually",
		};
	}

	mkdirSync(hubDir, { recursive: true });
	writeFileSync(hubPath, stamped);
	const hubVersion = bumpManifest(now);
	return { status: "promoted", hubPath, hubVersion };
}

export interface PullResult {
	/** Lesson filenames newly copied into the project. */
	pulled: string[];
	/** Files present and identical — untouched. */
	skippedSame: number;
	/** Files present with DIFFERENT content — untouched, local wins. */
	conflicts: string[];
	hubVersion: number | null;
}

/**
 * Pull the hub channel (and, when available, the package's bundled community
 * lessons) into the project's `.claude/lessons/`. Additive-only; idempotent.
 */
export function pullLessons(projectRoot: string, packageLessonsDir?: string): PullResult {
	const targetDir = join(projectRoot, ".claude/lessons");
	const sources: string[] = [];
	if (packageLessonsDir && existsSync(packageLessonsDir)) sources.push(packageLessonsDir);
	if (existsSync(getHubLessonsDir())) sources.push(getHubLessonsDir());

	const pulled: string[] = [];
	const conflicts: string[] = [];
	let skippedSame = 0;

	for (const dir of sources) {
		for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
			const sourceContent = readFileSync(join(dir, file), "utf-8");
			const targetPath = join(targetDir, file);
			if (!existsSync(targetPath)) {
				mkdirSync(targetDir, { recursive: true });
				writeFileSync(targetPath, sourceContent);
				pulled.push(file);
				continue;
			}
			if (hash(readFileSync(targetPath, "utf-8")) === hash(sourceContent)) {
				skippedSame++;
			} else {
				conflicts.push(file);
			}
		}
	}

	return { pulled, skippedSame, conflicts, hubVersion: readManifest()?.version ?? null };
}
