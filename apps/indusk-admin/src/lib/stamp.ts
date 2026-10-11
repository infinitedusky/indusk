/**
 * A time as the cockpit writes it: `YYYY-MM-DD HH:MM`, UTC, from an ISO
 * string. One definition, so the dashboard, a promise's page, a plan's history
 * and the timeline read a time the same way (plan-cockpit A43).
 *
 * promise: display-names-are-defined-once
 */
export function stamp(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}
