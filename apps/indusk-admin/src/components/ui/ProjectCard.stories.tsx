import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProjectCard } from "./ProjectCard";

const meta = {
  title: "ui/ProjectCard",
  component: ProjectCard,
} satisfies Meta<typeof ProjectCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: "homework-gate-workbench",
    path: "~/code/sandbox/homework-gate-workbench",
    activePlanCount: 0,
    href: "/p/homework-gate-workbench/",
  },
};
