/**
 * Plan documents for tests (planner-promises): a brief in the shape the
 * contract reads, and a small impl whose trajectory a test controls. Text
 * only — `promiseProject`'s `planFiles` puts them in a plan folder.
 */

export interface BriefSpec {
	/** `null` writes "None — <reason>"; omitted writes one complete expectation. */
	expectations?: Array<{ text: string; measure?: string; look?: string }> | { none: string };
	makes?: Array<{ name: string; kind?: string; sentence: string }>;
	mustNotBreak?: string[];
	changes?: Array<{ name: string; sentence: string }>;
	replaces?: Array<{ old: string; by: string }>;
	notPromised?: string[];
}

/** A brief in the shape ADR D1 gives. */
export function briefText(plan: string, spec: BriefSpec = {}): string {
	const expectations = spec.expectations ?? [
		{ text: "People seat themselves", measure: "seats taken per day", look: "in two weeks" },
	];
	const expectationLines =
		"none" in expectations
			? [`None — ${expectations.none}`]
			: expectations.flatMap((e, i) => [
					`${i + 1}. **${e.text}**`,
					...(e.measure === undefined ? [] : [`   - Measure: ${e.measure}`]),
					...(e.look === undefined ? [] : [`   - Look: ${e.look}`]),
				]);
	const list = (items: string[]) => (items.length > 0 ? items : ["None."]);
	return [
		"---",
		`title: "${plan}"`,
		"status: accepted",
		"workflow: feature",
		"---",
		"",
		`# ${plan} — Brief`,
		"",
		"## Expectations",
		"",
		...expectationLines,
		"",
		"## Promises",
		"",
		"### This plan makes",
		"",
		...list(
			(spec.makes ?? []).map(
				(p, i) => `${i + 1}. **\`${p.name}\`** (${p.kind ?? "state"}). ${p.sentence}`,
			),
		),
		"",
		"### Existing promises",
		"",
		"**Must not break**",
		"",
		...list((spec.mustNotBreak ?? []).map((n) => `- **\`${n}\`**. Still true.`)),
		"",
		"**Changes**",
		"",
		...list((spec.changes ?? []).map((c) => `- **\`${c.name}\`**. ${c.sentence}`)),
		"",
		"**Replaces**",
		"",
		...list((spec.replaces ?? []).map((r) => `- **\`${r.old}\`**, by **\`${r.by}\`**.`)),
		"",
		"### Not promised",
		"",
		...list((spec.notPromised ?? []).map((n) => `- ${n}`)),
		"",
	].join("\n");
}

/** A brief in the shape written before planner-promises: no Promises section. */
export function legacyBriefText(plan: string): string {
	return `---\ntitle: "${plan}"\nstatus: accepted\nworkflow: feature\n---\n\n# ${plan} — Brief\n\n## Problem\n\nSeats are double-booked.\n\n## Success Criteria\n\n- A seat is held once\n`;
}

export interface ImplSpec {
	/** Extra frontmatter lines, e.g. `test_purpose: required`. */
	keys?: string[];
	status?: string;
	/** Columns after `State`, in order, e.g. `["Level", "For", "Test"]`. */
	columns?: string[];
	/** One per row: the row's state and its cells for `columns`, by header. */
	rows: Array<{ id?: string; asserts?: string; state?: string; cells?: Record<string, string> }>;
}

/** A small impl: Test Phase 1 and one build phase, every row passing at Build Phase 1. */
export function implText(plan: string, spec: ImplSpec): string {
	const columns = spec.columns ?? [];
	const header = ["ID", "Asserts", "Writable at", "Passes at", "State", ...columns];
	const rows = spec.rows.map((r, i) =>
		[
			r.id ?? `T${i + 1}`,
			r.asserts ?? `assertion ${i + 1} holds`,
			"Test Phase 1",
			"Build Phase 1",
			r.state ?? "passing",
			...columns.map((c) => r.cells?.[c] ?? ""),
		].join(" | "),
	);
	const ids = spec.rows.map((r, i) => r.id ?? `T${i + 1}`).join(", ");
	const done = (spec.status ?? "in-progress") !== "draft";
	const box = done ? "[x]" : "[ ]";
	return [
		"---",
		`title: "${plan}"`,
		`status: ${spec.status ?? "in-progress"}`,
		"trajectory: required",
		"test_phases: required",
		...(spec.keys ?? []),
		"---",
		"",
		`# ${plan}`,
		"",
		"## Test Trajectory",
		"",
		`| ${header.join(" | ")} |`,
		`|${header.map(() => "----").join("|")}|`,
		...rows.map((r) => `| ${r} |`),
		"",
		"## Checklist",
		"",
		"### Test Phase 1: Red",
		"",
		`- ${box} every row written, red`,
		"",
		"#### Test Phase 1 Verification",
		"",
		`- ${box} ${ids} each fail on their own assertion`,
		"",
		"### Build Phase 1: Build",
		"",
		`- ${box} build it`,
		"",
		"#### Build Phase 1 Verification",
		"",
		`- ${box} ${ids} pass`,
		"",
		"#### Build Phase 1 Context",
		"",
		`- ${box} guard: the tests carry the rule`,
		"",
		"#### Build Phase 1 Document",
		"",
		`- ${box} the page`,
		"",
	].join("\n");
}
