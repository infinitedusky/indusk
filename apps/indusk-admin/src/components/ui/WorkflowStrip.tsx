import { Fragment, type HTMLAttributes } from "react";

/** How a planning document stands in this project: always kept, kept, or turned off. */
export type WorkflowDocumentState = "core" | "kept" | "off";

export interface WorkflowDocument {
  label: string;
  state: WorkflowDocumentState;
}

export interface WorkflowStripProps extends HTMLAttributes<HTMLDivElement> {
  /** The planning documents in order. */
  documents: readonly WorkflowDocument[];
}

const PILL: Record<WorkflowDocumentState, string> = {
  core: "bg-dusk-wash font-semibold text-ink",
  kept: "bg-dusk-wash text-ink",
  off: "bg-idle-wash text-ink-faint line-through",
};

/**
 * The planning documents in order, as a plan will write them: the core marked
 * in bold, a turned-off one struck through on the idle wash.
 */
export function WorkflowStrip({
  documents,
  className = "",
  ...rest
}: WorkflowStripProps) {
  return (
    <div
      data-component="workflow-strip"
      data-state="default"
      className={`flex flex-wrap items-center gap-2 text-sm leading-3 ${className}`}
      {...rest}
    >
      {documents.map((doc, index) => (
        <Fragment key={doc.label}>
          {index > 0 ? <span>→</span> : null}
          <span className={`rounded-pill px-3 py-1 ${PILL[doc.state]}`}>
            {doc.label}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
