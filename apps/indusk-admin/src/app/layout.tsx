import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/ui/Sidebar";

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
	description: "Read-only viewer over .indusk/planning/",
};

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
			<body className="min-h-full">
				<div className="flex h-screen w-full">
					<Sidebar
						header={
							<div className="flex flex-col">
								<span className="text-sm font-semibold text-gray-900">InDusk Admin</span>
								<span className="text-xs text-gray-500">read-only viewer</span>
							</div>
						}
					>
						<EmptyPlansSidebarSlot />
					</Sidebar>
					<main className="flex-1 overflow-y-auto p-6">{children}</main>
				</div>
			</body>
		</html>
	);
}

/**
 * Phase 1 placeholder for the sidebar's plan-list slot.
 * Phase 3 will replace this with a server-component render of the
 * planning-reader's results. T12 (empty-state behavior) is satisfied
 * by this component when no plans exist.
 */
function EmptyPlansSidebarSlot() {
	return (
		<div className="px-2 py-4 text-sm text-gray-500" data-testid="sidebar-empty-state">
			No plans yet — create one with <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/planner</code>.
		</div>
	);
}
