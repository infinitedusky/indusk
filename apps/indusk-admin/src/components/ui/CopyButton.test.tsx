import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { CopyButton } from "./CopyButton";

/**
 * Real Chromium (via vitest-browser-playwright) doesn't reliably grant
 * clipboard-write permission headless, so we stub `navigator.clipboard`
 * directly rather than asserting against the real OS clipboard.
 */
function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

describe("CopyButton", () => {
  beforeEach(() => {
    stubClipboard();
  });

  it("copies the supplied text on click", async () => {
    const writeText = stubClipboard();
    const { container } = await render(
      <CopyButton text={"## Heading\n\nBody text."} />,
    );

    const button = container.querySelector(
      '[data-testid="copy-button"]',
    ) as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();

    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("## Heading\n\nBody text.");
    });
  });

  it("shows a copied state briefly after a successful copy", async () => {
    const { container } = await render(<CopyButton text="text" />);
    const button = container.querySelector(
      '[data-testid="copy-button"]',
    ) as HTMLButtonElement;
    expect(button.getAttribute("data-copied")).toBe("false");

    button.click();
    await vi.waitFor(() => {
      expect(button.getAttribute("data-copied")).toBe("true");
    });
  });

  it("respects a custom data-testid for call sites that need to disambiguate", async () => {
    const { container } = await render(
      <CopyButton text="text" data-testid="copy-plan-button" />,
    );
    expect(
      container.querySelector('[data-testid="copy-plan-button"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="copy-button"]')).toBeNull();
  });
});
