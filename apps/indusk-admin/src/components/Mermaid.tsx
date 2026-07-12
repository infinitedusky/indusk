"use client";

import mermaid from "mermaid";
import { useEffect, useId, useRef, useState } from "react";
import { FullscreenDiagram } from "@/components/ui/FullscreenDiagram";

mermaid.initialize({ startOnLoad: false, theme: "neutral" });

export interface MermaidProps {
  source: string;
}

/**
 * Renders a ```mermaid fenced-code-block's source as an SVG diagram, wrapped
 * in `FullscreenDiagram` for zoom/pan — architecture diagrams in ADRs and
 * research docs are often too dense to read at inline size. Wired into
 * `Markdown.tsx`'s `code`/`pre` overrides.
 */
export function Mermaid({ source }: MermaidProps) {
  const renderId = useId().replace(/[^a-zA-Z0-9-]/g, "-");
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    mermaid
      .render(`mermaid-${renderId}`, source)
      .then(({ svg }) => {
        if (!cancelled && containerRef.current)
          containerRef.current.innerHTML = svg;
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [renderId, source]);

  if (error) {
    return (
      <pre
        className="overflow-x-auto whitespace-pre-wrap rounded bg-red-50 p-3 text-xs text-red-700"
        data-testid="mermaid-error"
      >
        Failed to render diagram: {error}
        {"\n\n"}
        {source}
      </pre>
    );
  }

  return (
    <FullscreenDiagram>
      <div ref={containerRef} data-testid="mermaid-diagram" />
    </FullscreenDiagram>
  );
}
