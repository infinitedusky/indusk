import {
	ANY_PHASE_HEADING,
	fencedLineMask,
	gateHeading,
	type PhaseKind,
	type PhaseRef,
	parsePhaseHeading,
	phaseOrdinal,
	phaseSequence,
} from "../impl-headings.js";
import { parseTrajectory, type Trajectory } from "./parser.js";

export interface ValidationError {
	rule:
		| "trajectory-presence"
		| "cross-reference-integrity"
		| "temporal-coherence"
		| "deferred-completeness"
		| "rationale-completeness"
		| "test-phase-presence"
		| "test-phase-justification"
		| "regression-guard-declaration";
	message: string;
	/** The rough line number in the impl body, if known. */
	line?: number;
}

export interface ValidateTrajectoryOptions {
	/**
	 * When true, also enforce `### Trajectory Rationale` completeness — every
	 * trajectory T-ID must appear as a `- **TN**` entry in the subsection,
	 * and the subsection must not contain entries for IDs missing from the
	 * trajectory table. Mirrors the JS hook's `rationale: required` frontmatter
	 * check at apps/indusk-mcp/hooks/validate-impl-structure.js.
	 */
	rationaleRequired?: boolean;
	/**
	 * The phase number that counts as "writable today against the current stack."
	 * Trajectory rows whose `Writable at` is ≤ baseline are exempt from the
	 * rationale-completeness rule. Defaults to 0 (the original behavior:
	 * Phase 0 rows are exempt). Plans where Phase 1 IS the enabling work
	 * (refactors, schema migrations, scaffolding) set this to 1 so rows
	 * authored at Phase 1 don't require justification entries.
	 */
	rationaleBaseline?: number;
	/**
	 * When true, the impl must open with a test phase. Set from `test_phases:
	 * required` in the frontmatter. Absent means exempt — which is how every
	 * impl written before test phases existed keeps validating without being
	 * edited.
	 */
	testPhasesRequired?: boolean;
}

const TRAJECTORY_HEADING = /^##\s+Test Trajectory\b/;
const VERIFICATION_HEADING = gateHeading("Verification");
const NEXT_GATE_HEADING = gateHeading("(OTel|Context|Document|Forward Intelligence)");
const CHECKLIST_ITEM = /^-\s+\[[ xX]\]\s+(.*)/;
// Accept T-prefixed (test) and A-prefixed (acceptance) IDs. Bounded to [TA]
// deliberately — broadening to [A-Z] would false-match H-prefixed hypothesis
// refs and P-prefixed phase refs in Verification prose.
const TEST_ID_PATTERN = /\b[TA]\d+\b/g;

const ALLOWED_NO_TESTS_REASONS: ReadonlySet<string> = new Set([
	"schema-only",
	"delete",
	"refactor",
	"infra",
]);

// Match both em-dash and hyphen with flexible whitespace around the separator
const NO_TESTS_DECLARATION = /\(no tests flip at this phase\s*[—–-]+\s*reason:\s*([a-z-]+)\s*\)/i;

/**
 * Rule 1: Every impl document must have a `## Test Trajectory` section.
 */
export function validateTrajectoryPresence(body: string): ValidationError[] {
	const lines = body.split("\n");
	const hasTrajectory = lines.some((line) => TRAJECTORY_HEADING.test(line));
	if (hasTrajectory) return [];
	return [
		{
			rule: "trajectory-presence",
			message:
				"Impl is missing the `## Test Trajectory` section. Every impl must declare its tests at the top as a table with columns: ID | Asserts | Writable at | Passes at | State. See `.indusk/planning/tests-first-planning/adr.md` Section 3.",
		},
	];
}

interface PhaseVerification {
	phase: number;
	items: { text: string; line: number }[];
	headingLine: number;
}

/**
 * Extract each phase's Verification block as a list of checklist items.
 */
