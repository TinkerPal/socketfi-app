import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  ChartArea,
  ChartPie,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import TransactionHistory from "../../components/TransactionHistory";
import TopStats from "../../components/TopStats";
import WalletScreen from "./WalletScreen";

import { useStates } from "../../context/StatesContext";

type Network = "TESTNET" | "PUBLIC";

interface SessionShape {
  userProfile?: {
    address?: Partial<Record<Network, string>>;
  };
}

interface WalletTransaction {
  id: string;
  txHash: string;
  network: Network;
  walletAddress: string;

  status: string;
  successful: boolean;
  actionType: string;

  assetSymbol: string;
  assetContract: string | null;

  amount: string | null;
  amountAtomic: string | null;

  valueUsd: string;
  priceUsd: string;

  direction: "IN" | "OUT" | null;

  ledger: string;
  ledgerClosedAt: string;

  explorerUrl: string;
}

interface WalletTransactionsResponse {
  success: boolean;
  network: Network;
  walletAddress: string;
  total: number;
  limit: number;
  offset: number;
  items: WalletTransaction[];
  error?: string;
  message?: string;
}

interface PortfolioDetail {
  total?: string | number;
}

interface WalletDashboardContext {
  portfolioDetail?: PortfolioDetail;
  selectedNetwork?: Network;
  activeSession?: SessionShape | null;
  updateData?: number;
}

interface WalletStats {
  transactionCount: number;
  totalVolumeUsd: number;
}

const INDEXER_API_URL = (
  import.meta.env.VITE_INDEXER_API_URL || "http://localhost:4015"
).replace(/\/$/, "");

const INDEXER_API_KEY = import.meta.env.VITE_INDEXER_API_KEY || "";

const STATS_PAGE_SIZE = 100;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to load wallet statistics.";
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatUsd(value: unknown): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toFiniteNumber(value));
}

function formatInteger(value: unknown): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(toFiniteNumber(value));
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error ||
        payload.message ||
        `Request failed with status ${response.status}.`
    );
  }

  return payload as T;
}

