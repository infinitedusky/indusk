import { fencedLineMask, parsePhaseHeading } from "../impl-headings.js";

/**
 * The register: the subsections Test Phase 1 carries.
 *
 * `#### Deferred to Test Phase N` justifies the *existence* of a later test
 * phase. `#### Deferred to Build Phase N` justifies a single test authored
 * later than the test phase — usually because its subject is a symbol that
 * phase introduces, so authoring it earlier would produce a file that fails to
 * load rather than an assertion that fails. `#### Regression Guards` declares
 * rows that are green the moment they are written.
 */
const DEFERRED_TO_TEST_PHASE = /^####\s+Deferred to Test Phase\s+(\d+)\b/;
const REGRESSION_GUARDS_HEADING = /^####\s+Regression Guards\b/;
const REGISTER_ENTRY_ID = /^\s*-\s+\*\*([TA]\d+)\*\*/;

interface Register {
	/** Test-phase numbers with a `#### Deferred to Test Phase N` entry. */
	justifiedTestPhases: Set<number>;
	/** Row IDs declared under `#### Regression Guards`. */
	regressionGuards: Set<string>;
}

/**
 * Read Test Phase 1's register.
 *
 * Scanning stops at the next `###` phase heading: the register belongs to the
 * first test phase, and an entry written under some later phase is not a
 * justification recorded up front — which is the entire point of putting it
 * there. Fenced lines are skipped so a carried test body cannot masquerade as
 * a register entry.
 */
export function parseRegister(body: string): Register {
	const lines = body.split("\n");
	const fenced = fencedLineMask(lines);
	const justifiedTestPhases = new Set<number>();
	const regressionGuards = new Set<string>();

	let inTestPhaseOne = false;
	let inGuards = false;
	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) continue;
		const line = lines[i];

		const heading = parsePhaseHeading(line);
		if (heading) {
			inTestPhaseOne = heading.kind === "test" && heading.number === 1;
			inGuards = false;
			continue;
		}
		if (!inTestPhaseOne) continue;

		const deferred = DEFERRED_TO_TEST_PHASE.exec(line);
		if (deferred) {
			justifiedTestPhases.add(Number.parseInt(deferred[1], 10));
			inGuards = false;
			continue;
		}
		if (REGRESSION_GUARDS_HEADING.test(line)) {
			inGuards = true;
			continue;
		}
		if (/^####\s+/.test(line)) {
			inGuards = false;
			continue;
		}
		if (inGuards) {
			const entry = REGISTER_ENTRY_ID.exec(line);
			if (entry) regressionGuards.add(entry[1]);
		}
	}

	return { justifiedTestPhases, regressionGuards };
}
