// @ts-nocheck
export default function SocketMetricCard({ label, value, icon }) {
  return (
    <div className="rounded-[20px] border border-[#dbe3ef] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className="shrink-0 rounded-xl bg-[#f4f7fb] p-2 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}
