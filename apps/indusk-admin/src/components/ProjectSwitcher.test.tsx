import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// Stub next/navigation's useRouter — the switcher calls router.push on change.
const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));

import { ProjectSwitcher } from "./ProjectSwitcher";

/**
 * T14 — A header dropdown switches between any two registered projects
 * without restarting the daemon; the page navigates to the selected
 * project's /p/{name}/ route.
 *
 * Component-level contract:
 *   - renders a <select> (or equivalent) with one <option> per project
 *   - the current project is marked as selected
 *   - changing the selection calls router.push(`/p/${name}/`)
 */

interface Entry {
  name: string;
}

describe("ProjectSwitcher — T14: select changes navigate to /p/{name}/", () => {
  it("T14 — renders one option per registered project, with the current one selected", async () => {
    const projects: Entry[] = [
      { name: "dusk" },
      { name: "numero" },
      { name: "chitin-sportsbook" },
    ];
    const { container } = await render(
      <ProjectSwitcher projects={projects} currentProject="numero" />,
    );

    const select = container.querySelector(
      '[data-testid="project-switcher"]',
    ) as HTMLSelectElement | null;
    expect(select).not.toBeNull();

    const options = Array.from(select?.querySelectorAll("option") ?? []).map(
      (o) => o.getAttribute("value"),
    );
    expect(options).toEqual(["dusk", "numero", "chitin-sportsbook"]);

    expect(select?.value).toBe("numero");
  });

  it("T14 — changing selection dispatches navigation to /p/{name}/", async () => {
    pushSpy.mockClear();
    const projects: Entry[] = [{ name: "dusk" }, { name: "numero" }];
    const { container } = await render(
      <ProjectSwitcher projects={projects} currentProject="dusk" />,
    );

    const select = container.querySelector(
      '[data-testid="project-switcher"]',
    ) as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    if (!select) throw new Error("unreachable");

    select.value = "numero";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(pushSpy).toHaveBeenCalledWith("/p/numero/");
  });

  it("T14 — omits the switcher entirely when only one project is registered", async () => {
    const { container } = await render(
      <ProjectSwitcher projects={[{ name: "dusk" }]} currentProject="dusk" />,
    );
    expect(
      container.querySelector('[data-testid="project-switcher"]'),
    ).toBeNull();
  });
});
