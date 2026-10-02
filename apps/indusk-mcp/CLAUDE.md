# indusk-mcp — rules for working in this package

Loaded by Claude Code when a file under `apps/indusk-mcp/` is read. Rules that
apply only here; cross-cutting design intent stays in the root `CLAUDE.md`.

- `lib/tokens.ts` is the one token grammar for the promise and lesson tokens; a
  new token kind is added there, never as a second pattern. The file that
  documents a marker must not spell one out — the scanner reads it as a
  citation, and refused this package's own docblock the day the grammar moved.
