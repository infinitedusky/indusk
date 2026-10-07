"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

const TYPES = ["feature", "bugfix", "refactor", "spike"] as const;

/**
 * New plan (admin-plan-authoring A1): a type and a name. The plan starts on
 * its own branch and worktree and its planning session begins; the page then
 * moves to the plan, where the conversation runs.
 *
 * In a workbench wrapping more than one repo, the form also asks which repo
 * the plan's code goes in (workbench-plan-authoring A9); with one repo, or
 * in a normal-mode project, it asks nothing.
 */
export function NewPlanForm({
  project,
  repos = [],
}: {
  project: string;
  /** The workbench's declared repos; empty in a normal-mode project. */
  repos?: string[];
}) {
  const router = useRouter();
  const [type, setType] = useState<string>("feature");
  const [name, setName] = useState("");
  const asksRepo = repos.length > 1;
  const [repo, setRepo] = useState<string>(repos[0] ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ plan?: string }>("/api/plans", {
      project,
      type,
      name,
      ...(asksRepo ? { repo } : {}),
    });
    setBusy(false);
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    router.push(`/p/${project}/plan/${r.body.plan}`);
  };

  return (
    <form
      className="flex flex-col gap-2 rounded border border-gray-200 bg-white p-4 text-left text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
    >
      <h2 className="font-semibold text-gray-800">New plan</h2>
      <label className="flex flex-col gap-1">
        <span className="text-gray-600">Type</span>
        <select
          className="rounded border border-gray-300 px-2 py-1"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-gray-600">Name</span>
        <input
          className="rounded border border-gray-300 px-2 py-1 font-mono"
          value={name}
          placeholder="kebab-case-name"
          onChange={(e) => setName(e.target.value.trim())}
        />
      </label>
      {asksRepo ? (
        <label className="flex flex-col gap-1">
          <span className="text-gray-600">Repo</span>
          <select
            className="rounded border border-gray-300 px-2 py-1"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
          >
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {problem ? <p className="text-red-700">{problem}</p> : null}
      <Button
        type="submit"
        disabled={busy || !/^[a-z0-9][a-z0-9-]*$/.test(name)}
      >
        {busy ? "Starting…" : "Start planning"}
      </Button>
    </form>
  );
}
