import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview } from "@storybook/nextjs-vite";
// The app's own stylesheet: the foundation's tokens, so a story draws with the
// values the screens do.
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    nextjs: { appDirectory: true },
  },
  decorators: [
    // The generated foundation reads `[data-theme="dark" | "light"]` on :root.
    withThemeByDataAttribute({
      themes: { light: "light", dark: "dark" },
      defaultTheme: "light",
      attributeName: "data-theme",
    }),
  ],
};

export default preview;
