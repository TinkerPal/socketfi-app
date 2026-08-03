// @ts-nocheck
import { Back, CloseCircle } from "iconsax-react";
import { CheckCircle2, Settings2, ShieldCheck } from "lucide-react";

import Button from "./Button";
import { useStates } from "../context/StatesContext";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function SettingsTransact({
  description = null,
  defaultDescription = "Deposit tokens from the connected wallet below to your smart wallet.",
  topStat = null,

  isModal = false,
  onCloseModal = () => {},
  onGoBack = () => {},
  isLoading = false,
  onClickButton,
  inputParams,
  setInputParams,
}) {
  const { activeButton } = useStates();

  const title =
    description === null ? "Smart Wallet Transaction" : description?.short;

  const helper = description === null ? defaultDescription : description?.long;

  const isAllowance = activeButton === "allowance";

  function handleInputChange(event) {
    const nextValue = event.target.value;

    if (isAllowance) {
      if (nextValue === "-" || Number(nextValue) < 0) return;
    }

    setInputParams(nextValue);
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className={classNames(
        "relative mx-auto w-full overflow-hidden rounded-[24px] border border-[#dbe3ef] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        isModal ? "max-w-2xl" : "mt-0 lg:mt-6"
      )}
    >
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef4ff_55%,#f8fafc_100%)] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              Wallet settings
            </div>

            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h3>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              {helper}
            </p>
          </div>

          <button
            type="button"
            onClick={isModal ? onCloseModal : onGoBack}
            disabled={isLoading}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={isModal ? "Close modal" : "Go back"}
          >
            {isModal ? (
              <CloseCircle className="h-5 w-5" />
            ) : (
              <Back className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {topStat && (
          <div className="mb-4 rounded-[20px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              {topStat?.title}
            </p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-900">
              {topStat?.value || "Not set"}
            </p>
          </div>
        )}

        <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <Settings2 className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900">
                Settings Details
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Review the setting below and confirm it with your wallet.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              {description?.button || "Value"}
            </label>

            <input
              onChange={handleInputChange}
              type={isAllowance ? "number" : "text"}
              inputMode={isAllowance ? "decimal" : "text"}
              min={isAllowance ? "0" : undefined}
              disabled={isLoading}
              value={inputParams || ""}
              placeholder={description?.placeholder || "Enter value"}
              className="min-h-[48px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />

            <p className="mt-2 text-xs leading-5 text-slate-400">
              {isAllowance
                ? "Use a positive value only. This controls the instant transaction limit."
                : "Make sure the account value is correct before confirming."}
            </p>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <div className="w-full sm:max-w-[160px]">
              <Button
                noBackground
                disabled={isLoading}
                onClick={isModal ? onCloseModal : onGoBack}
              >
                Cancel
              </Button>
            </div>

            <div className="w-full sm:max-w-[220px]">
              <Button
                isLoading={isLoading}
                disabled={isLoading || !String(inputParams || "").trim()}
                onClick={onClickButton}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Settings
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
