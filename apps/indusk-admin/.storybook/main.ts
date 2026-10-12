import type { StorybookConfig } from "@storybook/nextjs-vite";

/**
 * Storybook for the admin (storybook-components ADR): one story per component
 * state, rendered by the framework the admin itself uses. `componentsManifest`
 * makes the build write the component manifest the catalog is read from.
 *
 * Next stays at 16.2.x until storybookjs/storybook#36720 is fixed
 * (package.json `next`; `lesson: everyday-tests-never-wait` guards the tier).
 */
const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-vitest"],
  core: { disableTelemetry: true },
  features: { componentsManifest: true },
};

export default config;
