/** Stub: Build Phase 3 writes this (a-run-can-be-trusted A80). */
export type ArchiveResult = { ok: true; to: string } | { ok: false; reason: string };

export interface ArchiveDeps {
	git?: (cwd: string, args: string[]) => { ok: true } | { ok: false; error: string };
	declaredPromises?: (root: string, plan: string) => string[];
}

export function archivePlan(_root: string, _plan: string, _deps: ArchiveDeps = {}): ArchiveResult {
	return { ok: false, reason: "not written yet" };
}
