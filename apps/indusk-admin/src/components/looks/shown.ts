/**
 * What the page drew, as the body of an Approve or an Unapprove: the project,
 * the foundation and checkout it was drawn on, and the hash of the mockup or
 * story shown. Both buttons send the same bodies, so an approval and the
 * taking-back of it name the same thing.
 *
 * promise: a-mockup-is-approved-by-a-person
 */

export interface Shown {
  project: string;
  app: string;
  foundationHash: string;
  /** The plan whose worktree is shown; null for the project's own checkout. */
  checkout: string | null;
}

/** A mockup as the page drew it: its composed hash and the hash of the snapshots it composes. */
export function mockupBody(
  { project, foundationHash, checkout }: Shown,
  mockup: string,
  mockupHash: string,
  componentsHash: string,
) {
  return {
    project,
    mockup,
    mockupHash,
    componentsHash,
    foundationHash,
    checkout,
  };
}

/** A story as the page drew it: its snapshot hash, and its component's stylesheet hash when the caller sends one (Approve does; null or absent when it has none). */
export function storyBody(
  { project, foundationHash, checkout }: Shown,
  story: string,
  snapshotHash: string,
  stylesheetHash?: string | null,
) {
  return {
    project,
    kind: "story",
    story,
    snapshotHash,
    ...(stylesheetHash ? { stylesheetHash } : {}),
    foundationHash,
    checkout,
  };
}
