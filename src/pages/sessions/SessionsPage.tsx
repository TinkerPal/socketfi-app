// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  KeyRound,
  Loader2,
  Plus,
  Search,
  ShieldOff,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSocketFi } from "@socketfi/react";
import { xdr } from "@stellar/stellar-sdk";
import { useStates } from "../../context/StatesContext";
import { api } from "../../services/sessionAutomation.client";
const hash = (r) =>
  r?.txHash || r?.hash || r?.transactionHash || r?.data?.txHash;
const bytes = (h) =>
  Uint8Array.from(h.match(/.{2}/g).map((x) => parseInt(x, 16)));
const short = (v, a = 10, b = 8) =>
  !v ? "—" : v.length <= a + b + 1 ? v : `${v.slice(0, a)}…${v.slice(-b)}`;
export default function SessionsPage() {
  const socketfi = useSocketFi(),
    navigate = useNavigate();
  const { activeSession, selectedNetwork, toast } = useStates();
  const token = activeSession?.accessToken || "",
    wallet = activeSession?.userProfile?.address?.[selectedNetwork] || "";
  const [items, setItems] = useState([]),
    [selected, setSelected] = useState(null),
    [loading, setLoading] = useState(true),
    [working, setWorking] = useState(""),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState("");
  const load = useCallback(async () => {
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setItems(await api.listSessions(selectedNetwork, token, status, search));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, selectedNetwork, status, search]);
  useEffect(() => {
    void load();
  }, [load]);
  const active = useMemo(
    () => items.filter((x) => x.status === "ACTIVE").length,
    [items]
  );
  async function revoke(s) {
    setWorking(s.policyIdHex);
    try {
      const r = await socketfi.signAndSubmitTx({
        contractId: wallet,
        callFunction: { name: "revoke_session" },
        argsXdr: [xdr.ScVal.scvBytes(bytes(s.policyIdHex)).toXDR("base64")],
        accessToken: token,
        displayMode: "full",
        description: "Revoke delegated session",
        values: [
          { policyId: s.policyIdHex },
          { delegate: s.delegatePublicKey },
          { uses: s.useCount },
        ],
      });
      const tx = hash(r);
      if (!tx) throw new Error("No transaction hash returned");
      await api.confirmRevoke(
        {
          network: selectedNetwork,
          policyIdHex: s.policyIdHex,
          transactionHash: tx,
        },
        token
      );
      toast.success("Session revoked");
      setSelected(null);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setWorking("");
    }
  }
  async function revokeAll() {
    if (!active || !confirm(`Revoke all ${active} active sessions?`)) return;
    setWorking("ALL");
    try {
      const r = await socketfi.signAndSubmitTx({
        contractId: wallet,
        callFunction: { name: "revoke_all_sessions" },
        argsXdr: [],
        accessToken: token,
        displayMode: "full",
        description: "Invalidate all delegated sessions",
        values: [{ activeSessions: active }, { network: selectedNetwork }],
      });
      const tx = hash(r);
      if (!tx) throw new Error("No transaction hash returned");
      await api.confirmRevokeAll(
        {
          network: selectedNetwork,
          walletAddress: wallet,
          transactionHash: tx,
        },
        token
      );
      toast.success("All sessions invalidated");
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
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <KeyRound className="h-4 w-4" />
              Delegated sessions
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-slate-950">
              Session management
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Review delegates, policy limits, linked automations and usage.
              Revoke one session or invalidate every session through the account
              epoch.
            </p>
          </div>
          <button
            onClick={() => navigate("/automations/new")}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Create session
          </button>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Active", active],
          ["Total", items.length],
          ["Successful uses", items.reduce((n, x) => n + (x.useCount || 0), 0)],
        ].map(([l, v]) => (
          <div
            key={l}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <Activity className="h-5 w-5 text-slate-400" />
            <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
              {l}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{v}</p>
          </div>
        ))}
      </section>
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:justify-between">
          <div className="relative max-w-lg flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search policy, delegate or automation"
              className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option>ACTIVE</option>
              <option>REVOKED</option>
              <option>EXPIRED</option>
              <option>INVALIDATED</option>
            </select>
            <button
              disabled={!active || working === "ALL"}
              onClick={() => void revokeAll()}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 disabled:opacity-40"
            >
              <ShieldOff className="h-4 w-4" />
              Revoke all
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center">
            <KeyRound className="h-9 w-9 text-slate-300" />
            <p className="mt-4 font-semibold">No sessions found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((s) => (
              <button
                key={s.policyIdHex}
                onClick={() => setSelected(s)}
                className="grid w-full gap-3 p-4 text-left hover:bg-slate-50 sm:grid-cols-[1.5fr_1fr_100px_110px]"
              >
                <div>
                  <p className="font-semibold text-slate-950">{s.label}</p>
                  <p className="mt-1 truncate font-mono text-xs text-slate-400">
                    {s.policyIdHex}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Delegate</p>
                  <p className="mt-1 truncate font-mono text-xs">
                    {s.delegatePublicKey}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Usage</p>
                  <p className="mt-1 font-semibold">
                    {s.useCount}
                    {s.maxUses == null ? "" : ` / ${s.maxUses}`}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                  {s.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
      {selected ? (
        <div className="fixed inset-0 z-[220]">
          <button
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setSelected(null)}
          />
          <aside className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Session details
                </p>
                <p className="mt-1 font-mono text-sm">
                  {short(selected.policyIdHex, 14, 10)}
                </p>
              </div>
              <button onClick={() => setSelected(null)}>
                <X />
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [
                    "Used",
                    `${selected.useCount}${
                      selected.maxUses == null ? "" : ` / ${selected.maxUses}`
                    }`,
                  ],
                  ["Delegate", short(selected.delegatePublicKey)],
                  ["Automation", selected.automationId || "None"],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-400">{l}</p>
                    <p className="mt-2 break-all text-sm font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border p-4">
                <h3 className="font-semibold">Policy permissions</h3>
                <div className="mt-3 space-y-2">
                  {selected.allowedInvocations?.length ? (
                    selected.allowedInvocations.map((x) => (
                      <div
                        className="rounded-xl bg-slate-50 p-3"
                        key={`${x.contractId}:${x.functionName}`}
                      >
                        <p className="font-mono text-xs">
                          {short(x.contractId)}
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {x.functionName}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No invocation metadata indexed.
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border p-4">
                <h3 className="font-semibold">Recent usage</h3>
                <div className="mt-3 space-y-2">
                  {selected.usageEvents?.length ? (
                    selected.usageEvents
                      .slice()
                      .reverse()
                      .slice(0, 10)
                      .map((e) => (
                        <div
                          key={e.executionId}
                          className="rounded-xl bg-slate-50 p-3"
                        >
                          <p className="text-sm font-semibold">{e.status}</p>
                          <p className="mt-1 truncate font-mono text-xs text-slate-400">
                            {e.executionId}
                          </p>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      This session has not been used.
                    </p>
                  )}
                </div>
              </div>
              {selected.status === "ACTIVE" ? (
                <button
                  disabled={working === selected.policyIdHex}
                  onClick={() => void revoke(selected)}
                  className="h-12 w-full rounded-2xl bg-rose-600 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {working === selected.policyIdHex
                    ? "Revoking…"
                    : "Revoke session"}
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
