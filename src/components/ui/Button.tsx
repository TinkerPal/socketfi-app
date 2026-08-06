import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[var(--color-action-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-action-primary-hover)] disabled:bg-[var(--color-action-primary-disabled)]",
  secondary:
    "border-[var(--color-border-default)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)]",
  quiet:
    "border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]",
  danger:
    "border-transparent bg-[var(--color-danger)] text-[var(--color-text-inverse)] hover:opacity-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      className,
      leadingIcon,
      size = "md",
      trailingIcon,
      type = "button",
      variant = "primary",
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border font-semibold shadow-sm transition-colors duration-[var(--motion-duration-fast)] disabled:cursor-not-allowed disabled:opacity-60",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
        {children}
        {trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
      </button>
    );
  }
);
