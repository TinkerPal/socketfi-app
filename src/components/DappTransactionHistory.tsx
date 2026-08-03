// @ts-nocheck
import { ArrowRight } from "iconsax-react";
import { ArrowUpRight, ExternalLink, Sparkles } from "lucide-react";
import { useStates } from "../context/StatesContext";
import { formatTimestamp, mask_middle } from "../utils/helper-functions";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getTypeMeta(type) {
  if (type === "swap/AQUA") {
    return {
      badge: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
      dot: "text-violet-500",
      iconBg: "bg-violet-100 text-violet-700",
      icon: Sparkles,
    };
  }

  if (type === "swap/SOROSWAP") {
    return {
      badge: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
      dot: "text-indigo-500",
      iconBg: "bg-indigo-100 text-indigo-700",
      icon: ArrowUpRight,
    };
  }

  return {
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    dot: "text-amber-500",
    iconBg: "bg-amber-100 text-amber-700",
    icon: ArrowUpRight,
  };
}

function getTransactionDescription(tx) {
  if (tx?.type === "swap/AQUA" || tx?.type === "swap/SOROSWAP") {
    return `${tx?.amountOut || "0"} ${tx?.symbolOut || ""} → ${
      tx?.amountIn || "0"
    } ${tx?.symbolIn || ""}`;
  }

  if (tx?.from || tx?.to) {
    return `${tx?.type || "Transaction"} ${
      tx?.from ? `from ${mask_middle(tx?.from)}` : ""
    } ${tx?.to ? `to ${mask_middle(tx?.to)}` : ""}`;
  }

  return tx?.type || "dApp transaction";
}

export default function DappTransactionHistory() {
  const { transactionStats, selectedNetwork } = useStates();
  const [dappTransactions, setDappTransactions] = useState([]);

  const location = useLocation();
  const filterPath = location.pathname?.slice(7);

  useEffect(() => {
    if (filterPath === "aqua-amm") {
      const filtered = transactionStats?.transactions?.filter(
        (tx) => tx?.type === "swap/AQUA"
      );

      setDappTransactions(filtered || []);
    } else if (filterPath === "soroswap") {
      const filtered = transactionStats?.transactions?.filter(
        (tx) => tx?.type === "swap/SOROSWAP"
      );

      setDappTransactions(filtered || []);
    } else {
      setDappTransactions([]);
    }
  }, [filterPath, transactionStats]);

  if (!transactionStats || transactionStats?.transactions?.length === 0) {
    return null;
  }

  function openTxInExplorerHandler(txId) {
    const url = `https://stellar.expert/explorer/${selectedNetwork?.toLowerCase()}/tx/${txId}`;
    window.open(url, "_blank");
  }

  const txs = [
    ...(dappTransactions?.filter((tx) => tx?.network === selectedNetwork) ||
      []),
  ].reverse();

  const shown = txs.slice(0, 5);

  if (shown.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[24px] border border-[#dbe3ef] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            dApp activity
          </div>

          <h3 className="mt-3 text-xl font-semibold text-slate-900 sm:text-2xl">
            dApp Transactions
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Latest smart wallet activity for this dApp.
          </p>
        </div>

        {txs.length > 5 && (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            View All Transactions
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-[#dbe3ef] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="hidden lg:block">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Transaction Details
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Amount (USD)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Explorer
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {shown.map((tx) => {
                const meta = getTypeMeta(tx?.type);
                const Icon = meta.icon;

                return (
                  <tr
                    key={tx?.txId}
                    className="transition hover:bg-slate-50/80"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={classNames(
                            "mt-0.5 rounded-2xl p-2",
                            meta.iconBg
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <span
                            className={classNames(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                              meta.badge
                            )}
                          >
                            <svg
                              className={classNames("h-2.5 w-2.5", meta.dot)}
                              fill="currentColor"
                              viewBox="0 0 8 8"
                            >
                              <circle cx="4" cy="4" r="3"></circle>
                            </svg>
                            {tx?.type}
                          </span>

                          <p className="mt-2 text-sm font-semibold text-slate-900">
                            {getTransactionDescription(tx)}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {tx?.txId}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-700">
                      {formatTimestamp(tx?.timestamp)}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-900">
                      ${tx?.value ? Number(tx?.value).toFixed(3) : "0.00"}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <button
                        type="button"
                        onClick={() => openTxInExplorerHandler(tx?.txId)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        View
                        <ArrowRight className="-rotate-45 h-4 w-auto" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 lg:hidden">
          {shown.map((tx) => {
            const meta = getTypeMeta(tx?.type);
            const Icon = meta.icon;

            return (
              <div
                key={tx?.txId}
                className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span
                      className={classNames(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        meta.badge
                      )}
                    >
                      <svg
                        className={classNames("h-2.5 w-2.5", meta.dot)}
                        fill="currentColor"
                        viewBox="0 0 8 8"
                      >
                        <circle cx="4" cy="4" r="3"></circle>
                      </svg>
                      {tx?.type}
                    </span>

                    <div className="mt-3 flex items-start gap-3">
                      <div
                        className={classNames("rounded-2xl p-2", meta.iconBg)}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {getTransactionDescription(tx)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatTimestamp(tx?.timestamp)}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {tx?.txId}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="shrink-0 text-sm font-semibold text-slate-900">
                    ${tx?.value ? Number(tx?.value).toFixed(3) : "0.00"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openTxInExplorerHandler(tx?.txId)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  View in Explorer
                  <ArrowRight className="-rotate-45 h-4 w-auto" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
