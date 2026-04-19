import { resolve } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next.js doesn't pick up an unrelated lockfile
  // higher in the filesystem (e.g., a global ~/package-lock.json).
  turbopack: {
    root: resolve(__dirname, "../.."),
  },
};

export default nextConfig;
