import type { ReactNode } from "react";

export type DCAFormProps = { children: ReactNode };

export function DCAForm({ children }: DCAFormProps) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export type RebalanceFormProps = { children: ReactNode };

export function RebalanceForm({ children }: RebalanceFormProps) {
  return <div className="space-y-5">{children}</div>;
}

export type DistributionFormProps = { children: ReactNode };

export function DistributionForm({ children }: DistributionFormProps) {
  return <div className="space-y-5">{children}</div>;
}
