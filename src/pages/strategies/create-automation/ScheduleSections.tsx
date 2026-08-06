import type { ReactNode } from "react";

export type ScheduleSectionProps = { children: ReactNode };

export function ScheduleSection({ children }: ScheduleSectionProps) {
  return (
    <section className="rounded-2xl border border-[#EAECF0] bg-white p-4">
      {children}
    </section>
  );
}

export type LimitsSectionProps = { children: ReactNode };

export function LimitsSection({ children }: LimitsSectionProps) {
  return <>{children}</>;
}
