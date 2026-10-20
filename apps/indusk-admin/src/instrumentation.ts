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
    { drainPlanWriteDecisions },
    { sourceNames },
    { readRegistryProjects },
    { readAdminRefreshMs },
    { writeScanRecord, recordPassOutcome },
    { warmProject },
  ] = await Promise.all([
    import("@infinitedusky/indusk-mcp/admin/recorder-loop"),
    import("@infinitedusky/indusk-mcp/promises/record"),
    import("@infinitedusky/indusk-mcp/promises/clause-verdicts"),
    import("@infinitedusky/indusk-mcp/promises/sources"),
    import("./lib/registry-client"),
    import("./lib/project-reader"),
    import("@infinitedusky/indusk-mcp/admin/scan-record"),
    import("@infinitedusky/indusk-mcp/run-record"),
  ]);

  // Each project's shared git directory is found now, off any request, so the readers that ask for
  // it synchronously beneath a page or this loop are answered from what is found (decision 11).
  for (const project of readRegistryProjects()) void warmProject(project.path);

  startRecorderLoops({
    projects: () => readRegistryProjects().map((p) => p.path),
    hasProduction: (root) => sourceNames(root).includes("production"),
    intervalFor: readAdminRefreshMs,
    // Each pass's start, end and outcome, in machine state: the patient recorder
    // landing test reads it to know the admin has scanned since a break was loaded.
    scanRecord: writeScanRecord,
    // A pass whose production read failed resolves with `error`: not a finished scan (A102).
    outcomeOf: recordPassOutcome,
    // Each tick also judges the shell guard's recorded decisions
    // (a-run-can-be-trusted, Decision 8); best-effort, it never fails a pass.
    record: async (root) => {
      await warmProject(root);
      await drainPlanWriteDecisions(root);
      return recordBreaks(root, { by: "admin", source: "deployed" });
    },
  });
}
