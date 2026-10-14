"use client";

import {
  type CreationStepId,
  type CreationStepState,
  stepLabel,
} from "@infinitedusky/indusk-mcp/new-project/steps";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { applyEvent, type CreationView, readCreation } from "./creation-stream";
import { NewProjectCreating } from "./NewProjectCreating";

const WAITING = (ids: readonly CreationStepId[]): CreationView["steps"] =>
  ids.map((id) => ({ id, state: "waiting" as CreationStepState }));

/**
 * A project being made, with the network it needs: it asks the accept route to
 * make the project, folds each step the route reports into what
 * `NewProjectCreating` draws, and ends with the way into the project - or with
 * why it stopped and what can be done (try again, or go back to the proposal).
 * A page opened after a run began (or failed) is given that run's `initial`
 * steps and `start={false}`; it asks for nothing until the person does.
 *
 * promise: a-new-project-is-made-by-the-agent
 */
export function NewProjectCreatingPanel({
  draft,
  name,
  location,
  stepIds,
  initial,
  initialProblem = null,
  start = true,
  onBack,
  backHref,
}: {
  draft: string;
  name: string;
  location: string;
  /** The steps this creation runs, in order. */
  stepIds: readonly CreationStepId[];
  /** Where each stood when the page was drawn; all waiting when absent. */
  initial?: CreationView["steps"];
  /** Why that run stopped, when it did. */
  initialProblem?: string | null;
  /** Make the project now; false for a run already past (it shows, and offers Try again). */
  start?: boolean;
  /** Back to editing the proposal, when the proposal is on this page. */
  onBack?: () => void;
  /** Back to editing the proposal, when the proposal is another page (a server page cannot pass a function). */
  backHref?: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<CreationView>({
    steps: initial ?? WAITING(stepIds),
    href: null,
    problem: initialProblem,
  });
  const [running, setRunning] = useState(false);
  const began = useRef(false);

  const make = useCallback(async () => {
    setRunning(true);
    // A page opened mid-run, or after a stop, shows this run again.
    window.history.replaceState(null, "", `/new/${draft}?creating=1`);
    setView({ steps: WAITING(stepIds), href: null, problem: null });
    try {
      const response = await fetch(`/api/new-projects/${draft}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      await readCreation(response, (event) =>
        setView((v) => applyEvent(v, event)),
      );
    } catch (err) {
      setView((v) =>
        applyEvent(v, { type: "error", message: (err as Error).message }),
      );
    } finally {
      setRunning(false);
    }
  }, [draft, stepIds]);

  useEffect(() => {
    if (!start || began.current) return;
    began.current = true;
    void make();
  }, [start, make]);

  const stopped = !running && view.problem !== null && view.href === null;
  return (
    <NewProjectCreating
      name={name}
      location={location}
      steps={view.steps.map((s) => ({
        label: stepLabel(s.id, s.state),
        state: s.state,
      }))}
      href={view.href ?? undefined}
      problem={view.problem}
      actions={
        stopped ? (
          <>
            <Button onClick={() => void make()}>Try again</Button>
            <Button
              variant="secondary"
              onClick={() => (backHref ? router.push(backHref) : onBack?.())}
            >
              Change the proposal
            </Button>
          </>
        ) : undefined
      }
    />
  );
}
