# Code Quality MCP Tools — Design

These tools are designed here and will be implemented in the MCP server plan.

## get_quality_config

Returns the current Biome config merged with rationale annotations so the agent can understand why each rule exists.

**Input:** none

**Output:**
```json
{
  "rules": [
    {
      "name": "noExplicitAny",
      "category": "suspicious",
      "level": "error",
      "options": null,
      "rationale": {
        "added": "2026-03-19",
        "source": "Initial setup — known AI agent pattern",
        "reason": "Agents default to `any` when types get complex, causing silent runtime failures."
      }
    },
    {
      "name": "noConsole",
      "category": "suspicious",
      "level": "warn",
      "options": { "allow": ["warn", "error", "info"] },
      "rationale": {
        "added": "2026-03-19",
        "source": "Initial setup — known AI agent pattern",
        "reason": "Agents leave debug console.logs in production code."
      }
    }
  ],
  "overrides": [
    {
      "includes": ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
      "relaxed": ["noConsole"]
    },
    {
      "includes": ["apps/mcp/**"],
      "relaxed": ["noConsole"]
    }
  ]
}
```

**Implementation notes:**
- Parse `biome.json` for rules and overrides
- Parse `biome-rationale.md` for rationale entries
- Match rules to rationale by rule name
- Rules without rationale entries should be flagged (missing documentation)

## suggest_rule

Given a mistake description, searches Biome's rule catalog for a matching rule. Used during retrospectives when asking "could this have been caught automatically?"

**Input:**
```json
{
  "mistake": "Agent used var instead of const for a variable that's never reassigned"
}
```

**Output:**
```json
{
  "suggested_rule": "useConst",
  "category": "style",
  "description": "Require const declarations for variables that are only assigned once.",
  "already_enabled": true,
  "config_snippet": {
    "style": {
      "useConst": "error"
    }
  }
}
```

**Implementation notes:**
- Maintain a mapping of common mistake patterns to Biome rule names
- For unknown patterns, return `null` with a note that manual lookup is needed
- Check if the suggested rule is already enabled in the current config

## quality_check

Runs `biome check` on specified files and returns structured results. This is what the verify skill calls programmatically.

**Input:**
```json
{
  "files": ["apps/brand-site/src/app/page.tsx"],
  "fix": false
}
```

Or for all files:
```json
{
  "files": "all",
  "fix": false
}
```

**Output:**
```json
{
  "passed": false,
  "checked": 1,
  "duration_ms": 45,
  "diagnostics": [
    {
      "file": "apps/brand-site/src/app/page.tsx",
      "line": 42,
      "column": 5,
      "rule": "noExplicitAny",
      "category": "suspicious",
      "severity": "error",
      "message": "Unexpected any. Specify a different type."
    }
  ],
  "summary": {
    "errors": 1,
    "warnings": 0,
    "info": 0
  }
}
```

**Implementation notes:**
- Run `biome check --reporter=json` and parse the output
- If `fix: true`, run `biome check --write` instead
- Return structured diagnostics the agent can reason about
- Include duration for performance tracking
