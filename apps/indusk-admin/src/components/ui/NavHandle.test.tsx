// promise: the-nav-widens-by-dragging
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { NavHandle } from "./NavHandle";

describe("NavHandle — keyboard steps", () => {
  it("arrows step the width by 16 px, held between its ends; Home and End go to them", async () => {
    const onResize = vi.fn();
    const onResizeEnd = vi.fn();
    const screen = await render(
      <NavHandle
        value={300}
        min={280}
        max={320}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
      />,
    );
    screen.getByRole("separator").element().focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onResize).toHaveBeenLastCalledWith(316);
    await userEvent.keyboard("{ArrowLeft}");
    expect(onResize).toHaveBeenLastCalledWith(284);
    await userEvent.keyboard("{Home}");
    expect(onResize).toHaveBeenLastCalledWith(280);
    await userEvent.keyboard("{End}");
    expect(onResizeEnd).toHaveBeenLastCalledWith(320);
  });

  it("a step past an end stops at it", async () => {
    const onResize = vi.fn();
    const screen = await render(
      <NavHandle value={312} min={280} max={320} onResize={onResize} />,
    );
    screen.getByRole("separator").element().focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onResize).toHaveBeenLastCalledWith(320);
  });

  it("states what it is: a vertical separator with its value and ends", async () => {
    const screen = await render(<NavHandle value={300} min={280} max={440} />);
    const handle = screen.getByRole("separator").element();
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-valuenow")).toBe("300");
    expect(handle.getAttribute("aria-valuemin")).toBe("280");
    expect(handle.getAttribute("aria-valuemax")).toBe("440");
  });
});

describe("A15 — a drag the browser cancels ends the drag", () => {
  const press = (el: HTMLElement, type: string, x: number, buttons = 0) =>
    el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        isPrimary: true,
        clientX: x,
        clientY: 0,
        buttons,
      }),
    );

  for (const ending of ["pointercancel", "lostpointercapture"]) {
    it(`A15 ${ending} stops dragging, keeps the width reached, and a later move resizes nothing`, async () => {
      const onResize = vi.fn();
      const onResizeEnd = vi.fn();
      const screen = await render(
        <NavHandle
          value={300}
          min={280}
          max={440}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
        />,
      );
      const handle = screen.getByRole("separator").element() as HTMLElement;
      press(handle, "pointerdown", 100, 1);
      press(handle, "pointermove", 140, 1);
      expect(onResize).toHaveBeenLastCalledWith(340);
      await vi.waitFor(() =>
        expect(handle.getAttribute("data-state")).toBe("dragging"),
      );

      press(handle, "pointermove", 140, 1);
      press(handle, ending, 140);
      await vi.waitFor(() =>
        expect(handle.getAttribute("data-state")).toBe("default"),
      );
      expect(onResizeEnd).toHaveBeenCalledTimes(1);
      expect(onResizeEnd).toHaveBeenLastCalledWith(340);

      onResize.mockClear();
      press(handle, "pointermove", 220);
      expect(onResize).not.toHaveBeenCalled();
    });
  }
});
