# Quarantine damaged state instead of silently overwriting it

# Quarantine damaged state instead of silently overwriting it

When a file/record/resource fails to parse or validate, the instinct is to "return a clean default and move on." Fine for reads. **Catastrophic for anything that later triggers a write**, because the write path then cleanly overwrites the damaged state with the clean default — and the original data is gone, with no warning, no backup, no recovery path.

## What goes wrong

`readRegistry()` in `apps/indusk-mcp/src/lib/admin/registry.ts` originally had this shape:

```ts
export function readRegistry(): Registry {
  const path = registryPath();
  if (!existsSync(path)) return emptyRegistry();
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Registry;
    if (parsed.version !== 1 || !Array.isArray(parsed.projects)) {
      return emptyRegistry();  // ← silent data loss hazard
    }
    return parsed;
  } catch {
    return emptyRegistry();  // ← ditto
  }
}
```

The hazard: a user hand-edits `~/.indusk/projects.json`, makes a typo. The next `indusk init` elsewhere triggers `addProject()`, which calls `readRegistry()` (returns empty), appends one entry, calls `writeRegistry()` (atomically overwrites the damaged file with a single-entry clean registry). Every other registered project vanishes. No warning, no backup, no way to recover.

Surfaced by `/falsify admin-ui-hosting` (Phase 7, hypothesis T24). Before the falsification dogfood, nobody noticed — happy-path tests all passed because they never put a malformed file on disk first.

## The fix

Rename the damaged file before returning the default. Keep the old bytes on disk under a timestamped backup path:

```ts
function quarantine(path: string): void {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${path}.corrupt.${iso}.bak`;
  try {
    renameSync(path, backupPath);
    process.stderr.write(`warning: quarantined malformed registry to ${backupPath}\n`);
  } catch {
    // best-effort: if rename fails, old behavior (silent overwrite) applies,
    // but at least we tried. Log could go here if a logger is available.
  }
}
```

Any subsequent `writeRegistry()` creates a brand-new file at the original path. The damaged bytes are preserved at the backup path for user recovery. The ISO timestamp prevents repeated corruption events from clobbering each other's backups.

## Generalize

Anywhere you see this shape:

```ts
function load(path): T {
  try {
    return parse(readFile(path));
  } catch {
    return defaultT;
  }
}
```

ask: **will any caller later write to the same path?** If yes, the silent overwrite hazard is real. Add quarantine before returning the default. The cost is a rename (nearly free) + a stderr warning (helpful); the benefit is user-recoverable state on damage.

## When to skip

Quarantine is overkill for genuinely transient files — lock files, pidfiles, cache files where the expected behavior is "if corrupt, trust the new state." Apply the lens: is this file the source of truth for some user-meaningful data? If yes, quarantine on corruption. If it's a working copy that gets regenerated on every run, don't bother.

## Related

- `falsification-fixtures-must-be-minimal.md` — the Phase 7 falsification test (T24) was only writable because the fixture was a minimal malformed-JSON seed. Any additional complexity would have hidden whether the quarantine behavior was firing.
- `community-no-fallback-values.md` — "never use fallback values where a value is expected." This is the broader pattern: silent fallbacks are where damage hides.