function extractPhaseVerifications(body: string): PhaseVerification[] {
	const lines = body.split("\n");
	const result: PhaseVerification[] = [];
	let currentPhase: number | null = null;
	let currentVerification: PhaseVerification | null = null;
	let inVerification = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Any kind: a test phase ends the previous phase's Verification block
		// just as surely as another build phase does.
		const phaseMatch = line.match(ANY_PHASE_HEADING);
		if (phaseMatch) {
			if (currentVerification) result.push(currentVerification);
			currentPhase = Number.parseInt(phaseMatch[1], 10);
			currentVerification = null;
			inVerification = false;
			continue;
		}

		const verMatch = line.match(VERIFICATION_HEADING);
		if (verMatch && currentPhase !== null) {
			if (currentVerification) result.push(currentVerification);
			currentVerification = {
				phase: currentPhase,
				items: [],
				headingLine: i + 1,
			};
			inVerification = true;
			continue;
		}

		if (inVerification && NEXT_GATE_HEADING.test(line)) {
			if (currentVerification) result.push(currentVerification);
			currentVerification = null;
			inVerification = false;
			continue;
		}

		if (inVerification && currentVerification) {
			const itemMatch = line.match(CHECKLIST_ITEM);
			if (itemMatch) {
				currentVerification.items.push({ text: itemMatch[1].trim(), line: i + 1 });
			}
		}
	}

	if (currentVerification) result.push(currentVerification);
	return result;
}

/**
 * Rule 2: Every test ID referenced in a phase Verification block must exist
 * in the Trajectory table. Phases with no test-ID references must declare
 * `(no tests flip at this phase — reason: {allowed-reason})`.
 */
export function validateCrossReferenceIntegrity(
	body: string,
	trajectory: Trajectory,
): ValidationError[] {
	const errors: ValidationError[] = [];
	const knownIds = new Set(trajectory.rows.map((row) => row.id));
	const verifications = extractPhaseVerifications(body);

	for (const ver of verifications) {
		let foundTestReference = false;
		let foundNoTestsDeclaration = false;

		for (const item of ver.items) {
			const noTestsMatch = item.text.match(NO_TESTS_DECLARATION);
			if (noTestsMatch) {
				foundNoTestsDeclaration = true;
				const reason = noTestsMatch[1].toLowerCase();
				if (!ALLOWED_NO_TESTS_REASONS.has(reason)) {
					errors.push({
						rule: "cross-reference-integrity",
						line: item.line,
						message: `Phase ${ver.phase} Verification: "(no tests flip at this phase — reason: ${reason})" uses disallowed reason. Allowed: ${[...ALLOWED_NO_TESTS_REASONS].join(", ")}.`,
					});
				}
				continue;
			}

			const idMatches = item.text.match(TEST_ID_PATTERN);
			if (idMatches) {
				foundTestReference = true;
				for (const id of idMatches) {
					if (!knownIds.has(id)) {
						errors.push({
							rule: "cross-reference-integrity",
							line: item.line,
							message: `Phase ${ver.phase} Verification references test ID \`${id}\` but no such row exists in the Test Trajectory table.`,
						});
					}
				}
			}
		}

		if (!foundTestReference && !foundNoTestsDeclaration && ver.items.length > 0) {
			errors.push({
				rule: "cross-reference-integrity",
				line: ver.headingLine,
				message: `Phase ${ver.phase} Verification has no test ID references and no "(no tests flip at this phase — reason: {schema-only|delete|refactor|infra})" declaration. Every phase's Verification must either flip named tests from the trajectory or explicitly declare no tests flip with an allowed reason.`,
			});
		}
	}

	return errors;
}

/**
 * Rule 3: For every Trajectory row, the phase number in `Writable at` must
 * be ≤ the phase number in `Passes at`. A test cannot pass before its
 * dependencies exist. Also catches NaN from malformed `Phase N` references.
 */
