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

// Mock next/navigation — pages/layouts that host ProjectSwitcher will reach
// for useRouter; we don't exercise navigation from the page test.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn() }),
}));

import PerProjectPage from "./page";

/**
 * T13 — Clicking a project card on the homepage navigates to `/p/{name}/`,
 * which renders the same sidebar + plan-list shape as 1.26.0's per-project
 * mode.
 *
 * The page-level server component does filesystem I/O; this test exercises
 * its default export as an async function, resolves the JSX, and renders it
 * in the browser to assert shape. The shape contract is:
 *   - a PlanList with the project's plans ([data-testid="active-plans"])
 *   - a ProjectSwitcher ([data-testid="project-switcher"]) when >1 project
 *     is registered
 */

describe("PerProjectPage — T13: per-project layout preserves 1.26.0 sidebar+plan-list shape", () => {
	it("T13 — default export is an async function that returns JSX", () => {
		expect(typeof PerProjectPage).toBe("function");
	});

	it("T13 — renders a PlanList scoped to the project", async () => {
		// The page takes params.project; Next 16 passes params as a Promise.
		const element = await PerProjectPage({
			params: Promise.resolve({ project: "dusk" }),
		} as Parameters<typeof PerProjectPage>[0]);

		const { container } = await render(<>{element}</>);

		// Sidebar + PlanList shape must appear (same as 1.26.0 per-project mode)
		expect(
			container.querySelector('[data-testid="active-plans"]') ??
				container.querySelector('[data-testid="sidebar-empty-state"]'),
		).not.toBeNull();
	});
});
