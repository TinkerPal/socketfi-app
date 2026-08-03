import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { Reserve } from "./types";

export function StatCard({ label, value, helper, icon: Icon }: { label: string; value: string | number; helper?: string; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold text-slate-950">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
        </div>
        <div className="h-fit rounded-xl bg-slate-100 p-2 text-slate-600"><Icon className="h-4 w-4" /></div>
      </div>
    </div>
  );
}

export function TokenIcon({ reserve, token, size = "md" }: { reserve: Reserve; token?: any; size?: "sm" | "md" | "lg" }) {
  const image = token?.icon || token?.logo;
  const className = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return (
    <div title={`${reserve.symbol} · ${reserve.asset}`} className={`flex ${className} shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm`}>
      {image ? <img src={image} alt={reserve.symbol} className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold text-slate-600">{reserve.symbol.slice(0, 4)}</span>}
    </div>
  );
}

export function MetricRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><span className="text-right font-semibold text-slate-950">{value}</span></div>;
}