export function validateTemporalCoherence(
	trajectory: Trajectory,
	sequence: readonly PhaseRef[] = [],
): ValidationError[] {
	const errors: ValidationError[] = [];
	const label = (n: number, kind: PhaseKind) => `${kind === "test" ? "Test " : ""}Phase ${n}`;
	for (const row of trajectory.rows) {
		if (!Number.isFinite(row.writableAt)) {
			errors.push({
				rule: "temporal-coherence",
				message: `Trajectory row \`${row.id}\` has invalid "Writable at" — expected "Phase N" where N is a number.`,
			});
			continue;
		}
		if (!Number.isFinite(row.passesAt)) {
			errors.push({
				rule: "temporal-coherence",
				message: `Trajectory row \`${row.id}\` has invalid "Passes at" — expected "Phase N" where N is a number.`,
			});
			continue;
		}
		// Ordered on the document's timeline rather than by number: with two
		// sequences numbering independently, Test Phase 1 and Build Phase 1 are
		// different phases wearing the same digit. `phaseOrdinal` reduces to the
		// number when the document has no test phase, so every existing impl
		// compares exactly as it did before.
		const writable = phaseOrdinal({ kind: row.writableAtKind, number: row.writableAt }, sequence);
		const passes = phaseOrdinal({ kind: row.passesAtKind, number: row.passesAt }, sequence);
		if (writable > passes) {
			errors.push({
				rule: "temporal-coherence",
				message: `Trajectory row \`${row.id}\` has "Writable at" ${label(row.writableAt, row.writableAtKind)} after "Passes at" ${label(row.passesAt, row.passesAtKind)}. A test cannot pass before its dependencies exist. If phases were reordered, update the trajectory to reflect the new dependency order.`,
			});
		}
	}
	return errors;
}

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

/**
 * A new impl must open with a test phase.
 *
 * Gated on `test_phases: required` in the frontmatter, the same way
 * `trajectory: required` rolled out across 52 files without migrating one of
 * them. The alternative — exempting `archive/` by path — would make the rule a
 * property of where a file lives rather than of what it claims about itself.
 */
export function validateTestPhasePresence(
	_body: string,
	sequence: readonly PhaseRef[],
	required: boolean,
): ValidationError[] {
	if (!required) return [];
	if (sequence.some((p) => p.kind === "test")) return [];
	return [
		{
			rule: "test-phase-presence",
			message:
				"`test_phases: required` is set but this impl has no test phase. Add `### Test Phase 1` as the first phase — it authors every test that can honestly be authored and records, in its register, every test that cannot. Naming the omission matters more than naming the rule: without it, the discipline the whole document is built around is the only one with nowhere to happen.",
		},
	];
}

/**
 * Every test phase after the first must be justified in the first.
 *
 * Structural rather than prose-inspected: the rule looks for a heading, so it
 * can say which phase is unjustified instead of asking a human to decide
 * whether some paragraph counts.
 */
export function validateTestPhaseJustification(
	body: string,
	sequence: readonly PhaseRef[],
): ValidationError[] {
	const later = sequence.filter((p) => p.kind === "test" && p.number > 1);
	if (later.length === 0) return [];

	const { justifiedTestPhases } = parseRegister(body);
	return later
		.filter((p) => !justifiedTestPhases.has(p.number))
		.map((p) => ({
			rule: "test-phase-justification" as const,
			message: `Test Phase ${p.number} exists but Test Phase 1 does not justify it. Add a \`#### Deferred to Test Phase ${p.number}\` entry there saying why those tests cannot be authored up front — a later test phase is a deviation from "author everything first", and the register is where every deviation is recorded.`,
		}));
}

/**
 * A row that passes the moment it is authored must say so.
 *
 * Green on arrival means the row has no red window: the test phase that
 * authors it is the phase it passes at. That is legitimate — a regression
 * guard, or an assertion about the runner rather than about our code — and it
 * is also exactly what a rubber stamp looks like. Nothing can tell the two
 * apart mechanically, so the rule makes the author say which.
 *
 * Scoped to rows whose *both* ends name a test phase. A build-phase row where
 * `Writable at` equals `Passes at` is the ordinary unit-test-for-new-code case
 * and stays untouched, which is why no existing impl is affected.
 */
