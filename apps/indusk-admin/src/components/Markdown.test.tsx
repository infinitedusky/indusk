import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// Markdown renders ```mermaid blocks through <Mermaid>, which initializes the
// mermaid library on import. Stub it: this test is about HTML handling, not
// diagrams. Mocked from the module Markdown actually imports it from.
vi.mock("@/components/Mermaid", () => ({
  Mermaid: () => null,
}));

import { Markdown } from "./Markdown";

const DETAILS_DOC = `Narrative paragraph.

<details>
<summary>Technical</summary>

Inside the fold, with \`code\` and **bold**.

</details>
`;

describe("Markdown — inline HTML", () => {
  it("renders <details>/<summary> as a real disclosure, not literal text", async () => {
    const { container } = await render(<Markdown>{DETAILS_DOC}</Markdown>);

    const details = container.querySelector("details");
    const summary = container.querySelector("details > summary");
    expect(details, "a <details> element exists").not.toBeNull();
    expect(summary?.textContent).toBe("Technical");

    // The markdown between the tags is still markdown: the fold's body has
    // an inline <code> and a <strong>, and the raw tag text never appears.
    expect(details?.querySelector("code")?.textContent).toBe("code");
    expect(details?.querySelector("strong")?.textContent).toBe("bold");
    expect(container.textContent).not.toContain("<details>");
    expect(container.textContent).not.toContain("<summary>");
  });

  it("strips unsafe HTML while keeping the fold", async () => {
    const { container } = await render(
      <Markdown>{`<details><summary>S</summary>\n\n<script>window.pwned = 1</script>\n\n<img src=x onerror="window.pwned = 1">ok\n\n</details>`}</Markdown>,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("onerror")).toBeNull();
    expect(container.querySelector("details > summary")?.textContent).toBe("S");
    expect((window as unknown as { pwned?: number }).pwned).toBeUndefined();
  });

  it("still renders a plain document with no HTML unchanged", async () => {
    const { container } = await render(
      <Markdown>{"# Title\n\nA [link](https://x.test)."}</Markdown>,
    );
    expect(container.querySelector("h1")?.textContent).toBe("Title");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://x.test",
    );
  });
});
