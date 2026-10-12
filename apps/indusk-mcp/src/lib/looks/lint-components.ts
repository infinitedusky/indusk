import { readStoryApprovals, unapprovedUses } from "./approvals.js";
import { catalogGaps, readCatalog } from "./components.js";
import type { Finding } from "./lint-types.js";
import { markedElementsOf } from "./markup.js";
import type { LooksApp, Mockup } from "./mockups.js";

/**
 * The component half of the lint (storybook-components ADR decisions 2 and 7):
 * a component name implemented in two files, a screen that writes a
 * component's element out itself, a component the catalog does not list, and
 * a state a mockup places that no story covers, and a component a mockup names
 * with no approved snapshot to compose. The facts are `looks/components`' and
 * `looks/approvals`';
 * this turns them into findings in the lint's one grammar.
 *
 * promise: a-component-has-one-implementation
 * promise: every-component-state-has-a-story
 * promise: an-agent-can-find-every-component
 * promise: a-mockup-composes-approved-components
 */
/**
 * A mockup shows a component only by naming it (ADR decision 4): a
 * `data-component` element written in its source is `component drawn in
 * mockup`, unless the mockup declares the component new (`<meta
 * name="indusk-new-components">`, as `indusk-new-tokens` does for a token) —
 * then it is listed `needs a story`, a notice, until its story exists. Like
 * the catalog's gaps, the rule holds once the app has adopted stories (it has
 * a `components.json`); a mockup `screens.json` lists as `uncomposed` was
 * drawn before composition existed and is exempt until it is rewritten.
 */
export function drawnComponents(app: LooksApp, mockup: Mockup, adopted: boolean): Finding[] {
	if (!adopted || app.uncomposed.includes(mockup.name)) return [];
	const declared = new Set(mockup.declaresNewComponents);
	const storied = new Set(app.stories.map((s) => s.component));
	const findings: Finding[] = [];
	for (const el of markedElementsOf(mockup.source)) {
		const name = el.attrs["data-component"] as string;
		if (declared.has(name)) continue;
		const line = el.attrLine("data-component");
		findings.push({
			file: mockup.file,
			line,
			value: name,
			rule: "component-drawn-in-mockup",
			message: `component drawn in mockup: ${mockup.file}:${line} ${name} — place it with <indusk-component name="${name}" state="…">, or declare it new in <meta name="indusk-new-components">`,
		});
	}
	for (const name of declared) {
		if (storied.has(name)) continue;
		findings.push({
			file: mockup.file,
			line: 1,
			value: name,
			rule: "needs-a-story",
			message: `needs a story: ${name} — declared new by this mockup; write its stories and run \`indusk looks stories ${app.app}\``,
			notice: true,
		});
	}
	return findings;
}

export async function componentFindings(root: string, app: LooksApp): Promise<Finding[]> {
	const gaps = await catalogGaps(root, app);
	const stories = readStoryApprovals(app);
	const adopted = readCatalog(app) !== null;
	return [
		...gaps.scan.findings.map(
			(f): Finding => ({
				file: f.file,
				line: f.line,
				value: f.name,
				rule: f.rule,
				message: f.message,
			}),
		),
		...gaps.notInCatalog.map(
			(c): Finding => ({
				file: c.file,
				line: c.line,
				value: c.name,
				rule: "not-in-catalog",
				message: `not in catalog: ${c.name} — run \`indusk looks stories ${app.app}\` after writing its stories`,
			}),
		),
		...gaps.noStory.map(
			(r): Finding => ({
				file: r.file,
				line: r.line,
				value: `${r.name}.${r.state}`,
				rule: "no-story",
				message: `no story: ${r.name}.${r.state}`,
			}),
		),
		...app.mockups.flatMap((m) => drawnComponents(app, m, adopted)),
		...app.mockups.flatMap((m) =>
			unapprovedUses(app, m, stories).map(
				(u): Finding => ({
					file: m.file,
					line: u.line,
					value: u.story,
					rule: "no-approved-story",
					message: `no approved story: ${u.story} — a mockup composes approved components; approve its story on the cockpit's Looks page, or declare the component new and draw it`,
				}),
			),
		),
	];
}
