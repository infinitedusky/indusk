# Next.js

You are working in a Next.js project. Follow these patterns.

## App Router

- Use the App Router (`app/` directory), not Pages Router
- Default to Server Components — only add `"use client"` when you need interactivity, browser APIs, or hooks
- Use `loading.tsx` for streaming, `error.tsx` for error boundaries, `not-found.tsx` for 404s
- Colocate components with their routes when they're route-specific

## Data Fetching

- Fetch data in Server Components, not in client components via useEffect
- Use `fetch()` with Next.js caching — understand `cache: 'force-cache'` (default) vs `cache: 'no-store'`
- Use `revalidatePath()` or `revalidateTag()` for on-demand revalidation, not time-based unless you need it
- Server Actions for mutations — don't build API routes for form submissions

## Performance

- Use `next/image` for all images — never raw `<img>` tags
- Use `next/link` for navigation — never raw `<a>` for internal links
- Use `next/font` for fonts — no external font loading
- Dynamic imports (`next/dynamic`) for heavy client components
- Minimize `"use client"` boundaries — push them as deep in the component tree as possible

## Common Gotchas

- `"use client"` doesn't mean the component only renders on the client — it still SSRs. It means it hydrates.
- Server Components can't use hooks, event handlers, or browser APIs
- Don't import server-only code in client components — use `server-only` package to enforce
- `cookies()` and `headers()` make a route dynamic — use them intentionally
- Middleware runs on every request — keep it fast. Don't do database calls in middleware.
