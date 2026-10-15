"use client";

import { useEffect } from "react";
import { AGENT_WROTE } from "./SessionConnector";

/**
 * Where on the brief page a file the agent wrote is shown: a mockup or a
 * story is its look's row, a promise file its promise's row, the brief
 * itself the brief. Null for a file the page does not show.
 */
export function targetOf(file: string): string | null {
  const look =
    /\.indusk\/mockups\/[^/]+\/(?:screens|components)\/([^/]+)\.html$/.exec(
      file,
    );
  if (look) return `[data-look="${look[1]}"]`;
  const promise = /\.indusk\/promises\/([^/]+)\.md$/.exec(file);
  if (promise) return `[data-promise="${promise[1]}"]`;
  if (/\/brief\.md$/.test(file)) return '[data-document="brief"]';
  return null;
}

/** Tries for a few seconds: a look or promise the agent just made appears only once the page has refreshed. */
const TRIES = 12;
const EVERY_MS = 500;

/**
 * Follows the agent on the brief page: when it writes a look, a promise or
 * the brief, that part is opened, centred and marked for a moment, so the
 * person sees what it is working on without looking for it.
 */
export function FollowAgent() {
  useEffect(() => {
    let timer: number | undefined;
    const onWrote = (e: Event) => {
      const { file } = (e as CustomEvent<{ file: string }>).detail;
      const selector = targetOf(file);
      if (!selector) return;
      window.clearTimeout(timer);
      let tries = 0;
      const find = () => {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) {
          if (++tries < TRIES) timer = window.setTimeout(find, EVERY_MS);
          return;
        }
        for (
          let d = el.closest("details");
          d;
          d = d.parentElement?.closest("details") ?? null
        )
          d.open = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.dataset.followed = "true";
        window.setTimeout(() => delete el.dataset.followed, 2000);
      };
      find();
    };
    window.addEventListener(AGENT_WROTE, onWrote);
    return () => {
      window.removeEventListener(AGENT_WROTE, onWrote);
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}
