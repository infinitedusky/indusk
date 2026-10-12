import type { Preview } from "@storybook/nextjs-vite";
// The app's own stylesheet: the foundation's tokens, so a story draws with the
// values the screens do.
import "../src/app/globals.css";

/**
 * The generated foundation follows `prefers-color-scheme` and lets
 * `[data-theme="light" | "dark"]` on :root override it — which is what the
 * admin's own screens do. A story therefore sets the attribute only when a
 * theme is chosen (the toolbar, or `globals=theme:dark` in the address), and
 * otherwise leaves it off so it matches the admin by following the same
 * system setting.
 */
const preview: Preview = {
  parameters: {
    nextjs: { appDirectory: true },
  },
  initialGlobals: { theme: "match" },
  globalTypes: {
    theme: {
      description: "Colour scheme",
      toolbar: {
        title: "Theme",
        icon: "circlehalf",
        dynamicTitle: true,
        items: [
          { value: "match", title: "Match the admin" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme;
      const root = document.documentElement;
      if (theme === "light" || theme === "dark") {
        root.setAttribute("data-theme", theme);
      } else {
        root.removeAttribute("data-theme");
      }
      return Story();
    },
  ],
};

export default preview;
