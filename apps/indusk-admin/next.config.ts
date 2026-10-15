import { resolve } from "node:path";
import type { NextConfig } from "next";

// `next` is pinned at 16.2.x in package.json (an exact version, which JSON
// cannot comment) until storybookjs/storybook#36720 is resolved; the plan
// (storybook-components Build Phase 1) names that issue as the reason.
const nextConfig: NextConfig = {
  // A test boots its own `next dev` beside a running admin: Next holds one
  // lock per build directory, so the test server builds into its own
  // (`INDUSK_ADMIN_DIST_DIR`, set by `startNextDev`).
  distDir: process.env.INDUSK_ADMIN_DIST_DIR || ".next",
  // Pin the workspace root so Next.js doesn't pick up an unrelated lockfile
  // higher in the filesystem (e.g., a global ~/package-lock.json).
  turbopack: {
    root: resolve(__dirname, "../.."),
  },
};

export default nextConfig;
