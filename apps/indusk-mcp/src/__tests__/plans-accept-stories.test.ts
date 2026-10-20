import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { approve } from "../lib/looks/approve.js";
import { readApp, snapshotHash } from "../lib/looks/mockups.js";
import {
	APP,
	type BriefAppProject,
	briefAppProject,
	briefOf,
	briefWorkbench,
	PLAN,
	PLAN_DIR,
} from "./helpers/brief-app.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { approveWithReview } from "./helpers/plan-review-fixture.js";
import { commitFile, git } from "./helpers/versioned-workbench.js";

/**
 * promise: a-new-component-ends-its-plan-with-a-story — brief-as-the-contract A25.
 * promise: a-plan-is-approved-with-its-looks-approved — brief-as-the-contract A33, a workbench plan's looks checks.
 *
 * A new component a brief names is drawn as its own mockup before approval
 * (`screens/badge.ok.html`, declaring `badge` in `indusk-new-components`), and
 * the screens that use it draw it inline under the same declaration until its
 * story exists (ADR decision 4a). `indusk plans accept` holds the plan until
 * the component's story is approved and every mockup the brief names composes
 * only approved stories. Over the CLI boundary, with the `brief-app` fixture.
 */

const MOCKUPS = `.indusk/mockups/${APP}`;
const out = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;

/** home.full drawing the new badge inline, as a screen does before the badge's story exists. */
const HOME_FULL_INLINE = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>home — full</title>
		<meta name="indusk-new-components" content="badge" />
		<link rel="stylesheet" href="../tokens.css" />
	</head>
	<body>
		<main class="card" data-component="card">Three seats held.</main>
		<span class="badge" data-component="badge">ok</span>
	</body>
</html>
`;

/** home.full placing the badge by name, once its story exists. */
const HOME_FULL_COMPOSED = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>home — full</title>
		<link rel="stylesheet" href="../tokens.css" />
	</head>
	<body>
		<main class="card" data-component="card">Three seats held.</main>
		<indusk-component name="badge" state="ok"></indusk-component>
	</body>
</html>
`;

/** The badge's story snapshot, as the render step writes it from the built component. */
const BADGE_OK_STORY = `<span data-component="badge" class="bg-amber-50 p-[13px]">ok</span>\n`;

let app: BriefAppProject;
beforeEach(() => {
	app = briefAppProject("plans-accept-stories");
});
afterEach(() => app.cleanup());

const write = (rel: string, text: string) => {
	mkdirSync(join(app.wt, rel, ".."), { recursive: true });
	writeFileSync(join(app.wt, rel), text);
};

/** The person approves a mockup as the worktree holds it, with the hashes the page would show. */
async function approveMockup(name: string): Promise<void> {
	const held = (await readApp(app.wt, APP)).mockups.find((m) => m.name === name);
	expect(held, `no mockup ${name}`).toBeDefined();
	const person = await approve(app.wt, APP, name, "sandy", {
		mockupHash: held?.hash,
		...(held && held.uses.length > 0 ? { componentsHash: held.componentsHash } : {}),
	});
	expect(person.approved, JSON.stringify(person)).toBe(true);
}

describe.skipIf(SHOULD_SKIP)("a new component ends its plan with a story", () => {
	it("A25 accept is refused while the new component has no approved story or a named mockup draws it inline, naming each; once the story is approved and placed the same plan is accepted", async () => {
		// The plan as approved: its brief makes home.full, changes detail.default
		// and replaces badge.old by badge.ok, the new component drawn as its own
		// mockup; home.full draws the badge inline under the same declaration.
		app.writePlan({ brief: "looks-listed", impl: "internal" });
		write(`${MOCKUPS}/screens/home.full.html`, HOME_FULL_INLINE);
		for (const look of ["home.full", "detail.default", "badge.ok"]) await approveMockup(look);
		const approved = approveWithReview(app.trunk, PLAN, join(app.wt, PLAN_DIR));
		expect(approved.code, out(approved)).toBe(0);

		const refused = runCli(app.trunk, ["plans", "accept", PLAN]);
		expect(refused.code, out(refused)).not.toBe(0);
		expect(out(refused)).toContain("badge.ok");
		expect(out(refused)).toContain("home.full");
		expect(out(refused)).toContain("<indusk-component>");

		// The component is built: its story is rendered and the person approves it.
		write(`${MOCKUPS}/components/badge.ok.html`, BADGE_OK_STORY);
		const story = await approve(app.wt, APP, "badge.ok", "sandy", {
			kind: "story",
			snapshotHash: snapshotHash(BADGE_OK_STORY),
		});
		expect(story.approved, JSON.stringify(story)).toBe(true);

		// The story approved, home.full still draws the badge inline: still refused, naming it.
		const stillInline = runCli(app.trunk, ["plans", "accept", PLAN]);
		expect(stillInline.code, out(stillInline)).not.toBe(0);
		expect(out(stillInline)).toContain("home.full");

		// home.full places the badge by name and the person approves it as composed.
		write(`${MOCKUPS}/screens/home.full.html`, HOME_FULL_COMPOSED);
		await approveMockup("home.full");

		const accepted = runCli(app.trunk, ["plans", "accept", PLAN]);
		expect(accepted.code, out(accepted)).toBe(0);
		expect(readFileSync(join(app.wt, `.indusk/planning/${PLAN}/impl.md`), "utf-8")).toMatch(
			/^accepted: /m,
		);
	});
});

describe.skipIf(SHOULD_SKIP)("a workbench plan is accepted under the same looks checks", () => {
	it("A33 accept of a workbench plan is refused for an interface change its brief lists no look for, and for a new component with no approved story, naming each", async () => {
		const bench = briefWorkbench();
		try {
			// An interface change against a brief that lists no look.
			bench.writePlan({ brief: "none", impl: "internal" });
			const approved = approveWithReview(bench.root, PLAN, join(bench.root, PLAN_DIR));
			expect(approved.code, out(approved)).toBe(0);
			commitFile(bench.code, "src/Card.jsx", "export const Card = 2;\n", "the build");

			const unlisted = runCli(bench.root, ["plans", "accept", PLAN]);
			expect(unlisted.code, out(unlisted)).not.toBe(0);
			expect(out(unlisted)).toContain("src/Card.jsx");
			expect(
				readFileSync(join(bench.root, `.indusk/planning/${PLAN}/impl.md`), "utf-8"),
			).not.toMatch(/^accepted: /m);

			// A new component with no approved story, its mockup drawing it inline.
			const planDir = join(bench.root, `.indusk/planning/${PLAN}`);
			writeFileSync(join(planDir, "brief.md"), briefOf("looks-listed"));
			const mockups = join(bench.root, MOCKUPS, "screens");
			writeFileSync(join(mockups, "home.full.html"), HOME_FULL_INLINE);
			for (const look of ["home.full", "detail.default", "badge.ok"]) {
				const held = (await readApp(bench.root, APP)).mockups.find((m) => m.name === look);
				const person = await approve(bench.root, APP, look, "sandy", {
					mockupHash: held?.hash,
					...(held && held.uses.length > 0 ? { componentsHash: held.componentsHash } : {}),
				});
				expect(person.approved, JSON.stringify(person)).toBe(true);
			}
			git(bench.root, ["add", "-A"]);
			git(bench.root, ["commit", "-q", "-m", "a brief that names looks"]);
			const stories = runCli(bench.root, ["plans", "accept", PLAN]);
			expect(stories.code, out(stories)).not.toBe(0);
			expect(out(stories)).toContain("badge.ok");
			expect(out(stories)).toContain("<indusk-component>");
		} finally {
			bench.cleanup();
		}
	});
});
