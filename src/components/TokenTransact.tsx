import { Back, CloseCircle, ShieldTick } from "iconsax-react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ShieldCheck,
} from "lucide-react";

import Button from "./Button";
import SelectTransactToken from "./SelectTransactToken";
import DappTokenSelectorTrigger from "./DappTokenSelectorTrigger";
import { useStates } from "../context/StatesContext";

type TransactionMode = "deposit" | "withdraw" | "approve";

interface TransactionButton {
  id: string;
  name: string;
  onClick?: () => void;
}

interface TransactionDescription {
  short?: string;
  long?: string;
}

interface TransactionBalance {
  value?: string | number;
  symbol?: string;
}

interface TopStat {
  name?: string;
  address?: string;
  balance?: TransactionBalance;
}

interface ExtraField {
  name?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

interface TokenTransact2Props {
  needWalletConnect?: boolean;
  extra?: ExtraField | null;
  hasExtra?: boolean;
  description?: TransactionDescription | null;
  defaultDescription?: string;
  topStat?: TopStat | null;
  buttons?: TransactionButton[];
  isModal?: boolean;
  onCloseModal?: () => void;
  onGoBack?: () => void;
  isLoading?: boolean;
  onClickButton?: () => void;
  buttonMessage?: string;
  availableBalance?: string | number;
  amountHasError?: boolean;
  hasInvalidAmount?: boolean;
  amountExceedsBalance?: boolean;
  disableConfirmButton?: boolean;
  mode?: TransactionMode;
  recipientAddress?: string;
}

interface TokenShape {
  name?: string;
  symbol?: string;
  address?: string;
  contract?: string;
  amount?: string;
  balance?: string | number;
}

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function shortAddress(value = ""): string {
  if (!value || value.length < 18) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-8)}`;
}

function formatNumber(value: unknown): string {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0.00";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 7,
    minimumFractionDigits: number === 0 ? 2 : 0,
  }).format(number);
}

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-semibold text-slate-700">{children}</label>

      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </div>
  );
}

function FieldInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={classNames(
        "block h-12 w-full appearance-none rounded-2xl border bg-white px-4 text-sm text-slate-950 placeholder:text-slate-400 outline-none transition",
        "focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100",
        className || "border-slate-200"
      )}
    />
  );
}

function ModeIcon({ mode }: { mode: TransactionMode }) {
  if (mode === "withdraw") {
    return <ArrowUpFromLine size={22} strokeWidth={2} />;
  }

  if (mode === "approve") {
    return <ShieldCheck size={22} strokeWidth={2} />;
  }

  return <ArrowDownToLine size={22} strokeWidth={2} />;
}

export default function TokenTransact({
  needWalletConnect = true,
  extra = null,
  hasExtra = false,
  description = null,
  defaultDescription = "Transfer tokens securely.",
  topStat = null,
  buttons = [],
  isModal = false,
  onCloseModal = () => undefined,
  onGoBack = () => undefined,
  isLoading = false,
  onClickButton = () => undefined,
  buttonMessage = "Confirm",
  availableBalance = 0,
  amountHasError = false,
  hasInvalidAmount = false,
  amountExceedsBalance = false,
  disableConfirmButton = false,
  mode = "deposit",
  recipientAddress = "",
}: TokenTransact2Props) {
  const {
    selectedTransactToken,
    setSelectedTransactToken,
    userKey,
    activeButton,
    selectedNetwork,
    setDappTokenIn,
  } = useStates();

  const token = selectedTransactToken as TokenShape | null;

  const showPercentActions = mode === "withdraw" || mode === "approve";

  const amountValue = token?.amount || "";

  const symbol = token?.symbol || topStat?.balance?.symbol || "";

  function handleAmountChange(value: string) {
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) {
      return;
    }

    setSelectedTransactToken((previous) => ({
      ...previous,
      amount: value,
    }));

    if (selectedNetwork === "PUBLIC") {
      setDappTokenIn((previous) => ({
        ...previous,
        amount: value,
      }));
    }
  }

  function setAmountByPercent(percentage: number) {
    const balance = Number(availableBalance || 0);

    if (!Number.isFinite(balance) || balance <= 0) {
      return;
    }

    const calculated = balance * percentage;

    /*
     * Avoid floating-point noise in the UI.
     */
    const value = calculated.toFixed(7).replace(/\.?0+$/, "");

    handleAmountChange(value);
  }

  const actionTitle =
    description?.short ||
    (mode === "withdraw"
      ? "Withdraw tokens"
      : mode === "approve"
      ? "Approve allowance"
      : "Deposit tokens");

  const actionDescription = description?.long || defaultDescription;

  const confirmLabel =
    userKey?.length === 0 && needWalletConnect
      ? "Connect Stellar wallet"
      : buttonMessage ||
        (mode === "withdraw"
          ? "Confirm withdrawal"
          : mode === "approve"
          ? "Confirm approval"
          : "Confirm deposit");

  return (
    <section
      onClick={(event) => event.stopPropagation()}
      role={isModal ? "dialog" : undefined}
      aria-modal={isModal ? true : undefined}
      aria-labelledby="transaction-title"
      className={classNames(
        "relative w-full overflow-hidden bg-white shadow-2xl",
        isModal
          ? "max-h-[94svh] max-w-[520px] rounded-t-[28px] sm:rounded-[28px]"
          : "mx-auto max-w-[520px] rounded-[28px]"
      )}
    >
      <div className="max-h-[94svh] overflow-y-auto">
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
          <div>
            <span
              className={classNames(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                mode === "approve"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-950 text-white"
              )}
            >
              <ModeIcon mode={mode} />
            </span>

            <h2
              id="transaction-title"
              className="mt-4 text-xl font-semibold tracking-tight text-slate-950"
            >
              {actionTitle}
            </h2>

            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              {actionDescription}
            </p>
          </div>

          <button
            type="button"
            onClick={isModal ? onCloseModal : onGoBack}
            aria-label={isModal ? "Close transaction" : "Go back"}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
          >
            {isModal ? (
              <CloseCircle className="h-6 w-6" />
            ) : (
              <Back className="h-6 w-6" />
            )}
          </button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                  {topStat?.name || "Available balance"}
                </p>

                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  {formatNumber(topStat?.balance?.value ?? availableBalance)}{" "}
                  <span className="text-base font-semibold text-slate-500">
                    {topStat?.balance?.symbol || symbol}
                  </span>
                </p>
              </div>

              {topStat?.address ? (
                <span className="max-w-full truncate rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                  {shortAddress(topStat.address)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="space-y-5">
              {hasExtra ? (
                <div>
                  <FieldLabel>
                    {extra?.name ||
                      (mode === "withdraw"
                        ? "Recipient wallet"
                        : "Spender wallet")}
                  </FieldLabel>

                  <div className="mt-2">
                    <FieldInput
                      type="text"
                      value={recipientAddress}
                      placeholder="Enter a G... or C... address"
                      onChange={extra?.onChange}
                      autoComplete="off"
                    />
                  </div>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Verify the destination carefully. Blockchain transactions
                    cannot be reversed.
                  </p>
                </div>
              ) : null}

              <div>
                <FieldLabel>Asset</FieldLabel>

                <div className="mt-2">
                  {selectedNetwork === "TESTNET" ? (
                    token?.name === "Enter Token ID" ? (
                      <FieldInput
                        type="text"
                        value={token?.address || ""}
                        placeholder="Enter token contract C..."
                        onChange={(event) =>
                          setSelectedTransactToken((previous) => ({
                            ...previous,
                            address: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <SelectTransactToken />
                    )
                  ) : (
                    <DappTokenSelectorTrigger which="from" />
                  )}
                </div>
              </div>

              <div>
                <FieldLabel
                  hint={
                    showPercentActions
                      ? `Available: ${formatNumber(availableBalance)} ${symbol}`
                      : undefined
                  }
                >
                  Amount
                </FieldLabel>

                <div
                  className={classNames(
                    "mt-2 rounded-[20px] border bg-white p-3 transition focus-within:ring-4",
                    amountHasError
                      ? "border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100"
                      : "border-slate-200 focus-within:border-indigo-300 focus-within:ring-indigo-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      onChange={(event) =>
                        handleAmountChange(event.target.value)
                      }
                      type="text"
                      inputMode="decimal"
                      value={amountValue}
                      placeholder="0.00"
                      className="min-w-0 flex-1 border-0 bg-transparent px-1 text-2xl font-semibold tracking-tight text-slate-950 outline-none placeholder:text-slate-300"
                    />

                    {symbol ? (
                      <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
                        {symbol}
                      </span>
                    ) : null}
                  </div>

                  {showPercentActions ? (
                    <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                      {[
                        {
                          label: "25%",
                          value: 0.25,
                        },
                        {
                          label: "50%",
                          value: 0.5,
                        },
                        {
                          label: "Max",
                          value: 1,
                        },
                      ].map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          disabled={!Number(availableBalance)}
                          onClick={() => setAmountByPercent(option.value)}
                          className="min-h-8 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {amountHasError ? (
                  <div className="mt-2 flex items-center gap-2 text-xs font-medium text-rose-600">
                    <AlertCircle className="h-4 w-4" />
                    {amountExceedsBalance
                      ? "Amount exceeds your available balance."
                      : hasInvalidAmount
                      ? "Enter a valid amount greater than zero."
                      : "Check the entered amount."}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {mode === "withdraw" ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200">
                  <Wallet className="h-4 w-4" />
                </span>

                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Review withdrawal
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Confirm the recipient, amount, and network before signing.
                  </p>
                </div>
              </div>

              <dl className="mt-4 divide-y divide-indigo-100">
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm text-slate-500">Recipient</dt>
                  <dd className="max-w-[65%] truncate text-right text-sm font-semibold text-slate-800">
                    {recipientAddress
                      ? shortAddress(recipientAddress)
                      : "Not entered"}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm text-slate-500">Amount</dt>
                  <dd className="text-right text-sm font-semibold text-slate-800">
                    {amountValue || "0"} {symbol}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm text-slate-500">Network</dt>
                  <dd className="text-right text-sm font-semibold text-slate-800">
                    {selectedNetwork}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-700" />

              <p className="text-xs leading-5 text-slate-600">
                Review the transaction details carefully. Nothing will be
                submitted until you authorize the transaction.
              </p>
            </div>
          </div>

          <Button
            isLoading={isLoading}
            onClick={onClickButton}
            message={buttonMessage}
            disable={disableConfirmButton}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {confirmLabel}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Button>
        </div>
      </div>
    </section>
  );
}
