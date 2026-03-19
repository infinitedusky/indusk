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
