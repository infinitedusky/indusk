/**
 * Copy of `src/lib/test-levels.ts`'s TEST_LEVELS for the hooks, which cannot
 * import TypeScript. Pinned equal by `test-levels-parity.test.ts`; change both
 * together.
 *
 * Hook-local (`_`-prefixed): imported by hooks, never registered as one.
 */

export const TEST_LEVELS = ["unit", "contract", "live check", "smoke", "promise"];

export function isTestLevel(value) {
	return TEST_LEVELS.includes(String(value).trim().toLowerCase());
}
