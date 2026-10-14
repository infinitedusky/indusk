"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FileChip } from "@/components/ui/FileChip";
import { PromptBox } from "@/components/ui/PromptBox";
import { postJson } from "@/lib/post-json";
import { readFiles, type SentFile } from "./documents";

/**
 * New project (new-project-flow, the approved `new-project.start`): one box,
 * "What do you want to build?", and a way to add documents to write the brief
 * from. No project is needed and nothing is created: sending opens a
 * conversation (`/api/new-projects`) and moves to it.
 *
 * The one thing it can ask first is where new projects go (the approved
 * `new-project.no-parent`): with none set, the folder is asked for and saved
 * through the admin, Start waits for it, and no command is typed. With one set
 * it is shown with Change. `editing` opens the folder's field at once.
 *
 * promise: a-new-project-is-made-by-the-agent
 * promise: a-project-starts-as-a-conversation
 */
export function NewProjectStart({
  parent: savedParent,
  editing: openEditing = false,
}: {
  /** Where new projects go, or null when none is set. */
  parent: string | null;
  editing?: boolean;
}) {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [documents, setDocuments] = useState<SentFile[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [parent, setParent] = useState(savedParent);
  const [asking, setAsking] = useState(openEditing || savedParent === null);
  const [folder, setFolder] = useState(savedParent ?? "");

  const add = async (files: FileList | null) => {
    if (!files) return;
    const read = await readFiles(Array.from(files));
    // A name given twice is one document: the later one.
    setDocuments((prev) => [
      ...prev.filter((d) => !read.some((r) => r.name === d.name)),
      ...read,
    ]);
  };

  const saveParent = async () => {
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
    setParent(r.body.parent);
    setFolder(r.body.parent);
    setAsking(false);
  };

  const begin = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ id?: string }>("/api/new-projects", {
      message,
      documents,
    });
    setBusy(false);
    if (!r.ok || !r.body.id) {
      setProblem(r.ok ? "the admin opened no conversation" : r.error);
      return;
    }
    router.push(`/new/${r.body.id}`);
  };

  return (
    <>
      <PromptBox
        value={message}
        onChange={setMessage}
        onAdd={() => picker.current?.click()}
        attachments={
          documents.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {documents.map((d) => (
                <FileChip key={d.name}>{d.name}</FileChip>
              ))}
            </div>
          ) : undefined
        }
        actions={
          <Button
            onClick={() => void begin()}
            disabled={busy || parent === null || message.trim() === ""}
          >
            {busy ? "Starting…" : "Start"}
          </Button>
        }
        hint={
          <>
            {asking ? (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm leading-3 text-ink-soft">
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
                    onClick={() => void saveParent()}
                  >
                    Save
                  </Button>
                </div>
                <p className="text-sm leading-3 text-ink-faint">
                  InDusk makes new projects only inside this folder. You can
                  change it later.
                </p>
              </>
            ) : (
              <p className="flex flex-wrap items-center gap-2 text-sm leading-3 text-ink-soft">
                New projects go in
                <span className="font-mono text-xs leading-2 break-words text-ink-faint">
                  {parent}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAsking(true)}
                >
                  Change
                </Button>
              </p>
            )}
            <p className="text-sm leading-3 text-ink-faint">
              Say it however you like — one sentence or a whole brief. The agent
              asks only what your idea leaves open, then proposes the project
              for you to accept. Nothing is created until you do.
            </p>
          </>
        }
      />
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        aria-label="Documents to write the brief from"
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      {problem ? <p className="text-sm text-bad">{problem}</p> : null}
    </>
  );
}
