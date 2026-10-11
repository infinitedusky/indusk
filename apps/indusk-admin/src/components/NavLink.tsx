"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

type NavLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/**
 * A nav link that knows whether its page is the open one. The layout is a
 * server component and cannot read the path; this is the one place that does,
 * so a plan, Promises and every other entry mark themselves `aria-current`
 * the same way.
 */
export function NavLink({ href, children, ...rest }: NavLinkProps) {
  const pathname = usePathname();
  const current =
    pathname !== null &&
    pathname !== undefined &&
    (pathname === href || pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      data-component="view-link"
      aria-current={current ? "page" : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}
