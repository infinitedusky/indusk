import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { commitNote, type NoteCommit } from "../bookkeeping/notes.js";
import { bookkeepingRoots } from "../bookkeeping/roots.js";
import type { Question } from "./record.js";

/**
 * The follow-on plan (ADR decision 8): a late answer, given after the question
 * went ahead, that differs from what was done opens one draft plan naming the
 * question, the choice made and the one wanted. It is `status: draft` with
 * `follow_on_of: <plan>/<question-id>` in its brief, so the release (and only the
 * release) can find it; it is never accepted, approved or started by the answer. A
 * second answer to the same question updates that draft instead of opening
 * another. It sits beside the bugfix plan an unclaimed failure opens
 * (`release/bugfix-plan.ts`) and replaces nothing of it.
 *
 * clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan
 */
export interface FollowOn {
	/** A new draft was written. */
	opened: boolean;
	/** The plan's name, `<plan>-<question-id>`, when one exists for this question. */
	plan?: string;
	/** An existing draft's wanted choice was rewritten by a later answer. */
	updated?: boolean;
}

export const followOnName = (q: Pick<Question, "plan" | "id">): string => `${q.plan}-${q.id}`;

const norm = (s: string): string => s.trim().toLowerCase();

/** Whether `wanted` differs from what was done: the same words, ignoring case and spacing, do not. */
export function differs(q: Pick<Question, "done">, wanted: string): boolean {
	return norm(q.done ?? "") !== norm(wanted);
}

export function openFollowOn(planningDir: string, q: Question, wanted: string): FollowOn {
	if (q.state !== "went-ahead" && q.state !== "answered-late") return { opened: false };
	if (!differs(q, wanted)) return { opened: false };
	const plan = followOnName(q);
	const dir = join(planningDir, plan);
	const brief = join(dir, "brief.md");
	if (existsSync(brief)) {
		const existing = matter(readFileSync(brief, "utf-8"));
		// A person who accepted it has taken it over: the answer no longer rewrites it.
		if (existing.data.status !== "draft") return { opened: false, plan };
		writeFileSync(brief, briefOf(q, wanted));
		return { opened: false, plan, updated: true };
	}
	mkdirSync(dir, { recursive: true });
	writeFileSync(brief, briefOf(q, wanted));
	return { opened: true, plan };
}

/** `openFollowOn` for the trunk's planning folder, committing the draft on `main` as a note. */
export function openFollowOnOnTrunk(
	anyCheckout: string,
	q: Question,
	wanted: string,
): FollowOn & { commit?: NoteCommit } {
	const trunk = bookkeepingRoots(anyCheckout).trunk;
	const result = openFollowOn(join(trunk, ".indusk", "planning"), q, wanted);
	if (!result.plan || (!result.opened && !result.updated)) return result;
	const commit = commitNote(
		trunk,
		[join(".indusk", "planning", result.plan, "brief.md")],
		`chore(indusk): ${result.plan} — follow-on to ${q.id} of ${q.plan}`,
	);
	return { ...result, commit };
}

function briefOf(q: Question, wanted: string): string {
	const date = new Date().toISOString().slice(0, 10);
	return `---
title: ${JSON.stringify(`Follow-on to ${q.id} of ${q.plan}`)}
date: ${date}
status: draft
workflow: bugfix
follow_on_of: ${q.plan}/${q.id}
---

# Follow-on to ${q.id} of ${q.plan}

An unattended run of \`${q.plan}\` asked this question, and it went ahead before the person answered:

> ${q.text}

- **Done:** ${q.done ?? "(unrecorded)"}
- **Recommended:** ${q.recommended}, because ${q.reason}
- **The person wanted:** ${wanted.trim()}

They disagree. This draft is where the difference is put right. It was opened by the answer and nothing more: it is not accepted, approved or started, and \`indusk release\` waits for it to be landed, abandoned or archived.
`;
}
