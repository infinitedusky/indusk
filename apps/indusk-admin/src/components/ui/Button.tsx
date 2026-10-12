import { type ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-surface hover:bg-ink-soft active:bg-ink-soft",
  secondary: "bg-idle-wash text-ink hover:bg-line active:bg-ink-faint",
  ghost: "bg-transparent text-ink-soft hover:bg-idle-wash active:bg-idle-wash",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2 py-1 text-sm",
  md: "px-4 py-2 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", className = "", children, ...rest },
    ref,
  ) => {
    const classes = [
      "inline-flex items-center justify-center rounded-md font-medium transition-colors",
      "focus:outline-2 focus:outline-dusk focus:outline-offset-1",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      variantClasses[variant],
      sizeClasses[size],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button ref={ref} data-component="button" className={classes} {...rest}>
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
