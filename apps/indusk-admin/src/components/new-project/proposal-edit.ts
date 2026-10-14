import type {
  Proposal,
  ProposalRecommendation,
} from "@infinitedusky/indusk-mcp/new-project";
import {
  CORE_DOCUMENTS,
  DOCUMENT_LABELS,
  requiredDocuments,
} from "@infinitedusky/indusk-mcp/workflow-types";
import type { WorkflowDocument } from "@/components/ui/WorkflowStrip";

/**
 * What the proposal's page does with a proposal that the package does not
 * already say (new-project-flow): how its choices are drawn, and how a decline
 * changes it. The check of what a valid proposal is stays the package's
 * (`validateProposal`); the page sends its edits there and shows the refusal.
 */

const isCore = (doc: string): boolean =>
  (CORE_DOCUMENTS as readonly string[]).includes(doc);

const sentence = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** The planning documents a new project plans with, in order, as the strip draws them. */
export function workflowDocuments(
  documentsOff: readonly string[],
): WorkflowDocument[] {
  return requiredDocuments("feature").map((doc) => ({
    label:
      doc === "adr" ? DOCUMENT_LABELS[doc] : sentence(DOCUMENT_LABELS[doc]),
    state: isCore(doc) ? "core" : documentsOff.includes(doc) ? "off" : "kept",
  }));
}

/** The folders the project will have: the workbench, each repository, the worktrees folder. */
export function layoutOf(
  proposal: Pick<Proposal, "location" | "repos">,
): string {
  const root = proposal.location.split("/").filter(Boolean).pop() ?? "";
  const width =
    Math.max(
      0,
      ...proposal.repos.map((r) => r.name.length + 1),
      "worktrees".length + 1,
    ) + 6;
  const line = (folder: string, note: string) =>
    `  ${`${folder}/`.padEnd(width)}${note}`;
  return [
    `${root}/`,
    ...proposal.repos.map((r) => line(r.name, "the repository")),
    line("worktrees", "one per plan"),
  ].join("\n");
}

/** A recommendation's words on the page: its own title, else its name. */
export const titleOf = (rec: ProposalRecommendation): string =>
  rec.title ?? rec.name;

/**
 * Decline a recommendation with the person's reason. One named for a planning
 * document the project may do without (`adr`) also turns that document off, so
 * the workflow strip and the created config agree with the decline.
 */
export function decline(
  proposal: Proposal,
  name: string,
  reason: string,
): Proposal {
  const turnOff = name in DOCUMENT_LABELS && !isCore(name);
  return {
    ...proposal,
    recommendations: proposal.recommendations.map((rec) =>
      rec.name === name ? { ...rec, kept: false, reason } : rec,
    ),
    documentsOff:
      turnOff && !proposal.documentsOff.includes(name)
        ? [...proposal.documentsOff, name]
        : proposal.documentsOff,
  };
}

/** Keep a declined recommendation after all; its document, if it had turned one off, is back. */
export function keep(proposal: Proposal, name: string): Proposal {
  return {
    ...proposal,
    recommendations: proposal.recommendations.map((rec) => {
      if (rec.name !== name) return rec;
      const { reason: _reason, ...rest } = rec;
      return { ...rest, kept: true };
    }),
    documentsOff: proposal.documentsOff.filter((doc) => doc !== name),
  };
}
