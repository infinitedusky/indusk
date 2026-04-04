# Local Mode

Use InDusk on team codebases without touching committed files.

## Overview

`indusk init --local` sets up the full InDusk dev system as a personal overlay — invisible to teammates, fully functional for you. Everything InDusk creates lives in `.indusk/` and `.claude/`, excluded from git via `.git/info/exclude`.

## What It Does

| What | Where | Behavior |
|------|-------|----------|
| Plans, extensions, config | `.indusk/` | Git-excluded via `.git/info/exclude` |
| Skills, hooks, lessons | `.claude/` | Git-excluded via `.git/info/exclude` |
| Settings (hooks, permissions) | `.claude/settings.json` | Overlay — merged on init, stripped on `pr-clean` |
| Biome config | `.indusk/biome.json` | Local linting |
| Tests | `.indusk/tests/` | Local test runner |
| Docs | `.indusk/docs/` | Plain markdown |

## What It Skips

composable-env, OTel scaffolding, VS Code settings, CLAUDE.md at root, .gitignore modifications. The team owns all of these.

## Quick Start

```bash
# In the team repo
indusk init --local

# Start working
/plan my-feature
/work my-feature

# Before a PR
indusk pr-clean
# push your PR
indusk pr-restore
```

## Directory Layout

```
.indusk/
├── config.json              # Project profile (mode, verify contract, detected tooling)
├── planning/                # Plans
├── extensions/              # Extension manifests
├── settings-overlay.json    # What InDusk merged into .claude/settings.json
├── biome.json               # Local linter config
├── vitest.config.ts         # Local test runner (or jest.config.js)
├── tests/                   # Local test files
└── docs/                    # Plain markdown documentation
    └── index.md
```

## Config File

`.indusk/config.json` is the central project profile. Init detects the team's tooling and writes it here. All InDusk tools read from it.

```json
{
  "mode": "local",
  "verify": {
    "linter": { "tool": "biome", "config": ".indusk/biome.json" },
    "testRunner": { "tool": "jest", "config": ".indusk/jest.config.js" },
    "typeCheck": "tsc"
  },
  "detected": {
    "otel": true,
    "testRunner": "jest",
    "linter": "eslint"
  }
}
```

- **`mode`** — `"local"` or `"full"`. Controls what init/update touch.
- **`verify`** — What tools to run and where their configs live. Verify reads this instead of guessing.
- **`detected`** — What the team already has. Extensions auto-enable based on this.

## PR Workflow

Before pushing a PR, strip InDusk settings so teammates don't see noise:

```bash
indusk pr-clean      # strips overlay from .claude/settings.json
# push your PR
indusk pr-restore    # re-applies overlay locally
```

The overlay file (`.indusk/settings-overlay.json`) records exactly what InDusk added. `pr-clean` reads it and removes those entries. `pr-restore` puts them back.

The settings additions aren't sensitive (hooks and permissions), so accidentally including them is noise, not a security issue.

## Detection

Init detects the team's existing tooling:

- **Linter:** biome.json, .eslintrc.*, eslint.config.*
- **Test runner:** vitest.config.*, jest.config.*
- **OTel:** instrumentation.ts, instrumentation.py
- **TypeScript:** tsconfig.json

Detected tooling is recorded in `config.json` and used by the verify skill.

## Re-cloning

`.git/info/exclude` is per-clone — it's not committed. If you re-clone the repo, run `indusk init --local` again. Init is idempotent.
