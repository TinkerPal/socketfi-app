import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

import {
  getCctpExplorerSummary,
  getCctpTransfer,
  listCctpTransfers,
  type ExplorerFilters,
  type ExplorerNetwork,
  type ExplorerStatus,
  type ExplorerSummary,
  type ExplorerTransfer,
} from "../services/cctp-explorer.client";

const STATUS_OPTIONS: Array<{
  value: "" | ExplorerStatus;
  label: string;
}> = [
  { value: "", label: "All statuses" },
  { value: "PREPARED", label: "Prepared" },
  { value: "BURN_SUBMITTED", label: "Burn submitted" },
  { value: "BURN_CONFIRMED", label: "Burn confirmed" },
  { value: "ATTESTING", label: "Attesting" },
  { value: "ATTESTATION_READY", label: "Attestation ready" },
  { value: "MINT_SUBMITTED", label: "Mint submitted" },
  { value: "SUCCESS", label: "Completed" },
  { value: "FAILED_RETRYABLE", label: "Retrying" },
  { value: "FAILED_FINAL", label: "Failed" },
  { value: "SUPERSEDED", label: "Superseded" },
  { value: "EXPIRED", label: "Expired" },
];

function short(value?: string | null, start = 8, end = 6) {
  if (!value) return "—";
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatUsdc(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return `${value} USDC`;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(number)} USDC`;
}

function statusClasses(category: ExplorerTransfer["statusCategory"]) {
  if (category === "SUCCESS") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (category === "FAILED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (category === "WARNING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-indigo-200 bg-indigo-50 text-indigo-700";
}

function StatusBadge({ transfer }: { transfer: ExplorerTransfer }) {
  const Icon =
    transfer.statusCategory === "SUCCESS"
      ? CheckCircle2
      : transfer.statusCategory === "FAILED"
      ? XCircle
      : Clock3;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(
        transfer.statusCategory
      )}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {transfer.statusLabel}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

function DetailDrawer({
  transfer,
  onClose,
}: {
  transfer: ExplorerTransfer;
  onClose: () => void;
}) {
  const rows = [
    ["Session ID", transfer.id],
    ["Idempotency ID", transfer.idempotencyKey],
    ["Source sender", transfer.source.sender],
    ["Destination recipient", transfer.destination.recipient],
    ["Source transaction", transfer.source.txHash],
    ["Destination transaction", transfer.destination.txHash],
  ] as const;

  return (
    <div className="fixed inset-0 z-[200]">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
      />
      <aside className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              CCTP transfer
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {short(transfer.id, 10, 8)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-6 p-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <StatusBadge transfer={transfer} />
              <span className="text-xs font-medium text-slate-500">
                {transfer.speed === "FAST" ? "Fast" : "Standard"}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-slate-950"
                style={{ width: `${transfer.progress}%` }}
              />
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">Amount</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {formatUsdc(transfer.token.amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Estimated received</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatUsdc(transfer.token.estimatedReceived)}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Source
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {transfer.source.chainName}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {short(transfer.source.sender, 10, 8)}
              </p>
            </div>
            <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-slate-300 sm:rotate-0" />
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Destination
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {transfer.destination.chainName}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {short(transfer.destination.recipient, 10, 8)}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200">
            {rows.map(([label, value], index) => (
              <div
                key={label}
                className={`grid gap-2 px-4 py-3 sm:grid-cols-[150px_1fr_auto] ${
                  index ? "border-t border-slate-100" : ""
                }`}
              >
                <span className="text-xs font-medium text-slate-500">
                  {label}
                </span>
                <span className="break-all font-mono text-xs text-slate-800">
                  {value || "Pending"}
                </span>
                {value ? (
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(value)}
                    className="text-slate-400 hover:text-slate-950"
                    aria-label={`Copy ${label}`}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {transfer.source.explorerUrl ? (
              <a
                href={transfer.source.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Source explorer
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            {transfer.destination.explorerUrl ? (
              <a
                href={transfer.destination.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Stellar explorer
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 p-4 text-xs text-slate-500">
            <div className="flex justify-between gap-4">
              <span>Created</span>
              <span className="font-medium text-slate-800">
                {formatDate(transfer.createdAt)}
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span>Updated</span>
              <span className="font-medium text-slate-800">
                {formatDate(transfer.updatedAt)}
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span>Circle fee</span>
              <span className="font-medium text-slate-800">
                {formatUsdc(transfer.token.protocolFee)}
              </span>
            </div>
          </section>

          {transfer.lastError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {transfer.lastError}
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export default function CctpExplorerPage() {
  const initial = new URLSearchParams(window.location.search);
  const [queryInput, setQueryInput] = useState(initial.get("q") || "");
  const [query, setQuery] = useState(initial.get("q") || "");
  const [network, setNetwork] = useState<"" | ExplorerNetwork>(
    (initial.get("network") as ExplorerNetwork) || ""
  );
  const [status, setStatus] = useState<"" | ExplorerStatus>(
    (initial.get("status") as ExplorerStatus) || ""
  );
  const [speed, setSpeed] = useState<"" | "FAST" | "STANDARD">("");
  const [chainId, setChainId] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ExplorerTransfer[]>([]);
  const [summary, setSummary] = useState<ExplorerSummary | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ExplorerTransfer | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const filters = useMemo<ExplorerFilters>(
    () => ({
      q: query || undefined,
      network: network || undefined,
      status: status || undefined,
      speed: speed || undefined,
      chainId: chainId ? Number(chainId) : undefined,
      page,
      limit: 25,
      sort: "newest",
    }),
    [chainId, network, page, query, speed, status]
  );

  const load = useCallback(
    async (silent = false) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      silent ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const [list, overview] = await Promise.all([
          listCctpTransfers(filters, controller.signal),
          getCctpExplorerSummary(
            { network: network || undefined, window: "all" },
            controller.signal
          ),
        ]);

        setItems(list.items);
        setPagination(list.pagination);
        setSummary(overview);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") {
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load bridge transfers"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters, network]
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (network) params.set("network", network);
    if (status) params.set("status", status);

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${
        params.toString() ? `?${params.toString()}` : ""
      }`
    );
  }, [network, query, status]);

  useEffect(() => {
    void load();
    return () => requestRef.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!items.some((item) => item.isPending)) return;
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [items, load]);

  async function openTransfer(transfer: ExplorerTransfer) {
    setSelected(transfer);
    if (!transfer.isPending) return;
    try {
      setSelected(await getCctpTransfer(transfer.id));
    } catch {
      // Keep list data visible if detail refresh fails.
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Circle CCTP bridge explorer
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Track USDC transfers to SocketFi
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
              Search by source transaction, Stellar transaction, sender,
              recipient, session ID, or idempotency ID.
            </p>
          </div>

          <form
            className="relative mt-8"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQuery(queryInput.trim());
            }}
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search hash, sender, recipient, session or idempotency ID"
              className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-28 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
            <button
              type="submit"
              className="absolute right-2 top-2 inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total transfers"
            value={summary?.transfers.toLocaleString("en-US") || "—"}
            icon={Activity}
          />
          <MetricCard
            label="USDC volume"
            value={summary ? formatUsdc(summary.volumeUsdc) : "—"}
            icon={CircleDollarSign}
          />
          <MetricCard
            label="Completed"
            value={summary?.successful.toLocaleString("en-US") || "—"}
            icon={CheckCircle2}
          />
          <MetricCard
            label="Pending"
            value={summary?.pending.toLocaleString("en-US") || "—"}
            icon={Clock3}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-950">
                Bridge transfers
              </h2>
              <span className="text-xs text-slate-400">
                {pagination.total.toLocaleString("en-US")}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:flex">
              <select
                value={network}
                onChange={(event) => {
                  setPage(1);
                  setNetwork(event.target.value as "" | ExplorerNetwork);
                }}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">All networks</option>
                <option value="PUBLIC">Mainnet</option>
                <option value="TESTNET">Testnet</option>
              </select>

              <select
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value as "" | ExplorerStatus);
                }}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={speed}
                onChange={(event) => {
                  setPage(1);
                  setSpeed(event.target.value as "" | "FAST" | "STANDARD");
                }}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">All speeds</option>
                <option value="FAST">Fast</option>
                <option value="STANDARD">Standard</option>
              </select>

              <input
                value={chainId}
                onChange={(event) => {
                  setPage(1);
                  setChainId(event.target.value.replace(/\D/g, ""));
                }}
                placeholder="Source chain ID"
                inputMode="numeric"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm lg:w-36"
              />

              <button
                type="button"
                onClick={() => void load(true)}
                disabled={refreshing}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>

          {error ? (
            <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <Search className="h-8 w-8 text-slate-300" />
              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No bridge transfers found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Check the identifier or remove some filters.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1050px] text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Transfer</th>
                      <th className="px-5 py-3">Route</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((transfer) => (
                      <tr
                        key={transfer.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <p className="font-mono text-xs font-semibold text-slate-900">
                            {short(
                              transfer.source.txHash || transfer.id,
                              10,
                              8
                            )}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {short(transfer.idempotencyKey, 8, 6)}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-slate-800">
                              {transfer.source.chainName}
                            </span>
                            <ArrowRight className="h-4 w-4 text-slate-300" />
                            <span className="font-medium text-slate-800">
                              Stellar
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-xs text-slate-400">
                            {short(transfer.destination.recipient, 7, 6)}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-950">
                            {formatUsdc(transfer.token.amount)}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {transfer.speed === "FAST" ? "Fast" : "Standard"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge transfer={transfer} />
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">
                          {formatDate(transfer.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => void openTransfer(transfer)}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-white"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {items.map((transfer) => (
                  <button
                    type="button"
                    key={transfer.id}
                    onClick={() => void openTransfer(transfer)}
                    className="block w-full p-4 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold text-slate-900">
                          {short(transfer.source.txHash || transfer.id, 10, 8)}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          {formatUsdc(transfer.token.amount)}
                        </p>
                      </div>
                      <StatusBadge transfer={transfer} />
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <span>{transfer.source.chainName}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                      <span>Stellar</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {formatDate(transfer.createdAt)}
                    </p>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-4">
                <p className="text-xs text-slate-500">
                  Page {pagination.page} of {pagination.totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!pagination.hasPreviousPage}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!pagination.hasNextPage}
                    onClick={() => setPage((value) => value + 1)}
                    className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <p className="pb-8 text-center text-xs leading-5 text-slate-400">
          SocketFi only sponsors the Stellar fee. USDC is burned on the source
          chain and minted directly to the destination through Circle CCTP.
        </p>
      </div>

      {selected ? (
        <DetailDrawer transfer={selected} onClose={() => setSelected(null)} />
      ) : null}
    </main>
  );
}
