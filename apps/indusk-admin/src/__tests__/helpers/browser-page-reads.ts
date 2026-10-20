/**
 * Setup for the browser test project. A page under test opens its reads through
 * `@/lib/page-reads` and keeps its standings through `@/lib/standing-kept`; both import the
 * package's run-record readers, which import `node:child_process` and `node:fs` and cannot load
 * in Chromium. Here a page reads no process list and no landings, and every standing is read
 * fresh through the reader the test already mocks. A test that needs more mocks its own.
 */
import { vi } from "vitest";

vi.mock("@/lib/page-reads", () => {
  const reads = {
    alive: () => false,
    command: () => null,
    startTime: () => null,
    unreadable: () => false,
  };
  const reading = () => ({
    table: null,
    reads,
    landed: () => false,
    subjects: [] as string[],
    counts: {
      processReads: 0,
      landingReads: 0,
      refreshedEarly: [] as boolean[],
      readings: [] as Array<{ ageMs: number; windowMs: number }>,
      repositories: 0,
    },
  });
  const page = () => ({ reads: async () => reading(), finish: () => {} });
  return {
    __esModule: true,
    latestReading: () => ({ table: null, reads, landed: () => false }),
    readPageReads: async () => reading(),
    readProcessReads: async () => reads,
    startPage: page,
    startPageFor: page,
    withPageContext: <T>(fn: () => Promise<T>) => fn(),
  };
});

vi.mock("@/lib/standing-kept", () => ({
  __esModule: true,
  STALE_FOR_MS: 60_000,
  standingKept: <T>(_key: string, read: () => Promise<T>) => read(),
  resetStandingKept: () => {},
}));
