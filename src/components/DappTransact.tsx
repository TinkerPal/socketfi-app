// @ts-nocheck
import type { ChangeEvent, MouseEvent, ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck, X } from "lucide-react";

import { useStates } from "../context/StatesContext";
import SwapPage from "../pages/swaps/SwapPage";
import { useNavigate } from "react-router-dom";

type DappActionButton = {
  id: string;
  name: string;
  onClick?: () => void;
  disabled?: boolean;
};

type ExtraField = {
  name?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

type TopStat = {
  name?: string;
  address?: string;
  balance?: {
    value?: string | number;
    symbol?: string;
  };
};

type DappDescription = {
  long?: string;
  short?: string;
};

type DappTransactProps = {
  isTransacting?: boolean;
  isLoading?: boolean;
  description?: DappDescription | null;
  defaultDescription?: string;
  topStat?: TopStat | null;
  buttons?: DappActionButton[];
  isModal?: boolean;
  onCloseModal?: () => void;
  onGoBack?: () => void;
  onClickButton?: () => void | Promise<void>;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  buttonMessage?: string;
  hasExtra?: boolean;
  extra?: ExtraField | null;
  footer?: ReactNode;
};

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function shortAddress(value?: string, start = 10, end = 8): string {
  if (!value) {
    return "";
  }

  if (value.length <= start + end + 1) {
    return value;
  }

  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

export default function DappTransact({
  isTransacting = false,
  isLoading = false,
  description = null,
  defaultDescription = "Interact securely through your SocketFi smart account.",
  topStat = null,
  buttons = [
    {
      id: "send",
      name: "Send Tokens",
      onClick: () => undefined,
    },
  ],
  isModal = false,
  onCloseModal = () => undefined,
  onGoBack = () => undefined,
  onClickButton,
  onClick,
  buttonMessage,
  hasExtra = false,
  extra = null,
  footer = null,
}: DappTransactProps) {
  const { activeButton, selectedDapp, activeSession, selectedNetwork } =
    useStates();

  const busy = Boolean(isTransacting || isLoading);

  const walletAddress =
    activeSession?.userProfile?.address?.[selectedNetwork] || "";

  const activeDescription = description?.long || defaultDescription;

  const activeTitle =
    description?.short || selectedDapp?.name || "dApp interaction";
  const navigate = useNavigate();
  return (
    <section
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      className="relative overflow-hidden rounded-[28px] border border-[#dbe3ef] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)] lg:col-span-5"
    >
      <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav
            className="flex min-w-0 flex-1 flex-wrap gap-2"
            aria-label="dApp actions"
          >
            {buttons.map((button) => {
              const selected = activeButton === button.id;

              return (
                <button
                  key={button.id}
                  type="button"
                  disabled={button.disabled || busy}
                  onClick={button.onClick}
                  className={classNames(
                    "inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
                    selected
                      ? "bg-slate-950 text-white shadow-sm"
                      : "border border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-950",
                    (button.disabled || busy) && "cursor-not-allowed opacity-55"
                  )}
                  aria-pressed={selected}
                >
                  {button.name}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={isModal ? onCloseModal : () => navigate(-1)}
            aria-label={
              isModal ? "Close dApp interaction" : "Return to dApp Hub"
            }
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 sm:self-auto"
          >
            {isModal ? (
              <X className="h-4.5 w-4.5" />
            ) : (
              <ArrowLeft className="h-4.5 w-4.5" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {activeTitle}
            </p>

            <h2 className="mt-2 max-w-3xl text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              {activeDescription}
            </h2>

            {walletAddress ? (
              <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />

                <span className="truncate">
                  Connected as{" "}
                  <span className="font-mono font-semibold">
                    {shortAddress(walletAddress)}
                  </span>
                </span>
              </div>
            ) : null}
          </div>

          {topStat?.balance?.symbol ? (
            <div className="min-w-[190px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-500">
                {topStat?.name || "Balance"}
              </p>

              <p className="mt-1 text-lg font-semibold text-slate-950">
                {topStat?.balance?.value || "0"}{" "}
                <span className="text-sm font-medium text-indigo-600">
                  {topStat?.balance?.symbol}
                </span>
              </p>

              {topStat?.address ? (
                <p className="mt-2 truncate font-mono text-[11px] text-slate-400">
                  {shortAddress(topStat.address, 8, 6)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Connected integration
            </p>

            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              {selectedDapp?.name || "SocketFi dApp"}
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {selectedDapp?.description ||
                "Review the transaction details before authorizing this dApp action."}
            </p>

            <div className="mt-5 space-y-3 border-t border-slate-200 pt-5">
              {[
                "Authorized by your SocketFi account",
                "Transaction details shown before signing",
                "Only the selected contract action is approved",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

                  <p className="text-xs leading-5 text-slate-600">{item}</p>
                </div>
              ))}
            </div>
          </aside>

          <div className="min-w-0">
            {hasExtra && extra ? (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                <label
                  htmlFor="dapp-extra-field"
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  {extra.label || extra.name || "Additional information"}
                </label>

                <input
                  id="dapp-extra-field"
                  type="text"
                  value={extra.value}
                  onChange={extra.onChange}
                  placeholder={extra.placeholder || extra.name || "Enter value"}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100"
                />
              </div>
            ) : null}

            <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
              {busy ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-[2px]">
                  <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-xl">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-700" />

                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {buttonMessage || "Preparing transaction…"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Complete the authorization request in your wallet.
                    </p>
                  </div>
                </div>
              ) : null}

              <SwapPage
                onClickButton={onClickButton}
                isTransacting={busy}
                buttonMessage={buttonMessage}
              />
            </div>
          </div>
        </div>

        {footer ? (
          <div className="border-t border-slate-100 pt-5">{footer}</div>
        ) : null}
      </div>
    </section>
  );
}
