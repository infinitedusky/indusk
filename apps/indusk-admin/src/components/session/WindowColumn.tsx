"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * A column that ends at the window's bottom edge, wherever it starts: it
 * sticks to the top as the page scrolls and is as tall as the window below
 * its top, so the agent's input is always on screen while the brief scrolls
 * beside it. Measured, because the page above it (the admin's bar, the
 * plan's header) is not a fixed height.
 */
export function WindowColumn({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const top = Math.max(0, el.getBoundingClientRect().top);
      el.style.height = `${window.innerHeight - top}px`;
    };
    fit();
    window.addEventListener("scroll", fit, { passive: true });
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
    };
  }, []);
  return (
    <aside
      ref={ref}
      className={`sticky top-0 flex min-w-0 flex-col self-start overflow-hidden ${className}`}
      {...rest}
    >
      {children}
    </aside>
  );
}
