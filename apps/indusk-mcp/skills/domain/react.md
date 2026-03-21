# React

You are working in a React project. Follow these patterns.

## Components

- Prefer function components — never class components
- One component per file for non-trivial components
- Name components with PascalCase, files with the component name
- Colocate related files: `Button.tsx`, `Button.test.tsx`, `Button.stories.tsx`

## Hooks

- Only call hooks at the top level — never in conditionals, loops, or nested functions
- Custom hooks start with `use` — `useAuth`, `useDebounce`
- `useEffect` is for synchronization with external systems, not for derived state
- If you can compute it from props/state, don't put it in state or an effect

## State Management

- Start with local state (`useState`) — don't reach for global state until you need it
- Lift state up only as far as the nearest common ancestor
- Use `useReducer` for complex state with multiple sub-values
- Context is for low-frequency updates (theme, auth). Don't use it for high-frequency data (positions, timers).

## Patterns to Avoid

- Don't copy props into state — derive from props directly
- Don't use `useEffect` to set state based on other state — compute during render
- Don't use `key={Math.random()}` — use stable identifiers
- Don't `useEffect(() => { fetchData() }, [])` — use a data fetching library or Server Components
- Don't wrap everything in `useMemo`/`useCallback` — only optimize when you measure a problem
