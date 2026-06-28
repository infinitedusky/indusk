/**
 * Semantic graph — event-sourced bridge between CGC (structural) and
 * Graphiti (semantic overlay). See `.indusk/planning/archive/cgc-graphiti-bridge/`
 * for the brief, ADR, and impl. git-only as of 1.31.0 (git-only-substrate).
 */

// Change-ID and ancestry helpers (git short SHA based). The SCM abstraction
// went away in `git-only-substrate` Phase 4 — `lib/scm/index.ts` is the
// single source.
export { getCurrentChangeId, getReachableChangeIds } from "../scm/index.js";
export type { AdapterRecord, SemanticGraphAdapter } from "./adapter.js";
export * from "./events.js";
export { type LogReaderOptions, readAllEvents, readEvents } from "./log-reader.js";
export { LogWriter } from "./log-writer.js";
export * from "./paths.js";
export { type ReplayOptions, type ReplayResult, replay } from "./replay.js";
export { SemanticGraphClient, type SemanticGraphClientOptions } from "./runtime-client.js";
export { runSync, type SyncResult } from "./sync-engine.js";
