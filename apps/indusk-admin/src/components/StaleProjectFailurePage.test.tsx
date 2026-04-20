import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { StaleProjectFailurePage } from "./StaleProjectFailurePage";

/**
 * T11 — A registered project whose path is deleted from disk:
 * `/p/{name}/` returns HTTP 200 with a "needs reconfiguration" failure
 * page (not 500).
 *
 * Component-level contract for the failure page:
 *   - Renders a `[data-testid="stale-project-failure"]` marker so the HTTP
 *     smoke (`http-stale-project.test.ts`) can assert on it.
 *   - Surfaces the registered name and old path so the user can recover.
 *   - Surfaces the recovery instruction: run `indusk update` from the new
 *     location OR hand-edit `~/.indusk/projects.json`.
 */

describe("StaleProjectFailurePage — T11: component shape", () => {
	it("T11 — renders the failure marker, the registered name, and the old path", async () => {
		const { container } = await render(
			<StaleProjectFailurePage
				projectName="gone-project"
				projectPath="/Users/someone/deleted/gone-project"
			/>,
		);
		expect(
			container.querySelector('[data-testid="stale-project-failure"]'),
		).not.toBeNull();
		expect(container.textContent).toContain("gone-project");
		expect(container.textContent).toContain(
			"/Users/someone/deleted/gone-project",
		);
	});

	it("T11 — names the recovery command", async () => {
		const { container } = await render(
			<StaleProjectFailurePage
				projectName="gone"
				projectPath="/tmp/gone"
			/>,
		);
		expect(container.textContent).toContain("indusk update");
	});

	it("T11 — handles the 'unregistered name' case (null path)", async () => {
		const { container } = await render(
			<StaleProjectFailurePage projectName="never-registered" />,
		);
		expect(
			container.querySelector('[data-testid="stale-project-failure"]'),
		).not.toBeNull();
		expect(container.textContent).toContain("never-registered");
	});
});
