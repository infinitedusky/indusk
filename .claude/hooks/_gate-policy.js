/**
 * The gate policy a build sets for its sessions (admin-plan-authoring, ADR
 * D5), read the same way by `check-gates.js` and `validate-impl-structure.js`.
 *
 * `INDUSK_GATE_POLICY` is the per-invocation level the policy table already
 * ranks above the plan's `gate_policy` and the project's settings. A build
 * runs with nobody to ask, so it sets `auto` — and under it a gate item is
 * skipped only with its reason, because the review lists every skip for the
 * person to judge, and a bare `(none needed)` gives them nothing to judge.
 */

export const GATE_POLICY_ENV = "INDUSK_GATE_POLICY";

const POLICIES = ["strict", "ask", "auto"];

/** The policy the environment sets, or null when it sets none — a value that is not a policy is no policy. */
export function policyFromEnvironment(env = process.env) {
	const value = (env[GATE_POLICY_ENV] ?? "").trim();
	return POLICIES.includes(value) ? value : null;
}

/**
 * A skip that says why: `(none needed — <reason>)`, `(not applicable —
 * <reason>)`, or `skip-reason: <reason>`, the reason non-empty.
 */
export function skipCarriesReason(text) {
	return (
		/\((?:none needed|not applicable)\s*—\s*\S[^)]*\)/.test(text) || /skip-reason:\s*\S/.test(text)
	);
}
