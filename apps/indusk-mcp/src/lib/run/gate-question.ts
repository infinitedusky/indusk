/**
 * Ask-mode gate-question classification (dawn-hook-parity A6–A8).
 *
 * `check-gates` already refuses a proof-less gate skip under `gate_policy:
 * ask` — it demands conversation proof a headless run has no way to produce.
 * The loop's job is only to RECOGNIZE that refusal class and pause with the
 * question, instead of reporting it as a generic red stop.
 *
 * Deliberately loop-side: the shared hook is untouched, so the TS lib and its
 * JS hook ports do not need coordinated edits (the mirror-ports gotcha).
 * Classification keys off the refusal's own structured text — the policy
 * label the hook prints and the proof format it names.
 */

/** The refusal's policy tag: `Phase N blocked (policy: ask): …`. */
const ASK_POLICY_RE = /\bblocked\s*\(policy:\s*ask\)/i;

/** The proof format the hook prints when it refuses under ask. */
const PROOF_FORMAT_RE = /asked:\s*"[^"]*"\s*—\s*user:\s*"[^"]*"/;

/**
 * True when a gate refusal is "a human must answer a skip question", as
 * opposed to a genuine red (tests not green, items not done). Requires BOTH
 * the ask-policy tag and the proof-format hint — either alone is ambiguous.
 */
export function isGateQuestion(blockMessage: string | undefined): boolean {
	if (!blockMessage) return false;
	return ASK_POLICY_RE.test(blockMessage) && PROOF_FORMAT_RE.test(blockMessage);
}

/**
 * The gate items named in the refusal — the lines the hook lists as
 * `  [gate] text` before the skip hint.
 */
export function gateQuestionItems(blockMessage: string): string[] {
	return blockMessage
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line) => /^\s{2}\[[a-z]+\]\s/i.test(line))
		.map((line) => line.trim());
}

/** Human-facing pause text: what to answer, and how to record the answer. */
export function gateQuestionReason(phase: number, blockMessage: string): string {
	const items = gateQuestionItems(blockMessage);
	const list = items.length > 0 ? items.join("\n") : "(see the gate output below)";
	return [
		`Phase ${phase} needs a human decision: gate_policy is 'ask', and these gate items can only be skipped with conversation proof —`,
		list,
		"",
		"Either complete them, or record the conversation in the impl:",
		'  - [x] (none needed — asked: "your question" — user: "their answer")',
		"",
		"Then re-run: completed phases are skipped, so the run resumes where it paused.",
		"",
		blockMessage,
	].join("\n");
}
