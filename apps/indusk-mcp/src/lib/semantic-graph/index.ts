/**
 * Semantic graph — event-sourced bridge between CGC (structural) and
 * Graphiti (semantic overlay). See `.indusk/planning/cgc-graphiti-bridge/`
 * for the brief, ADR, and impl.
 */

export * from "./events.js";
export { type LogReaderOptions, readAllEvents, readEvents } from "./log-reader.js";
export { LogWriter } from "./log-writer.js";
export * from "./paths.js";
