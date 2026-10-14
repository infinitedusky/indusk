import "@/app/globals.css";
import type { Proposal } from "@infinitedusky/indusk-mcp/new-project";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { NewProjectProposal } from "./NewProjectProposal";

// promise: a-project-starts-as-a-conversation

/**
 * new-project-flow A3: once the agent writes its proposal, the page shows the
 * proposed name, location and shape, each of which the person can change
 * before accepting.
 */

const homeworkGate: Proposal = {
  name: "homework-gate",
  location: "/Users/test/projects/homework-gate-workbench",
  repos: [{ name: "homework-gate" }],
  milestones: ["lockdown-baseline", "school-hours-schedule"],
  recommendations: [
    {
      name: "docs-site",
      title: "A docs site with a changelog",
      why: "So others can join in.",
      kept: true,
    },
    {
      name: "adr",
      title: "Decision records (ADRs)",
      why: "A record of why each choice was made.",
      kept: true,
    },
  ],
  documentsOff: [],
  remote: { github: false },
};

describe("A3 — the proposal shows name, location and shape, each changeable", () => {
  it("A3 shows the name, the location and the shape, and Create project is ready", async () => {
    const screen = await render(<NewProjectProposal proposal={homeworkGate} />);
    await expect
      .element(screen.getByLabelText("Name", { exact: true }))
      .toHaveValue("homework-gate");
    await expect
      .element(screen.getByLabelText("Location", { exact: true }))
      .toHaveValue(homeworkGate.location);
    await expect
      .element(screen.getByLabelText("Repositories", { exact: true }))
      .toHaveValue("homework-gate");
    await expect
      .element(screen.getByRole("button", { name: "Create project" }))
      .toBeEnabled();
  });

  it("A3 hands the changed name, location and shape on when the person creates it", async () => {
    const onCreate = vi.fn();
    const screen = await render(
      <NewProjectProposal proposal={homeworkGate} onCreate={onCreate} />,
    );
    await userEvent.fill(
      screen.getByLabelText("Name", { exact: true }),
      "homework-gate-2",
    );
    await userEvent.fill(
      screen.getByLabelText("Location", { exact: true }),
      "/Users/test/projects/hg2",
    );
    await userEvent.fill(
      screen.getByLabelText("Repositories", { exact: true }),
      "server, grader",
    );
    await screen.getByRole("button", { name: "Create project" }).click();
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "homework-gate-2",
        location: "/Users/test/projects/hg2",
        repos: [{ name: "server" }, { name: "grader" }],
      }),
    );
  });

  it("declining a recommendation asks for a reason, turns its document off, and can be taken back", async () => {
    const onCreate = vi.fn();
    const screen = await render(
      <NewProjectProposal proposal={homeworkGate} onCreate={onCreate} />,
    );
    await screen.getByRole("button", { name: "Decline" }).nth(1).click();
    await userEvent.fill(
      screen.getByLabelText(/Why decline Decision records/),
      "Solo project for now",
    );
    await screen.getByRole("button", { name: "Confirm decline" }).click();
    await expect
      .element(screen.getByText("Your reason: Solo project for now"))
      .toBeInTheDocument();
    await screen.getByRole("button", { name: "Create project" }).click();
    expect(onCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        documentsOff: ["adr"],
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            name: "adr",
            kept: false,
            reason: "Solo project for now",
          }),
        ]),
      }),
    );
    await screen.getByRole("button", { name: "Keep it after all" }).click();
    await screen.getByRole("button", { name: "Create project" }).click();
    expect(onCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ documentsOff: [] }),
    );
  });

  it("confirms the private GitHub repository separately, off until the person says so", async () => {
    const onCreate = vi.fn();
    const screen = await render(
      <NewProjectProposal proposal={homeworkGate} onCreate={onCreate} />,
    );
    await screen.getByRole("button", { name: "Create project" }).click();
    expect(onCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ remote: { github: false } }),
    );
    await screen.getByRole("checkbox").click();
    await screen.getByRole("button", { name: "Create project" }).click();
    expect(onCreate).toHaveBeenLastCalledWith(
      expect.objectContaining({ remote: { github: true } }),
    );
  });
});
