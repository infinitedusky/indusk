import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProjectCard } from "./ProjectCard";

const meta = {
  title: "ui/ProjectCard",
  component: ProjectCard,
} satisfies Meta<typeof ProjectCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// One project of each kind the home grid shows.
export const Default: Story = {
  args: {
    name: "avoca-next",
    path: "~/code/lazer/avoca/avoca-next",
    activePlanCount: 0,
    href: "/p/avoca-next/",
    shape: "normal-mode",
    lastSeen: "5mo ago",
  },
};
export const InProgress: Story = {
  args: {
    name: "dusk",
    path: "~/code/sandbox/dusk",
    activePlanCount: 52,
    href: "/p/dusk/",
    shape: "normal-mode",
    inProgress: true,
    lastSeen: "6d ago",
  },
};
export const Workbench: Story = {
  args: {
    name: "homework-gate-workbench",
    path: "~/code/sandbox/homework-gate-workbench",
    activePlanCount: 3,
    href: "/p/homework-gate-workbench/",
    shape: "workbench",
    inProgress: true,
    lastSeen: "1mo ago",
  },
};
