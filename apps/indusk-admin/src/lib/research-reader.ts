import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Research directory reader (`.indusk/research/`). Extracted from
 * planning-reader.ts (dawn-ui-plan-grouping cleanup) — research reads share
 * nothing with plan parsing beyond `node:fs`. Server-side only, same as the
 * planning reader.
 */

export interface ResearchEntry {
  slug: string;
  path: string;
  title: string | null;
  isDirectory: boolean;
}

/**
 * List the top-level research slugs under `projectRoot/.indusk/research/`.
 *
 * For each entry:
 *   - Top-level `.md` file → slug is the basename without `.md`, title is the
 *     first `# H1` if present, else `null`.
 *   - Nested directory → slug is the directory name; title is read from
 *     `README.md`'s `# H1` if present, else `null`. `isDirectory: true`.
 *
 * Returns `[]` when the research directory is missing or empty — not an error.
 * Server-side only.
 */
export async function readProjectResearch(
  projectRoot: string,
): Promise<ResearchEntry[]> {
  const dir = join(projectRoot, ".indusk/research");
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const out: ResearchEntry[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const slug = entry.name.slice(0, -3);
      const fullPath = join(dir, entry.name);
      const title = await readFirstH1(fullPath);
      out.push({ slug, path: fullPath, title, isDirectory: false });
      continue;
    }
    if (entry.isDirectory()) {
      const slug = entry.name;
      const readmePath = join(dir, slug, "README.md");
      const title = existsSync(readmePath)
        ? await readFirstH1(readmePath)
        : null;
      out.push({
        slug,
        path: join(dir, slug),
        title,
        isDirectory: true,
      });
    }
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

/**
 * Read the markdown content for a single research slug. Returns `null` when
 * the slug doesn't exist — route handler maps that to `notFound()`.
 *
 * Resolves in two shapes:
 *   - `{slug}.md` — top-level file
 *   - `{slug}/README.md` — directory with README (nested research)
 */
export async function readResearchContent(
  projectRoot: string,
  slug: string,
): Promise<string | null> {
  // Reject path-traversal attempts — slug must be a single path segment.
  if (slug.includes("/") || slug.includes("..") || slug.startsWith(".")) {
    return null;
  }
  const base = join(projectRoot, ".indusk/research");
  const filePath = join(base, `${slug}.md`);
  if (existsSync(filePath)) return readFile(filePath, "utf-8");
  const dirReadme = join(base, slug, "README.md");
  if (existsSync(dirReadme)) return readFile(dirReadme, "utf-8");
  return null;
}

async function readFirstH1(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const match = content.match(/^#\s+(.+?)\s*$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
