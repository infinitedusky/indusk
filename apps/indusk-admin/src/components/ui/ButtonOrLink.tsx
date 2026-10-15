import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

/**
 * The root a row or link in the nav and the lists is drawn on: a button when
 * it only stands in a story, a link when it is given somewhere to go. The
 * attributes are the same either way, in the same order, so a component's
 * snapshot does not depend on which one a page chose. Not a component a
 * mockup names: it carries no marker.
 */
export function ButtonOrLink({
  href,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { href?: string }) {
  if (href !== undefined) {
    return (
      <Link href={href} {...(rest as Record<string, unknown>)}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" {...rest}>
      {children}
    </button>
  );
}
