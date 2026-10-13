import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { git } from "../git.js";
import { approvalOf, readRecord, standingOf } from "../looks/approvals.js";
import { type LooksApp, readApp } from "../looks/mockups.js";
import { listApps } from "../looks/overview.js";
import { type BriefLooks, parseBriefContract } from "../promises/brief-contract.js";

/**
 * What approval records, and what it waits on (brief-as-the-contract ADR
 * decisions 4 and 5): the approval is of the brief, kept as the hash of its
 * bytes in the impl's frontmatter, and a plan is approved only once the
 * mockups its brief makes, changes or replaces are. A story is exempt, since
 * it cannot be approved before the component exists and the build pauses for
 * it. The hash is what a brief edited afterwards is compared with.
 *
 * promise: approval-is-of-the-brief
 * promise: a-plan-is-approved-with-its-looks-approved
 */

/** sha256 of a brief's bytes: the one spelling of "the brief that was approved". */
export const briefHash = (briefText: string): string =>
	createHash("sha256").update(briefText).digest("hex");

/**
 * Where a plan's brief stands against its approval: `unapproved` when the impl
 * records no approved brief (a plan not yet approved, or approved before this
 * record), `unchanged` when the brief is the one approved, `changed` when it
 * has been edited since. `amendmentsOf` (Build Phase 3) builds on `changed`.
 */
export type BriefStanding =
	| { state: "unapproved" }
	| { state: "unchanged"; approved: string }
	| { state: "changed"; approved: string; now: string };

/** A plan folder's brief compared with the hash its impl recorded at approval. */
export function briefStandingOf(planDir: string): BriefStanding {
	const impl = join(planDir, "impl.md");
	const brief = join(planDir, "brief.md");
	if (!existsSync(impl) || !existsSync(brief)) return { state: "unapproved" };
	const approved = matter(readFileSync(impl, "utf-8")).data.approved_brief;
	if (typeof approved !== "string" || approved === "") return { state: "unapproved" };
	const now = briefHash(readFileSync(brief, "utf-8"));
	return now === approved ? { state: "unchanged", approved } : { state: "changed", approved, now };
}

/** Who approved: the person git knows here, else the account the command runs as. */
export async function approvedBy(root: string): Promise<string> {
	return (await git(root, "config", "user.name").catch(() => "")) || userInfo().username;
}

/**
 * The frontmatter an approval writes beside `status: approved`. Every value is
 * a quoted string: a bare hash of digits and one `e` is a number in YAML, and a
 * bare timestamp is a date.
 */
export function approvalFrontmatter(
	briefText: string,
	by: string,
	at: Date,
): Record<string, string> {
	return {
		approved_brief: JSON.stringify(briefHash(briefText)),
		approved_by: JSON.stringify(by),
		approved_at: JSON.stringify(at.toISOString()),
	};
}

/** The names of the looks a brief must have approved: those it makes, changes, or replaces by. */
export function looksToApprove(looks: BriefLooks | null): string[] {
	if (looks === null) return [];
	return [
		...new Set([
			...looks.makes.map((l) => l.name),
			...looks.changes.map((l) => l.name),
			...looks.replaces.map((l) => l.by),
		]),
	];
}

/**
 * Refusals, one per mockup `briefText` makes, changes or replaces that is not
 * approved as `root` holds it, or not drawn there at all. No name is exempt:
 * a story is never named without a mockup, since a new component is drawn as
 * its own (brief-as-the-contract ADR decision 4a). An app that cannot be read
 * is a refusal of its own, never a silent pass.
 */
export async function unapprovedMockups(root: string, briefText: string): Promise<string[]> {
	const brief = parseBriefContract(briefText);
	const wanted = brief.shape === "contract" ? looksToApprove(brief.looks) : [];
	if (wanted.length === 0) return [];

	const apps: LooksApp[] = [];
	const refusals: string[] = [];
	for (const name of listApps(root)) {
		try {
			apps.push(await readApp(root, name));
		} catch (err) {
			refusals.push(
				`${name}'s looks cannot be read, so its mockups cannot be checked: ${(err as Error).message}`,
			);
		}
	}
	// An app that could not be read may hold the look: its refusal stands for it.
	const someUnreadable = refusals.length > 0;
	for (const look of wanted) {
		const drawnIn = apps.filter((app) => app.mockups.some((m) => m.name === look));
		if (drawnIn.length === 0 && !someUnreadable) {
			refusals.push(
				`${look} is not drawn — draw it as a mockup in this plan's worktree (a new component as its own mockup, declared in indusk-new-components) and approve it in the cockpit's Looks page`,
			);
		}
		for (const app of drawnIn) {
			const mockup = app.mockups.find((m) => m.name === look);
			if (!mockup) continue;
			const standing = standingOf(readRecord(app));
			const now = approvalOf(app, mockup, standing.mockups, [], standing.stories);
			if (now.state === "approved") continue;
			refusals.push(
				`${look} (${app.app}) is still proposed — approve it in the cockpit's Looks page, in this plan's worktree`,
			);
		}
	}
	return refusals;
}
