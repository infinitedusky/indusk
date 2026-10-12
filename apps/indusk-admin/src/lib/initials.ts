/**
 * The two letters a plan's mark carries in the nav: the first letter of its
 * first two words (`ui-promises` is `UP`), or its first two letters when it
 * is one word (`cleanup` is `CL`).
 */
export function initialsOf(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters =
    words.length === 1
      ? (words[0] ?? "").slice(0, 2)
      : `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`;
  return letters.toUpperCase();
}
