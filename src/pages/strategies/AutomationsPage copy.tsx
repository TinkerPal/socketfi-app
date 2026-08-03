// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStates } from "../../context/StatesContext";
import { api } from "../../services/sessionAutomation.client";
const labels = {
  DISBURSEMENT: "Disbursement",
  DCA: "Dollar-cost averaging",
  REBALANCE: "Portfolio rebalancing",
  AMPLIDEX_LONG: "Amplidex long",
  AMPLIDEX_SHORT: "Amplidex short",
};
export default function AutomationsPage() {
  const navigate = useNavigate();
  const { activeSession, selectedNetwork, toast } = useStates();
  const token = activeSession?.accessToken || "";
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [working, setWorking] = useState(""),
    [status, setStatus] = useState(""),
    [type, setType] = useState("");
  const load = useCallback(async () => {
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setItems(await api.listAutomations(selectedNetwork, token, status, type));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, selectedNetwork, status, type]);
  useEffect(() => {
    void load();
  }, [load]);
  const active = useMemo(
    () => items.filter((x) => x.status === "ACTIVE").length,
    [items]
  );
  async function change(x, next) {
    setWorking(x.automationId);
    try {
      await api.updateAutomation(x.automationId, next, token);
      toast.success(`Automation ${next.toLowerCase()}`);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking("");
    }
  }
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              <Bot className="h-4 w-4" />
              Advanced automation
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-slate-950">
              Strategies & automation
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Manage scheduled disbursements, DCA, rebalancing, and Amplidex
              long or short strategies backed by scoped sessions.
            </p>
          </div>
          <button
            onClick={() => navigate("/automations/new")}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            New automation
          </button>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Active", active],
          ["Total", items.length],
          ["Successful runs", items.reduce((n, x) => n + (x.runCount || 0), 0)],
        ].map(([l, v]) => (
          <div
            key={l}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <p className="text-xs uppercase text-slate-400">{l}</p>
            <p className="mt-2 text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </section>
      <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-11 rounded-xl border px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option>ACTIVE</option>
              <option>PAUSED</option>
              <option>COMPLETED</option>
              <option>CANCELLED</option>
              <option>FAILED</option>
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-11 rounded-xl border px-3 text-sm"
            >
              <option value="">All strategies</option>
              {Object.entries(labels).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void load()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center">
            <Bot className="h-9 w-9 text-slate-300" />
            <p className="mt-4 font-semibold">No automations found</p>
          </div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((x) => (
              <article key={x.automationId} className="rounded-2xl border p-5">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-slate-400">
                      {labels[x.type] || x.type}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold">{x.name}</h2>
                  </div>
                  <span className="h-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                    {x.status}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                  <div>
                    <p className="text-slate-400">Runs</p>
                    <p className="mt-1 font-semibold">
                      {x.runCount}
                      {x.maxRuns == null ? "" : ` / ${x.maxRuns}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Schedule</p>
                    <p className="mt-1 truncate font-semibold">
                      {x.schedule?.expression || "—"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 truncate font-mono text-xs text-slate-400">
                  {x.policyIdHex}
                </p>
                <div className="mt-5 flex gap-2 border-t pt-4">
                  {x.status === "ACTIVE" ? (
                    <button
                      disabled={working === x.automationId}
                      onClick={() => void change(x, "PAUSED")}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold"
                    >
                      <Pause className="h-4 w-4" />
                      Pause
                    </button>
                  ) : x.status === "PAUSED" ? (
                    <button
                      disabled={working === x.automationId}
                      onClick={() => void change(x, "ACTIVE")}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold"
                    >
                      <Play className="h-4 w-4" />
                      Resume
                    </button>
                  ) : null}
                  {!["CANCELLED", "COMPLETED"].includes(x.status) ? (
                    <button
                      disabled={working === x.automationId}
                      onClick={() => void change(x, "CANCELLED")}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-700"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
