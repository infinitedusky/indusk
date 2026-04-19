import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PlanList } from "@/components/PlanList";
import { Sidebar } from "@/components/ui/Sidebar";
import {
  readActivePlans,
  readArchivedPlans,
  readMasterPlanOrder,
} from "@/lib/planning-reader";
import { getProjectRoot } from "@/lib/project-root";

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

/**
 * Root layout reads planning data on every request via the planning-reader.
 * This is a server component — `process.cwd()` is the directory the
 * `indusk ui` CLI was invoked from, which is the project root by convention.
 *
 * Per the work skill's tests-first discipline, the data flow is:
 *   layout.tsx → readActivePlans/readArchivedPlans/readMasterPlanOrder
 *              → <PlanList active=... archived=... masterOrder=... />
 *              → <Link href={`/plan/${name}`}> per item (Phase 4 wires the route)
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const projectRoot = getProjectRoot();
  const [active, archived] = await Promise.all([
    readActivePlans(projectRoot),
    readArchivedPlans(projectRoot),
  ]);
  const masterOrder = readMasterPlanOrder(projectRoot);

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
            <PlanList active={active} archived={archived} masterOrder={masterOrder} />
          </Sidebar>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
