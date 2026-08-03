// @ts-nocheck
import React from "react";
import Button from "../../components/Button";
import DappTokenSelectorTrigger from "../../components/DappTokenSelectorTrigger";
import { useStates } from "../../context/StatesContext";

export default function SwapPage({ onClickButton, isTransacting }) {
  const {
    setLoginIsOpen,
    activeSession,
    setDappTokenIn,
    dappTokenIn,
    dappTokenOut,
    isFetchingAmountOut,
    allTokens,
  } = useStates();

  const amountIn = dappTokenIn?.amount || "";
  const amountOut = dappTokenOut?.amount || "";

  const balance = Number(
    allTokens.find((token) => token?.contract === dappTokenIn?.contract)
      ?.balance || 0
  );

  const amountValue = Number(amountIn);

  const hasInvalidInput =
    amountIn !== "" && (!Number.isFinite(amountValue) || amountValue <= 0);

  const exceedsBalance =
    amountIn !== "" && Number.isFinite(amountValue) && amountValue > balance;

  const inputHasError = hasInvalidInput || exceedsBalance;

  const swapDisabled =
    isTransacting ||
    isFetchingAmountOut ||
    !dappTokenIn ||
    !dappTokenOut ||
    !amountIn ||
    hasInvalidInput ||
    exceedsBalance;

  const setAmountByPercent = (percent) => {
    const nextAmount = balance * percent;

    setDappTokenIn((prev) => ({
      ...(prev || {}),
      amount: nextAmount > 0 ? String(nextAmount) : "",
    }));
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;

    if (value === "") {
      setDappTokenIn((prev) => ({
        ...(prev || {}),
        amount: "",
      }));
      return;
    }

    if (!/^\d*\.?\d*$/.test(value)) return;

    setDappTokenIn((prev) => ({
      ...(prev || {}),
      amount: value,
    }));
  };

  return (
    <div className="relative w-full max-w-[1135px] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-5">
      <div className="relative w-full p-4 sm:p-5 lg:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950 sm:text-lg">
              Swap Tokens
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Exchange one asset for another through your smart wallet.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left sm:text-right">
            <p className="text-xs font-medium text-slate-500">
              Available balance
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-950">
              {balance.toLocaleString()} {dappTokenIn?.symbol || ""}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-slate-600">
                Swap from
              </label>

              <div className="flex items-center gap-1.5">
                {[0.25, 0.5, 1].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    disabled={!balance}
                    onClick={() => setAmountByPercent(percent)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {percent === 1 ? "Max" : `${percent * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={[
                "flex min-w-0 items-center gap-3 rounded-2xl border bg-slate-50 px-4 py-3 transition focus-within:bg-white",
                inputHasError
                  ? "border-red-300 focus-within:border-red-400"
                  : "border-slate-200 focus-within:border-slate-300",
              ].join(" ")}
            >
              <input
                value={amountIn}
                onChange={handleAmountChange}
                type="text"
                inputMode="decimal"
                placeholder="0"
                className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-slate-950 outline-none placeholder:text-slate-300"
              />

              <div className="shrink-0">
                <DappTokenSelectorTrigger which="from" />
              </div>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">$0</p>

              {inputHasError && (
                <p className="text-xs font-medium text-red-500">
                  {exceedsBalance
                    ? "Amount exceeds available balance"
                    : "Enter a valid amount"}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Switch swap direction"
            >
              ↓
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">
              Swap to
            </label>

            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0 flex-1">
                {isFetchingAmountOut ? (
                  <div className="flex h-8 items-center">
                    <svg
                      className="h-5 w-5 animate-spin text-slate-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                ) : (
                  <input
                    value={amountOut}
                    disabled
                    type="text"
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent text-xl font-semibold text-slate-950 outline-none placeholder:text-slate-300 disabled:cursor-not-allowed"
                  />
                )}
              </div>

              <div className="shrink-0">
                <DappTokenSelectorTrigger which="to" />
              </div>
            </div>

            <p className="mt-1.5 text-xs text-slate-400">$0</p>
          </div>
        </div>

        <div className="mt-6">
          <Button
            message="Swapping..."
            isLoading={isTransacting}
            onClick={activeSession ? onClickButton : () => setLoginIsOpen(true)}
            disable={swapDisabled}
          >
            {activeSession ? "Confirm Swap" : "Create Account or Login"}
          </Button>
        </div>
      </div>
    </div>
  );
}
