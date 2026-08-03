// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  KeyRound,
  Loader2,
  Plus,
  Search,
  ShieldOff,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { xdr } from "@stellar/stellar-sdk";
import { useAccount, useConnectors, useReconnect, useSignMessage } from "wagmi";
import { useSocketFi } from "@socketfi/react";

import { useStates } from "../../context/StatesContext";
import { api } from "../../services/sessionAutomation.client";
import {
  getSocketFiAuthMethod,
  getSocketFiEvmSigner,
  getSocketFiStellarSigner,
  signAndSubmitSmartAccountInvocation,
} from "../../services/automationWalletSigning";

function transactionHash(response: any): string | undefined {
  return (
    response?.txHash ||
    response?.hash ||
    response?.transactionHash ||
    response?.data?.txHash ||
    response?.data?.hash
  );
}

function bytesFromHex(value: string): Uint8Array {
  const normalized = String(value || "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Session policy ID must be a 32-byte hexadecimal value");
  }
  return Uint8Array.from(
    normalized.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16))
  );
}

function short(value?: string, start = 10, end = 8): string {
  if (!value) return "—";
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Unable to complete the request";
}

function statusClasses(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    case "REVOKED":
    case "INVALIDATED":
      return "bg-rose-50 text-rose-700 ring-rose-100";
    case "EXPIRED":
      return "bg-amber-50 text-amber-700 ring-amber-100";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

export default function SettingsSessionsPage() {
  const navigate = useNavigate();
  const socketfi = useSocketFi();
  const { activeSession, selectedNetwork, toast } = useStates();
  const {
    address: connectedEvmAddress,
    connector: connectedEvmConnector,
    isConnected: isEvmConnected,
  } = useAccount();
  const evmConnectors = useConnectors();
  const { reconnectAsync: reconnectEvmAsync } = useReconnect();
  const { signMessageAsync } = useSignMessage();

  const token = activeSession?.accessToken || "";
  const wallet = activeSession?.userProfile?.address?.[selectedNetwork] || "";
  const authMethod = getSocketFiAuthMethod(activeSession);
  const stellarSigner = getSocketFiStellarSigner(activeSession);
  const evmSigner = getSocketFiEvmSigner(activeSession);

  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await api.listSessions(
        selectedNetwork,
        token,
        status,
        search.trim()
      );
      setItems(Array.isArray(result) ? result : result?.items || []);
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setLoading(false);
    }
  }, [search, selectedNetwork, status, toast, token]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const activeCount = useMemo(
    () => items.filter((item) => item.status === "ACTIVE").length,
    [items]
  );

  const successfulUses = useMemo(
    () => items.reduce((total, item) => total + Number(item.useCount || 0), 0),
    [items]
  );

  async function signInvocation(
    functionName: string,
    argsXdr: string[],
    description: string,
    values: any[]
  ) {
    return signAndSubmitSmartAccountInvocation({
      authMethod,
      network: selectedNetwork,
      walletAddress: wallet,
      contractId: wallet,
      callFunction: { name: functionName },
      argsXdr,
      accessToken: token,
      stellarSigner,
      evmSigner,
      connectedEvmAddress,
      isEvmConnected,
      signMessageAsync,
      evmConnectors,
      connectedEvmConnector,
      reconnectEvmAsync,
      evmConnectorId: activeSession?.evmConnectorId,
      evmConnectorType: activeSession?.evmConnectorType,
      evmConnectorName: activeSession?.evmConnectorName,
      socketfi,
      display: { description, values },
    });
  }

  async function revoke(session: any) {
    if (session.status !== "ACTIVE") return;
    setWorking(session.policyIdHex);

    try {
      const response = await signInvocation(
        "revoke_session",
        [xdr.ScVal.scvBytes(bytesFromHex(session.policyIdHex)).toXDR("base64")],
        "Revoke delegated session",
        [
          { policyId: session.policyIdHex },
          { delegate: session.delegatePublicKey },
          { uses: session.useCount || 0 },
        ]
      );

      const txHash = transactionHash(response);
      if (!txHash) throw new Error("No transaction hash was returned");

      await api.confirmRevoke(
        {
          network: selectedNetwork,
          policyIdHex: session.policyIdHex,
          transactionHash: txHash,
        },
        token
      );

      toast.success("Session revoked");
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setWorking("");
    }
  }

  async function revokeAll() {
    if (!activeCount) return;
    setWorking("ALL");

    try {
      const response = await signInvocation(
        "revoke_all_sessions",
        [],
        "Invalidate all delegated sessions",
        [{ activeSessions: activeCount }, { network: selectedNetwork }]
      );

      const txHash = transactionHash(response);
      if (!txHash) throw new Error("No transaction hash was returned");

      await api.confirmRevokeAll(
        {
          network: selectedNetwork,
          walletAddress: wallet,
          transactionHash: txHash,
        },
        token
      );

      toast.success("All sessions invalidated");
      setConfirmAllOpen(false);
      await load();
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setWorking("");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full space-y-5 px-0 py-4 sm:px-6 md:px-8">
      <button
        type="button"
        onClick={() => navigate("/settings")}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to settings
      </button>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
              <KeyRound className="h-4 w-4" />
              Delegated access
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Manage sessions
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Review delegates, policy limits, linked automations, and usage.
              Revoke one session or invalidate every existing session by
              advancing the account session epoch.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/automations/new")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Create automation
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Active", activeCount],
          ["Total", items.length],
          ["Successful uses", successfulUses],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <Activity className="h-5 w-5 text-slate-400" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-lg flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search policy, delegate, label, or automation"
              className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="REVOKED">Revoked</option>
              <option value="EXPIRED">Expired</option>
              <option value="INVALIDATED">Invalidated</option>
            </select>

            <button
              type="button"
              disabled={!activeCount || working === "ALL"}
              onClick={() => setConfirmAllOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {working === "ALL" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldOff className="h-4 w-4" />
              )}
              Revoke all
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <KeyRound className="h-7 w-7 text-slate-400" />
            </div>
            <p className="mt-4 font-semibold text-slate-950">
              No sessions found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try another filter or create a new automation session.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((session) => (
              <button
                type="button"
                key={session.policyIdHex}
                onClick={() => setSelected(session)}
                className="grid w-full gap-3 p-4 text-left transition hover:bg-slate-50 sm:grid-cols-[1.5fr_1fr_100px_120px] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">
                    {session.label || "Delegated session"}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-slate-400">
                    {session.policyIdHex}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Delegate</p>
                  <p className="mt-1 truncate font-mono text-xs text-slate-700">
                    {session.delegatePublicKey || "—"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Usage</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {session.useCount || 0}
                    {session.maxUses == null ? "" : ` / ${session.maxUses}`}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClasses(
                    session.status
                  )}`}
                >
                  {session.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-[220]">
          <button
            type="button"
            aria-label="Close session details"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />

          <aside className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Session details
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-950">
                  {short(selected.policyIdHex, 14, 10)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [
                    "Used",
                    `${selected.useCount || 0}${
                      selected.maxUses == null ? "" : ` / ${selected.maxUses}`
                    }`,
                  ],
                  ["Delegate", short(selected.delegatePublicKey)],
                  ["Automation", selected.automationId || "None"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-2 break-all text-sm font-semibold text-slate-950">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-950">
                  Policy permissions
                </h3>
                <div className="mt-3 space-y-2">
                  {selected.allowedInvocations?.length ? (
                    selected.allowedInvocations.map((permission) => (
                      <div
                        className="rounded-xl bg-slate-50 p-3"
                        key={`${permission.contractId}:${permission.functionName}`}
                      >
                        <p className="font-mono text-xs text-slate-500">
                          {short(permission.contractId)}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">
                          {permission.functionName}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No invocation metadata is indexed for this session.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-950">Recent usage</h3>
                <div className="mt-3 space-y-2">
                  {selected.usageEvents?.length ? (
                    selected.usageEvents
                      .slice()
                      .reverse()
                      .slice(0, 10)
                      .map((event) => (
                        <div
                          key={event.executionId}
                          className="rounded-xl bg-slate-50 p-3"
                        >
                          <p className="text-sm font-semibold text-slate-950">
                            {event.status}
                          </p>
                          <p className="mt-1 truncate font-mono text-xs text-slate-400">
                            {event.executionId}
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
                  type="button"
                  disabled={working === selected.policyIdHex}
                  onClick={() => void revoke(selected)}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
                >
                  {working === selected.policyIdHex ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldOff className="h-4 w-4" />
                  )}
                  {working === selected.policyIdHex
                    ? "Revoking…"
                    : "Revoke session"}
                </button>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}

      {confirmAllOpen ? (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setConfirmAllOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <ShieldOff className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-950">
              Revoke all active sessions?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This advances the account session epoch and immediately
              invalidates all {activeCount} active sessions. This action cannot
              be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmAllOpen(false)}
                className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={working === "ALL"}
                onClick={() => void revokeAll()}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
              >
                {working === "ALL" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Revoke all
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
