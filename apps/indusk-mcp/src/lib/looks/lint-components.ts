import { readStoryApprovals, unapprovedUses } from "./approvals.js";
import { catalogGaps } from "./components.js";
import type { Finding } from "./lint-types.js";
import type { LooksApp } from "./mockups.js";

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
export async function componentFindings(root: string, app: LooksApp): Promise<Finding[]> {
	const gaps = await catalogGaps(root, app);
	const stories = readStoryApprovals(app);
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
