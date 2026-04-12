import { parseTrajectory, type Trajectory } from "./parser.js";

export interface ValidationError {
	rule:
		| "trajectory-presence"
		| "cross-reference-integrity"
		| "temporal-coherence"
		| "deferred-completeness";
	message: string;
	/** The rough line number in the impl body, if known. */
	line?: number;
}

const TRAJECTORY_HEADING = /^##\s+Test Trajectory\b/;
const PHASE_HEADING = /^###\s+Phase\s+(\d+)\b/;
const VERIFICATION_HEADING = /^####\s+Phase\s+(\d+)\s+Verification\b/;
const NEXT_GATE_HEADING = /^####\s+Phase\s+\d+\s+(OTel|Context|Document|Forward Intelligence)\b/;
const CHECKLIST_ITEM = /^-\s+\[[ xX]\]\s+(.*)/;
const TEST_ID_PATTERN = /\bT\d+\b/g;

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

		const phaseMatch = line.match(PHASE_HEADING);
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
export function validateTemporalCoherence(trajectory: Trajectory): ValidationError[] {
	const errors: ValidationError[] = [];
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
		if (row.writableAt > row.passesAt) {
			errors.push({
				rule: "temporal-coherence",
				message: `Trajectory row \`${row.id}\` has "Writable at" Phase ${row.writableAt} > "Passes at" Phase ${row.passesAt}. A test cannot pass before its dependencies exist. If phases were reordered, update the trajectory to reflect the new dependency order.`,
			});
		}
	}
	return errors;
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
 * Run all four trajectory validation rules against an impl body. The body
 * is the markdown content after the frontmatter — pass the output of
 * `gray-matter` or equivalent. Returns combined errors; empty array means
 * the trajectory is valid.
 */
export function validateTrajectory(body: string): ValidationError[] {
	const presenceErrors = validateTrajectoryPresence(body);
	if (presenceErrors.length > 0) return presenceErrors;

	const trajectory = parseTrajectory(body);
	return [
		...validateCrossReferenceIntegrity(body, trajectory),
		...validateTemporalCoherence(trajectory),
		...validateDeferredCompleteness(trajectory),
	];
}
