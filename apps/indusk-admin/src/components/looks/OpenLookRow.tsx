"use client";

import { LookRow, type LookRowProps } from "@/components/ui/LookRow";

/**
 * A `LookRow` whose Open goes to `href`. The page that lists looks is drawn on
 * the server and cannot hand a row a function, so this is the one place the
 * row's Open becomes a navigation.
 */
export function OpenLookRow({
  href,
  ...rest
}: Omit<LookRowProps, "onOpen"> & { href: string }) {
  return <LookRow {...rest} onOpen={() => window.location.assign(href)} />;
}
