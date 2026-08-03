// @ts-nocheck
import { Back, CloseCircle } from "iconsax-react";
import Button from "./Button";
import SelectTransactToken from "./SelectTransactToken";
import { useStates } from "../context/StatesContext";
import DappTokenSelectorTrigger from "./DappTokenSelectorTrigger";

function shortAddress(value = "") {
  if (!value || value.length < 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function formatValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function FeePreviewCard({
  feePreview,
  onPreviewFee,
  isLoadingFeePreview,
  canPreviewFee,
}) {
  const decision = feePreview?.decision;
  const data = feePreview?.data || {};

  console.log("the fee decision is", feePreview);

  const isCollectNow = decision === "CollectNow";
  const isDefer = decision === "Defer";

  const decisionLabel = isCollectNow
    ? "Collect Now"
    : isDefer
    ? "Deferred"
    : formatValue(decision);

  const decisionTone = isCollectNow
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : isDefer
    ? "bg-amber-50 text-amber-700 ring-amber-200"
    : "bg-slate-100 text-slate-700 ring-slate-200";

  const descriptionText = isCollectNow
    ? "Fee will be charged in this transaction."
    : isDefer
    ? "Fee will be deferred and added to pending fees."
    : "Preview how the fee will be handled before confirming the transaction.";

  return (
    <div className="mt-6 rounded-[20px] border border-slate-200 bg-[#f8fafc] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Fee Decision
            </h3>

            {decision ? (
              <span
                className={classNames(
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                  decisionTone
                )}
              >
                {decisionLabel}
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            {descriptionText}
          </p>
        </div>

        <button
          type="button"
          onClick={onPreviewFee}
          disabled={!canPreviewFee || isLoadingFeePreview}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoadingFeePreview ? "Checking..." : "Preview Fee"}
        </button>
      </div>

      {!feePreview ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          No fee preview yet.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Total Transaction Amount
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatValue(data.total_tx_amount)}
            </p>
          </div>

          {isDefer && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Updated Deferred Fee
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatValue(data.updated_deferred_fee)}
              </p>
            </div>
          )}

          {isCollectNow && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Total Fee In Asset
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatValue(data.total_fee_in_asset)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="text-sm font-medium text-slate-600">{children}</label>
  );
}

function FieldInput(props) {
  return (
    <input
      {...props}
      className={classNames(
        "block h-12 w-full appearance-none rounded-2xl border bg-white px-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition",
        props.className || "border-slate-200 focus:border-slate-300"
      )}
    />
  );
}

export default function TokenTransact2({
  needWalletConnect = true,
  extra = null,
  hasExtra = false,
  description = null,
  defaultDescription = "Deposit tokens from the connected wallet below to your smart wallet.",
  topStat = null,
  buttons = [
    {
      id: "send",
      name: "Send Tokens",
      onClick: () => {},
    },
  ],
  isModal = false,
  onCloseModal = () => {},
  onGoBack = () => {},
  isLoading,
  onClickButton,
  buttonMessage,
  feePreview = null,
  onPreviewFee = () => {},
  isLoadingFeePreview = false,
  canPreviewFee = false,
  availableBalance = 0,
  amountHasError = false,
  hasInvalidAmount = false,
  amountExceedsBalance = false,
  disableConfirmButton = false,
}) {
  const {
    selectedTransactToken,
    setSelectedTransactToken,
    userKey,
    activeButton,
    selectedNetwork,
    setDappTokenIn,
  } = useStates();

  const showPercentActions =
    activeButton === "withdraw" || activeButton === "approve";

  const amountValue =
    selectedNetwork === "PUBLIC"
      ? selectedTransactToken?.amount || ""
      : selectedTransactToken?.amount || "";

  const handleAmountChange = (value) => {
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;

    setSelectedTransactToken((prev) => ({
      ...prev,
      amount: value,
    }));

    if (selectedNetwork === "PUBLIC") {
      setDappTokenIn((prev) =>
        prev ? { ...prev, amount: value } : { amount: value }
      );
    }
  };

  const setAmountByPercent = (percent) => {
    const balance = Number(availableBalance || 0);
    const nextAmount = balance * percent;
    const value = nextAmount > 0 ? String(nextAmount) : "";

    handleAmountChange(value);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={classNames(
        "relative w-full overflow-hidden border border-[#dbe3ef] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]",
        isModal
          ? "max-h-[92svh] max-w-[940px] rounded-t-[28px] sm:rounded-[28px]"
          : "mx-auto max-w-[940px] rounded-[28px]"
      )}
    >
      <div className="max-h-[92svh] overflow-y-auto">
        <main>
          <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-8">
            <div className="flex items-center justify-between gap-3 rounded-[20px] border border-slate-200 bg-[#f8fafc] p-2 sm:p-3">
              <nav className="flex min-w-0 flex-1 flex-wrap gap-2">
                {buttons?.map((button) => (
                  <button
                    type="button"
                    onClick={button?.onClick}
                    key={button?.id}
                    className={classNames(
                      "inline-flex items-center whitespace-nowrap rounded-2xl px-3.5 py-2 text-sm font-medium transition-all duration-200",
                      activeButton === button?.id
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:bg-white hover:text-slate-900"
                    )}
                  >
                    {button?.name}
                  </button>
                ))}
              </nav>

              {isModal ? (
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  <CloseCircle className="h-6 w-6" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGoBack}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  <Back className="h-6 w-6" />
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-lg font-semibold tracking-tight text-slate-900">
                  {description === null
                    ? defaultDescription
                    : description?.long}
                </p>

                {topStat?.address ? (
                  <p className="mt-2 break-all text-sm leading-6 text-slate-500">
                    {topStat.address}
                  </p>
                ) : null}
              </div>

              {topStat?.balance?.value ? (
                <div className="rounded-[18px] border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm">
                  <p className="text-slate-500">{topStat?.name}</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    <span className="text-indigo-600">
                      {topStat?.balance?.value || ""} {topStat?.balance?.symbol}
                    </span>
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-white">
              <div className="p-4 sm:p-5 lg:p-6">
                <div className="rounded-[22px] border border-slate-200 bg-[#f8fafc] p-4 sm:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900">
                      <svg
                        className="h-4 w-4 text-white"
                        viewBox="0 0 140 140"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M87.4974 70.0026L116.664 46.6693L87.4974 23.3359V40.8301H11.6641V52.4968H87.4974V70.0026ZM128.331 87.5026H52.4974V70.0026L23.3307 93.3359L52.4974 116.669V99.1693H128.331V87.5026Z" />
                      </svg>
                    </div>

                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        Transaction details
                      </p>
                      <p className="text-sm text-slate-500">
                        Provide the token and amount to continue.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {hasExtra && (
                      <div className="sm:col-span-2">
                        <FieldLabel>{extra?.name}</FieldLabel>
                        <div className="mt-2">
                          <FieldInput
                            type="text"
                            placeholder="G**** or C****"
                            onChange={extra.onChange}
                          />
                        </div>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <FieldLabel>Asset or Token</FieldLabel>

                      {selectedNetwork === "TESTNET" && (
                        <div className="mt-2">
                          {selectedTransactToken?.name === "Enter Token ID" ? (
                            <FieldInput
                              type="text"
                              value={selectedTransactToken?.address || ""}
                              placeholder="C****"
                              onChange={(e) =>
                                setSelectedTransactToken((prev) => ({
                                  ...prev,
                                  address: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <SelectTransactToken />
                          )}
                        </div>
                      )}

                      {selectedNetwork === "PUBLIC" && (
                        <div className="mt-2">
                          <DappTokenSelectorTrigger which="from" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <FieldLabel>Token Amount</FieldLabel>

                        {showPercentActions && (
                          <div className="flex items-center gap-1.5">
                            {[0.25, 0.5, 1].map((percent) => (
                              <button
                                key={percent}
                                type="button"
                                disabled={!Number(availableBalance)}
                                onClick={() => setAmountByPercent(percent)}
                                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {percent === 1 ? "Max" : `${percent * 100}%`}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-2">
                        <FieldInput
                          onChange={(e) => handleAmountChange(e.target.value)}
                          type="text"
                          inputMode="decimal"
                          value={amountValue}
                          placeholder="ex: 100"
                          className={
                            amountHasError
                              ? "border-red-300 focus:border-red-400"
                              : "border-slate-200 focus:border-slate-300"
                          }
                        />
                      </div>

                      {amountHasError && (
                        <p className="mt-1.5 text-xs font-medium text-red-500">
                          {amountExceedsBalance
                            ? "Amount exceeds available balance"
                            : "Enter a valid amount"}
                        </p>
                      )}

                      {showPercentActions && !amountHasError && (
                        <p className="mt-1.5 text-xs text-slate-400">
                          Available: {formatValue(availableBalance)}{" "}
                          {topStat?.balance?.symbol || ""}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col justify-end">
                      <Button
                        isLoading={isLoading}
                        onClick={onClickButton}
                        message={buttonMessage}
                        disable={disableConfirmButton}
                      >
                        {userKey?.length === 0 && needWalletConnect
                          ? "Connect Wallet"
                          : "Confirm Transaction"}
                      </Button>
                    </div>
                  </div>

                  {activeButton !== "deposit" && (
                    <FeePreviewCard
                      feePreview={feePreview}
                      onPreviewFee={onPreviewFee}
                      isLoadingFeePreview={isLoadingFeePreview}
                      canPreviewFee={canPreviewFee}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
