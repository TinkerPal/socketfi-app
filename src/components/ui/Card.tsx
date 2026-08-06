import { forwardRef, type HTMLAttributes } from "react";
import clsx from "clsx";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: "none" | "sm" | "md" | "lg";
};

const paddingClasses: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, padding = "md", ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(
        "rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-surface)] shadow-sm",
        paddingClasses[padding],
        className
      )}
      {...props}
    />
  );
});
