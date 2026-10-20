import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { gitSync } from "../bookkeeping/git.js";

/**
 * The release's wait for a known-wrong thing (decisions-as-questions, ADR decision
 * 11): a plan opened as the follow-on of a late disagreeing answer (`follow_on_of`
 * in its brief) that is not yet closed. Closed is landed, abandoned or archived
 * (a plan folder under `archive/` is not scanned). Only the release reads this;
 * landing never does, and an ordinary plan never blocks.
 *
 * clause: a-release-waits-for-a-known-wrong/release-refuses
 * clause: a-release-waits-for-a-known-wrong/landing-never-waits
 */
export interface OpenFollowOn {
	name: string;
	/** `<plan>/<question-id>` the follow-on answers. */
	of: string;
	status: string;
}

const CLOSED = new Set(["landed", "abandoned", "archived"]);

/**
 * `landed(name)` says whether the plan has landed on the trunk: landing never writes
 * `landed` into a brief, it merges with the subject `Merge <branch>: <plan> landed`
 * (`landedOnTrunk`). A brief whose frontmatter cannot be read but names `follow_on_of`
 * counts as open, with status `unreadable`.
 */
export function openFollowOns(
	planningDir: string,
	landed: (name: string) => boolean = () => false,
): OpenFollowOn[] {
	if (!existsSync(planningDir)) return [];
	const open: OpenFollowOn[] = [];
	for (const entry of readdirSync(planningDir, { withFileTypes: true }).sort((a, b) =>
		a.name.localeCompare(b.name),
	)) {
		if (!entry.isDirectory() || entry.name === "archive") continue;
		const brief = join(planningDir, entry.name, "brief.md");
		if (!existsSync(brief)) continue;
		const raw = readFileSync(brief, "utf-8");
		let data: Record<string, unknown>;
		try {
			data = matter(raw).data;
		} catch {
			const line = /^follow_on_of:\s*(\S.*)$/m.exec(raw);
			if (line) open.push({ name: entry.name, of: (line[1] ?? "").trim(), status: "unreadable" });
			continue;
		}
		const of = data.follow_on_of;
		if (typeof of !== "string" || of === "") continue;
		const status = typeof data.status === "string" ? data.status : "";
		if (CLOSED.has(status.toLowerCase()) || landed(entry.name)) continue;
		open.push({ name: entry.name, of, status });
	}
	return open;
}

/** Whether a plan landed on the trunk, read from the trunk's merge subjects (`plans/land.ts` writes them). */
export function landedOnTrunk(trunk: string): (name: string) => boolean {
	const log = gitSync(trunk, "log", "--format=%s", "--grep= landed$");
	const subjects = log.code === 0 ? log.out.split("\n") : [];
	return (name) => subjects.some((s) => s.startsWith("Merge ") && s.endsWith(`: ${name} landed`));
}

/** The refusal's words: every open follow-on by name, and how each is closed. */
export function followOnRefusal(open: OpenFollowOn[]): string {
	const names = open.map((o) => `${o.name} (follow-on to ${o.of}, ${o.status || "no status"})`);
	return `release refused: ${open.length} follow-on plan${open.length === 1 ? " is" : "s are"} still open — ${names.join("; ")}. A late answer disagreed with what a run did; land, abandon or archive each follow-on, then release again.`;
}