export default function WalletDashboard() {
  const [showAllTx, setShowAllTx] = useState(false);
  const location = useLocation();

  const { portfolioDetail, selectedNetwork, activeSession, updateData } =
    useStates() as WalletDashboardContext;

  const network: Network = selectedNetwork === "PUBLIC" ? "PUBLIC" : "TESTNET";

  const walletAddress =
    activeSession?.userProfile?.address?.[network]?.trim() || "";

  const [walletStats, setWalletStats] = useState<WalletStats>({
    transactionCount: 0,
    totalVolumeUsd: 0,
  });

  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [statsError, setStatsError] = useState("");
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
    if (location.hash !== "#activity") return;
    document.getElementById("activity")?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  useEffect(() => {
    setWalletStats({
      transactionCount: 0,
      totalVolumeUsd: 0,
    });

    setStatsError("");
    setLastUpdatedAt(null);
  }, [network, walletAddress]);

  const loadWalletStats = useCallback(
    async ({
      background = false,
    }: {
      background?: boolean;
    } = {}) => {
      if (!walletAddress) {
        setWalletStats({
          transactionCount: 0,
          totalVolumeUsd: 0,
        });

        return;
      }

      if (!INDEXER_API_KEY) {
        setStatsError(
          "VITE_INDEXER_API_KEY is not configured for the wallet application."
        );

        return;
      }

      const requestSequence = ++requestSequenceRef.current;

      if (background) {
        setRefreshingStats(true);
      } else {
        setLoadingStats(true);
      }

      setStatsError("");

      try {
        let offset = 0;
        let total = 0;
        let volumeUsd = 0;
        let firstRequest = true;

        /*
         * Retrieve all pages so wallet volume remains accurate even when
         * the wallet has more transactions than the API page limit.
         */
        while (firstRequest || offset < total) {
          firstRequest = false;

          const query = new URLSearchParams({
            network,
            limit: String(STATS_PAGE_SIZE),
            offset: String(offset),
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

          const payload = await readJsonResponse<WalletTransactionsResponse>(
            response
          );

          if (payload.success !== true) {
            throw new Error(
              payload.error ||
                payload.message ||
                "The indexer did not return wallet statistics."
            );
          }

          const items = Array.isArray(payload.items) ? payload.items : [];

          total = Number.isFinite(payload.total) ? payload.total : items.length;

          for (const transaction of items) {
            /*
             * Do not count wallet creation as financial volume.
             * valueUsd will normally already be zero for this action.
             */
            if (transaction.actionType === "WALLET_CREATE") {
              continue;
            }

            volumeUsd += toFiniteNumber(transaction.valueUsd);
          }

          if (items.length === 0) {
            break;
          }

          offset += items.length;

          /*
           * Protection against a malformed endpoint returning the same page
           * forever.
           */
          if (offset > total + STATS_PAGE_SIZE) {
            break;
          }
        }

        if (
          !mountedRef.current ||
          requestSequence !== requestSequenceRef.current
        ) {
          return;
        }

        setWalletStats({
          transactionCount: total,
          totalVolumeUsd: volumeUsd,
        });

        setLastUpdatedAt(new Date());
      } catch (error) {
        if (
          mountedRef.current &&
          requestSequence === requestSequenceRef.current
        ) {
          setStatsError(getErrorMessage(error));
        }
      } finally {
        if (
          mountedRef.current &&
          requestSequence === requestSequenceRef.current
        ) {
          setLoadingStats(false);
          setRefreshingStats(false);
        }
      }
    },
    [network, walletAddress]
  );

  useEffect(() => {
    void loadWalletStats();
  }, [loadWalletStats, updateData]);

  useEffect(() => {
    if (!showAllTx) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowAllTx(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showAllTx]);

  const topStatsData = useMemo(
    () => [
      {
        id: "balance",
        label: "Total Balance (USD)",
        value:
          portfolioDetail?.total == null
            ? "$0.00"
            : formatUsd(portfolioDetail.total),
        icon: Wallet,
      },
      {
        id: "transaction-volume",
        label: "Transaction Vol (USD)",
        value: loadingStats
          ? "Loading…"
          : formatUsd(walletStats.totalVolumeUsd),
        icon: ChartPie,
      },
      {
        id: "transaction-count",
        label: "Transactions Count",
        value: loadingStats
          ? "Loading…"
          : formatInteger(walletStats.transactionCount),
        icon: ChartArea,
      },
      {
        id: "loyalty-points",
        label: "Earned Points",
        value: null,
        icon: BadgeCheck,
      },
    ],
    [
      loadingStats,
      portfolioDetail?.total,
      walletStats.totalVolumeUsd,
      walletStats.transactionCount,
    ]
  );

  function refreshWalletStats() {
    void loadWalletStats({
      background: true,
    });
  }

  return (
    <div className="flex flex-col pt-3">
      <div className="flex flex-1 overflow-x-hidden">
        <div className="flex flex-1 flex-col">
          <main>
            <div className="py-0">
              <div className="mx-auto mt-2 px-0 sm:px-6 md:px-8">
                <div className="mx-auto mt-0 space-y-5">
                  <section>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex flex-col gap-2">
                        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
                          Wallet Details
                        </h1>

                        <p className="text-sm text-slate-500">
                          View balances, manage assets, and control transactions
                          across your wallet.
                        </p>

                        {/* <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span>{network}</span>

                          {lastUpdatedAt ? (
                            <>
                              <span aria-hidden="true">•</span>

                              <span>
                                Activity updated{" "}
                                {lastUpdatedAt.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </>
                          ) : null}
                        </div> */}
                      </div>

                      <button
                        type="button"
                        onClick={refreshWalletStats}
                        disabled={
                          !walletAddress ||
                          loadingStats ||
                          refreshingStats ||
                          !INDEXER_API_KEY
                        }
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${
                            refreshingStats ? "animate-spin" : ""
                          }`}
                        />
                        Refresh activity
                      </button>
                    </div>
                  </section>

                  {statsError ? (
                    <section
                      role="alert"
                      className="flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          Wallet statistics unavailable
                        </p>

                        <p className="mt-1 text-xs leading-5 text-amber-700">
                          {statsError}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={refreshWalletStats}
                        disabled={refreshingStats}
                        className="shrink-0 text-xs font-semibold text-amber-800 underline underline-offset-2 disabled:opacity-50"
                      >
                        Retry
                      </button>
                    </section>
                  ) : null}

                  <TopStats data={topStatsData} />

                  <WalletScreen />

                  <div id="activity" className="scroll-mt-6">
                    <TransactionHistory onOpenAll={() => setShowAllTx(true)} />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 ${
          showAllTx
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!showAllTx}
      >
        <button
          type="button"
          aria-label="Close transaction history"
          className={`absolute inset-0 bg-slate-950/45 backdrop-blur-[3px] transition-opacity duration-300 ${
            showAllTx ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setShowAllTx(false)}
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="all-transactions-title"
          className={`absolute inset-x-0 bottom-0 flex h-[96vh] transform flex-col overflow-hidden rounded-t-[28px] bg-slate-50 shadow-2xl transition-transform duration-300 ease-out ${
            showAllTx ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                Wallet activity
              </p>

              <h2
                id="all-transactions-title"
                className="mt-1 text-lg font-semibold tracking-tight text-slate-950"
              >
                All Transactions
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Complete indexed history for this wallet on {network}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAllTx(false)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Close
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-3 py-4 sm:px-6 sm:py-5">
              <TransactionHistory full onClose={() => setShowAllTx(false)} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
