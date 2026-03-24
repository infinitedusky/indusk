---
title: "Code Quality System"
date: 2026-03-19
status: accepted
---

# Code Quality System

## Y-Statement

In the context of **an AI-assisted dev system where the agent repeatedly makes the same preventable mistakes across sessions and projects**,
facing **CLAUDE.md being advisory-only (the agent can read rules and still violate them) and no automated enforcement of learned lessons**,
we decided for **Biome as the single lint/format tool with a global base config that acts as a quality ratchet, an annotated rationale file linking each rule to its origin, project-level overrides via Biome's `overrides`, and MCP tools to make the quality system inspectable**
and against **ESLint (config complexity, plugin hell), separate lint and format tools (Prettier + ESLint), and unannotated configs where rules exist without explanation**,
to achieve **a codified quality floor that improves automatically after each retrospective, spans all projects, and is enforced by the verify skill**,
accepting **Biome's smaller ecosystem vs ESLint, the overhead of maintaining biome-rationale.md, and the need to build MCP tools for inspectability**,
because **Biome is a single binary with zero config dependencies, fast enough for per-item verification, and the annotated config pattern turns linting rules into a knowledge artifact that compounds across projects**.

## Context

The verify skill runs automated checks but its lint step currently reports "skipped (no linter configured)." Context captures soft lessons in CLAUDE.md. Code quality closes the gap by providing hard enforcement — rules the agent cannot violate, not just advice it should follow.

Biome is already installed (`@biomejs/biome@2.4.8`) but not configured. This ADR formalizes the configuration approach, the rationale tracking pattern, and the MCP integration.

See `planning/code-quality-system/brief.md` for the full problem statement.

## Decision

### Biome as the single lint/format tool

One tool for linting AND formatting. No Prettier, no ESLint. Biome handles both with a single config file and a single binary.

Commands:
- `biome check` — lint + format check (what verify runs)
- `biome check --write` — lint + auto-fix + format (for cleanup)
- `biome format --write` — format only

### Global base config at project root

`biome.json` at the repo root with Biome's recommended rules enabled plus our learned rules:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": {
          "level": "error",
          "options": { "ignorePattern": "^_" }
        },
        "noUnusedImports": "error"
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noDebugger": "error",
        "noConsole": {
          "level": "warn",
          "options": { "allow": ["warn", "error", "info"] }
        }
      },
      "style": {
        "useConst": "error",
        "noVar": "error"
      }
    }
  },
  "overrides": [
    {
      "include": ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsole": "off"
          }
        }
      }
    }
  ]
}
```

The `overrides` section handles test files — relaxing `noConsole` where it doesn't matter.

### biome-rationale.md as a knowledge artifact

Every non-default rule in `biome.json` has a corresponding entry in `biome-rationale.md`:

```markdown
# Biome Rule Rationale

Each non-default rule explains why it exists and what prompted it.

## noExplicitAny (error)
Added: 2026-03-19
Source: Initial setup — known AI agent pattern
Reason: Agents default to `any` when types get complex, causing silent runtime failures.

## noUnusedImports (error)
Added: 2026-03-19
Source: Initial setup — known AI agent pattern
Reason: Agents leave dead imports after refactoring. Clutters code and confuses future readers.

## noConsole (warn, allow: warn/error/info)
Added: 2026-03-19
Source: Initial setup — known AI agent pattern
Reason: Agents leave debug console.logs in production code. Warn instead of error to allow intentional logging.

## noVar (error)
Added: 2026-03-19
Source: Initial setup — modern JS convention
Reason: `var` has function scoping that causes subtle bugs. Always use `const` or `let`.
```

When a retrospective identifies a preventable mistake, a new rule is added to `biome.json` and a new entry is added to `biome-rationale.md`. The rationale file tells the story of why each rule exists.

### Project-level overrides via Biome's `overrides` section

Rather than multiple `biome.json` files, use the `overrides` array in the root config to handle per-directory or per-app rules:

```json
"overrides": [
  {
    "include": ["apps/mcp/**"],
    "linter": {
      "rules": {
        "suspicious": { "noConsole": "off" }
      }
    }
  }
]
```

This keeps a single config file while allowing app-specific relaxation. For cross-project inheritance (future), Biome's `extends` field will reference a shared config package.

### MCP tools for inspectability

Three tools in the MCP server (deferred to MCP server plan for implementation, but designed now):

- **`get_quality_config`** — returns biome.json merged with biome-rationale.md annotations. The agent can ask "why is noExplicitAny enabled?" and get the answer.
- **`suggest_rule`** — given a mistake description, searches Biome's rule catalog for a matching rule. Used during retrospectives.
- **`quality_check`** — runs `biome check` on specified files and returns structured results. This is what verify calls.

### The quality ratchet

Rules only get tighter, never looser. The retrospective template should include a prompt: "Could any of these mistakes have been caught by a Biome rule? If yes, add it to biome.json and biome-rationale.md."

This creates a feedback loop:
```
mistake made → caught in retro → new biome rule → verify enforces → mistake prevented next time
```

## Alternatives Considered

### ESLint
The incumbent. Rejected because: plugin configuration is complex and fragile, no built-in formatting (needs Prettier), slower than Biome, and the config surface area is a maintenance burden. ESLint's ecosystem is larger but that ecosystem is the source of the complexity.

### Prettier + ESLint
Two tools for format + lint. Rejected because: two configs, two binaries, potential conflicts between them, and Biome does both in one tool with one config.

### Unannotated config (biome.json without rationale)
Just rules, no explanations. Rejected because: over time, nobody remembers why a rule exists, and rules get removed when they're inconvenient rather than when they're wrong. The rationale file prevents this and makes the config a teaching tool for new projects.

## Consequences

### Positive
- Single binary, single config — zero plugin management
- Fast enough for per-item verification (< 2 seconds on changed files)
- Annotated config makes rules self-documenting
- Quality ratchet means the system gets better over time
- MCP tools make the quality system inspectable and actionable

### Negative
- Biome's rule catalog is smaller than ESLint's — some niche rules may not exist
- biome-rationale.md requires discipline to maintain
- MCP tools need to be built

### Risks
- **Biome rule gaps** — Mitigate by checking if a needed rule exists before adding to the plan. If Biome doesn't support it, document it as a Known Gotcha in CLAUDE.md instead.
- **Rationale drift** — Mitigate by making rationale updates part of the retrospective checklist
- **Formatting conflicts with existing code** — Mitigate by running `biome check --write` once to normalize, then all future changes are consistent

## References
- `planning/code-quality-system/brief.md`
- `planning/verify-skill/adr.md` (verify runs `biome check`)
- `planning/context-skill/adr.md` (context captures soft lessons, code-quality captures hard ones)
- Biome docs: configuration schema, overrides, rule categories
