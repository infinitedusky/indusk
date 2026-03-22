# Extensions

Extensions integrate external tools with InDusk MCP. They provide skills, health checks, verification commands, networking configuration, and more.

## Built-in Extensions

These ship with indusk-mcp. Enable the ones you need:

```bash
# See what's available
npx @infinitedusky/indusk-mcp extensions list

# Enable extensions
npx @infinitedusky/indusk-mcp extensions enable falkordb cgc typescript

# See what's active
npx @infinitedusky/indusk-mcp extensions status
```

### Available Built-in Extensions

| Extension | What it provides |
|-----------|-----------------|
| **falkordb** | FalkorDB health check, OrbStack networking |
| **cgc** | CodeGraphContext skill, health check, verification |
| **typescript** | TypeScript best practices skill, type check verification |
| **testing** | Testing patterns skill, vitest/jest verification |
| **nextjs** | Next.js patterns skill |
| **tailwind** | Tailwind CSS patterns skill |
| **react** | React patterns skill |
| **solidity** | Solidity patterns skill |
| **docker** | Docker patterns skill, Docker health check |
| **vitepress** | VitePress patterns skill |

## Auto-Detection

InDusk can suggest extensions based on your project:

```bash
npx @infinitedusky/indusk-mcp extensions suggest
```

This scans your `package.json` and file patterns to recommend extensions. For example, if you have `typescript` in devDependencies, it suggests the typescript extension.

## Third-Party Extensions

Any tool can integrate with InDusk by providing an `indusk-extension.json` manifest. Add it to your project:

```bash
# From an npm package
npx @infinitedusky/indusk-mcp extensions add composable-env --from npm:composable-env

# From a GitHub repo
npx @infinitedusky/indusk-mcp extensions add my-tool --from github:user/repo

# From a local file
npx @infinitedusky/indusk-mcp extensions add my-tool --from ./path/to/manifest.json
```

Then enable it:

```bash
npx @infinitedusky/indusk-mcp extensions enable composable-env
```

## Writing Your Own Extension

See the [Extension Spec](/reference/extension-spec) for the manifest format.

A minimal extension that just provides a skill:

```json
{
  "name": "my-tool",
  "description": "Best practices for my-tool",
  "provides": { "skill": true },
  "detect": { "dependency": "my-tool" }
}
```

Place `indusk-extension.json` and `skill.md` in your package root. Users add it with `extensions add`.

## Managing Extensions

```bash
extensions list              # Show all available
extensions status            # Health check results
extensions enable <name>     # Enable (installs skill, runs on_init hook)
extensions disable <name>    # Disable without removing
extensions remove <name>     # Remove completely
extensions suggest           # Recommend based on project
```

## How Extensions Work

When enabled, extensions sit in `.indusk/extensions/` as JSON manifests. InDusk reads these at startup and integrates their capabilities:

- **Health checks** run during `check_health`
- **Skills** are installed to `.claude/skills/{name}/SKILL.md`
- **Verification commands** are added to auto-discovery
- **Lifecycle hooks** run during init, update, health check, and onboard
