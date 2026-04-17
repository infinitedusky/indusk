/**
 * Semantic graph — event-sourced bridge between CGC (structural) and
 * Graphiti (semantic overlay). See `.indusk/planning/cgc-graphiti-bridge/`
 * for the brief, ADR, and impl.
 */

export type { AdapterRecord, SemanticGraphAdapter } from "./adapter.js";
export * from "./events.js";
export {
	getCurrentChangeId,
	getReachableChangeIds,
	isChangeReachable,
	NotAJjRepoError,
} from "./jj.js";
export { type LogReaderOptions, readAllEvents, readEvents } from "./log-reader.js";
export { LogWriter } from "./log-writer.js";
export * from "./paths.js";
export { type ReplayOptions, type ReplayResult, replay } from "./replay.js";
export { SemanticGraphClient, type SemanticGraphClientOptions } from "./runtime-client.js";
export { runSync, type SyncResult } from "./sync-engine.js";
