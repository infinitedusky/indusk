"use client";

import {
  DOCUMENT_LABELS,
  WORKFLOW_DEFINITIONS,
  WORKFLOW_TYPES,
  type WorkflowType,
} from "@infinitedusky/indusk-mcp/workflow-types";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";

/**
 * What kind of plan this is, and — on click — what that kind means
 * (admin-plan-type).
 *
 * Three readings, kept apart: a declared type; "type not declared"; and a
 * declared word that is not a type, shown as it was written. The page never
 * guesses a type from which documents exist.
 *
 * Every fact in the explanation comes from the package's `workflow-types`
 * module — what a type is for, what it requires, what it skips and why. This
 * component states no document list of its own: the planner skill's table and
 * the workflow templates are pinned to that module, and a list written here
 * would be the fourth copy and the first to drift.
 *
 * The explanation is a native `<dialog>`: it traps focus, closes on Escape
 * and returns focus to the chip without a library.
 */
export function PlanTypeChip({
  workflow,
  declared = null,
}: {
  workflow: WorkflowType | null;
  /** The word that was declared, when it is not one of the types. */
  declared?: string | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const unrecognised = workflow === null && declared !== null;
  const label =
    workflow ??
    (unrecognised
      ? `"${declared}" — not a recognised type`
      : "type not declared");
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        data-testid="plan-type-chip"
        data-workflow={workflow ?? ""}
        aria-haspopup="dialog"
        title="What this type of plan requires"
        onClick={() => dialog.current?.showModal()}
        className={`rounded-full border px-2 py-0.5 text-xs ${
          workflow === null
            ? "border-dotted border-gray-400 italic text-gray-500"
            : "border-gray-300 text-gray-700"
        }`}
      >
        {label}
      </Button>
      <dialog
        ref={dialog}
        data-testid="plan-type-dialog"
        aria-label="Plan type"
        className="m-auto max-w-md rounded-lg border border-gray-200 p-5 text-sm text-gray-800 shadow-xl backdrop:bg-gray-900/40"
      >
        {workflow === null ? (
          <Undeclared declared={unrecognised ? declared : null} />
        ) : (
          <Declared workflow={workflow} />
        )}
        <div className="mt-4 flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            data-testid="plan-type-dialog-close"
            onClick={() => dialog.current?.close()}
          >
            Close
          </Button>
        </div>
      </dialog>
    </>
  );
}

function Declared({ workflow }: { workflow: WorkflowType }) {
  const definition = WORKFLOW_DEFINITIONS[workflow];
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-gray-900">{workflow}</h2>
      <p>{definition.purpose}</p>
      <DocumentList
        testId="plan-type-requires"
        heading="Requires"
        documents={definition.requires}
        empty="Nothing."
      />
      <DocumentList
        testId="plan-type-skips"
        heading="Skips"
        documents={definition.skips}
        empty="Nothing — every document is written."
      />
      <p data-testid="plan-type-why" className="text-gray-600">
        {definition.why}
      </p>
    </div>
  );
}

function DocumentList({
  testId,
  heading,
  documents,
  empty,
}: {
  testId: string;
  heading: string;
  documents: readonly (keyof typeof DOCUMENT_LABELS)[];
  empty: string;
}) {
  return (
    <div data-testid={testId}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {heading}
      </h3>
      <p>
        {documents.length === 0
          ? empty
          : documents.map((d) => DOCUMENT_LABELS[d]).join(", ")}
      </p>
    </div>
  );
}

function Undeclared({ declared }: { declared: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-gray-900">
        {declared === null ? "Type not declared" : "Not a recognised type"}
      </h2>
      {declared === null ? (
        <p>
          This plan&apos;s brief has no <code>workflow:</code> line, so the page
          cannot tell a document the plan never needed from one it should have
          had. Absent documents it has moved past read <em>unknown</em>.
        </p>
      ) : (
        <p>
          This plan declares <code>workflow: {declared}</code>, which is not one
          of the plan types, so it is treated as having none. Absent documents
          it has moved past read <em>unknown</em>.
        </p>
      )}
      <p className="text-gray-600">
        Declare one in the brief&apos;s frontmatter:{" "}
        <code>workflow: {WORKFLOW_TYPES.join(" | ")}</code>.
      </p>
    </div>
  );
}
