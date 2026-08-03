import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ArrowLeftRight,
  WalletCards,
} from "lucide-react";

import { useStates } from "../context/StatesContext";
import { mask_middle } from "../utils/helper-functions";

type Network = "TESTNET" | "PUBLIC";
type Direction = "IN" | "OUT" | null;
type TransactionStatus = "SUCCESS" | "FAILED" | string;

interface SessionShape {
  userProfile?: {
    address?: Partial<Record<Network, string>>;
  };
}

interface IndexedTransaction {
  id: string;
  network: Network;
  walletId: string;
  walletAddress: string;
  txHash: string;
  ledger: string;
  ledgerClosedAt: string;
  status: TransactionStatus;
  successful: boolean;
  actionType: string;
  functionName: string;
  invokedContract: string;
  sourceAccount: string;
  feeChargedStroops: string | null;
  operationIndex: number;
  eventIndex: number;
  assetContract: string | null;
  assetSymbol: string;
  assetDecimals: number;
  amountAtomic: string | null;
  amount: string | null;
  direction: Direction;
  fromAddress: string | null;
  toAddress: string | null;
  counterparty: string | null;
  priceUsd: string;
  valueUsd: string;
  priceSource: string;
  memoType: string | null;
  memoValue: string | null;
  authAddresses: string[];
  indexedAt: string;
  updatedAt: string;
  explorerUrl: string;
}

interface TransactionHistoryResponse {
  success: boolean;
  network: Network;
  walletAddress: string;
  total: number;
  limit: number;
  offset: number;
  items: IndexedTransaction[];
  error?: string;
  message?: string;
}

interface TransactionHistoryProps {
  full?: boolean;
  onOpenAll?: () => void;
  onClose?: () => void;
  className?: string;
}

interface TransactionMeta {
  label: string;
  badge: string;
  iconSurface: string;
  amountClass: string;
  icon: typeof ArrowDownLeft;
}

const INDEXER_API_URL = (
  import.meta.env.VITE_INDEXER_API_URL || "http://localhost:4015"
).replace(/\/$/, "");

const INDEXER_API_KEY = import.meta.env.VITE_INDEXER_API_KEY || "";

const COMPACT_PAGE_SIZE = 5;
const FULL_PAGE_SIZE = 25;

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to load transaction history.";
}

function normalizeSymbol(symbol: string | null | undefined): string {
  const value = symbol?.trim();

  if (!value || value.toLowerCase() === "unknown") {
    return "";
  }

  return value.toLowerCase() === "native" ? "XLM" : value;
}

function parseNumeric(value: string | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTokenAmount(
  amount: string | null,
  symbol: string | null | undefined
): string {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (amount == null) {
    return normalizedSymbol || "—";
  }

  const numeric = parseNumeric(amount);

  if (numeric === null) {
    return `${amount}${normalizedSymbol ? ` ${normalizedSymbol}` : ""}`;
  }

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 7,
  }).format(numeric);

  return `${formatted}${normalizedSymbol ? ` ${normalizedSymbol}` : ""}`;
}

function formatUsd(value: string | null | undefined): string {
  const numeric = parseNumeric(value);

  if (numeric === null || numeric <= 0) {
    return "—";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: numeric < 0.01 ? 4 : 2,
    maximumFractionDigits: numeric < 0.01 ? 6 : 2,
  }).format(numeric);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  const differenceSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(differenceSeconds);

  let divisor = 1;
  let unit: Intl.RelativeTimeFormatUnit = "second";

  if (absolute >= 86_400) {
    divisor = 86_400;
    unit = "day";
  } else if (absolute >= 3_600) {
    divisor = 3_600;
    unit = "hour";
  } else if (absolute >= 60) {
    divisor = 60;
    unit = "minute";
  }

  return new Intl.RelativeTimeFormat(undefined, {
    numeric: "auto",
  }).format(Math.round(differenceSeconds / divisor), unit);
}

