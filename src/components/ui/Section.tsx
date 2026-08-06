import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

export type SectionProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  surface?: boolean;
};

export function Section({
  actions,
  children,
  className,
  description,
  surface = false,
  title,
  ...props
}: SectionProps) {
  return (
    <section
      className={clsx(
        surface &&
          "rounded-[var(--radius-panel)] border border-[var(--color-border-default)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6",
        className
      )}
      {...props}
    >
      {title || description || actions ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <div className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                {description}
              </div>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
