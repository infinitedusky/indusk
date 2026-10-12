import { catalogGaps } from "./components.js";
import type { Finding } from "./lint-types.js";
import type { LooksApp } from "./mockups.js";

/**
 * The component half of the lint (storybook-components ADR decisions 2 and 7):
 * a component name implemented in two files, a screen that writes a
 * component's element out itself, a component the catalog does not list, and
 * a state a mockup places that no story covers. The facts are `looks/components`'s;
 * this turns them into findings in the lint's one grammar.
 *
 * promise: a-component-has-one-implementation
 * promise: every-component-state-has-a-story
 * promise: an-agent-can-find-every-component
 */
export async function componentFindings(root: string, app: LooksApp): Promise<Finding[]> {
	const gaps = await catalogGaps(root, app);
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
	];
}