export function validateRegressionGuards(body: string, trajectory: Trajectory): ValidationError[] {
	const greenOnArrival = trajectory.rows.filter(
		(r) =>
			r.writableAtKind === "test" &&
			r.passesAtKind === "test" &&
			Number.isFinite(r.writableAt) &&
			r.writableAt === r.passesAt,
	);
	if (greenOnArrival.length === 0) return [];

	const { regressionGuards } = parseRegister(body);
	return greenOnArrival
		.filter((r) => !regressionGuards.has(r.id))
		.map((r) => ({
			rule: "regression-guard-declaration" as const,
			message: `Trajectory row \`${r.id}\` passes in the same test phase that authors it, so it has no red phase. That is allowed, but it must be declared: add a \`- **${r.id}** — {why}\` entry under \`#### Regression Guards\` in Test Phase 1. A row green on arrival is either a regression guard or a rubber stamp, and only the author knows which.`,
		}));
}

/**
 * Rule 4: Every Deferred Verification row must have non-empty `reason:`,
 * `would require:`, and `mitigation:` fields. The mitigation field is the
 * compensating control — without it, deferring a test means flying blind.
 */
export function validateDeferredCompleteness(trajectory: Trajectory): ValidationError[] {
	const errors: ValidationError[] = [];
	for (const row of trajectory.deferred) {
		const missing: string[] = [];
		if (!row.reason) missing.push("reason");
		if (!row.wouldRequire) missing.push("would require");
		if (!row.mitigation) missing.push("mitigation");
		if (missing.length > 0) {
			errors.push({
				rule: "deferred-completeness",
				message: `Deferred Verification row "${row.name}" is missing: ${missing.join(", ")}. Every deferred row requires all three fields — reason (why not testable here), would require (what would unlock a proper test), and mitigation (compensating control that keeps us from flying blind).`,
			});
		}
	}
	return errors;
}

/**
 * Rule 5: When the impl frontmatter sets `rationale: required`, every
 * trajectory row whose `Writable at` is later than the configured baseline
 * (default Phase 0) must have an entry in the `### Trajectory Rationale`
 * subsection.
 *
 * The baseline names the phase that counts as "writable today against the
 * current stack" for this plan. Default 0 — Phase 0 rows are exempt because
 * they're writable before any plan code lands. Plans where Phase 1 IS the
 * enabling work (refactors, schema migrations, scaffolding) can declare
 * `rationale_baseline: 1` in frontmatter so Phase 1 rows are exempt too.
 *
 * If no row needs a rationale (every row is ≤ baseline), the subsection
 * itself is optional. If any row is later than baseline, the subsection
 * must exist and contain an entry for every such row. Stale entries
 * (entries for IDs not in the trajectory) are always flagged.
 *
 * Mirrors `validateRationaleCompleteness` in
 * `.claude/hooks/validate-impl-structure.js`.
 */
