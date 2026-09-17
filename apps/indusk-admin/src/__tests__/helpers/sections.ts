/**
 * Every plan-page section is closed by default (admin-ui-phase-progress:
 * "overview before details"), so a test that reads a section's body opens it
 * first. These were copied across three test files; the cleanup phase gave
 * them one home.
 *
 * The 50 ms settle is the collapsible's state flip reaching the DOM in the
 * browser runner — not a timing hope, a render tick.
 */

const SETTLE_MS = 50;

function settle(): Promise<void> {
  return new Promise((r) => setTimeout(r, SETTLE_MS));
}

/** Open the collapsible whose `data-testid` wrapper is `testId`. */
export async function openSection(
  container: Element,
  testId: string,
): Promise<void> {
  const button = container.querySelector(
    `[data-testid="${testId}"] [aria-expanded="false"]`,
  ) as HTMLElement | null;
  button?.click();
  await settle();
}

/** The Implementation Plan section, whose body holds the phases. */
export function openImplPlan(container: Element): Promise<void> {
  return openSection(container, "phases-section");
}

/** Every phase inside the Implementation Plan is its own collapsible; open them all. */
export async function openAllPhases(container: Element): Promise<void> {
  for (const button of container.querySelectorAll(
    '[data-testid="phases-section"] button[aria-expanded="false"]',
  )) {
    (button as HTMLButtonElement).click();
  }
  await settle();
}
