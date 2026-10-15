import { type ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-ink bg-ink text-surface hover:bg-ink-soft active:bg-ink-soft",
  secondary:
    "border border-line bg-surface text-ink hover:bg-idle-wash active:bg-idle-wash",
  ghost:
    "border border-transparent bg-transparent text-ink-soft hover:bg-idle-wash active:bg-idle-wash",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2 py-1 text-sm",
  md: "px-5 py-snug text-base",
};

/** A button's classes, for a link that is drawn as one. */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
): string {
  return [
    "inline-flex items-center justify-center rounded-lg font-semibold transition-colors",
    "focus:outline-2 focus:outline-dusk focus:outline-offset-1",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", className = "", children, ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      data-component="button"
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {children}
    </button>
  ),
);
Button.displayName = "Button";
