import type { HTMLAttributes } from "react";
import clsx from "clsx";

export type StatusBadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "information";

export type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusBadgeTone;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  neutral:
    "border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]",
  success:
    "border-[var(--color-success-border)] bg-[var(--color-success-surface)] text-[var(--color-success)]",
  warning:
    "border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] text-[var(--color-warning)]",
  danger:
    "border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] text-[var(--color-danger)]",
  information:
    "border-[var(--color-information-border)] bg-[var(--color-information-surface)] text-[var(--color-information)]",
};

export function StatusBadge({
  className,
  tone = "neutral",
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
