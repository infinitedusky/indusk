import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

/**
 * The foundation's families (`--font-display`, `--font-sans`, `--font-mono`).
 * Loaded as the mockups name them; a machine offline falls back to the system
 * faces the same tokens list after them.
 */
const FONTS =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

export const metadata: Metadata = {
  title: "InDusk Admin",
  description:
    "Read-only viewer over .indusk/planning/ across every registered project",
};

/**
 * Force dynamic rendering for the entire app. Without this, Next.js prerenders
 * `/` at build time using the build's `process.env` snapshot, which has no
 * `INDUSK_HOME` set. The baked HTML then shows an empty sidebar forever,
 * regardless of what env var the runtime daemon was started with.
 *
 * The admin UI reads `.indusk/planning/` from disk on every request — there's
 * nothing to prerender. Dynamic rendering is the correct mode.
 *
 * Discovered during Phase 1 bundling smoke of admin-ui-hosting.
 */
export const dynamic = "force-dynamic";

/**
 * Global root layout. In the 1.27+ daemon model, the root layout is
 * deliberately thin — it only owns the chrome (body classes, top-level
 * navigation). Per-project pages nest their own sidebar + plan-list under
 * `app/p/[project]/layout.tsx`; the homepage (`/`) owns the project grid.
 *
 * Splitting like this means per-project pages DON'T double-render a sidebar
 * (one global + one per-project) and the homepage doesn't waste the
 * sidebar's width when it only has project cards to show.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body className="min-h-full bg-ground">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-dusk"
          >
            <span>InDusk Admin</span>
            <span className="text-xs font-regular text-ink-faint">
              plan, build, review, release
            </span>
          </Link>
        </header>
        <div className="app-body w-full">{children}</div>
      </body>
    </html>
  );
}
