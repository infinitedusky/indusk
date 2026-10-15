#!/usr/bin/env node
// promise: gates-ran-at-every-checkoff
/**
 * PreToolUse hook: blocks phase transitions in impl.md when gates are incomplete.
 *
 * The OTel gate is conditional on the project's `otel.role` in .indusk/config.json:
 *   - unset or "service": OTel gate is enforced (default)
 *   - "library" / "tool" / "none": OTel gate is silenced (mirrors validate-impl-structure)
 *
 * Exit 0 = allow the edit
 * Exit 2 = block the edit (stderr sent to agent as feedback)
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { policyFromEnvironment, skipCarriesReason } from "./_gate-policy.js";
import { resolveStateAndGitPaths } from "./_hook-paths.js";
import { phaseExists, phaseOrdinal, phaseSequence } from "./_impl-headings.js";
import { parseImplPhases as parsePhases } from "./_impl-phases.js";
import { parseTrajectoryFromBody, stripFrontmatter } from "./_trajectory-parser.js";

// Read hook input from stdin
let input = "";
for await (const chunk of process.stdin) {
	input += chunk;
}

const event = JSON.parse(input);
const toolInput = event.tool_input ?? {};

// Determine file path based on tool type
const filePath = toolInput.file_path ?? "";

// Fast path: not an impl.md file
if (!filePath.endsWith("/impl.md") && !filePath.endsWith("\\impl.md")) {
	process.exit(0);
}

/** The items `newPhases` has checked that `oldPhases` had not, by position. */
function newlyCheckedIn(oldPhases, newPhases) {
	const found = [];
	for (let pi = 0; pi < newPhases.length; pi++) {
		const newPhase = newPhases[pi];
		const oldPhase = oldPhases[pi];
		if (!oldPhase) continue;

		for (let ii = 0; ii < newPhase.items.length; ii++) {
			const newItem = newPhase.items[ii];
			const oldItem = oldPhase.items[ii];
			if (!oldItem) continue;

			if (newItem.checked && !oldItem.checked) {
				found.push({
					phase: newPhase.number,
					phaseKind: newPhase.kind,
					ordinal: newPhase.ordinal,
					phaseName: newPhase.name,
					text: newItem.text,
					gate: newItem.gate,
				});
			}
		}
	}
	return found;
}

/** A build item: one the amendment gate holds (a test phase's authoring waits for nobody). */
const isBuildItem = (item) => item.phaseKind !== "test";

// Check for skip-gates escape hatch
const newContent = toolInput.new_string ?? toolInput.content ?? "";

// Read gate policy: the environment a build sets, then the impl file, then settings
const policyFromBuild = policyFromEnvironment();
function readGatePolicy() {
	if (policyFromBuild) return policyFromBuild;
	try {
		const content = readFileSync(filePath, "utf-8");
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
		if (fmMatch) {
			const policyMatch = fmMatch[1].match(/gate_policy:\s*(strict|ask|auto)/);
			if (policyMatch) return policyMatch[1];
		}
	} catch {
		// ignore
	}
	// Check project settings
	try {
		const settingsPath = `${event.cwd}/.claude/settings.json`;
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		if (settings.indusk?.gate_policy) return settings.indusk.gate_policy;
	} catch {
		// ignore
	}
	return "ask"; // default
}

const gatePolicy = readGatePolicy();

