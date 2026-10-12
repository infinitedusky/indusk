import { resolve } from "node:path";
import type { NextConfig } from "next";

// `next` is pinned at 16.2.x in package.json (an exact version, which JSON
// cannot comment) until storybookjs/storybook#36720 is fixed: Storybook's
// `@storybook/nextjs-vite` breaks on later Next minors.
const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js doesn't pick up an unrelated lockfile
  // higher in the filesystem (e.g., a global ~/package-lock.json).
  turbopack: {
    root: resolve(__dirname, "../.."),
  },
};

export default nextConfig;
