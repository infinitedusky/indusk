import { readStoryApprovals, unapprovedUses } from "./approvals.js";
import { catalogGaps, readCatalog } from "./components.js";
import { COMPONENT_TAG, CONTENT_TAG } from "./compose.js";
import type { Finding } from "./lint-types.js";
import { elementsOf, markedElementsOf } from "./markup.js";
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
 * promise: placed-content-is-only-words-and-components
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

/**
 * What a mockup puts inside a placed component is words and placed
 * components, nothing else (component-content ADR): an element that is neither
 * `<indusk-component>` nor `<indusk-content>` is `content-not-words-or-
 * components`, and content for a property the state does not take — absent
 * from the state's `content` in the catalog — is `component-takes-no-content`.
 * A state the catalog does not list is `no story`'s to report, not this rule's.
 *
 * promise: placed-content-is-only-words-and-components
 */
export function contentFindings(app: LooksApp, mockup: Mockup): Finding[] {
	const elements = elementsOf(mockup.source);
	const refs = elements.filter((el) => el.tag === COMPONENT_TAG && el.attrs.name);
	if (refs.length === 0) return [];
	const catalog = readCatalog(app);
	const inside = (
		outer: { innerStart: number; innerEnd: number },
		el: { start: number; end: number },
	) => el.start >= outer.innerStart && el.end <= outer.innerEnd;
	const findings: Finding[] = [];
	for (const ref of refs) {
		const mine = (el: { start: number; end: number }) =>
			inside(ref, el) && !refs.some((o) => o !== ref && inside(ref, o) && inside(o, el));
		const own = elements.filter((el) => el !== ref && mine(el));
		const contents = own.filter((el) => el.tag === CONTENT_TAG);
		const nested = (el: { start: number; end: number }) =>
			contents.some(
				(o) =>
					o.start !== el.start && inside({ innerStart: o.innerStart, innerEnd: o.innerEnd }, el),
			);
		for (const el of own) {
			if (el.tag === CONTENT_TAG && el.attrs.for && !nested(el)) continue;
			if (el.tag === COMPONENT_TAG) continue;
			const why =
				el.tag !== CONTENT_TAG
					? `<${el.tag}> inside ${ref.attrs.name} — a placed component takes words and placed components only`
					: el.attrs.for
						? `<${el.tag}> inside another <${el.tag}> — content is words and placed components only`
						: `<${el.tag}> with no "for" inside ${ref.attrs.name} — name the property it fills`;
			findings.push({
				file: mockup.file,
				line: el.line,
				value: el.tag,
				rule: "content-not-words-or-components",
				message: `content not words or components: ${mockup.file}:${el.line} ${why} (promise: placed-content-is-only-words-and-components)`,
			});
		}
		const state = catalog?.components
			.find((c) => c.name === ref.attrs.name)
			?.states.find((s) => s.name === (ref.attrs.state || "default"));
		if (!state) continue;
		const top = contents.filter((el) => !nested(el));
		const named = top.filter((el) => el.attrs.for);
		const filled = new Map<string, number>();
		for (const el of named) {
			const property = el.attrs.for as string;
			const first = filled.get(property);
			if (first !== undefined) {
				findings.push({
					file: mockup.file,
					line: el.line,
					value: `${ref.attrs.name}.${property}`,
					rule: "content-given-twice",
					message: `content given twice: ${mockup.file}:${el.line} ${ref.attrs.name} "${property}" is also given at line ${first} — one of them would be dropped (promise: placed-content-is-only-words-and-components)`,
				});
			} else filled.set(property, el.line);
		}
		let bare = mockup.source.slice(ref.innerStart, ref.innerEnd);
		for (const el of [...top].sort((a, b) => b.start - a.start)) {
			bare = bare.slice(0, el.start - ref.innerStart) + bare.slice(el.end - ref.innerStart);
		}
		if (bare.trim() !== "") {
			const first = filled.get("children");
			if (first !== undefined) {
				findings.push({
					file: mockup.file,
					line: ref.line,
					value: `${ref.attrs.name}.children`,
					rule: "content-given-twice",
					message: `content given twice: ${mockup.file}:${ref.line} ${ref.attrs.name} "children" is words here and also given at line ${first} — the words would be dropped (promise: placed-content-is-only-words-and-components)`,
				});
			} else filled.set("children", ref.line);
		}
		for (const [property, line] of filled) {
			if (property in (state.content ?? {})) continue;
			findings.push({
				file: mockup.file,
				line,
				value: `${ref.attrs.name}.${property}`,
				rule: "component-takes-no-content",
				message: `component takes no content: ${mockup.file}:${line} ${ref.attrs.name} has no "${property}" to fill in state ${state.name} — see its content in components.json (promise: placed-content-is-only-words-and-components)`,
			});
		}
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
		...app.mockups.flatMap((m) => contentFindings(app, m)),
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
