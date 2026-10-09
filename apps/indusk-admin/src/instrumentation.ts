/**
 * The admin daemon records production breaks (incident-recording, ADR D2).
 *
 * Next calls `register()` once when the server starts, so the recorder runs
 * while the daemon runs — with no page open — and ends when `indusk ui stop`
 * ends the process. One loop per registered project that names a production
 * source (`promises.jaeger`), every `admin.refresh_ms`; each pass is the
 * package's one writer, `recordBreaks`. The admin composes; it writes nothing
 * itself.
 *
 * promise: a-production-break-is-recorded-unasked
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const flag = Symbol.for("indusk.admin.recorder");
  const g = globalThis as Record<symbol, unknown>;
  if (g[flag]) return;
  g[flag] = true;

  const [
    { startRecorderLoops },
    { recordBreaks },
    { sourceNames },
    { readRegistryProjects },
    { readAdminRefreshMs },
  ] = await Promise.all([
    import("@infinitedusky/indusk-mcp/admin/recorder-loop"),
    import("@infinitedusky/indusk-mcp/promises/record"),
    import("@infinitedusky/indusk-mcp/promises/sources"),
    import("./lib/registry-client"),
    import("./lib/project-reader"),
  ]);

  startRecorderLoops({
    projects: () => readRegistryProjects().map((p) => p.path),
    hasProduction: (root) => sourceNames(root).includes("production"),
    intervalFor: readAdminRefreshMs,
    record: (root) => recordBreaks(root, { by: "admin", source: "deployed" }),
  });
}
