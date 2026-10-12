import type { LooksCheckout } from "@infinitedusky/indusk-mcp/looks/overview";
import { hrefOf, type Show } from "./address";

/**
 * The Looks page's three independent choices (storybook-components ADR
 * decision 6): **Show** — mockups, components, or both; **View** — the list
 * beside a stage, or the cascade; **Read from** — which checkout's files are
 * read. Each link keeps the other two, so choosing one never undoes another.
 */

const SHOWS: Array<[Show, string]> = [
  ["all", "All"],
  ["mockups", "Mockups"],
  ["components", "Components"],
];

function Choice({
  label,
  testId,
  hint,
  children,
}: {
  label: string;
  testId: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <nav
      className="flex flex-wrap items-center gap-2 text-sm text-ink-soft"
      data-testid={testId}
      aria-label={label}
      title={hint}
    >
      <span>{label}</span>
      {children}
    </nav>
  );
}

function ChoiceLink({
  href,
  current,
  title,
  children,
}: {
  href: string;
  current: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      title={title}
      className="rounded-md px-tight text-dusk hover:bg-dusk-wash aria-[current=page]:bg-dusk-wash"
    >
      {children}
    </a>
  );
}

export function LooksToolbar({
  path,
  show,
  view,
  checkout,
  checkouts,
}: {
  path: string;
  show: Show;
  view: "list" | "cascade";
  /** The plan whose worktree is read; null for the project's own checkout. */
  checkout: string | null;
  checkouts: LooksCheckout[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <Choice label="Show" testId="looks-show">
        {SHOWS.map(([value, text]) => (
          <ChoiceLink
            key={value}
            href={hrefOf(path, { show: value, view, checkout })}
            current={show === value}
          >
            {text}
          </ChoiceLink>
        ))}
      </Choice>
      <Choice label="View" testId="looks-views">
        {(["list", "cascade"] as const).map((v) => (
          <ChoiceLink
            key={v}
            href={hrefOf(path, { show, view: v, checkout })}
            current={view === v}
          >
            {v}
          </ChoiceLink>
        ))}
      </Choice>
      {checkouts.length > 1 ? (
        <Choice
          label="Read from"
          testId="looks-checkouts"
          hint="Which checkout's files are read: the project's own, or the worktree of a plan whose looks are being worked there. Not a filter — the same mockups and components are read from each."
        >
          {checkouts.map((c) => (
            <ChoiceLink
              key={c.plan ?? "own"}
              href={hrefOf(path, { show, view, checkout: c.plan })}
              current={c.plan === checkout}
              title={c.branch ?? undefined}
            >
              {c.plan
                ? `plan ${c.plan}`
                : `project checkout${c.branch ? ` (${c.branch})` : ""}`}
            </ChoiceLink>
          ))}
        </Choice>
      ) : null}
    </div>
  );
}