// promise: a-change-to-what-was-agreed-needs-the-person
// The amendment gate is the person's, so nothing in the impl switches it off
// (brief-as-the-contract ADR decision 5; audit finding 3). Two ways round it
// are shut here, before the skip marker is read:
//   - an edit that removes or changes `approved_brief:` on an approved plan —
//     the gate runs only while the impl records it, so deleting the field would
//     end it for every later checkoff. The field changes through `indusk plans
//     reapprove`, a CLI write that passes no hook, never through an edit;
//   - a `<!-- skip-gates -->` marker on an edit that checks a build item off
//     while an amendment waits.
const oldContent = toolInput.old_string ?? "";
const approvedBriefOf = (text) =>
	/^---\r?\n([\s\S]*?)\r?\n---/
		.exec(text)?.[1]
		?.match(/^approved_brief:[ \t]*["']?([0-9a-f]{64})/m)?.[1];
let onDisk = null;
try {
	onDisk = readFileSync(filePath, "utf-8");
} catch {
	// a new file records no approval yet
}
const recordedBrief = onDisk === null ? undefined : approvedBriefOf(onDisk);
if (recordedBrief) {
	const after = applyEdit(onDisk);
	if (after !== null && approvedBriefOf(after) !== recordedBrief) {
		process.stderr.write(
			`This edit ${approvedBriefOf(after) ? "changes" : "removes"} \`approved_brief:\` on an approved plan. That field records the brief a person approved, and the amendment gate reads it, so it changes only when a person approves an amendment: \`indusk plans reapprove <plan>\` (or Approve on the plan's page).\nlesson: a-plan-builds-only-after-approval\n`,
		);
		process.exit(2);
	}
}

// In strict mode, skip-gates escape hatch is not allowed
if (newContent.includes("<!-- skip-gates -->") && gatePolicy !== "strict") {
	const after = recordedBrief ? applyEdit(onDisk) : null;
	if (after !== null && newlyCheckedIn(parsePhases(onDisk), parsePhases(after)).some(isBuildItem)) {
		const refusal = amendmentRefusal(filePath);
		if (refusal) {
			process.stderr.write(refusal);
			process.exit(2);
		}
	}
	process.exit(0);
}

// Detect checkbox transition: - [ ] → - [x]

// promise: a-plan-builds-only-after-approval
// A plan leaves `draft` only through `indusk plans approve`, which writes the
// file itself with no tool event (small-fixes A4). A planning session once set
// its plan `in-progress` by hand and started building, so approve's brief and
// promise checks never ran. Any tool edit that moves `status:` off `draft`
// (to anything but `abandoned`) is that hand edit, whoever makes it.
//
// Judged on the whole file before and after, never on the edit's own strings
// (small-fixes A19): an `old_string` of `draft\ntrajectory: …` moves the
// status without carrying the `status:` key. The value is the frontmatter's,
// unquoted — `status: "draft"` is a draft.
const statusOf = (text) => {
	const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
	return fm ? /^status:[ \t]*["']?([^"'\s#]+)/m.exec(fm[1])?.[1] : undefined;
};
let fromStatus;
let toStatus;
let diskContent = null;
try {
	diskContent = readFileSync(filePath, "utf-8");
} catch {
	// a new file has no status to leave
}
/**
 * The file as this tool call would leave it, or null when it cannot be told
 * (an Edit whose `old_string` is not in the file). The Edit tool's literal
 * splice, `replace_all` included — never `String.replace`, whose `$`
 * patterns substitute (hooks/CLAUDE.md).
 */
function applyEdit(disk) {
	if (event.tool_name === "Write") return newContent;
	if (event.tool_name !== "Edit" || !oldContent) return null;
	const at = disk.indexOf(oldContent);
	if (at === -1) return null;
	return toolInput.replace_all
		? disk.split(oldContent).join(newContent)
		: disk.slice(0, at) + newContent + disk.slice(at + oldContent.length);
}

if (diskContent !== null) {
	fromStatus = statusOf(diskContent);
	const after = applyEdit(diskContent);
	if (after !== null) toStatus = statusOf(after);
}
if (fromStatus === "draft" && toStatus && toStatus !== "draft" && toStatus !== "abandoned") {
	console.error(
		`A plan leaves draft only through \`indusk plans approve\`, which runs the brief and promise checks first; this edit sets status: ${toStatus} by hand. Run the approve command instead.\nlesson: a-plan-builds-only-after-approval`,
	);
	process.exit(2);
}

// For Edit tool: check if old_string has unchecked and new_string has checked
// For Write tool: we need to compare with the file on disk
let hasCheckboxTransition = false;

// promise: hidden-detail-is-only-read
// A box is counted only from a column-zero line: an indented box sits in a
// task's folded detail, which neither impl reader ever took as an item, so a
// ticked one there is not a checkoff (story-first-phases A9).
const CHECKED_BOX = /^-\s+\[x\]/gm;
const UNCHECKED_BOX = /^-\s+\[ \]/gm;
const countOf = (text, re) => (text.match(re) || []).length;

if (event.tool_name === "Edit" && oldContent && newContent) {
	// Counted over the whole file before and after the edit, never over the
	// edit's own strings: a fragment that begins at a folded box's dash has lost
	// the indent that says the box is detail (story-first-phases A24). Only an
	// edit that cannot be applied falls back to its strings.
	const wholeAfter = onDisk === null ? null : applyEdit(onDisk);
	const [before, after] = wholeAfter === null ? [oldContent, newContent] : [onDisk, wholeAfter];
	const oldUnchecked = countOf(before, UNCHECKED_BOX);
	const newUnchecked = countOf(after, UNCHECKED_BOX);
	const oldChecked = countOf(before, CHECKED_BOX);
	const newChecked = countOf(after, CHECKED_BOX);
	hasCheckboxTransition = newChecked > oldChecked || newUnchecked < oldUnchecked;
} else if (event.tool_name === "Write") {
	// For Write, compare with file on disk
	try {
		const diskContent = readFileSync(filePath, "utf-8");
		const diskChecked = countOf(diskContent, CHECKED_BOX);
		const writeChecked = countOf(newContent, CHECKED_BOX);
		hasCheckboxTransition = writeChecked > diskChecked;
	} catch {
		// File doesn't exist yet — new impl, allow
		process.exit(0);
	}
}

if (!hasCheckboxTransition) {
	process.exit(0);
}

// Parse the impl file to understand phase structure
// Read the full file to get current state, then apply the edit mentally
let fullContent;
try {
	fullContent = readFileSync(filePath, "utf-8");
} catch {
	process.exit(0);
}

// No item is checked off on a plan that is not approved (small-fixes A5):
// building is `/work`'s, after `plans approve`; a draft's checklist is the
// plan, not progress.
if (statusOf(fullContent) === "draft") {
	console.error(
		"This plan is still a draft: nothing is checked off before `indusk plans approve` has run its brief and promise checks; building is /work's, after approval.\nlesson: a-plan-builds-only-after-approval",
	);
	process.exit(2);
}

// The new full content, the way the tool will write it
const newFullContent = applyEdit(fullContent);
if (newFullContent === null) process.exit(0);

// Detect workflow type from content frontmatter
function detectWorkflow(content) {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
	const fm = fmMatch ? fmMatch[1] : "";
	const m = fm.match(/workflow:\s*(bugfix|refactor|feature|spike)/);
	return m ? m[1] : "feature";
}

/**
 * Whether the OTel gate should fire for this project. Reads .indusk/config.json
 * and checks otel.role. Returns true if missing/unset/"service", false for
 * library/tool/none. Mirrors shouldEmitOtelGate() in apps/indusk-mcp/src/lib/config.ts.
 */
function shouldEmitOtelGate(statePath) {
	const configPath = `${statePath}/.indusk/config.json`;
	if (!existsSync(configPath)) return true;
	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		const role = config?.otel?.role;
		return role === undefined || role === "service";
	} catch {
		return true;
	}
}

// Workbench-aware state resolution (1.31.7). statePath is where .indusk/ lives.
const { statePath: resolvedStatePath } = resolveStateAndGitPaths(event.cwd ?? process.cwd());
const statePath = resolvedStatePath ?? event.cwd ?? process.cwd();
const otelGateEnabled = shouldEmitOtelGate(statePath);

// Which gate types are required per workflow.
// OTel is filtered out below when the project opts out via otel.role.
const WORKFLOW_GATES_BASE = {
	feature: ["verification", "otel", "context", "document"],
	refactor: ["verification", "otel", "context", "document"],
	bugfix: ["verification", "document"],
	spike: [],
};

const WORKFLOW_GATES = Object.fromEntries(
	Object.entries(WORKFLOW_GATES_BASE).map(([wf, gates]) => [
		wf,
		otelGateEnabled ? gates : gates.filter((g) => g !== "otel"),
	]),
);

// The phase/item walk is shared with gate-reminder.js — one definition, pinned by A24.

/** Name a phase unambiguously: the two sequences share their digits. */
function phaseLabel(kind, number) {
	return `${kind === "test" ? "Test " : ""}Phase ${number}`;
}

const workflow = detectWorkflow(fullContent);
const requiredGates = WORKFLOW_GATES[workflow] || WORKFLOW_GATES.feature;
const oldPhases = parsePhases(fullContent);
const newPhases = parsePhases(newFullContent);

// ------------------------------------------------------------------
// Zero-parsed-phases rejection.
//
// Control flow below is driven entirely by `newlyChecked`, which is derived
// from parsed phases — so an incoming edit in which no heading parses produces
// an empty list and every gate is skipped. A checkoff arriving alongside a
// broken heading is exactly the shape of that hazard, and it currently exits 0.
//
// This fires only when the incoming content *checks something off* (the caller
// already established a checkbox transition) and still yields no phase: work
// is being claimed as done, and no phase can be held responsible for it.
// ------------------------------------------------------------------
if (newPhases.length === 0) {
	process.stderr.write(
		"Gate check refused: an item was checked off but no phase heading parses in impl.md, " +
			"so no gate could be evaluated. Expected `### Test Phase N: Name`, " +
			"`### Build Phase N: Name`, or `### Phase N: Name`. Check for a typo in a heading.\n",
	);
	process.exit(2);
}

// Find which items were just checked (were unchecked before, checked now)
const newlyChecked = newlyCheckedIn(oldPhases, newPhases);

if (newlyChecked.length === 0) {
	process.exit(0);
}

// promise: a-plan-builds-only-after-approval
// An amendment waits for the person (brief-as-the-contract ADR decision 5): a
// change since approval to the brief's expectations, promises or looks, or to
// a promise's statement the plan owns, stops every build item until a person
// approves it (`indusk plans reapprove`, or Approve on the plan's page). The
// comparison needs the brief, the registry and git, so it is the package's
// (`plans/amendments`), run through `indusk plans amendments` — never a second
// reader here. An impl that records no `approved_brief` was approved before
// the field existed and has no amendments: absence is a rule, so no command
// runs. A check that cannot run refuses, and says why.
const buildChecked = newlyChecked.filter(isBuildItem);
if (buildChecked.length > 0 && approvedBriefOf(fullContent)) {
	const refusal = amendmentRefusal(filePath);
	if (refusal) {
		process.stderr.write(refusal);
		process.exit(2);
	}
}

/** The refusal while amendments wait, the could-not-check refusal, or null to allow. */
function amendmentRefusal(implPath) {
	const planDir = dirname(implPath);
	const plan = planDir.match(/[\\/]\.indusk[\\/]planning[\\/]([^\\/]+)$/)?.[1];
	if (!plan) return null;
	const bin = process.env.INDUSK_BIN ?? "indusk";
	const ran = `${bin} plans amendments ${plan} --dir ${planDir} --json`;
	const r = spawnSync(
		`${bin} plans amendments "$INDUSK_AMEND_PLAN" --dir "$INDUSK_AMEND_DIR" --json`,
		{
			shell: true,
			cwd: planDir,
			encoding: "utf-8",
			timeout: 30_000,
			env: {
				...process.env,
				INDUSK_AMEND_PLAN: plan,
				INDUSK_AMEND_DIR: planDir,
				INDUSK_SKIP_UPDATE_CHECK: "1",
			},
		},
	);
	let amendments = null;
	if (r.status === 0) {
		try {
			const parsed = JSON.parse((r.stdout ?? "").trim().split("\n").pop() ?? "");
			if (Array.isArray(parsed)) amendments = parsed;
		} catch {
			// not the list: reported below as a check that could not run
		}
	}
	if (amendments === null) {
		const how = r.error
			? `could not start: ${r.error.message}`
			: r.signal
				? `was stopped by ${r.signal} (30s limit)`
				: r.status === 0
					? "printed no list of amendments"
					: `exited ${r.status}`;
		const said = (r.stderr ?? "").trim();
		const detail = said ? `\n${said.split("\n").slice(0, 6).join("\n")}` : "";
		return `Whether ${plan}'s brief still says what was approved could not be checked, so this checkoff is refused: a gate that cannot run is never a pass.\n\n  ran: ${ran}\n  it ${how}${detail}\n\nThe \`indusk\` this hook reaches must have \`plans amendments\`: install or upgrade the one on PATH, or set INDUSK_BIN to a build that has it.\nlesson: detectors-must-distinguish-could-not-check-from-checked-and-failed\n`;
	}
	if (amendments.length === 0) return null;
	const said = (s) => (s === null || s === undefined ? "(not in the brief)" : JSON.stringify(s));
	const lines = amendments
		.map((a) => `  - ${a.part} ${a.name}: was ${said(a.was)} — now ${said(a.now)}`)
		.join("\n");
	return `${plan} has ${amendments.length} amendment(s) waiting on the person: what was agreed at approval has changed, so no build item is checked off until a person approves the change.\n${lines}\n\nThe person approves it with Approve on the plan's page in the cockpit, or by running \`indusk plans reapprove ${plan}\`; or put the brief back as it was approved.\nlesson: a-plan-builds-only-after-approval\n`;
}

// Trajectory gates run BEFORE the gate-completeness loop, deliberately.
// Both violations can be present at once — an unauthored test is usually WHY
// a test phase's gate is still open — and the hook reports the first one it
// finds. Reporting "complete Phase 1 gates first" when the cause is a test
// that was never written sends the reader to the symptom; reporting the
// test-first violation sends them to the cause, and fixing the cause clears
// the symptom.

const hasTrajectorySection = /^##\s+Test Trajectory\b/m.test(newFullContent);
if (hasTrajectorySection) {
	const advancingPhases = new Set();
	// Two things advance the test-first obligation: starting build work, and
	// closing a test phase. The second is new — a test phase's items ARE the
	// authoring, so its Verification gate is the moment it claims to be done,
	// and a test phase that can close with unwritten tests has nothing to
	// review, which is the compensating control the whole register rests on.
	for (const item of newlyChecked) {
		if (item.gate === "implementation") advancingPhases.add(item);
		else if (item.gate === "verification" && item.phaseKind === "test") advancingPhases.add(item);
	}

	if (advancingPhases.size > 0) {
		const trajectory = parseTrajectoryFromBody(stripFrontmatter(newFullContent));
		const sequence = phaseSequence(newFullContent);

		// Gate A: test-first authoring, at or before the advancing phase.
		//
		// The comparison used to be `===`, which meant a row was asked about at
		// exactly one moment: miss it and no later phase ever asks again. That
		// is how five rows in `lifecycle-rebalance` were authored four phases
		// late with nothing objecting. Worse, `advancingPhase` is never 0, so
		// `Writable at: Phase 0` — 260 of 444 rows across this repo — could
		// never match at all, and the DEFAULT path of the test-first rule was
		// unenforced by construction.
		//
		// `<=` on the document timeline fixes both: a row due earlier and still
		// unwritten blocks every subsequent checkoff until it is authored.
		const testFirstBlockers = [];
		for (const advancing of advancingPhases) {
			const advancingOrdinal = phaseOrdinal(
				{ kind: advancing.phaseKind, number: advancing.phase },
				sequence,
			);
			const unauthored = trajectory.rows.filter(
				(row) =>
					// A row can only be *late* for a phase the document contains.
					// One naming a phase nobody has written yet is a forward
					// reference, not a missed obligation. `Phase 0` counts as
					// present by definition — it is where the 260 unenforceable
					// rows live, and it is the whole point of this correction.
					phaseExists({ kind: row.writableAtKind, number: row.writableAt }, sequence) &&
					phaseOrdinal({ kind: row.writableAtKind, number: row.writableAt }, sequence) <=
						advancingOrdinal &&
					row.state !== "written" &&
					row.state !== "passing" &&
					row.state !== "skipped" &&
					row.state !== "blocked",
			);
			for (const row of unauthored) {
				testFirstBlockers.push({ advancing, row });
			}
		}

		if (testFirstBlockers.length > 0) {
			const rowLabel = (row) =>
				`${row.writableAtKind === "test" ? "Test " : ""}Phase ${row.writableAt}`;
			const msg = testFirstBlockers
				.map(
					(b) =>
						`${phaseLabel(b.advancing.phaseKind, b.advancing.phase)} test-first violation: row ${b.row.id} is Writable at: ${rowLabel(b.row)} but still ${b.row.state}. Author it as RED before marking work at or after that phase done.\nlesson: test-red-at-earliest-writable-phase`,
				)
				.join("\n");
			process.stderr.write(`${msg}\n`);
			process.exit(2);
		}

		// Gate B: every prior phase must be closable.
		//
		// Expressed over the document timeline rather than by counting from 1:
		// with two sequences there is no "phase 1..N-1" to count through, and
		// the phases that must be closed are simply the ones that come earlier
		// in the document than the phase being advanced.
		const allBlockers = [];
		for (const advancing of advancingPhases) {
			const advancingOrdinal = phaseOrdinal(
				{ kind: advancing.phaseKind, number: advancing.phase },
				sequence,
			);
			for (const row of trajectory.rows) {
				const ref = { kind: row.passesAtKind, number: row.passesAt };
				if (!phaseExists(ref, sequence)) continue;
				const passesOrdinal = phaseOrdinal(ref, sequence);
				if (passesOrdinal >= advancingOrdinal) continue;
				if (row.state !== "passing" && row.state !== "skipped" && row.state !== "blocked") {
					allBlockers.push({ ref, row });
				}
			}
		}

		if (allBlockers.length > 0) {
			const msg = allBlockers
				.map(
					(b) =>
						`  [${b.row.id}] ${b.row.asserts} — state: ${b.row.state} (${phaseLabel(b.ref.kind, b.ref.number)} cannot close until this row is 'passing' or 'skipped')`,
				)
				.join("\n");
			process.stderr.write(
				`Trajectory blocks phase advance (policy: ${gatePolicy}):\n${msg}\n\nEvery trajectory row with 'Passes at: Phase N' must be 'passing', 'skipped', or 'blocked' before advancing past Phase N. See .indusk/planning/tests-first-planning/adr.md Section 6.\n`,
			);
			process.exit(2);
		}
	}
}

// For each newly checked item: if it's an implementation item,
// check that all PREVIOUS phases have complete gates
for (const item of newlyChecked) {
	// Checking gate items is always allowed
	if (item.gate !== "implementation") continue;

	// Check all phases before this item's phase. Ordered by document position:
	// with two sequences numbering independently, `Test Phase 1` and `Build
	// Phase 1` both report number 1, so a number comparison would let build
	// work start while the test phase that authors its tests is still open.
	for (const phase of oldPhases) {
		if (phase.ordinal >= item.ordinal) break;

		const isOverridden = (text) => {
			if (gatePolicy === "strict") return false;

			const hasBareOptOut =
				text.includes("(none needed)") ||
				text.includes("(not applicable)") ||
				text.includes("skip-reason:");

			// A build's sessions (INDUSK_GATE_POLICY=auto) skip only with a reason,
			// which the review shows; a plan that set auto itself keeps the bare form.
			if (gatePolicy === "auto") return policyFromBuild ? skipCarriesReason(text) : hasBareOptOut;

			// ask mode: requires conversation proof
			// Format: (none needed — asked: "{question}" — user: "{answer}")
			const hasConversationProof =
				/\(none needed\s*—\s*asked:\s*"[^"]+"\s*—\s*user:\s*"[^"]+"\)/.test(text) ||
				/\(not applicable\s*—\s*asked:\s*"[^"]+"\s*—\s*user:\s*"[^"]+"\)/.test(text) ||
				/skip-reason:.*—\s*asked:\s*"[^"]+"\s*—\s*user:\s*"[^"]+"/.test(text);

			return hasConversationProof;
		};

		const uncheckedGates = phase.items.filter(
			(i) => !i.checked && !isOverridden(i.text) && requiredGates.includes(i.gate),
		);

		if (uncheckedGates.length > 0) {
			const missing = uncheckedGates.map((i) => `  [${i.gate}] ${i.text}`).join("\n");
			const skipHint =
				gatePolicy === "strict"
					? "Gate policy is 'strict' — no overrides allowed.\n"
					: gatePolicy === "ask"
						? 'Gate policy is \'ask\' — to skip, you must ask the user and include proof.\nFormat: (none needed — asked: "your question" — user: "their answer")\n'
						: policyFromBuild
							? "This build runs under INDUSK_GATE_POLICY=auto: skip a gate item only with its reason — (none needed — {why}) or skip-reason: {why}; the review lists every skip\n"
							: "To skip a gate item, mark with (none needed) or skip-reason: {why}\n";
			process.stderr.write(
				`${phaseLabel(item.phaseKind, item.phase)} blocked (policy: ${gatePolicy}): complete ${phaseLabel(phase.kind, phase.number)} gates first:\n${missing}\n${skipHint}`,
			);
			process.exit(2);
		}
	}
}

// All checks passed
process.exit(0);

// ------------------------------------------------------------------
// Trajectory parser (pure JS, mirrors parser.ts — simplified to read
// just id, passesAt, and state which is all this hook needs).
// ------------------------------------------------------------------
