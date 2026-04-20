import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "InDusk Admin",
	description: "Read-only viewer over .indusk/planning/ across every registered project",
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
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			<body className="min-h-full bg-gray-50">
				<header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
					<Link
						href="/"
						className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-blue-600"
					>
						<span>InDusk Admin</span>
						<span className="text-xs font-normal text-gray-500">
							read-only viewer
						</span>
					</Link>
					<nav className="flex items-center gap-3 text-sm">
						<Link
							href="/"
							className="text-gray-600 hover:text-gray-900"
						>
							Projects
						</Link>
						<Link
							href="/scorecards"
							className="text-gray-600 hover:text-gray-900"
						>
							Scorecards
						</Link>
					</nav>
				</header>
				<div className="h-[calc(100vh-2.5rem)] w-full">{children}</div>
			</body>
		</html>
	);
}
