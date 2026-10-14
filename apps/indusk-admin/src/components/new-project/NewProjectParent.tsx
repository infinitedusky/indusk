"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * Where new projects go, on the start page (new-project-flow, the approved
 * `new-project.start` line and `new-project.no-parent` form): the folder with
 * Change when one is set; with none, "Where should new projects go?" and Save.
 * Saving goes through the admin (`/api/new-projects/parent`), so no command is
 * typed; `onSaved` hands the saved folder to the page that waits on it.
 *
 * promise: a-new-project-is-written-only-under-its-parent
 */
export function NewProjectParent({
  parent,
  editing = false,
  onSaved,
}: {
  /** The folder new projects go in, or null when none is set. */
  parent: string | null;
  /** Open the field at once, to change a folder that is set. */
  editing?: boolean;
  onSaved: (parent: string) => void;
}) {
  const [asking, setAsking] = useState(editing || parent === null);
  const [folder, setFolder] = useState(parent ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ parent?: string }>("/api/new-projects/parent", {
      parent: folder,
    });
    setBusy(false);
    if (!r.ok || !r.body.parent) {
      setProblem(r.ok ? "the admin saved no folder" : r.error);
      return;
    }
    setFolder(r.body.parent);
    setAsking(false);
    onSaved(r.body.parent);
  };

  if (!asking) {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm leading-3 text-ink-soft">
        New projects go in
        <span className="font-mono text-xs leading-2 break-words text-ink-faint">
          {parent}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setAsking(true)}>
          Change
        </Button>
      </p>
    );
  }
  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 text-sm leading-3 text-ink-soft"
        data-look-state="new-project.no-parent"
      >
        <label htmlFor="new-project-parent">
          Where should new projects go?
        </label>
        <input
          id="new-project-parent"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-tight text-ink"
          placeholder="~/code"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={busy || folder.trim() === ""}
          onClick={() => void save()}
        >
          Save
        </Button>
      </div>
      <p className="text-sm leading-3 text-ink-faint">
        InDusk makes new projects only inside this folder. You can change it
        later.
      </p>
      {problem ? <p className="text-sm text-bad">{problem}</p> : null}
    </>
  );
}
