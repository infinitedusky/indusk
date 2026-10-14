import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { approvalOf, readApprovals } from "../lib/looks/approvals.js";
import { readApp } from "../lib/looks/mockups.js";
import { approveAll, contentApp } from "./helpers/component-content-app.js";
import { MOCKUPS, removeApps } from "./helpers/looks-cli.js";

/**
 * component-content Test Phase 1, A9–A10: an approval binds the words placed
 * in a component, and the component's own story, through the composed hash.
 */

afterEach(removeApps);

const page = (body: string) => `<!doctype html>\n<html><body>\n${body}\n</body></html>\n`;
const standing = async (root: string, name: string) => {
	const app = await readApp(root, "demo");
	const m = app.mockups.find((x) => x.name === name);
	if (!m) throw new Error(`no mockup ${name}`);
	return approvalOf(app, m, readApprovals(app));
};

describe("a mockup's approval binds what it places", () => {
	it("A9 returns to proposed, naming the component, when a component placed with words changes", async () => {
		// promise: a-changed-component-reopens-its-mockups
		const root = contentApp({
			"home.words": page(
				'<indusk-component name="box" state="default"><indusk-component name="button" state="default">Go</indusk-component></indusk-component>',
			),
		});
		await approveAll(root, ["home.words"]);
		expect((await standing(root, "home.words")).state).toBe("approved");
		const file = join(root, MOCKUPS, "components", "button.default.html");
		writeFileSync(file, readFileSync(file, "utf-8").replace("<button", '<button class="changed"'));
		const after = await standing(root, "home.words");
		expect(after.state).toBe("proposed");
		expect(after.state === "proposed" && after.componentsChanged).toContain("button");
	});

	it("A10 returns an approved mockup to proposed when only the placed words change", async () => {
		// promise: a-mockup-is-approved-by-a-person
		const root = contentApp({
			"home.words": page(
				'<indusk-component name="button" state="default">Create project</indusk-component>',
			),
		});
		await approveAll(root, ["home.words"]);
		expect((await standing(root, "home.words")).state).toBe("approved");
		const file = join(root, MOCKUPS, "screens", "home.words.html");
		writeFileSync(file, readFileSync(file, "utf-8").replace("Create project", "Make a project"));
		expect((await standing(root, "home.words")).state).toBe("proposed");
	});
});
