/**
 * How long a draft has been untouched, and how the page words it: a draft
 * untouched for `AGED_AFTER_DAYS` is drawn warm, so the person sees it will
 * age out (`drafts.max_age_days`, swept by `indusk plans archive-dead`).
 */

/** A draft untouched this many days reads as aged on the page. */
export const AGED_AFTER_DAYS = 7;
export const DAY_MS = 86_400_000;

export const isAged = (updatedMs: number, now: Date): boolean =>
	now.getTime() - updatedMs >= AGED_AFTER_DAYS * DAY_MS;

/** How long a draft has been untouched, as the page words it. */
export function describeDraftAge(updatedMs: number, now: Date = new Date()): string {
	const minutes = Math.max(0, Math.floor((now.getTime() - updatedMs) / 60_000));
	if (minutes < 60) return `last talked ${minutes < 1 ? "just now" : `${minutes}m ago`}`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `last talked ${hours}h ago`;
	const days = Math.floor(hours / 24);
	return days < AGED_AFTER_DAYS
		? `last talked ${days}d ago`
		: `untouched ${days} day${days === 1 ? "" : "s"}`;
}
