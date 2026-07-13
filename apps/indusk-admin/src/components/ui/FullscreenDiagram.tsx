"use client";

import { Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import createPanZoom, { type PanZoom } from "panzoom";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface FullscreenDiagramProps {
  children: ReactNode;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

/**
 * Wraps a rendered diagram with an expand button that opens a fullscreen
 * modal with pan/zoom. React port of the docs site's Vue component
 * (`apps/docs/src/.vitepress/components/FullscreenDiagram.vue`) — same
 * `panzoom` library, same UX: plain wheel pans, Cmd/Ctrl+wheel zooms,
 * unbounded panning (a bounded box silently blocks panning once the
 * diagram roughly fills the modal — Figma/Miro convention is unbounded).
 *
 * The inline diagram is always rendered (so Mermaid only draws once); on
 * expand, its current innerHTML is cloned into the modal and panzoom
 * attaches to the cloned SVG. Portal to `document.body` mirrors Vue's
 * `<Teleport to="body">` — keeps the modal out of any clipping/overflow
 * ancestor in the plan detail layout.
 */
export function FullscreenDiagram({ children }: FullscreenDiagramProps) {
  const [expanded, setExpanded] = useState(false);
  const [diagramHtml, setDiagramHtml] = useState("");
  const [zoomPct, setZoomPct] = useState(100);
  const inlineRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const panzoomRef = useRef<PanZoom | null>(null);

  const toggle = () => {
    if (!expanded) setDiagramHtml(inlineRef.current?.innerHTML ?? "");
    setExpanded((e) => !e);
  };

  useEffect(() => {
    if (!expanded) return;
    document.body.style.overflow = "hidden";

    const svgElement = expandedRef.current?.querySelector("svg");
    let instance: PanZoom | null = null;
    if (svgElement) {
      instance = createPanZoom(svgElement, {
        bounds: false,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        beforeWheel(e) {
          if (e.ctrlKey || e.metaKey) return false; // let panzoom zoom
          e.preventDefault();
          instance?.moveBy(-e.deltaX, -e.deltaY, false);
          return true; // plain wheel pans instead of panzoom's default zoom
        },
      });
      panzoomRef.current = instance;
      instance.on("zoom", () => {
        setZoomPct(
          Math.round((panzoomRef.current?.getTransform().scale ?? 1) * 100),
        );
      });
    }

    return () => {
      document.body.style.overflow = "";
      instance?.dispose();
      panzoomRef.current = null;
      setZoomPct(100);
    };
  }, [expanded]);

  const zoomIn = () => {
    const inst = panzoomRef.current;
    if (inst && inst.getTransform().scale < MAX_ZOOM)
      inst.smoothZoom(0, 0, 1.1);
  };
  const zoomOut = () => {
    const inst = panzoomRef.current;
    if (inst && inst.getTransform().scale > MIN_ZOOM)
      inst.smoothZoom(0, 0, 0.9);
  };
  const resetZoom = () => {
    panzoomRef.current?.zoomAbs(0, 0, 1);
    panzoomRef.current?.moveTo(0, 0);
  };

  return (
    <div className="relative w-full" data-testid="fullscreen-diagram">
      <div
        ref={inlineRef}
        className="rounded-lg border border-gray-200 bg-gray-50 p-4"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={toggle}
        title="Expand"
        aria-label="Expand diagram"
        className="absolute right-2 top-2 rounded border border-gray-200 bg-white p-1.5 text-gray-600 opacity-90 hover:bg-gray-50 hover:opacity-100"
      >
        <Maximize2 className="h-4 w-4" aria-hidden />
      </button>

      {expanded &&
        createPortal(
          <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/85">
            <div className="relative flex h-[95vh] w-[95vw] flex-col rounded-lg bg-white p-6">
              <div className="flex flex-1 items-center justify-center overflow-hidden">
                <div
                  ref={expandedRef}
                  className="cursor-move [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-[90%] [&_svg]:min-w-[600px] [&_svg]:max-w-[90%]"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: cloning our own already-rendered Mermaid SVG, not user-supplied HTML.
                  dangerouslySetInnerHTML={{ __html: diagramHtml }}
                />
              </div>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={zoomPct <= MIN_ZOOM * 100}
                  title="Zoom Out"
                  aria-label="Zoom out"
                  className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <span
                  className="min-w-16 text-center text-sm text-gray-500"
                  data-testid="zoom-level"
                >
                  {zoomPct}%
                </span>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={zoomPct >= MAX_ZOOM * 100}
                  title="Zoom In"
                  aria-label="Zoom in"
                  className="rounded p-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={resetZoom}
                  title="Reset Zoom"
                  aria-label="Reset zoom"
                  className="rounded p-1 text-gray-600 hover:bg-gray-100"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <button
                type="button"
                onClick={toggle}
                title="Close"
                aria-label="Close"
                className="absolute right-4 top-4 rounded border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
