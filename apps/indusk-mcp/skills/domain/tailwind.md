# Tailwind CSS

You are working in a project that uses Tailwind CSS. Follow these patterns.

## Utility-First

- Use utility classes directly in markup — don't extract to CSS unless a pattern repeats 3+ times
- When extracting, use `@apply` in a CSS file or create a component — not a custom CSS class
- Prefer Tailwind's built-in values over arbitrary values (`p-4` over `p-[17px]`)

## Responsive Design

- Mobile-first: default styles are mobile, use `sm:`, `md:`, `lg:` for larger screens
- Use `container` with `mx-auto` for max-width layouts
- Use `grid` and `flex` utilities — don't fight Tailwind with custom CSS grid

## Dark Mode

- Use `dark:` variant for dark mode styles
- Design both modes — don't leave dark mode as an afterthought

## Common Gotchas

- Tailwind 4 uses `@import "tailwindcss"` not `@tailwind base/components/utilities`
- Tailwind 4 requires Node 22 — native bindings fail on older versions
- Don't use `@apply` with Tailwind 4's new CSS-first config — use CSS custom properties instead
- Arbitrary values (`[17px]`) are a code smell — check if Tailwind has a matching utility first
- Purging: if a class isn't in your templates, it won't be in the build. Dynamic class names must use complete strings, not template literals like `bg-${color}-500`