function getTransactionMeta(transaction: IndexedTransaction): TransactionMeta {
  const action = transaction.actionType.toUpperCase();

  if (action === "WALLET_CREATE") {
    return {
      label: "Wallet created",
      badge: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
      iconSurface: "bg-slate-100 text-slate-700",
      amountClass: "text-slate-700",
      icon: WalletCards,
    };
  }

  if (
    action.includes("APPROVE") ||
    action.includes("AUTH") ||
    action.includes("ACCESS")
  ) {
    return {
      label: "Authorization",
      badge: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200",
      iconSurface: "bg-cyan-100 text-cyan-700",
      amountClass: "text-cyan-700",
      icon: ShieldCheck,
    };
  }

  if (action.includes("SWAP")) {
    return {
      label: "Swap",
      badge: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
      iconSurface: "bg-violet-100 text-violet-700",
      amountClass: "text-violet-700",
      icon: ArrowLeftRight,
    };
  }

  if (transaction.direction === "IN" || action === "RECEIVE") {
    return {
      label: "Received",
      badge:
        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
      iconSurface: "bg-emerald-100 text-emerald-700",
      amountClass: "text-emerald-700",
      icon: ArrowDownLeft,
    };
  }

  if (transaction.direction === "OUT" || action === "TRANSFER") {
    return {
      label: "Sent",
      badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
      iconSurface: "bg-amber-100 text-amber-700",
      amountClass: "text-slate-950",
      icon: ArrowUpRight,
    };
  }

  return {
    label: action
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase()),
    badge: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
    iconSurface: "bg-slate-100 text-slate-700",
    amountClass: "text-slate-950",
    icon: ArrowUpRight,
  };
}

function getDescription(transaction: IndexedTransaction): string {
  if (transaction.actionType.toUpperCase() === "WALLET_CREATE") {
    return "SocketFi wallet created";
  }

  const amount = formatTokenAmount(transaction.amount, transaction.assetSymbol);

  if (transaction.direction === "IN") {
    return transaction.counterparty
      ? `${amount} from ${mask_middle(transaction.counterparty, 8, "…")}`
      : `${amount} received`;
  }

  if (transaction.direction === "OUT") {
    return transaction.counterparty
      ? `${amount} to ${mask_middle(transaction.counterparty, 8, "…")}`
      : `${amount} sent`;
  }

  return `${transaction.functionName || transaction.actionType} transaction`;
}

function TransactionStatusBadge({ successful }: { successful: boolean }) {
  return successful ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      Confirmed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
      <AlertCircle className="h-3 w-3" />
      Failed
    </span>
  );
}

function TransactionAmount({
  transaction,
}: {
  transaction: IndexedTransaction;
}) {
  const meta = getTransactionMeta(transaction);
  const hasAmount = transaction.amount != null;
  const sign =
    hasAmount && transaction.direction === "IN"
      ? "+"
      : hasAmount && transaction.direction === "OUT"
      ? "−"
      : "";

  return (
    <div className="text-right">
      <p className={cx("text-sm font-semibold", meta.amountClass)}>
        {hasAmount
          ? `${sign}${formatTokenAmount(
              transaction.amount,
              transaction.assetSymbol
            )}`
          : "—"}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {formatUsd(transaction.valueUsd)}
      </p>
    </div>
  );
}

