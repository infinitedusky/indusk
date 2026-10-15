/**
 * Which Paths sit inside which (cockpit-audit-fixes, Build Phase 3): the one
 * place the dashboard's grouping and the nav's ask "is this Path inside that
 * one", so a promise and its plan are put under the same, innermost Path in
 * both. `subplans` maps a parent plan to the names it declares; a name that is
 * itself a key is a Path inside it, to any depth. A master naming its own
 * ancestor stops at the repeat, and two Paths that declare each other sit
 * inside neither: nesting is strict.
 *
 * promise: a-promise-sits-in-its-innermost-path
 */
export function pathsInside(
  subplans: Record<string, readonly string[]>,
  path: string,
): Set<string> {
  const inside = new Set<string>();
  const pending = [path];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    for (const child of subplans[current] ?? []) {
      if (child === path || inside.has(child) || !(child in subplans)) continue;
      inside.add(child);
      pending.push(child);
    }
  }
  for (const other of inside) {
    if (pathsReach(subplans, other, path)) inside.delete(other);
  }
  return inside;
}

/** Whether `from` declares `target`, directly or through Paths it declares. */
function pathsReach(
  subplans: Record<string, readonly string[]>,
  from: string,
  target: string,
): boolean {
  const seen = new Set<string>([from]);
  const pending = [from];
  while (pending.length > 0) {
    for (const child of subplans[pending.pop() as string] ?? []) {
      if (child === target) return true;
      if (seen.has(child) || !(child in subplans)) continue;
      seen.add(child);
      pending.push(child);
    }
  }
  return false;
}

/** The names declared by the Paths inside `path`, not by `path` itself. */
export function declaredWithin(
  subplans: Record<string, readonly string[]>,
  path: string,
): Set<string> {
  const names = new Set<string>();
  for (const inner of pathsInside(subplans, path)) {
    for (const name of subplans[inner] ?? []) names.add(name);
  }
  return names;
}

/** The innermost Path of those that declare `plan`: the one no other candidate sits inside. */
export function innermostPath(
  subplans: Record<string, readonly string[]>,
  plan: string,
): string | null {
  const declaring = Object.entries(subplans)
    .filter(([, plans]) => plans.includes(plan))
    .map(([path]) => path);
  return (
    declaring.find(
      (c) => !declaring.some((o) => o !== c && pathsInside(subplans, c).has(o)),
    ) ??
    declaring[0] ??
    null
  );
}
