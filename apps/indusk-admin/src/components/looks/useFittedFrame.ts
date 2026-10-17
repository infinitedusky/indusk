"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * The size a story's frame is fitted to (storybook-components ADR decision 6).
 * The admin serves its own Storybook, so the frame's document can be read: the
 * component is waited for, measured, and watched for changes of size — fonts
 * and images settle after the load. The frame's load can come before the page
 * hydrates, so the wait also starts on mount. A component that sizes itself by
 * the frame's own height would never settle, so the watch ends after a few
 * changes.
 */

export interface FittedSize {
  width: number;
  height: number;
}

/** The size a story's component takes at the frame's current width, padding included. */
function measure(frame: HTMLIFrameElement): FittedSize | null {
  const doc = frame.contentDocument;
  const el = doc?.querySelector("#storybook-root")?.firstElementChild;
  // `instanceof` would compare against this window's classes, not the frame's.
  if (!doc || !el) return null;
  // A component that fills its viewport (`min-height: 100vh`) is read at a
  // one-pixel viewport, synchronously and before any paint, so its own content
  // sets the height rather than the frame's last one.
  const previous = frame.style.height;
  frame.style.height = "1px";
  const r = el.getBoundingClientRect();
  const lead = leadingSpace(el);
  frame.style.height = previous;
  // The space before the component, taken on both sides. Not its own `left`:
  // a component aligned to the end (`justify-self-end`) sits at the frame's
  // far edge, so `right + left` would grow the frame by the frame's own width.
  return {
    width: Math.max(1, Math.ceil(r.width + 2 * lead)),
    height: Math.max(1, Math.ceil(r.bottom + r.top)),
  };
}

/**
 * The space a component aligned to the start would have before it: its
 * container's content edge plus its own left margin.
 */
function leadingSpace(el: Element): number {
  const view = el.ownerDocument.defaultView;
  const parent = el.parentElement;
  if (!view || !parent) return 0;
  const px = (v: string) => Number.parseFloat(v) || 0;
  const s = view.getComputedStyle(parent);
  return (
    parent.getBoundingClientRect().left +
    px(s.borderLeftWidth) +
    px(s.paddingLeft) +
    px(view.getComputedStyle(el).marginLeft)
  );
}

/** The component a story drew, once Storybook has drawn it. */
const drawnIn = (frame: HTMLIFrameElement | null) =>
  frame?.contentDocument?.querySelector("#storybook-root")?.firstElementChild;

export function useFittedFrame(
  ref: RefObject<HTMLIFrameElement | null>,
  enabled: boolean,
) {
  const [fitted, setFitted] = useState<FittedSize | null>(null);
  const watching = useRef<ResizeObserver | null>(null);
  const waiting = useRef<ReturnType<typeof setInterval> | null>(null);

  const refit = useCallback(() => {
    if (ref.current) setFitted(measure(ref.current));
  }, [ref]);

  const watch = useCallback(() => {
    watching.current?.disconnect();
    const el = drawnIn(ref.current);
    if (!el) return;
    let changes = 0;
    const observer = new ResizeObserver(() => {
      changes += 1;
      if (changes > 6) {
        observer.disconnect();
        return;
      }
      refit();
    });
    observer.observe(el);
    watching.current = observer;
  }, [ref, refit]);

  const start = useCallback(() => {
    if (waiting.current) clearInterval(waiting.current);
    let tries = 0;
    waiting.current = setInterval(() => {
      tries += 1;
      if (drawnIn(ref.current) || tries > 100) {
        if (waiting.current) clearInterval(waiting.current);
        refit();
        watch();
      }
    }, 50);
  }, [ref, refit, watch]);

  useEffect(() => {
    if (enabled) start();
    return () => {
      watching.current?.disconnect();
      if (waiting.current) clearInterval(waiting.current);
    };
  }, [enabled, start]);

  return { fitted, start, refit, forget: () => setFitted(null) };
}
