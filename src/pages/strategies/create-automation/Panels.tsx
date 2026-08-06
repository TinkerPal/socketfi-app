import type { ReactNode } from "react";

export type SummarySidebarProps = { children: ReactNode };
export function SummarySidebar({ children }: SummarySidebarProps) {
  return <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">{children}</aside>;
}

export type ReviewPanelProps = { children: ReactNode };
export function ReviewPanel({ children }: ReviewPanelProps) {
  return <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">{children}</section>;
}

export type AuthorizationPanelProps = { children: ReactNode };
export function AuthorizationPanel({ children }: AuthorizationPanelProps) {
  return <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">{children}</section>;
}
