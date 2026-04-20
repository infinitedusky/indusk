import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// `next/link` references Node-only globals in the browser test runtime.
// Stub with a plain anchor — see PlanList.test.tsx for the canonical pattern.
vi.mock("next/link", () => {
	function MockLink({
		href,
		children,
		...rest
	}: {
		href: string;
		children: React.ReactNode;
		[key: string]: unknown;
	}) {
		return (
			<a href={href} {...rest}>
				{children}
			</a>
		);
	}
	return { default: MockLink, __esModule: true };
});

import { ProjectGrid } from "./ProjectGrid";

/**
 * T12 — `/` renders one card per registered project with name, last-seen-at,
 * and active-plan count.
 *
 * These tests drive the shape of the `<ProjectGrid>` and `<ProjectCard>`
 * components. The component receives an array of `{ name, path, lastSeenAt,
 * activePlanCount, hasInProgress }` and renders one card per entry.
 */

interface ProjectCardData {
	name: string;
	path: string;
	lastSeenAt: string;
	activePlanCount: number;
	hasInProgress: boolean;
}

function mockProject(
	name: string,
	overrides: Partial<ProjectCardData> = {},
): ProjectCardData {
	return {
		name,
		path: `/Users/demo/${name}`,
		lastSeenAt: "2026-04-20T00:00:00.000Z",
		activePlanCount: 3,
		hasInProgress: false,
		...overrides,
	};
}

describe("ProjectGrid — T12: one card per registered project", () => {
	it("T12 — renders exactly one card per project with name, plan count, and link to /p/{name}/", async () => {
		const projects = [
			mockProject("dusk", { activePlanCount: 5, hasInProgress: true }),
			mockProject("numero", { activePlanCount: 2 }),
			mockProject("chitin-sportsbook", { activePlanCount: 0 }),
		];
		const { container } = await render(<ProjectGrid projects={projects} />);

		for (const p of projects) {
			// ProjectCard IS an <a> (it's the Link itself), so the card element
			// carries both the data attribute and the href.
			const card = container.querySelector(
				`[data-project-name="${p.name}"]`,
			);
			expect(card, `expected card for ${p.name}`).not.toBeNull();
			expect(card?.textContent).toContain(p.name);
			expect(card?.textContent).toContain(`${p.activePlanCount}`);
			expect(card?.getAttribute("href")).toBe(`/p/${p.name}/`);
		}
	});

	it("T12 — empty registry renders a clear 'no projects registered' empty state", async () => {
		const { container } = await render(<ProjectGrid projects={[]} />);
		expect(
			container.querySelector('[data-testid="project-grid-empty"]'),
		).not.toBeNull();
	});

	it("T12 — surfaces the in-progress badge on projects with any in-progress plan", async () => {
		const projects = [
			mockProject("dusk", { hasInProgress: true }),
			mockProject("numero", { hasInProgress: false }),
		];
		const { container } = await render(<ProjectGrid projects={projects} />);

		const duskCard = container.querySelector('[data-project-name="dusk"]');
		const numeroCard = container.querySelector(
			'[data-project-name="numero"]',
		);
		expect(
			duskCard?.querySelector('[data-testid="in-progress-badge"]'),
		).not.toBeNull();
		expect(
			numeroCard?.querySelector('[data-testid="in-progress-badge"]'),
		).toBeNull();
	});
});
