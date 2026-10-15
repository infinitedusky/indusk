// promise: technical-detail-opens-on-request
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { PhaseItems } from "./PhaseItems";

const items = [
  {
    checked: false,
    text: "Placing a component puts your words in place",
    detail:
      '`compose` walks each path.\n\n```ts\ncompose(snapshot, { title: "Create project" })\n```',
  },
];

describe("PhaseItems", () => {
  it("shows the sentence and keeps the detail closed until opened", async () => {
    const { container } = await render(<PhaseItems items={items} />);
    const fold = container.querySelector("details") as HTMLDetailsElement;
    expect(container.textContent).toContain("Placing a component");
    expect(fold.open).toBe(false);
    fold.querySelector("summary")?.click();
    expect(fold.open).toBe(true);
    expect(fold.querySelector("pre code")?.textContent).toContain(
      "compose(snapshot",
    );
    expect(fold.querySelector("code")?.textContent).toBe("compose");
    expect(container.textContent).not.toMatch(/<\/?(details|summary)/);
  });
});
