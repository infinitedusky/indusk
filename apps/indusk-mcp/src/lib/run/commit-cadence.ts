import { execFile } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";
import type { EditToolInput, GatedToolName, WriteToolInput } from "./gate.js";
import { resolveInWorktree } from "./worktree-paths.js";

/**
 * Loop-owned per-item commit cadence (dawn-hook-parity A2/A5, ADR Decision 2).
 *
 * The loop — not the model — commits after each checklist-item checkoff
 * survives the gate chain, restoring the `/work` convention's granularity
 * (bisect, blame, per-item revert) and giving the eval rail its natural
 * firing points. Deterministic by design: commit behavior left to model
 * discretion is demonstrably variable across drivers (matrix F-findings).
 *
 * Detection: an applied `edit` to the plan's impl file whose replacement
 * checks at least one `- [ ]` into `- [x]` is a checkoff event. Everything
 * changed in the worktree since the previous commit belongs to that item —
 * the writes a model makes between checkoffs are the item's work product —
 * so staging is `git add -A` within the worktree.
 *
 * Failure is bookkeeping, never a gate (A5): a failed commit is recorded
 * loudly on the run report and nothing is enqueued downstream; the run
 * continues. Non-git worktrees (test fixtures, staging dirs) disable the
 * cadence LOUDLY via `disabledReason`, never silently.
 *
 * Known boundary: checkoffs performed through `bash` (rather than the edit
 * tool) bypass cadence detection — the bash gate re-validates them, but no
 * commit fires. The phase contract instructs models to check off via edit.
 */

const execFileAsync = promisify(execFile);

export interface CommitRecord {
	sha: string;
	item: string;
	phase: number;
}

export interface CommitFailure {
	phase: number;
	message: string;
}

export interface CommitCadence {
	/** Wire into GateOptions.onGatedApply — fires after a gated apply lands. */
	onGatedApply: (name: GatedToolName, input: EditToolInput | WriteToolInput) => Promise<void>;
	/** Non-null when the cadence is off (non-git worktree) — surface it loudly. */
	disabledReason: string | null;
	commits: CommitRecord[];
	failures: CommitFailure[];
}

export interface CommitCadenceOptions {
	worktreeRoot: string;
	implPath: string;
	/** Current phase number, read at commit time (the loop advances it). */
	getPhase: () => number;
	/** Plan segment for the commit message; defaults to the impl's directory name. */
	planName?: string;
	/** Phase 3 seam: fires after each successful commit (queue append). */
	onCommit?: (record: CommitRecord) => Promise<void>;
}

/** First newly-checked item's text: present as checked in next, unchecked in prev. */
export function newlyCheckedItem(oldText: string, newText: string): string | null {
	const checkedLines = (s: string) =>
		s
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.startsWith("- [x]"));
	const before = new Set(checkedLines(oldText));
	const fresh = checkedLines(newText).find((l) => !before.has(l));
	return fresh ? fresh.replace(/^- \[x\]\s*/, "").trim() : null;
}

/** Truncate an item summary for a one-line commit message. */
function summarize(item: string): string {
	const oneLine = item.replace(/\s+/g, " ").trim();
	return oneLine.length > 72 ? `${oneLine.slice(0, 69)}...` : oneLine;
}

export async function createCommitCadence(options: CommitCadenceOptions): Promise<CommitCadence> {
	const root = resolve(options.worktreeRoot);
	const implAbsolute = resolve(options.implPath);
	const planName = options.planName ?? basename(dirname(implAbsolute)) ?? "plan";

	let disabledReason: string | null = null;
	try {
		await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root });
	} catch {
		disabledReason =
			`Commit cadence DISABLED: ${root} is not a git worktree — the run proceeds without ` +
			"per-item commits or eval-queue records. Run inside a git repo for the full rail.";
	}

	const commits: CommitRecord[] = [];
	const failures: CommitFailure[] = [];

	const onGatedApply = async (
		name: GatedToolName,
		input: EditToolInput | WriteToolInput,
	): Promise<void> => {
		if (disabledReason) return;
		if (name !== "edit") return;
		const edit = input as EditToolInput;
		if (resolveInWorktree(root, edit.path) !== implAbsolute) return;
		const item = newlyCheckedItem(edit.old_string, edit.new_string);
		if (!item) return;

		const phase = options.getPhase();
		const message = `item(${planName} P${phase}): ${summarize(item)}`;
		try {
			await execFileAsync("git", ["add", "-A"], { cwd: root });
			await execFileAsync("git", ["commit", "-m", message], { cwd: root });
			const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
			const record: CommitRecord = { sha: stdout.trim(), item, phase };
			commits.push(record);
			await options.onCommit?.(record);
		} catch (error) {
			const err = error as { stderr?: string; message?: string };
			failures.push({
				phase,
				message: (err.stderr?.trim() || err.message || String(error)).trim(),
			});
		}
	};

	return { onGatedApply, disabledReason, commits, failures };
}
