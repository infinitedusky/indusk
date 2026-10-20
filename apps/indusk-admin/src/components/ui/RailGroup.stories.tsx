import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";
import { RailGroup } from "./RailGroup";
import { Step } from "./Step";

const meta = {
  title: "ui/RailGroup",
  component: RailGroup,
} satisfies Meta<typeof RailGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Planning",
    chip: <Badge variant="enforced">done</Badge>,
    children: [
      <Step key="research" name="Research" status="done" state="done" />,
      <Step key="brief" name="Brief" status="done" state="done" />,
    ],
  },
};
/** A plan's Planning list once its impl and its planning audit are done (a-run-can-be-trusted). */
export const PlanningWithAudit: Story = {
  args: {
    title: "Planning",
    chip: <Badge variant="enforced">done</Badge>,
    children: [
      <Step key="research" name="Research" status="done" state="done" />,
      <Step key="brief" name="Brief" status="done" state="done" />,
      <Step key="test-plan" name="Test plan" status="done" state="done" />,
      <Step key="decision" name="Decision" status="done" state="done" />,
      <Step key="impl" name="Impl" status="done" state="done" />,
      <Step key="audit" name="Planning audit" status="done" state="done" />,
    ],
  },
};
export const Current: Story = {
  args: {
    title: "Release",
    chip: <Badge variant="active">now</Badge>,
    current: true,
    children: [
      <Step key="build" name="Build" status="done" state="done" />,
      <Step
        key="review"
        name="Review"
        status="waiting for you"
        state="needs"
        current
      />,
      <Step key="land" name="Land" status="waiting" state="waiting" />,
    ],
  },
};
