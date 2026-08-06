import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export type InlineAlertTone = "success" | "warning" | "danger" | "information";

export type InlineAlertProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  tone?: InlineAlertTone;
  icon?: ReactNode;
};

const toneClasses: Record<InlineAlertTone, string> = {
  success:
    "border-[var(--color-success-border)] bg-[var(--color-success-surface)] text-[var(--color-success)]",
  warning:
    "border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] text-[var(--color-warning)]",
  danger:
    "border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] text-[var(--color-danger)]",
  information:
    "border-[var(--color-information-border)] bg-[var(--color-information-surface)] text-[var(--color-information)]",
};

export function InlineAlert({
  children,
  className,
  icon,
  role,
  title,
  tone = "information",
  ...props
}: InlineAlertProps) {
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={clsx(
        "flex items-start gap-3 rounded-[var(--radius-card)] border p-4",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {icon ? <span className="mt-0.5 shrink-0" aria-hidden="true">{icon}</span> : null}
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {children ? (
          <div className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
