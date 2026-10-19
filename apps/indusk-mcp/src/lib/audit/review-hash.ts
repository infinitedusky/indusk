import { createHash } from "node:crypto";

/**
 * The hash a plan review records as `read:` (audit-concerns-are-answered, Build Phase 8):
 * what the four documents said when the reader read them. A review whose hash is not the
 * documents' hash now was written about other documents, and is read again. A missing
 * document hashes as empty, so adding one after the review also makes it out of date.
 *
 * promise: a-plan-is-read-cold-before-approval
 * clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold
 */
export function planReviewHash(texts: {
	brief: string | null;
	testPlan: string | null;
	adr: string | null;
	impl: string | null;
}): string {
	const hash = createHash("sha256");
	for (const text of [texts.brief, texts.testPlan, texts.adr, texts.impl]) {
		hash.update(text ?? "");
		hash.update("\0");
	}
	return hash.digest("hex");
}
