import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// Mock next/link — see PlanList.test.tsx for the canonical reason.
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

vi.mock("next/navigation", () => ({
	__esModule: true,
	useRouter: () => ({ push: vi.fn() }),
	notFound: () => {
		throw new Error("not found");
	},
}));

// The layout's data layer hits `node:fs` transitively via planning-reader
// and registry-client. In the vitest browser runtime `node:fs` is
// externalized — mocking these modules is the cleanest way to assert on
// the layout's shape without paying the server-side I/O cost or importing
// node internals into the browser.
vi.mock("@/lib/planning-reader", () => ({
	__esModule: true,
	readActivePlans: async () => [
		{ name: "alpha", status: "draft", archived: false },
		{ name: "beta", status: "in-progress", archived: false },
	],
	readArchivedPlans: async () => [],
	readMasterPlanOrder: () => ["alpha", "beta"],
	readProjectResearch: async () => [],
}));

vi.mock("@/lib/registry-client", () => ({
	__esModule: true,
	readRegistryProjects: () => [
		{
			name: "fixture-proj",
			path: "/mock/project",
			registeredAt: "2026-04-20T00:00:00.000Z",
			lastSeenAt: "2026-04-20T00:00:00.000Z",
		},
	],
	getProjectPath: (name: string) =>
		name === "fixture-proj" ? "/mock/project" : null,
	// Always reports the mocked path exists; the stale-failure branch is
	// exercised separately by component-level tests against
	// StaleProjectFailurePage and the HTTP smoke in __tests__/.
	projectPathExists: () => true,
}));

import PerProjectLayout from "./layout";

/**
 * T13 — The per-project layout renders the same sidebar + plan-list shape
 * as 1.26.0's per-project mode.
 *
 * Implementation detail: T13 exercises the LAYOUT (`app/p/[project]/layout.tsx`)
 * rather than the PAGE. In the new route structure the layout owns the
 * sidebar + PlanList — the page fills the main content area only. Testing
 * the layout is the honest thing; testing the page alone wouldn't assert
 * the shape claim.
 *
 * Data-layer calls are mocked (see `vi.mock` above) so this renders
 * hermetically in the browser runtime.
 */
describe("per-project layout — T13: same sidebar + plan-list shape as 1.26.0", () => {
	it("T13 — renders PlanList scoped to the project (active-plans testid present)", async () => {
		const element = await PerProjectLayout({
			children: <div data-testid="child-marker">child</div>,
			params: Promise.resolve({ project: "fixture-proj" }),
		});

		const { container } = await render(element as React.ReactElement);

		// Sidebar + PlanList shape must appear — same contract as 1.26.0
		expect(
			container.querySelector('[data-testid="active-plans"]'),
		).not.toBeNull();

		// Plan entries carry the per-project href prefix
		const firstLink = container.querySelector(
			'[data-testid="active-plans"] a[data-plan-name="alpha"]',
		);
		expect(firstLink?.getAttribute("href")).toBe("/p/fixture-proj/plan/alpha");

		// Children slot receives what was passed
		expect(
			container.querySelector('[data-testid="child-marker"]'),
		).not.toBeNull();
	});
});
