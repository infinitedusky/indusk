/**
 * An incident's age, in words (incident-recording): `indusk promises status`
 * and the admin's incidents table both say it, so it is said one way. No
 * filesystem import: the admin's table renders in browser tests, where
 * `node:fs` is not there.
 *
 * promise: one-definition-per-shared-rule
 */
export function formatAge(ms: number | null): string {
	if (ms === null || Number.isNaN(ms)) return "an unknown time";
	const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
	const days = Math.floor(ms / 86_400_000);
	if (days >= 1) return plural(days, "day");
	const hours = Math.floor(ms / 3_600_000);
	if (hours >= 1) return plural(hours, "hour");
	return plural(Math.max(0, Math.floor(ms / 60_000)), "minute");
}
