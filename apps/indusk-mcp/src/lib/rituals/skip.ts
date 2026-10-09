export interface SkipCheck {
	skipped: boolean;
	reason: string | null;
}

export function isRitualSkipped(
	_implContent: string,
	_ritual: "falsification" | "cleanup" | "audit",
): SkipCheck {
	return { skipped: false, reason: null };
}
