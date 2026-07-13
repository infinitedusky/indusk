import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { CollapsibleSection } from "./CollapsibleSection";

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

/**
 * T29 — `CollapsibleSection` accepts an optional `persistKey` prop. When set,
 *       the component reads its initial open/closed state from
 *       `localStorage[persistKey]` (fallback: `defaultOpen` when no stored
 *       value), and writes state back on every toggle so it survives page
 *       reloads.
 *
 * Tests run in the vitest browser runtime (real Chromium), which provides a
 * real `localStorage` — no mocking needed. We clear it between tests to
 * isolate fixtures.
 */

describe("CollapsibleSection — T29 persistKey (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to defaultOpen when persistKey is absent (regression guard)", async () => {
    const { container } = await render(
      <CollapsibleSection title="no-key" defaultOpen={true}>
        <span data-testid="no-key-child">content</span>
      </CollapsibleSection>,
    );
    // No persistKey → initial state comes from defaultOpen, body visible
    expect(
      container.querySelector('[data-testid="no-key-child"]'),
    ).not.toBeNull();
  });

  it("renders CLOSED when persistKey is set and localStorage[key] === '0', even if defaultOpen is true", async () => {
    localStorage.setItem("t29-closed-key", "0");
    const { container } = await render(
      <CollapsibleSection
        title="closed-key"
        defaultOpen={true}
        persistKey="t29-closed-key"
      >
        <span data-testid="closed-child">content</span>
      </CollapsibleSection>,
    );
    // Persisted "0" overrides defaultOpen=true
    expect(container.querySelector('[data-testid="closed-child"]')).toBeNull();
  });

  it("renders OPEN when persistKey is set and localStorage[key] === '1', even if defaultOpen is false", async () => {
    localStorage.setItem("t29-open-key", "1");
    const { container } = await render(
      <CollapsibleSection
        title="open-key"
        defaultOpen={false}
        persistKey="t29-open-key"
      >
        <span data-testid="open-child">content</span>
      </CollapsibleSection>,
    );
    expect(
      container.querySelector('[data-testid="open-child"]'),
    ).not.toBeNull();
  });

  it("writes the new state back to localStorage on toggle", async () => {
    const { container } = await render(
      <CollapsibleSection
        title="toggle-key"
        defaultOpen={false}
        persistKey="t29-toggle-key"
      >
        <span data-testid="toggle-child">content</span>
      </CollapsibleSection>,
    );
    // Start closed
    expect(localStorage.getItem("t29-toggle-key")).toBeNull();
    expect(container.querySelector('[data-testid="toggle-child"]')).toBeNull();

    // Click the header button to toggle open
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    button?.click();

    // React state updates are async — wait for the rerender
    await vi.waitFor(() => {
      expect(
        container.querySelector('[data-testid="toggle-child"]'),
      ).not.toBeNull();
    });
    expect(localStorage.getItem("t29-toggle-key")).toBe("1");

    // Toggle back closed
    button?.click();
    await vi.waitFor(() => {
      expect(
        container.querySelector('[data-testid="toggle-child"]'),
      ).toBeNull();
    });
    expect(localStorage.getItem("t29-toggle-key")).toBe("0");
  });
});

describe("CollapsibleSection — copyMarkdown", () => {
  it("does not render a copy button when copyMarkdown is omitted", async () => {
    const { container } = await render(
      <CollapsibleSection title="no-copy">
        <span>content</span>
      </CollapsibleSection>,
    );
    expect(container.querySelector('[data-testid="copy-button"]')).toBeNull();
  });

  it("copies the supplied markdown verbatim, without toggling the section", async () => {
    const writeText = stubClipboard();
    const { container } = await render(
      <CollapsibleSection
        title="Research"
        defaultOpen={false}
        copyMarkdown={"## Research\n\nSome research body."}
      >
        <span data-testid="research-child">content</span>
      </CollapsibleSection>,
    );

    const copyButton = container.querySelector(
      '[data-testid="copy-button"]',
    ) as HTMLButtonElement;
    expect(copyButton).not.toBeNull();
    copyButton.click();

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "## Research\n\nSome research body.",
      );
    });
    // Clicking the copy button must not toggle the section open.
    expect(
      container.querySelector('[data-testid="research-child"]'),
    ).toBeNull();
  });

  it("keeps the toggle button as the first <button> in the DOM (T29 querySelector regression guard)", async () => {
    const { container } = await render(
      <CollapsibleSection title="ordering" copyMarkdown={"## ordering\n\nbody"}>
        <span>content</span>
      </CollapsibleSection>,
    );
    const firstButton = container.querySelector("button");
    expect(firstButton?.getAttribute("aria-expanded")).not.toBeNull();
  });
});
