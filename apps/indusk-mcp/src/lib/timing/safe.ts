/**
 * The one wrapper every timing recorder is called through. A record that
 * cannot be written warns once and resolves; it never rejects, so the work it
 * records carries on (plan-timing ADR, a-record-never-blocks).
 *
 * promise: a-plan-says-how-long-it-took
 */
export async function recordSafely(
	fn: () => Promise<void>,
	warn: (message: string) => void = (m) => console.warn(m),
): Promise<void> {
	try {
		await fn();
	} catch (err) {
		warn(`timing: could not record — ${err instanceof Error ? err.message : String(err)}`);
	}
}