export function validateRationaleCompleteness(
	body: string,
	trajectory: Trajectory,
	options: { baseline?: number } = {},
): ValidationError[] {
	const errors: ValidationError[] = [];
	const baseline = Number.isFinite(options.baseline) ? Number(options.baseline) : 0;

	const rowsNeedingRationale = trajectory.rows.filter(
		(r) => Number.isFinite(r.writableAt) && r.writableAt > baseline,
	);
	const hasSubsection = /^###\s+Trajectory Rationale\b/m.test(body);
	const rationaleIds = hasSubsection ? parseRationaleBlock(body) : new Set<string>();

	if (rowsNeedingRationale.length > 0 && !hasSubsection) {
		errors.push({
			rule: "rationale-completeness",
			message: `\`rationale: required\` is set and ${rowsNeedingRationale.length} trajectory row(s) have \`Writable at\` later than Phase ${baseline}, but the impl is missing the \`### Trajectory Rationale\` subsection. Rows at or below the baseline don't need rationale; rows where authoring waits on later plan code do — add an entry for ${rowsNeedingRationale.map((r) => r.id).join(", ")}.`,
		});
		// Even without the subsection, fall through to also check for stale entries
		// (there are none in this case, but the structure is symmetric).
	}

	const missing: string[] = [];
	for (const row of rowsNeedingRationale) {
		if (!rationaleIds.has(row.id)) missing.push(row.id);
	}

	if (missing.length > 0 && hasSubsection) {
		errors.push({
			rule: "rationale-completeness",
			message: `Trajectory rows with \`Writable at\` later than Phase ${baseline} missing from \`### Trajectory Rationale\`: ${missing.join(", ")}. Every row whose authoring waits on later plan code needs a \`- **TN** \`Writable at: Phase N\` — {reason}\` entry. Rows at or below the baseline (Phase ${baseline}) do not need rationale.`,
		});
	}

	const knownIds = new Set(trajectory.rows.map((r) => r.id));
	const extra = [...rationaleIds].filter((id) => !knownIds.has(id));
	if (extra.length > 0) {
		errors.push({
			rule: "rationale-completeness",
			message: `\`### Trajectory Rationale\` contains entries for IDs not present in the trajectory table: ${extra.join(", ")}. Remove the stale entries or add the missing trajectory rows.`,
		});
	}

	return errors;
}

/**
 * Parse the `### Trajectory Rationale` subsection and return the set of
 * T-IDs that appear as `- **TN**` entries. Stops at the next heading of
 * depth 1-3.
 */
function parseRationaleBlock(body: string): Set<string> {
	const lines = body.split("\n");
	const ids = new Set<string>();
	let inRationale = false;

	for (const line of lines) {
		if (/^###\s+Trajectory Rationale\b/.test(line)) {
			inRationale = true;
			continue;
		}
		if (!inRationale) continue;
		if (/^#{1,3}\s+/.test(line) && !/^###\s+Trajectory Rationale\b/.test(line)) break;
		const match = line.match(/^-\s+\*\*([TA]\d+)\*\*/);
		if (match) ids.add(match[1]);
	}

	return ids;
}

/**
 * Run all trajectory validation rules against an impl body. The body is the
 * markdown content after the frontmatter — pass the output of `gray-matter`
 * or equivalent. Returns combined errors; empty array means the trajectory
 * is valid. Pass `{ rationaleRequired: true }` to additionally enforce
 * `### Trajectory Rationale` completeness (mirrors the JS hook's check on
 * `rationale: required` in frontmatter).
 */
export function validateTrajectory(
	body: string,
	options: ValidateTrajectoryOptions = {},
): ValidationError[] {
	const presenceErrors = validateTrajectoryPresence(body);
	if (presenceErrors.length > 0) return presenceErrors;

	const trajectory = parseTrajectory(body);
	const sequence = phaseSequence(body);
	const hasTestPhase = sequence.some((p) => p.kind === "test");
	const errors: ValidationError[] = [
		...validateCrossReferenceIntegrity(body, trajectory),
		...validateTemporalCoherence(trajectory, sequence),
		...validateDeferredCompleteness(trajectory),
		...validateTestPhasePresence(body, sequence, options.testPhasesRequired ?? false),
		...validateTestPhaseJustification(body, sequence),
		...validateRegressionGuards(body, trajectory),
	];
	// The register absorbs `### Trajectory Rationale`: when a test phase exists,
	// deferral justification lives in Test Phase 1 and requiring the legacy
	// section too would create two homes for one fact — the failure this
	// codebase has three lessons about. Impls without a test phase are
	// unaffected, which is every impl written before this rule existed.
	if (options.rationaleRequired && !hasTestPhase) {
		errors.push(
			...validateRationaleCompleteness(body, trajectory, {
				baseline: options.rationaleBaseline,
			}),
		);
	}
	return errors;
}
