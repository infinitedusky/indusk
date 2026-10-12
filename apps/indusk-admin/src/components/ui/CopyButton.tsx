"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export interface CopyButtonProps {
  /**
   * Precomputed markdown to copy. Deliberately a plain string, not a
   * `() => string` thunk — this component renders inside Next.js Server
   * Components (e.g. `PlanDetail.tsx`), and functions can't cross the
   * server/client boundary as props. Assembly is cheap regex work, so
   * computing eagerly at the call site costs nothing.
   */
  text: string;
  /** Accessible label / tooltip. Defaults to "Copy as markdown". */
  label?: string;
  className?: string;
  /** Overrides the default `data-testid="copy-button"` for call sites that need to disambiguate. */
  "data-testid"?: string;
}

const COPIED_RESET_MS = 1500;

/**
 * Icon-only copy-to-clipboard button. Used both standalone (e.g. the
 * "copy whole plan" affordance) and embedded in section headers via
 * `CollapsibleSection`'s `copyMarkdown` prop.
 *
 * `stopPropagation` matters when nested inside a clickable header row —
 * without it, a click bubbles up and toggles the section instead of (or
 * in addition to) copying.
 */
export function CopyButton({
  text,
  label = "Copy as markdown",
  className = "",
  "data-testid": testId = "copy-button",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_RESET_MS);
      })
      .catch(() => {
        // Clipboard permission denied / unavailable — leave state untouched.
      });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      data-testid={testId}
      data-copied={copied}
      className={`inline-flex items-center justify-center rounded-md p-1 text-ink-faint transition-colors hover:bg-idle-wash hover:text-ink-soft focus:outline-2 focus:outline-dusk ${className}`}
    >
      {copied ? (
        <Check className="h-4 w-4 text-ok" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
