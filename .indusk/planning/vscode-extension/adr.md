---
title: "VS Code extension — promises in the editor, the break where the fix happens"
date: 2026-10-08
status: accepted
---

# VS Code extension — promises in the editor, the break where the fix happens

## Goal

**The developer's editor shows every promise at the line that keeps it, turns red within ten seconds of a break, and starts their own Claude on the fix in one click — reading health from the same one place the admin does.**

Today a production break is seen in Slack or the admin, and the fix starts with a person opening a terminal and describing the break to Claude. The admin computes promise health in its own app code, so any second window would compute it again and drift. After this plan, health is worked out once, in the package; the admin, `indusk promises health` and a VS Code extension read it; and the extension carries the break to Claude.

## Y-Statement

**In the context of:**
The demo's last act — a production break caught and fixed — and every developer who keeps promises in code. Promises are marked by a `promise: <name>` comment at the code that keeps them; their health per source (local, production) is read from Jaeger and the incident record, and today only the admin's Next.js app turns those reads into a state.

**Facing:**
A third window must not compute health a third way (A6, A7). The editor has to learn of a break within ten seconds (A8) without starting a Node process per read, it must never write to the project (A15), and it must reach production with the machine's stored credential, which only the package knows how to find.

**We decided for:**
Moving the health reader — `promise-health.ts` and its incremental mark store `promise-timeline.ts` — from the admin into the package as the `promises/health` subpath, imported by the admin unchanged in behaviour. A new CLI command, `indusk promises health --json [--every <seconds>]`, prints one JSON health read per line, once or on a cadence, from that reader. A new app, `apps/vscode-extension`, runs that command as one long-lived child process at five seconds and shows what each line says: end-of-line markers on token lines (found with the package's one token grammar, bundled), hovers, Problems entries, one notification per new break, and a "Fix with Claude" code action that opens a VS Code terminal in the project running `claude` with the break's facts. The extension is bundled with esbuild, packaged as a `.vsix` with `@vscode/vsce`, shipped inside the npm package, and installed by `indusk editor install` into VS Code (`code`) and Cursor (`cursor`) when their CLIs are present.

**And against:**
The extension importing the package in-process (it would need the project's own Node modules, Jaeger readers and credential lookup inside VS Code's extension host, and a second copy of the store's cache per window). Reading the admin daemon over HTTP (the editor would show nothing unless the admin happens to run). Spawning `indusk promises status` every five seconds (a Node start per read, and prose to parse). A `--json` on `promises status` (its job is the watcher's report over a window; health is the per-promise state the admin shows). A VS Code fork. A Language Server (nothing here is a language).

**To achieve:**
One health, three windows that cannot disagree; a break on the developer's line within two reads; the fix started with the facts an incident records; nothing written by the editor.

**Accepting:**
Moving 700 lines out of the admin into the package and re-pointing four admin files at the subpath. A new app in the monorepo with its own build and a VS Code contract test in the system tier. A `.vsix` of a few hundred kilobytes inside the npm package. A long-lived `indusk` process per open VS Code window with InDusk.

**Because:**
The rule is one source of truth, several windows; the package is where the readers and the credential already live, and a CLI line stream is the narrowest boundary an editor can read without becoming a second reader. The extension then holds only presentation, which is what makes "only shows" true by construction.

## Context

- [Research](research.md): the token grammar in `lib/tokens.ts`; health computed in the admin over the package's `promises/*` readers; `promises status` prose only; VS Code 1.141 on this machine; the five defaults Sandy accepted.
- [Brief](brief.md): five promises; ten seconds at a five-second cadence (Sandy, 2026-10-08).
- [Test plan](test-plan.md): 16 assertions; A6/A7 decide where health lives, A8 the cadence, A15 "only shows".

## Decision

1. **`promises/health` in the package.** `apps/indusk-admin/src/lib/promise-health.ts` and `promise-timeline.ts` move to `apps/indusk-mcp/src/lib/promises/health.ts` and `store.ts`, exported as `@infinitedusky/indusk-mcp/promises/health`. The admin's four importers re-point; `readAdminRefreshMs` stays in the admin and is passed in. A single-definition pin (A7) refuses a second `healthOf` or `readHealth` under either app.
2. **`indusk promises health --json [--every <seconds>]`.** One JSON object per line: `{ at, sources: [{ name, ok, reason?, rows: [{ promise, state, lastHeld?, lastBroke?, symptom?, traceUrl?, tests[] }] }] }`. Without `--every`, one line and exit. With it, a line per read until killed; the store reads only what is new, as in the admin.
3. **`apps/vscode-extension`.** Activation on a workspace containing `.indusk/config.json`. A pure core (`core/`) — given a file's text, the registry, a health line and a clock, it returns markers, hovers, problems, notifications and the fix prompt — is where every `unit` row lives (A1–A4, A8–A10, A12, A13, A15). A thin VS Code layer (`extension.ts`) applies them: `TextEditorDecorationType` for end-of-line markers, a `HoverProvider`, a `DiagnosticCollection`, `showWarningMessage` once per new break, a `CodeActionProvider` for "Fix with Claude", which runs `window.createTerminal({ cwd: projectRoot })` and `terminal.sendText('claude "<prompt>"')` after checking `claude` is on PATH.
4. **Token lines from the package's grammar.** The extension bundles `lib/tokens.ts` (pure, no Node I/O) rather than spelling the pattern again; a test-file token reads "proves", a code token "keeps", decided by the registry's `tests:` paths.
5. **Packaging and install.** `pnpm --filter vscode-extension package` builds `dist/indusk.vsix`; the indusk-mcp `prepublishOnly` copies it to `editor/indusk.vsix` in the package (in `files`). `indusk editor install` runs `code --install-extension <vsix> --force` and `cursor --install-extension …` for each CLI found, and says which it installed into.
6. **Nothing written.** The extension's only side effects are the child process, VS Code UI and a terminal; it never calls a file-writing API. A15 checks the project's files after a full session of the core and the fix action.

## Alternatives Considered

### The extension imports the package in-process
It would run Jaeger reads and the credential lookup inside VS Code's extension host, resolving the package from wherever the project has it, with its own cache per window. Rejected: the dependency is the project's, not the editor's, and a CLI already resolves exactly the right install.

### Read the admin daemon's API
The admin polls already. Rejected: the editor would be blank whenever the admin is not running, and a server becomes a dependency of a text editor.

### Spawn `promises status` per read
Rejected: a Node start every five seconds, and prose to parse.

### A Language Server
Rejected: no language features are involved; decorations, diagnostics and code actions are plain extension APIs.

## Consequences

### Positive
- Health is defined once; the admin, the CLI and the editor cannot disagree.
- The extension is presentation only, testable as pure functions.
- `promises health --json` is useful on its own (scripts, other editors).

### Negative
- A larger move inside the admin than the editor itself needs.
- One `indusk` process per open window.

### Risks
- **VS Code API changes.** Mitigation: A16 in the system tier; the extension pins `engines.vscode`.
- **The child process dies.** Mitigation: the core treats a missing line past two cadences as "not reading" (A10's rule), and the extension restarts the child once, then says so.

## Documentation Plan

### Pages
- New: `guide/promises-in-your-editor.md` — install, what the markers mean, the fix action.
- New: `reference/cli/editor.md` — `indusk editor install`.
- Update: `reference/cli/promises.md` — `promises health --json`, its line shape.
- Update: `reference/admin-ui/promises.md` — health comes from the package's `promises/health`.

### Diagrams
- One Mermaid sequence in the guide: break → Jaeger → `promises health` line → marker → Fix with Claude → terminal.

### Changelog
- Added: the VS Code extension, `indusk editor install`, `indusk promises health --json`.
- Changed: promise health moves from the admin to the package.

### ADR in Docs
- Yes: `decisions/vscode-extension.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- [promise-timeline](../archive/promise-timeline/brief.md), [promise-sources](../archive/promise-sources/brief.md), [server-provisioning](../archive/server-provisioning/brief.md)
- VS Code extension API: decorations, `languages.createDiagnosticCollection`, `languages.registerCodeActionsProvider`, `window.createTerminal`
