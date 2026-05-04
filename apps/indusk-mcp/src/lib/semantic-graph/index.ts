/**
 * Semantic graph — event-sourced bridge between CGC (structural) and
 * Graphiti (semantic overlay). See `.indusk/planning/cgc-graphiti-bridge/`
 * for the brief, ADR, and impl.
 */

// SCM-aware change-ID and ancestry helpers. The jj-only versions still live
// in `./jj.ts` as the jj-branch implementation; consumers that want
// rebase-survivable identity should reach for them directly. Public surface
// goes through `lib/scm`. `NotAJjRepoError` is no longer re-exported — it's
// an internal jj-mode detail.
export { getCurrentChangeId, getReachableChangeIds } from "../scm/index.js";
export type { AdapterRecord, SemanticGraphAdapter } from "./adapter.js";
export * from "./events.js";
export { isChangeReachable } from "./jj.js";
export { type LogReaderOptions, readAllEvents, readEvents } from "./log-reader.js";
export { LogWriter } from "./log-writer.js";
export * from "./paths.js";
export { type ReplayOptions, type ReplayResult, replay } from "./replay.js";
export { SemanticGraphClient, type SemanticGraphClientOptions } from "./runtime-client.js";
export { runSync, type SyncResult } from "./sync-engine.js";
