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
 * from. Nothing is asked first, no project is needed, and nothing is created:
 * sending opens a conversation (`/api/new-projects`) and moves to it.
 *
 * promise: a-project-starts-as-a-conversation
 */
export function NewProjectStart() {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [documents, setDocuments] = useState<SentFile[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (files: FileList | null) => {
    if (!files) return;
    const read = await readFiles(Array.from(files));
    // A name given twice is one document: the later one.
    setDocuments((prev) => [
      ...prev.filter((d) => !read.some((r) => r.name === d.name)),
      ...read,
    ]);
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
            disabled={busy || message.trim() === ""}
          >
            {busy ? "Starting…" : "Start"}
          </Button>
        }
        hint={
          <p className="text-sm leading-3 text-ink-faint">
            Say it however you like — one sentence or a whole brief. The agent
            asks only what your idea leaves open, then proposes the project for
            you to accept. Nothing is created until you do.
          </p>
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
