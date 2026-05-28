"use client";

import { useRouter } from "next/navigation";

export interface ProjectSwitcherProps {
  projects: { name: string }[];
  currentProject: string;
}

/**
 * Header dropdown that switches between registered projects. Client
 * component because it needs `useRouter` for navigation. When only a single
 * project is registered the switcher is omitted — there's nowhere to go.
 *
 * The shape is a native `<select>` styled to match the rest of the admin UI.
 * A custom dropdown would be nicer visually but adds a click-outside /
 * keyboard-a11y surface that the current primitives don't cover; the
 * <select> gives us A11y for free and matches the "no shadcn/no Radix"
 * constraint.
 */
export function ProjectSwitcher({
  projects,
  currentProject,
}: ProjectSwitcherProps) {
  const router = useRouter();
  if (projects.length <= 1) return null;

  return (
    <label className="flex items-center gap-2 text-xs text-gray-500">
      <span>Project</span>
      <select
        data-testid="project-switcher"
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={currentProject}
        onChange={(e) => {
          const next = e.currentTarget.value;
          if (next !== currentProject) router.push(`/p/${next}/`);
        }}
      >
        {projects.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