function EmptyState({
  hasWallet,
  onRefresh,
}: {
  hasWallet: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        <WalletCards className="h-6 w-6" />
      </span>
      <h4 className="mt-4 text-sm font-semibold text-slate-950">
        {hasWallet ? "No transactions yet" : "Wallet unavailable"}
      </h4>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {hasWallet
          ? "New wallet activity will appear here after the indexer confirms it."
          : "Sign in to a SocketFi wallet to load its transaction history."}
      </p>
      {hasWallet ? (
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh history
        </button>
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-5 sm:px-6">
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-100" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="mt-2 h-4 w-56 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
          <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function TransactionHistory({
  full = false,
  onOpenAll,
  onClose,
  className,
}: TransactionHistoryProps) {
  const { selectedNetwork, activeSession, updateData } = useStates() as {
    selectedNetwork?: Network;
    activeSession?: SessionShape | null;
    updateData?: number;
  };

  const network: Network = selectedNetwork === "PUBLIC" ? "PUBLIC" : "TESTNET";

  const walletAddress =
    activeSession?.userProfile?.address?.[network]?.trim() || "";

  const pageSize = full ? FULL_PAGE_SIZE : COMPACT_PAGE_SIZE;

  const [transactions, setTransactions] = useState<IndexedTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const requestSequenceRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setOffset(0);
    setTransactions([]);
    setTotal(0);
    setError("");
  }, [network, walletAddress, full]);

  const fetchTransactions = useCallback(
    async ({
      nextOffset = 0,
      background = false,
    }: {
      nextOffset?: number;
      background?: boolean;
    } = {}) => {
      if (!walletAddress) {
        setTransactions([]);
        setTotal(0);
        return;
      }

      if (!INDEXER_API_KEY) {
        setError(
          "Transaction history is unavailable because VITE_INDEXER_API_KEY is not configured."
        );
        return;
      }

      const requestSequence = ++requestSequenceRef.current;

      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const query = new URLSearchParams({
          network,
          limit: String(pageSize),
          offset: String(nextOffset),
        });

        const response = await fetch(
          `${INDEXER_API_URL}/v1/wallets/${encodeURIComponent(
            walletAddress
          )}/transactions?${query.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "X-API-Key": INDEXER_API_KEY,
            },
          }
        );

        const payload = (await response.json().catch(() => ({}))) as
          | TransactionHistoryResponse
          | {
              success?: boolean;
              error?: string;
              message?: string;
            };

        if (!response.ok || payload.success !== true) {
          throw new Error(
            payload.error ||
              payload.message ||
              `Transaction history request failed with status ${response.status}.`
          );
        }

        if (
          !mountedRef.current ||
          requestSequence !== requestSequenceRef.current
        ) {
          return;
        }

        const data = payload as TransactionHistoryResponse;
        const items = Array.isArray(data.items) ? data.items : [];

        setTransactions(items);
        setTotal(Number.isFinite(data.total) ? data.total : items.length);
        setOffset(nextOffset);
        setLastUpdatedAt(new Date());
      } catch (requestError) {
        if (
          mountedRef.current &&
          requestSequence === requestSequenceRef.current
        ) {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (
          mountedRef.current &&
          requestSequence === requestSequenceRef.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [network, pageSize, walletAddress]
  );

  useEffect(() => {
    void fetchTransactions({
      nextOffset: 0,
    });
  }, [fetchTransactions, network, walletAddress, updateData]);

  const page = Math.floor(offset / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const canGoPrevious = full && offset > 0 && !loading && !refreshing;
  const canGoNext =
    full && offset + pageSize < total && !loading && !refreshing;

  const pageDescription = useMemo(() => {
    if (total === 0) {
      return "No indexed transactions";
    }

    if (!full) {
      return `${total} indexed transaction${total === 1 ? "" : "s"}`;
    }

    const start = offset + 1;
    const end = Math.min(offset + transactions.length, total);

    return `Showing ${start}–${end} of ${total}`;
  }, [full, offset, total, transactions.length]);

  function openExplorer(transaction: IndexedTransaction) {
    const fallbackUrl = `https://stellar.expert/explorer/${network.toLowerCase()}/tx/${
      transaction.txHash
    }`;

    window.open(
      transaction.explorerUrl || fallbackUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function refresh() {
    void fetchTransactions({
      nextOffset: offset,
      background: true,
    });
  }

  function goToPreviousPage() {
    if (!canGoPrevious) {
      return;
    }

    void fetchTransactions({
      nextOffset: Math.max(0, offset - pageSize),
    });
  }

  function goToNextPage() {
    if (!canGoNext) {
      return;
    }

    void fetchTransactions({
      nextOffset: offset + pageSize,
    });
  }

  return (
    <section
      className={cx(
        "rounded-[24px] border border-[#dbe3ef] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Wallet activity
          </div>

          <h3 className="mt-3 text-xl font-semibold text-slate-900 sm:text-2xl">
            {full ? "Transaction History" : "Transactions"}
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {full
              ? "A complete view of activity for this wallet on the selected network."
              : "Latest confirmed wallet activity from the SocketFi indexer."}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>
              {loading ? "Loading indexed transactions…" : pageDescription}
            </span>
            <span aria-hidden="true">•</span>
            <span>{network}</span>
            {lastUpdatedAt ? (
              <>
                <span aria-hidden="true">•</span>
                <span>
                  Updated {formatRelativeTime(lastUpdatedAt.toISOString())}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={
              !walletAddress || loading || refreshing || !INDEXER_API_KEY
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={cx("h-4 w-4", refreshing && "animate-spin")}
            />
            Refresh
          </button>

          {!full && total > COMPACT_PAGE_SIZE && onOpenAll ? (
            <button
              type="button"
              onClick={onOpenAll}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              View all
              <ExternalLink className="h-4 w-4" />
            </button>
          ) : null}

          {full && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-[#dbe3ef] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {error ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertCircle className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-950">
              Transaction history unavailable
            </p>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              {error}
            </p>
            <button
              type="button"
              onClick={refresh}
              disabled={!walletAddress || refreshing}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw
                className={cx("h-4 w-4", refreshing && "animate-spin")}
              />
              Try again
            </button>
          </div>
        ) : loading ? (
          <LoadingState />
        ) : transactions.length === 0 ? (
          <EmptyState hasWallet={Boolean(walletAddress)} onRefresh={refresh} />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="min-w-full table-fixed">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="w-[44%] px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Transaction
                    </th>
                    <th className="w-[20%] px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Time
                    </th>
                    <th className="w-[20%] px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Amount
                    </th>
                    <th className="w-[16%] px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Explorer
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {transactions.map((transaction) => {
                    const meta = getTransactionMeta(transaction);
                    const Icon = meta.icon;

                    return (
                      <tr
                        key={transaction.id}
                        className="transition hover:bg-slate-50/80"
                      >
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <span
                              className={cx(
                                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                                meta.iconSurface
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </span>

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cx(
                                    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                    meta.badge
                                  )}
                                >
                                  {meta.label}
                                </span>
                                <TransactionStatusBadge
                                  successful={transaction.successful}
                                />
                              </div>

                              <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                                {getDescription(transaction)}
                              </p>

                              <p className="mt-1 truncate font-mono text-xs text-slate-400">
                                {transaction.txHash}
                              </p>

                              {transaction.memoValue ? (
                                <p className="mt-1 truncate text-xs text-slate-500">
                                  Memo: {transaction.memoValue}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 align-top">
                          <p className="whitespace-nowrap text-sm font-medium text-slate-700">
                            {formatDateTime(transaction.ledgerClosedAt)}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Ledger {transaction.ledger}
                          </p>
                        </td>

                        <td className="px-6 py-4 align-top">
                          <TransactionAmount transaction={transaction} />
                        </td>

                        <td className="px-6 py-4 text-right align-top">
                          <button
                            type="button"
                            onClick={() => openExplorer(transaction)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            View
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 lg:hidden">
              {transactions.map((transaction) => {
                const meta = getTransactionMeta(transaction);
                const Icon = meta.icon;

                return (
                  <article key={transaction.id} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span
                        className={cx(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                          meta.iconSurface
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cx(
                                  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                  meta.badge
                                )}
                              >
                                {meta.label}
                              </span>
                              <TransactionStatusBadge
                                successful={transaction.successful}
                              />
                            </div>

                            <p className="mt-2 break-words text-sm font-semibold leading-5 text-slate-900">
                              {getDescription(transaction)}
                            </p>
                          </div>

                          <TransactionAmount transaction={transaction} />
                        </div>

                        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
                          <p className="text-xs font-medium text-slate-600">
                            {formatDateTime(transaction.ledgerClosedAt)}
                          </p>
                          <p className="mt-1 break-all font-mono text-[11px] leading-5 text-slate-400">
                            {transaction.txHash}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => openExplorer(transaction)}
                          className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          View in Explorer
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      {full && !error && !loading && total > pageSize ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Page {page} of {pageCount}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={!canGoPrevious}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <button
              type="button"
              onClick={goToNextPage}
              disabled={!canGoNext}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {refreshing ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Refreshing indexed activity…
        </div>
      ) : null}
    </section>
  );
}
