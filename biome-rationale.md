# Biome Rule Rationale

Each non-default rule explains why it exists and what prompted it. When a retrospective identifies a preventable mistake, add a new rule here and in biome.json.

## noExplicitAny (error)
Added: 2026-03-19
Source: Initial setup — known AI agent pattern
Reason: Agents default to `any` when types get complex, causing silent runtime failures when type shapes change. Forces proper typing.

## noUnusedImports (error)
Added: 2026-03-19
Source: Initial setup — known AI agent pattern
Reason: Agents leave dead imports after refactoring. Clutters code and confuses future readers about actual dependencies.

## noUnusedVariables (error, ignorePattern: ^_)
Added: 2026-03-19
Source: Initial setup — code hygiene
Reason: Dead variables obscure what code actually does. Underscore prefix convention allows intentional unused params (e.g., `_req` in middleware).

## noConsole (warn, allow: warn/error/info)
Added: 2026-03-19
Source: Initial setup — known AI agent pattern
Reason: Agents leave debug console.logs in production code. Warn instead of error to allow intentional logging via console.warn/error/info. Test files and MCP app are exempted via overrides.

## noVar (error)
Added: 2026-03-19
Source: Initial setup — modern JS convention
Reason: `var` has function scoping that causes subtle bugs. Always use `const` or `let`.

## useConst (error)
Added: 2026-03-19
Source: Initial setup — immutability preference
Reason: Default to `const` unless reassignment is needed. Makes intent clear and prevents accidental mutation.

## noDebugger (error)
Added: 2026-03-19
Source: Initial setup — code hygiene
Reason: `debugger` statements should never be committed. They halt execution in browsers and have no place in production code.

## Override: noUnusedVariables disabled for `**/*.vue` (1.28.13)
Added: 2026-05-07
Source: FullscreenDiagram silent-no-op bug — handlers prefixed with `_` because the linter couldn't see template references
Reason: Biome doesn't parse Vue's `<template>` blocks, so it treats handlers and reactive state used only by the template as "unused." The auto-fix path (and the underscore-prefix convention from `argsIgnorePattern`) caused agents to prepend `_` to handlers that were already correctly named — Vue then resolved the template binding `@click="toggleExpand"` to `undefined` and clicks became silent no-ops. We disable the rule for `*.vue` files entirely; genuinely-unused script-setup vars are surfaced by Vue dev tools and the cost of letting them slip is far smaller than the cost of silently broken click handlers. If a future Biome version gains Vue template parsing (or we adopt a Vue-aware linter that does), this override becomes redundant and should be removed.
