/**
 * Copy of `src/lib/test-kinds.ts`'s TEST_KINDS for the hooks, which cannot
 * import TypeScript. Pinned equal by `test-kinds-parity.test.ts`; change both
 * together.
 *
 * Hook-local (`_`-prefixed): imported by hooks, never registered as one.
 */

export const TEST_KINDS = ["unit", "contract", "live check", "smoke", "promise"];

export function isTestKind(value) {
	return TEST_KINDS.includes(String(value).trim().toLowerCase());
}
