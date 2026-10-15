"use client";

import { useIsCurrent } from "@/components/NavLink";
import { PlanRow, type PlanRowProps } from "@/components/ui/PlanRow";
import { ViewLink, type ViewLinkProps } from "@/components/ui/ViewLink";

/**
 * The nav's rows and links that know whether their page is the open one. The
 * layout is a server component and cannot read the path, so these read it and
 * hand `PlanRow` and `ViewLink` the `current` they already draw.
 */

export function NavPlanRow({
  href,
  ...rest
}: Omit<PlanRowProps, "current" | "href"> & { href: string }) {
  const current = useIsCurrent(href);
  return <PlanRow href={href} current={current} {...rest} />;
}

export function NavViewLink({
  href,
  ...rest
}: Omit<ViewLinkProps, "current" | "href"> & { href: string }) {
  const current = useIsCurrent(href);
  return <ViewLink href={href} current={current} {...rest} />;
}
