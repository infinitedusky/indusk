"use client";

import {
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  useRef,
  useState,
} from "react";

export interface NavHandleProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    | "onChange"
    | "onPointerDown"
    | "onPointerMove"
    | "onPointerUp"
    | "onPointerCancel"
    | "onLostPointerCapture"
    | "onKeyDown"
  > {
  /** The nav's width now, in px. */
  value: number;
  /** The narrowest the nav drags to (`--size-nav`), in px. */
  min: number;
  /** The widest the nav drags to (`--size-nav-max`), in px. */
  max: number;
  /** Called with each width the pointer or a key asks for, already held between `min` and `max`. */
  onResize?: (width: number) => void;
  /** Called with the width a drag or a key step ended on. */
  onResizeEnd?: (width: number) => void;
  /** What an arrow key moves the width by, in px. */
  step?: number;
  /** Draw the dragging state without a pointer holding it (a story, a test). */
  dragging?: boolean;
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/** The width a key asks for — arrows step, Home and End go to the ends — held between `min` and `max`; null for any other key. */
function widthForKey(
  key: string,
  value: number,
  min: number,
  max: number,
  step: number,
): number | null {
  if (key === "ArrowRight") return clamp(value + step, min, max);
  if (key === "ArrowLeft") return clamp(value - step, min, max);
  if (key === "Home") return min;
  if (key === "End") return max;
  return null;
}

/**
 * The nav's drag edge: a vertical separator a pointer drags to widen or narrow
 * the nav, and arrow keys step. It reports widths and draws nothing else, so
 * the frame decides what a width does. While a pointer holds it, it reads
 * `dragging`.
 */
export function NavHandle({
  value,
  min,
  max,
  onResize,
  onResizeEnd,
  step = 16,
  dragging: shown,
  className = "",
  ...rest
}: NavHandleProps) {
  const [held, setDragging] = useState(false);
  const dragging = shown ?? held;
  // A ref beside the state: a pointer's events arrive faster than a render.
  const holding = useRef(false);
  const from = useRef({ x: 0, width: value });
  const last = useRef(value);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    from.current = { x: e.clientX, width: value };
    last.current = value;
    holding.current = true;
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // a pointer the browser does not hold (a synthetic one) still drags
    }
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!holding.current) return;
    last.current = clamp(
      from.current.width + e.clientX - from.current.x,
      min,
      max,
    );
    onResize?.(last.current);
  };
  // Every way a drag ends — the pointer lifted, the browser cancelled it (a
  // touch turned into a scroll), or the capture was lost — ends it once.
  const endDrag = () => {
    if (!holding.current) return;
    holding.current = false;
    setDragging(false);
    onResizeEnd?.(last.current);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = widthForKey(e.key, value, min, max, step);
    if (next === null) return;
    e.preventDefault();
    onResize?.(next);
    onResizeEnd?.(next);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable, draggable window splitter; <hr> is neither
    <div
      data-component="nav-handle"
      data-state={dragging ? "dragging" : "default"}
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to widen the nav"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={onKeyDown}
      className={`group absolute inset-y-0 -right-1 z-1 grid w-2 cursor-col-resize touch-none place-items-center ${className}`}
      {...rest}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 border-l border-transparent group-data-[state=dragging]:border-l-2 group-data-[state=dragging]:border-dusk"
      />
      <span
        aria-hidden="true"
        className="relative h-8 w-1 rounded-pill bg-line group-hover:bg-idle group-focus-visible:bg-idle group-data-[state=dragging]:bg-dusk group-data-[state=dragging]:halo"
      />
    </div>
  );
}
