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
	/**
	 * Commits that LANDED but whose eval-queue append failed (A13). Distinct
	 * from `failures`: history exists, the rail record does not.
	 */
	queueFailures: CommitFailure[];
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

/**
 * EVERY item newly checked by an edit — checked in the replacement, unchecked
 * before it. Returning only the first (pre-falsification behavior) let a
 * batched checkoff commit several items' work while naming one, so the
 * history stopped accounting for the rest (A10).
 */
export function newlyCheckedItems(oldText: string, newText: string): string[] {
	const checkedLines = (s: string) =>
		s
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.startsWith("- [x]"));
	const before = new Set(checkedLines(oldText));
	return checkedLines(newText)
		.filter((l) => !before.has(l))
		.map((l) => l.replace(/^- \[x\]\s*/, "").trim());
}

/** Truncate an item summary for a one-line commit message. */
function summarize(item: string): string {
	const oneLine = item.replace(/\s+/g, " ").trim();
	return oneLine.length > 72 ? `${oneLine.slice(0, 69)}...` : oneLine;
}

/**
 * The commit message for a checkoff event. One item → its summary. Several
 * (a batched checkoff) → the subject counts them and the body lists every
 * one, so the commit accounts for all the work it actually contains.
 */
export function commitMessageFor(planName: string, phase: number, items: string[]): string {
	if (items.length === 1) {
		return `item(${planName} P${phase}): ${summarize(items[0])}`;
	}
	const body = items.map((item) => `- ${summarize(item)}`).join("\n");
	return `item(${planName} P${phase}): ${items.length} items checked off\n\n${body}`;
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
	const queueFailures: CommitFailure[] = [];
	/** Items from failed attempts, still uncommitted — named by the next commit. */
	const carriedItems: string[] = [];

	const onGatedApply = async (
		name: GatedToolName,
		input: EditToolInput | WriteToolInput,
	): Promise<void> => {
		if (disabledReason) return;
		if (name !== "edit") return;
		const edit = input as EditToolInput;
		if (resolveInWorktree(root, edit.path) !== implAbsolute) return;
		const items = newlyCheckedItems(edit.old_string, edit.new_string);
		if (items.length === 0) return;

		const phase = options.getPhase();
		// Items from earlier failed attempts are still uncommitted in the
		// working tree, so this commit will contain them — name them (A11).
		const attributed = [...carriedItems, ...items];
		const message = commitMessageFor(planName, phase, attributed);

		// The commit itself. A failure here is bookkeeping, never a gate — but
		// it MUST leave a clean index: `git add` already staged this item's
		// work, and leaving it staged would silently fold it into whatever
		// commit succeeds next, misattributing history (A11).
		let sha: string;
		try {
			// Stage the item's work product, but never the run's own eval
			// bookkeeping: `.indusk/eval/` (the pending queue + drained ledger)
			// is machine state written AFTER each commit, so including it would
			// both trail by one record and put run telemetry in plan history.
			await execFileAsync("git", ["add", "-A", "--", ".", ":(exclude).indusk/eval"], {
				cwd: root,
			});
			await execFileAsync("git", ["commit", "-m", message], { cwd: root });
			const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
			sha = stdout.trim();
		} catch (error) {
			const err = error as { stderr?: string; message?: string };
			failures.push({
				phase,
				message: (err.stderr?.trim() || err.message || String(error)).trim(),
			});
			// Unstage, so a later `git add` decides staging afresh rather than
			// inheriting this attempt's index state.
			await execFileAsync("git", ["reset"], { cwd: root }).catch(() => {
				// A reset that itself fails is visible in the next commit's diff;
				// never mask the original failure with this one.
			});
			// The work itself is still in the WORKING TREE — unstaging cannot
			// un-write it, and destroying it would be worse than mis-naming it.
			// So carry the attribution: whichever commit next succeeds names
			// these items too, and history accounts for everything it contains
			// (A11's real remedy — see the Phase 5 note on the refuted "unstage
			// is enough" hypothesis).
			carriedItems.push(...items);
			return;
		}

		// The commit LANDED. Queue-append failure past this point is its own
		// channel — reporting it as a commit failure would claim history that
		// exists does not (A13).
		const record: CommitRecord = { sha, item: attributed.join(" · "), phase };
		commits.push(record);
		carriedItems.length = 0; // attributed — nothing left riding along unnamed
		try {
			await options.onCommit?.(record);
		} catch (error) {
			const err = error as { message?: string };
			queueFailures.push({
				phase,
				message: `commit ${sha.slice(0, 8)} landed but its eval-queue append failed: ${
					err.message ?? String(error)
				}`,
			});
		}
	};

	return { onGatedApply, disabledReason, commits, failures, queueFailures };
}
