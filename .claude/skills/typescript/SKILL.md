# TypeScript

You are working in a TypeScript project. Follow these patterns.

## Type Safety

- Enable `strict: true` in tsconfig — no exceptions
- Never use `any` — use `unknown` and narrow, or define a proper type
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use discriminated unions for state machines and variant types
- Use `as const` for literal types instead of widened types

## Patterns

- Prefer `const` over `let` — only use `let` when reassignment is genuinely needed
- Use optional chaining (`?.`) and nullish coalescing (`??`) — not `&&` chains
- Use template literals for string building — not concatenation
- Prefer `Map` and `Set` over plain objects when keys are dynamic
- Use `satisfies` to validate a value matches a type without widening it

## Generics

- Use generics when the same logic works across multiple types
- Name generic parameters meaningfully: `TItem`, `TResult` — not just `T`
- Constrain generics with `extends` when the function needs specific properties
- Don't over-generalize — if a function only works with strings and numbers, use a union, not a generic

## Common Gotchas

- `===` always, never `==` — type coercion causes subtle bugs
- `Array.includes()` doesn't narrow types — use a type guard
- `Object.keys()` returns `string[]`, not `(keyof T)[]` — this is by design
- `Promise` rejections are `unknown` in strict mode — always narrow in catch blocks
- Index signatures (`[key: string]: T`) allow any string key — use `Record<K, V>` for specific keys
