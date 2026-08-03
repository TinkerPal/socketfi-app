// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Coins,
  Copy,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AutoLayer } from "@autolayer/sdk";
import { useSocketFi } from "@socketfi/react";
import { rpc } from "@stellar/stellar-sdk";
import { useAccount, useConnectors, useReconnect, useSignMessage } from "wagmi";

import { useStates } from "../../context/StatesContext";
import { api } from "../../services/sessionAutomation.client";
import {
  getSocketFiAuthMethod,
  getSocketFiEvmSigner,
  getSocketFiStellarSigner,
  approveAutomationPaymentAuthorization,
  signAndSubmitSmartAccountInvocation,
} from "../../services/automationWalletSigning";

type Network = "PUBLIC" | "TESTNET";

type StrategyType =
  | "DISBURSEMENT"
  | "DCA"
  | "REBALANCE"
  | "AMPLIDEX_LONG"
  | "AMPLIDEX_SHORT";

type TokenOption = {
  id: string;
  address: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  icon?: string;
  source: "wallet" | "watchlist";
};

type RecipientRow = {
  id: string;
  address: string;
  amount: string;
};

type RebalanceRow = {
  id: string;
  asset: string;
  weight: string;
};

type ScheduleUnit = "minute" | "hour" | "day" | "week" | "month" | "year";

type FirstRunMode = "NOW" | "SCHEDULED";

type ResolvedSchedule = {
  repeat: boolean;
  firstRunMode: FirstRunMode;
  firstRunAt: string;
  timezone: "UTC";
  expression: string;
  intervalValue: number | null;
  intervalUnit: ScheduleUnit | null;
};

type AutoLayerSchedule = {
  kind: "INTERVAL";
  expression: string;
  timezone: "UTC";
};

const STRATEGY_TYPES: Array<{
  id: StrategyType;
  label: string;
  description: string;
  accent: string;
}> = [
  {
    id: "DCA",
    label: "DCA",
    description: "Buy an asset gradually on a recurring schedule.",
    accent: "indigo",
  },
  {
    id: "DISBURSEMENT",
    label: "Disbursement",
    description: "Send scheduled payments to one or more recipients.",
    accent: "emerald",
  },
  {
    id: "REBALANCE",
    label: "Rebalance",
    description: "Maintain target portfolio allocations automatically.",
    accent: "violet",
  },
  //   {
  //     id: "AMPLIDEX_LONG",
  //     label: "Amplidex long",
  //     description: "Open recurring or scheduled leveraged long positions.",
  //     accent: "sky",
  //   },
  //   {
  //     id: "AMPLIDEX_SHORT",
  //     label: "Amplidex short",
  //     description: "Open recurring or scheduled leveraged short positions.",
  //     accent: "rose",
  //   },
];

const SCHEDULE_UNITS: Array<{
  value: ScheduleUnit;
  singular: string;
  plural: string;
}> = [
  { value: "minute", singular: "Minute", plural: "Minutes" },
  { value: "hour", singular: "Hour", plural: "Hours" },
  { value: "day", singular: "Day", plural: "Days" },
  { value: "week", singular: "Week", plural: "Weeks" },
  { value: "month", singular: "Month", plural: "Months" },
  { value: "year", singular: "Year", plural: "Years" },
];

const MARKET_PRESETS = ["XLM-USDC", "BTC-USDC", "ETH-USDC"];

const INPUT_CLASS =
  "mt-2 h-11 w-full rounded-xl border border-[#EAECF0] bg-white px-3.5 text-sm text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#2F0FD1] focus:ring-4 focus:ring-[#EEF2FF] disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#98A2B3]";

const SELECT_CLASS =
  "mt-2 h-11 w-full appearance-none rounded-xl border border-[#EAECF0] bg-white px-3.5 pr-10 text-sm text-[#101828] outline-none transition focus:border-[#2F0FD1] focus:ring-4 focus:ring-[#EEF2FF]";

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function transactionHash(response: any): string | undefined {
  return (
    response?.txHash ||
    response?.hash ||
    response?.transactionHash ||
    response?.data?.txHash ||
    response?.data?.hash
  );
}

function shorten(value?: string, start = 10, end = 8): string {
  if (!value) return "—";
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function asString(value: unknown, fallback = "0"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function normalizeBalance(token: any): string {
  const value =
    token?.balance?.value ??
    token?.balance ??
    token?.amount ??
    token?.availableBalance ??
    token?.walletBalance ??
    "0";

  return asString(value);
}

function normalizeToken(
  token: any,
  source: TokenOption["source"]
): TokenOption | null {
  const address = String(
    token?.address ||
      token?.contractId ||
      token?.tokenAddress ||
      token?.id ||
      ""
  ).trim();

  if (!address) return null;

  const symbol = String(
    token?.symbol || token?.code || token?.assetCode || token?.name || "TOKEN"
  ).trim();

  return {
    id: `${source}:${address}`,
    address,
    symbol,
    name: String(token?.name || symbol),
    balance: normalizeBalance(token),
    decimals: Number(token?.decimals ?? 7),
    icon: token?.icon || token?.image || token?.logo || token?.imgUrl,
    source,
  };
}

function dedupeTokens(
  walletTokens: any[] = [],
  watchlistTokens: any[] = []
): TokenOption[] {
  const map = new Map<string, TokenOption>();

  for (const raw of walletTokens) {
    const token = normalizeToken(raw, "wallet");
    if (token) map.set(token.address, token);
  }

  for (const raw of watchlistTokens) {
    const token = normalizeToken(raw, "watchlist");
    if (!token) continue;

    const existing = map.get(token.address);

    if (existing) {
      map.set(token.address, {
        ...token,
        ...existing,
        balance: existing.balance !== "0" ? existing.balance : token.balance,
        source: "wallet",
      });
    } else {
      map.set(token.address, token);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aHasBalance = Number(a.balance) > 0 ? 1 : 0;
    const bHasBalance = Number(b.balance) > 0 ? 1 : 0;

    if (aHasBalance !== bHasBalance) return bHasBalance - aHasBalance;
    return a.symbol.localeCompare(b.symbol);
  });
}

function formatDecimalUnits(
  rawValue: string | number | undefined,
  decimals = 7
): string {
  const raw = String(rawValue ?? "0");

  if (!/^\d+$/.test(raw)) return raw;

  try {
    const units = BigInt(raw);
    const divisor = 10n ** BigInt(decimals);
    const whole = units / divisor;
    const fraction = (units % divisor)
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");

    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return raw;
  }
}

function parsePositiveNumber(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }

  return parsed;
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive whole number`);
  }

  return parsed;
}

function validatePositiveDecimalAmount(
  value: string,
  decimals: number,
  label: string
): void {
  const normalized = value.trim();
  const safeDecimals =
    Number.isInteger(decimals) && decimals >= 0 ? decimals : 7;

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`${label} must be a valid positive amount`);
  }

  const [, fraction = ""] = normalized.split(".");

  if (fraction.length > safeDecimals) {
    throw new Error(`${label} supports at most ${safeDecimals} decimal places`);
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
}

/**
 * Render-safe decimal conversion.
 *
 * This function is called while the strategy preview is being rebuilt during
 * typing, so it must not throw for temporary input states such as "", "0",
 * or "0.". Strict positive-amount validation is performed by
 * validateConfiguration() before a proposal is submitted.
 */
function decimalToAtomicString(
  value: string,
  decimals: number,
  _label: string
): string {
  const normalized = value.trim();
  const safeDecimals =
    Number.isInteger(decimals) && decimals >= 0 ? decimals : 7;

  if (!normalized || !/^\d*(?:\.\d*)?$/.test(normalized)) {
    return "0";
  }

  const [whole = "0", fraction = ""] = normalized.split(".");

  if (fraction.length > safeDecimals) {
    return "0";
  }

  try {
    const atomic =
      BigInt(whole || "0") * 10n ** BigInt(safeDecimals) +
      BigInt(fraction.padEnd(safeDecimals, "0") || "0");

    return atomic.toString();
  } catch {
    return "0";
  }
}

function pluralizeScheduleUnit(unit: ScheduleUnit, value: number): string {
  return value === 1 ? unit : `${unit}s`;
}

function intervalExpression(value: number, unit: ScheduleUnit): string {
  return `${value} ${pluralizeScheduleUnit(unit, value)}`;
}

function scheduleUnitToSeconds(value: number, unit: ScheduleUnit): number {
  const multipliers: Record<ScheduleUnit, number> = {
    minute: 60,
    hour: 60 * 60,
    day: 24 * 60 * 60,
    week: 7 * 24 * 60 * 60,
    /*
     * AutoLayer's existing interval format treats months and years as fixed
     * durations. Calendar-aware schedules should use a future CALENDAR kind.
     */
    month: 30 * 24 * 60 * 60,
    year: 365 * 24 * 60 * 60,
  };

  return value * multipliers[unit];
}

function localDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function defaultFirstRunLocal(): string {
  const date = new Date(Date.now() + 5 * 60 * 1000);
  date.setSeconds(0, 0);
  return localDateTimeValue(date);
}

function dateTimeLocalToIso(value: string): string {
  const timestamp = new Date(value);

  if (!value || !Number.isFinite(timestamp.getTime())) {
    throw new Error("Choose a valid first-run date and time");
  }

  return timestamp.toISOString();
}

function formatScheduleDate(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Field({
  label,
  hint,
  required = false,
  optional = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-[#344054]">
      <span className="flex flex-wrap items-center gap-2">
        <span>
          {label}
          {required ? <span className="ml-1 text-[#D92D20]">*</span> : null}
        </span>
        {optional ? (
          <span className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-medium text-[#667085]">
            Optional
          </span>
        ) : null}
      </span>
      {hint ? (
        <span className="mt-1 block text-xs font-normal leading-5 text-[#667085]">
          {hint}
        </span>
      ) : null}
      {children}
    </label>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#2F0FD1]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-[#101828]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#667085]">{description}</p>
      </div>
    </div>
  );
}

function TokenSelect({
  label,
  hint,
  value,
  onChange,
  tokens,
  excludeAddress,
  required = true,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  tokens: TokenOption[];
  excludeAddress?: string;
  required?: boolean;
}) {
  const [mode, setMode] = useState<"listed" | "custom">(
    value && !tokens.some((token) => token.address === value)
      ? "custom"
      : "listed"
  );

  useEffect(() => {
    if (value && !tokens.some((token) => token.address === value)) {
      setMode("custom");
    }
  }, [tokens, value]);

  const available = tokens.filter(
    (token) => !excludeAddress || token.address !== excludeAddress
  );

  const selected = tokens.find((token) => token.address === value);

  function selectValue(next: string) {
    if (next === "__CUSTOM__") {
      setMode("custom");
      onChange("");
      return;
    }

    setMode("listed");
    onChange(next);
  }

  return (
    <Field label={label} hint={hint} required={required}>
      {mode === "listed" ? (
        <>
          <div className="relative">
            <select
              value={value}
              onChange={(event) => selectValue(event.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Select token</option>

              {available.length ? (
                <optgroup label="Wallet and watchlist">
                  {available.map((token) => (
                    <option key={token.id} value={token.address}>
                      {token.symbol} · balance {token.balance}
                    </option>
                  ))}
                </optgroup>
              ) : null}

              <option value="__CUSTOM__">Custom token contract…</option>
            </select>
            <ChevronDown className="pointer-events-none absolute bottom-4 right-3.5 h-4 w-4 text-slate-400" />
          </div>

          {selected ? (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                {selected.icon ? (
                  <img
                    src={selected.icon}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                    {selected.symbol.slice(0, 2)}
                  </span>
                )}
                <span className="truncate font-mono text-slate-500">
                  {shorten(selected.address, 8, 6)}
                </span>
              </div>
              <span className="ml-3 shrink-0 font-semibold text-slate-800">
                {selected.balance} {selected.symbol}
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <input
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value.trim())}
            placeholder="Enter a C… token contract address"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
          <button
            type="button"
            onClick={() => {
              setMode("listed");
              onChange("");
            }}
            className="mt-2 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Choose from wallet instead
          </button>
        </div>
      )}
    </Field>
  );
}

function AmountInput({
  label,
  value,
  onChange,
  token,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  token?: TokenOption;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint} required>
      <div className="relative mt-2">
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            const next = event.target.value;
            if (/^\d*(\.\d*)?$/.test(next)) onChange(next);
          }}
          placeholder="0.00"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3.5 pr-28 text-sm text-slate-950 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
          {token ? (
            <span className="max-w-16 truncate text-xs font-semibold text-slate-500">
              {token.symbol}
            </span>
          ) : null}
          {token && Number(token.balance) > 0 ? (
            <button
              type="button"
              onClick={() => onChange(token.balance)}
              className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100"
            >
              MAX
            </button>
          ) : null}
        </div>
      </div>
      {token ? (
        <span className="mt-1.5 block text-xs font-normal text-slate-400">
          Available: {token.balance} {token.symbol}
        </span>
      ) : null}
    </Field>
  );
}

function resolvePaymentToken(
  assetValue: unknown,
  requirements: any,
  tokens: TokenOption[]
): {
  symbol: string;
  name: string;
  address: string;
  icon?: string;
} {
  const address = String(assetValue || "").trim();
  const normalizedAddress = address.toUpperCase();

  const listedToken = tokens.find(
    (token) => token.address.trim().toUpperCase() === normalizedAddress
  );

  const metadataSymbol = String(
    requirements?.extra?.symbol ||
      requirements?.symbol ||
      requirements?.assetSymbol ||
      ""
  ).trim();

  const metadataName = String(
    requirements?.extra?.name || requirements?.assetName || ""
  ).trim();

  const configuredUsdcContracts = [
    import.meta.env.VITE_USDC_PUBLIC_CONTRACT,
    import.meta.env.VITE_USDC_TESTNET_CONTRACT,
    import.meta.env.VITE_PUBLIC_USDC_CONTRACT,
    import.meta.env.VITE_TESTNET_USDC_CONTRACT,
  ]
    .map((value) =>
      String(value || "")
        .trim()
        .toUpperCase()
    )
    .filter(Boolean);

  const isConfiguredUsdc = configuredUsdcContracts.includes(normalizedAddress);
  const looksLikeSymbol = /^[A-Z0-9._-]{2,12}$/i.test(address);

  const symbol =
    listedToken?.symbol ||
    metadataSymbol ||
    (isConfiguredUsdc
      ? "USDC"
      : looksLikeSymbol
      ? address.toUpperCase()
      : "Token");

  return {
    symbol,
    name: listedToken?.name || metadataName || symbol,
    address,
    icon: listedToken?.icon,
  };
}

function QuoteCard({
  proposal,
  tokens,
}: {
  proposal: any;
  tokens: TokenOption[];
}) {
  const requirements = proposal?.paymentRequirements || {};
  const price = proposal?.price || {};
  const decimals = Number(
    price?.decimals ??
      requirements?.extra?.decimals ??
      requirements?.decimals ??
      7
  );

  const rawAmount =
    price?.amount ??
    requirements?.amount ??
    requirements?.maxAmountRequired ??
    "0";

  const displayAmount = formatDecimalUnits(rawAmount, decimals);
  const paymentAsset =
    price?.asset || requirements?.asset || requirements?.extra?.symbol || "";
  const paymentToken = resolvePaymentToken(paymentAsset, requirements, tokens);
  const network = String(
    price?.network || requirements?.network || proposal?.network || "—"
  );
  const payTo = String(price?.payTo || requirements?.payTo || "");
  const timeout = Number(requirements?.maxTimeoutSeconds || 0);
  const scheme = String(requirements?.scheme || "x402");

  const details = [
    {
      label: "Network",
      value: network,
    },
    {
      label: "Quote validity",
      value: timeout ? `${timeout} seconds` : "Confirmed during payment",
    },
    {
      label: "Treasury",
      value: payTo ? shorten(payTo, 10, 8) : "Confirmed during payment",
      title: payTo || undefined,
      mono: Boolean(payTo),
    },
    {
      label: "Payment standard",
      value: scheme.toUpperCase(),
    },
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-[#D9D6FE] bg-white shadow-sm">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#F4F3FF] via-white to-[#EEF2FF] px-5 py-5 sm:px-6">
        <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-indigo-200/30 blur-3xl" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2F0FD1] text-white shadow-sm">
              {paymentToken.icon ? (
                <img
                  src={paymentToken.icon}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <CircleDollarSign className="h-5 w-5" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5925DC]">
                  Activation fee
                </p>
                <span className="rounded-full border border-[#D9D6FE] bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6941C6]">
                  x402
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h3 className="text-2xl font-semibold tracking-tight text-[#101828]">
                  {displayAmount}
                </h3>
                <span className="text-base font-semibold text-[#2F0FD1]">
                  {paymentToken.symbol}
                </span>
              </div>

              <p className="mt-1.5 max-w-xl text-sm leading-5 text-[#667085]">
                One-time AutoLayer fee required to activate this automation.
              </p>
            </div>
          </div>

          <div className="hidden shrink-0 rounded-full border border-[#D1FADF] bg-[#ECFDF3] px-2.5 py-1 text-xs font-semibold text-[#027A48] sm:block">
            Exact quote
          </div>
        </div>
      </div>

      <div className="border-t border-[#EAECF0] px-5 py-4 sm:px-6">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label} className="min-w-0">
              <dt className="text-xs font-medium text-[#667085]">
                {detail.label}
              </dt>
              <dd
                title={detail.title}
                className={classNames(
                  "mt-1 truncate text-sm font-semibold text-[#101828]",
                  detail.mono && "font-mono text-xs"
                )}
              >
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>

        {paymentToken.address &&
        paymentToken.address.toUpperCase() !==
          paymentToken.symbol.toUpperCase() ? (
          <div className="mt-4 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#667085]">
                {paymentToken.name} contract
              </p>
              <p
                title={paymentToken.address}
                className="mt-0.5 truncate font-mono text-xs text-[#475467]"
              >
                {shorten(paymentToken.address, 12, 10)}
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-[#344054] ring-1 ring-inset ring-[#EAECF0]">
              {paymentToken.symbol}
            </span>
          </div>
        ) : null}

        {requirements?.description ? (
          <p className="mt-4 border-t border-[#EAECF0] pt-4 text-xs leading-5 text-[#667085]">
            {requirements.description}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function StrategyTypeCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "rounded-2xl border p-4 text-left transition",
        active
          ? "border-[#2F0FD1] bg-[#F4F7FF] shadow-sm"
          : "border-[#EAECF0] bg-white hover:border-[#D7DDF0] hover:bg-[#FCFCFD]"
      )}
    >
      <div
        className={classNames(
          "flex h-10 w-10 items-center justify-center rounded-2xl",
          active ? "bg-[#2F0FD1] text-white" : "bg-[#EEF2FF] text-[#2F0FD1]"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[#101828]">{title}</h3>
        {active ? <Check className="h-4 w-4 text-[#2F0FD1]" /> : null}
      </div>
      <p className="mt-1 text-sm leading-6 text-[#667085]">{description}</p>
    </button>
  );
}

function SummaryItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
      <p className="text-[11px] text-[#667085]">{label}</p>
      <div
        className={classNames(
          "mt-0.5 break-all text-sm font-semibold text-[#101828]",
          mono && "font-mono text-xs"
        )}
      >
        {value || "Not set"}
      </div>
    </div>
  );
}

type ProgressStep = {
  number: number;
  label: string;
  description: string;
};

const PROGRESS_STEPS: ProgressStep[] = [
  {
    number: 1,
    label: "Configure",
    description: "Strategy, schedule, and limits",
  },
  {
    number: 2,
    label: "Review",
    description: "Quote and generated policy",
  },
  {
    number: 3,
    label: "Authorize",
    description: "Create the scoped wallet session",
  },
  {
    number: 4,
    label: "Activate",
    description: "Pay the exact fee and start",
  },
];

function SetupProgress({ currentStep }: { currentStep: number }) {
  return (
    <nav aria-label="Automation setup progress">
      <ol className="grid gap-2 md:grid-cols-4">
        {PROGRESS_STEPS.map((item) => {
          const complete = item.number < currentStep;
          const active = item.number === currentStep;

          return (
            <li
              key={item.number}
              aria-current={active ? "step" : undefined}
              className={classNames(
                "relative flex min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-3 transition",
                active
                  ? "border-[#BDB4FE] bg-[#F4F3FF]"
                  : complete
                  ? "border-[#ABEFC6] bg-[#F6FEF9]"
                  : "border-[#EAECF0] bg-[#FCFCFD]"
              )}
            >
              <span
                className={classNames(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  complete
                    ? "bg-[#039855] text-white"
                    : active
                    ? "bg-[#2F0FD1] text-white"
                    : "bg-[#F2F4F7] text-[#667085]"
                )}
              >
                {complete ? <Check className="h-4 w-4" /> : item.number}
              </span>

              <span className="min-w-0">
                <span
                  className={classNames(
                    "block truncate text-xs font-semibold",
                    active
                      ? "text-[#2F0FD1]"
                      : complete
                      ? "text-[#027A48]"
                      : "text-[#475467]"
                  )}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 hidden truncate text-[11px] text-[#667085] xl:block">
                  {item.description}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function CreateAutomationPage() {
  const navigate = useNavigate();
  const socketfi = useSocketFi();
  const {
    address: connectedEvmAddress,
    connector: connectedEvmConnector,
    isConnected: isEvmConnected,
  } = useAccount();
  const evmConnectors = useConnectors();
  const { reconnectAsync: reconnectEvmAsync } = useReconnect();
  const { signMessageAsync } = useSignMessage();

  const {
    activeSession,
    selectedNetwork,
    toast,
    allTokens = [],
    tokenList = [],
    watchlistTokens = [],
    prices = {},
  } = useStates();

  const network = selectedNetwork as Network;
  const accessToken = activeSession?.accessToken || "";
  const wallet = activeSession?.userProfile?.address?.[network] || "";
  const authMethod = getSocketFiAuthMethod(activeSession);
  const stellarSigner = getSocketFiStellarSigner(activeSession);
  const evmSigner = getSocketFiEvmSigner(activeSession);
  const evmConnectorId = String(
    activeSession?.evmConnectorId ||
      activeSession?.userProfile?.evmConnectorId ||
      activeSession?.userProfile?.evmAccount?.connectorId ||
      ""
  ).trim();
  const evmConnectorType = String(
    activeSession?.evmConnectorType ||
      activeSession?.userProfile?.evmConnectorType ||
      activeSession?.userProfile?.evmAccount?.connectorType ||
      ""
  ).trim();
  const evmConnectorName = String(
    activeSession?.evmConnectorName ||
      activeSession?.userProfile?.evmConnectorName ||
      activeSession?.userProfile?.evmAccount?.connectorName ||
      ""
  ).trim();

  const tokens = useMemo(
    () =>
      dedupeTokens(Array.isArray(allTokens) ? allTokens : [], [
        ...(Array.isArray(tokenList) ? tokenList : []),
        ...(Array.isArray(watchlistTokens) ? watchlistTokens : []),
      ]),
    [allTokens, tokenList, watchlistTokens]
  );

  const [type, setType] = useState<StrategyType>("DCA");
  const [name, setName] = useState("Daily XLM purchase");

  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [intervalValue, setIntervalValue] = useState("5");
  const [intervalUnit, setIntervalUnit] = useState<ScheduleUnit>("minute");

  const [firstRunMode, setFirstRunMode] = useState<FirstRunMode>("NOW");
  const [firstRunLocal, setFirstRunLocal] = useState(defaultFirstRunLocal);

  const [durationValue, setDurationValue] = useState("2");
  const [durationUnit, setDurationUnit] = useState<ScheduleUnit>("day");
  const [maximumRuns, setMaximumRuns] = useState("5");
  const [resolvedSchedule, setResolvedSchedule] =
    useState<ResolvedSchedule | null>(null);

  const [assetIn, setAssetIn] = useState("");
  const [assetOut, setAssetOut] = useState("");
  const [amount, setAmount] = useState("1");

  const [recipients, setRecipients] = useState<RecipientRow[]>([
    { id: createId("recipient"), address: "", amount: "" },
  ]);

  const [rebalanceAssets, setRebalanceAssets] = useState<RebalanceRow[]>([
    { id: createId("allocation"), asset: "", weight: "50" },
    { id: createId("allocation"), asset: "", weight: "50" },
  ]);

  const [marketPreset, setMarketPreset] = useState("XLM-USDC");
  const [customMarket, setCustomMarket] = useState("");
  const [leverage, setLeverage] = useState("2");
  const [collateral, setCollateral] = useState("10");
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");

  const [step, setStep] = useState(1);
  const [proposal, setProposal] = useState<any>(null);
  const [sessionTransaction, setSessionTransaction] = useState("");
  const [preparedPayment, setPreparedPayment] = useState<any>(null);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!assetIn && tokens.length) {
      setAssetIn(tokens[0].address);
    }

    if (!assetOut && tokens.length > 1) {
      setAssetOut(tokens[1].address);
    }
  }, [assetIn, assetOut, tokens]);

  const selectedInputToken = tokens.find((token) => token.address === assetIn);
  const selectedOutputToken = tokens.find(
    (token) => token.address === assetOut
  );

  const repeatExpression = useMemo(() => {
    const value = Number(intervalValue);

    if (!Number.isInteger(value) || value <= 0) {
      return "";
    }

    return intervalExpression(value, intervalUnit);
  }, [intervalUnit, intervalValue]);

  const scheduleSummary = useMemo(() => {
    const firstRun =
      firstRunMode === "NOW"
        ? "immediately after activation"
        : formatScheduleDate(firstRunLocal);

    if (!repeatEnabled) {
      return `Once · first run ${firstRun}`;
    }

    return `First run ${firstRun} · repeat every ${repeatExpression || "—"}`;
  }, [firstRunLocal, firstRunMode, repeatEnabled, repeatExpression]);

  const aquariusRouter = String(
    import.meta.env[
      network === "PUBLIC"
        ? "VITE_AQUARIUS_PUBLIC_ROUTER"
        : "VITE_AQUARIUS_TESTNET_ROUTER"
    ] || ""
  ).trim();

  const strategy = useMemo(() => {
    if (type === "DISBURSEMENT") {
      return {
        asset: assetIn,
        repeat: repeatEnabled,
        recipients: recipients
          .filter((item) => item.address.trim() && item.amount.trim())
          .map((item) => ({
            address: item.address.trim(),
            amount: decimalToAtomicString(
              item.amount,
              selectedInputToken?.decimals ?? 7,
              "Recipient amount"
            ),
          })),
      };
    }

    if (type === "DCA") {
      return {
        protocol: {
          name: "AQUARIUS",
          contractId: aquariusRouter,
          functionName: "swap_chained",
        },
        inputAsset: assetIn,
        outputAsset: assetOut,
        amountPerRun: decimalToAtomicString(
          amount,
          selectedInputToken?.decimals ?? 7,
          "Amount per run"
        ),
        maxTotalAmount: (
          BigInt(
            decimalToAtomicString(
              amount,
              selectedInputToken?.decimals ?? 7,
              "Amount per run"
            )
          ) * BigInt(repeatEnabled ? Number(maximumRuns || 0) : 1)
        ).toString(),
        slippageBps: 100,
        spendRecipients: aquariusRouter ? [aquariusRouter] : [],
      };
    }

    if (type === "REBALANCE") {
      return {
        protocol: {
          name: "AQUARIUS",
          contractId: aquariusRouter,
          functionName: "swap_chained",
        },
        allowedAssets: rebalanceAssets
          .map((item) => item.asset)
          .filter(Boolean),
        targetWeightsBps: rebalanceAssets.map((item) =>
          Math.round(Number(item.weight || 0) * 100)
        ),
        maxTradeAmount: decimalToAtomicString(
          amount,
          selectedInputToken?.decimals ?? 7,
          "Maximum trade amount"
        ),
        maxTotalAmount: (
          BigInt(
            decimalToAtomicString(
              amount,
              selectedInputToken?.decimals ?? 7,
              "Maximum trade amount"
            )
          ) * BigInt(repeatEnabled ? Number(maximumRuns || 0) : 1)
        ).toString(),
        spendRecipients: aquariusRouter ? [aquariusRouter] : [],
      };
    }

    return {
      protocol: {
        name: "AMPLIDEX",
        contractId: import.meta.env[
          network === "PUBLIC"
            ? "VITE_AMPLIDEX_PUBLIC_CONTRACT"
            : "VITE_AMPLIDEX_TESTNET_CONTRACT"
        ],
        functionName: type === "AMPLIDEX_LONG" ? "open_long" : "open_short",
      },
      market:
        marketPreset === "__CUSTOM__" ? customMarket.trim() : marketPreset,
      side: type === "AMPLIDEX_LONG" ? "LONG" : "SHORT",
      collateralAsset: assetIn,
      collateralAmount: collateral,
      leverageBps: Math.round(Number(leverage || 0) * 10_000),
      takeProfit: takeProfit.trim() || null,
      stopLoss: stopLoss.trim() || null,
    };
  }, [
    amount,
    aquariusRouter,
    assetIn,
    assetOut,
    collateral,
    customMarket,
    leverage,
    marketPreset,
    maximumRuns,
    network,
    rebalanceAssets,
    recipients,
    repeatEnabled,
    selectedInputToken?.decimals,
    stopLoss,
    takeProfit,
    type,
  ]);

  const totalDisbursement = useMemo(
    () =>
      recipients.reduce(
        (sum, recipient) => sum + Number(recipient.amount || 0),
        0
      ),
    [recipients]
  );

  const allocationTotal = useMemo(
    () =>
      rebalanceAssets.reduce((sum, item) => sum + Number(item.weight || 0), 0),
    [rebalanceAssets]
  );

  const estimatedStrategySpend = useMemo(() => {
    const runs = repeatEnabled ? Number(maximumRuns || 0) : 1;

    if (type === "DISBURSEMENT") {
      return totalDisbursement * runs;
    }

    if (type === "DCA") {
      return Number(amount || 0) * runs;
    }

    if (type === "AMPLIDEX_LONG" || type === "AMPLIDEX_SHORT") {
      return Number(collateral || 0) * runs;
    }

    return Number(amount || 0) * runs;
  }, [amount, collateral, maximumRuns, repeatEnabled, totalDisbursement, type]);

  const validateConfiguration = useCallback(() => {
    if (!wallet) throw new Error("Connect your SocketFi account");
    if (!accessToken) throw new Error("Your SocketFi session has expired");
    if (!name.trim()) throw new Error("Enter a name for this automation");

    const duration = parsePositiveInteger(durationValue, "Session duration");
    const durationSeconds = scheduleUnitToSeconds(duration, durationUnit);

    const runs = repeatEnabled
      ? parsePositiveInteger(maximumRuns, "Maximum runs")
      : 1;

    let interval = 0;

    if (repeatEnabled) {
      interval = parsePositiveInteger(intervalValue, "Repeat interval");

      if (intervalUnit === "minute" && interval < 1) {
        throw new Error("The minimum repeat interval is 1 minute");
      }
    }

    /*
     * "Run immediately" still needs enough time for:
     * proposal review, on-chain session creation, payment settlement,
     * activation, and Agenda scheduling.
     */
    const IMMEDIATE_FIRST_RUN_DELAY_MS = 45_000;

    const firstRunAt =
      firstRunMode === "NOW"
        ? new Date(Date.now() + IMMEDIATE_FIRST_RUN_DELAY_MS).toISOString()
        : dateTimeLocalToIso(firstRunLocal);

    const firstRunTimestamp = new Date(firstRunAt).getTime();
    const now = Date.now();

    if (firstRunMode === "SCHEDULED" && firstRunTimestamp < now + 30_000) {
      throw new Error(
        "The scheduled first run must be at least 30 seconds in the future"
      );
    }

    if (firstRunTimestamp > now + durationSeconds * 1000) {
      throw new Error(
        "The wallet-session duration must extend beyond the first run"
      );
    }

    const expression = repeatEnabled
      ? intervalExpression(interval, intervalUnit)
      : "1 year";

    /*
     * AutoLayer's current API supports only INTERVAL and CRON. A one-time
     * automation is represented by maxUses = 1; the backend schedules it once.
     */
    const autoLayerSchedule: AutoLayerSchedule = {
      kind: "INTERVAL",
      expression,
      timezone: "UTC",
    };

    const resolvedSchedule: ResolvedSchedule = {
      repeat: repeatEnabled,
      firstRunMode,
      firstRunAt,
      timezone: "UTC",
      expression,
      intervalValue: repeatEnabled ? interval : null,
      intervalUnit: repeatEnabled ? intervalUnit : null,
    };

    if ((type === "DCA" || type === "REBALANCE") && !aquariusRouter) {
      throw new Error(`Aquarius router is not configured for ${network}`);
    }

    if (repeatEnabled) {
      const intervalSeconds = scheduleUnitToSeconds(interval, intervalUnit);

      const finalRunOffsetSeconds = intervalSeconds * Math.max(0, runs - 1);

      const sessionEndsAt = now + durationSeconds * 1000;

      if (firstRunTimestamp + finalRunOffsetSeconds * 1000 > sessionEndsAt) {
        throw new Error(
          "Session duration must cover the first run and all repeated runs"
        );
      }
    }

    if (!assetIn) throw new Error("Select an input or collateral token");

    if (type === "DCA") {
      if (!assetOut) throw new Error("Select an output token");
      if (assetIn === assetOut) {
        throw new Error("Input and output tokens must be different");
      }
      validatePositiveDecimalAmount(
        amount,
        selectedInputToken?.decimals ?? 7,
        "Amount per run"
      );
    }

    if (type === "DISBURSEMENT") {
      const validRecipients = recipients.filter(
        (item) => item.address.trim() && item.amount.trim()
      );

      if (!validRecipients.length) {
        throw new Error("Add at least one recipient and amount");
      }

      for (const recipient of validRecipients) {
        validatePositiveDecimalAmount(
          recipient.amount,
          selectedInputToken?.decimals ?? 7,
          "Recipient amount"
        );
      }
    }

    if (type === "REBALANCE") {
      if (rebalanceAssets.length < 2) {
        throw new Error("Rebalancing requires at least two assets");
      }

      if (rebalanceAssets.some((item) => !item.asset)) {
        throw new Error("Select every rebalance asset");
      }

      if (
        new Set(rebalanceAssets.map((item) => item.asset)).size !==
        rebalanceAssets.length
      ) {
        throw new Error("Each rebalance asset must be unique");
      }

      if (Math.abs(allocationTotal - 100) > 0.001) {
        throw new Error("Rebalance allocations must total 100%");
      }

      validatePositiveDecimalAmount(
        amount,
        selectedInputToken?.decimals ?? 7,
        "Maximum trade amount"
      );
    }

    if (type === "AMPLIDEX_LONG" || type === "AMPLIDEX_SHORT") {
      const resolvedMarket =
        marketPreset === "__CUSTOM__" ? customMarket.trim() : marketPreset;

      if (!resolvedMarket) throw new Error("Select or enter a market");
      parsePositiveNumber(collateral, "Collateral amount");

      const leverageNumber = parsePositiveNumber(leverage, "Leverage");
      if (leverageNumber < 1 || leverageNumber > 5) {
        throw new Error("Leverage must be between 1x and 5x");
      }
    }

    return {
      durationSeconds,
      runs,
      autoLayerSchedule,
      resolvedSchedule,
    };
  }, [
    accessToken,
    allocationTotal,
    amount,
    aquariusRouter,
    assetIn,
    assetOut,
    collateral,
    customMarket,
    durationUnit,
    durationValue,
    firstRunLocal,
    firstRunMode,
    intervalUnit,
    intervalValue,
    leverage,
    marketPreset,
    maximumRuns,
    name,
    network,
    rebalanceAssets,
    recipients,
    repeatEnabled,
    selectedInputToken?.decimals,
    type,
    wallet,
  ]);

  async function currentLedger(): Promise<number> {
    const url =
      network === "PUBLIC"
        ? import.meta.env.VITE_RPC_STELLAR
        : import.meta.env.VITE_TESTNET_RPC_URL ||
          "https://soroban-testnet.stellar.org";

    if (!url) throw new Error(`${network} RPC URL is not configured`);

    return (await new rpc.Server(url).getLatestLedger()).sequence;
  }

  async function propose() {
    setBusyAction("propose");
    setError("");

    try {
      const {
        durationSeconds,
        runs,
        autoLayerSchedule,
        resolvedSchedule: nextResolvedSchedule,
      } = validateConfiguration();

      const ledger = await currentLedger();
      const secondsUntilFirstRun = Math.max(
        0,
        Math.ceil(
          (new Date(nextResolvedSchedule.firstRunAt).getTime() - Date.now()) /
            1000
        )
      );

      /*
       * Keep the on-chain session validity separate from the actual
       * automation execution time.
       *
       * The session becomes valid before the requested first run so that
       * ledger timing, transaction confirmation, and scheduler delay cannot
       * cause the first execution to hit SESSION_NOT_YET_VALID.
       */
      const SESSION_READY_BUFFER_LEDGERS = 100;
      const MIN_SESSION_START_BUFFER_LEDGERS = 5;

      const estimatedFirstRunLedger =
        ledger + Math.max(20, Math.ceil(secondsUntilFirstRun / 5));

      const validAfterLedger = Math.max(
        ledger + MIN_SESSION_START_BUFFER_LEDGERS,
        estimatedFirstRunLedger - SESSION_READY_BUFFER_LEDGERS
      );

      const response = await AutoLayer.propose({
        network,
        type,
        walletAddress: wallet,
        validAfterLedger,
        expiresAtLedger: ledger + Math.ceil(durationSeconds / 5),
        maxUses: runs,
        schedule: autoLayerSchedule,
        strategy,
      });

      if (!response?.automationId || !response?.expectedPolicyIdHex) {
        throw new Error("AutoLayer returned an incomplete proposal");
      }

      setResolvedSchedule(nextResolvedSchedule);
      setProposal(response);
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Unable to create proposal";
      setError(message);
      toast.error(message);
    } finally {
      setBusyAction("");
    }
  }

  async function createSession() {
    if (!proposal) return;

    setBusyAction("session");
    setError("");

    try {
      const displayValues = [
        { automationId: proposal.automationId },
        { delegate: proposal.delegatePublicKey },
        {
          maxUses: proposal.sessionPolicyInput?.max_uses ?? maximumRuns,
        },
        {
          expiresAtLedger: proposal.sessionPolicyInput?.expires_at_ledger,
        },
        {
          AutoLayerFee:
            proposal?.price?.amount ||
            proposal?.paymentRequirements?.maxAmountRequired ||
            proposal?.paymentRequirements?.amount ||
            "See x402 quote",
        },
        {
          paymentToken:
            proposal?.price?.asset ||
            proposal?.paymentRequirements?.asset ||
            "See x402 quote",
        },
      ];

      const response = await signAndSubmitSmartAccountInvocation({
        authMethod,
        network,
        walletAddress: wallet,
        contractId: wallet,
        callFunction: { name: "create_session" },
        argsXdr: proposal.createSessionArgsXdr,
        accessToken,
        stellarSigner,
        evmSigner,
        connectedEvmAddress,
        isEvmConnected,
        signMessageAsync,
        evmConnectors,
        connectedEvmConnector,
        reconnectEvmAsync,
        evmConnectorId,
        evmConnectorType,
        evmConnectorName,
        socketfi,
        display: {
          description: `Create scoped ${type} automation session`,
          values: displayValues,
        },
      });

      const hash = transactionHash(response);

      if (!hash) throw new Error("No transaction hash was returned");

      setSessionTransaction(hash);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to create the wallet session";
      setError(message);
      toast.error(message);
    } finally {
      setBusyAction("");
    }
  }

  async function prepareAndActivate() {
    if (!proposal || !sessionTransaction || !resolvedSchedule) return;

    setBusyAction("activate");
    setError("");

    try {
      const prepared = await AutoLayer.preparePayment(proposal, {
        payerAddress: wallet,
      });

      setPreparedPayment(prepared);

      if (!prepared?.contractId || !prepared?.argsXdr?.length) {
        throw new Error("AutoLayer returned an incomplete payment request");
      }

      /*
       * Only the account owner's Soroban authorization entry is signed here.
       * AutoLayer remains the transaction submitter for every auth method.
       *
       * - passkey: SocketFi SDK signTx()
       * - Stellar: wallet signs the auth preimage
       * - EVM: wallet signs the exact 32-byte auth payload
       */
      const entries = await approveAutomationPaymentAuthorization({
        authMethod,
        network,
        walletAddress: wallet,
        contractId: prepared.contractId,
        callFunction: {
          name: prepared.functionName,
        },
        argsXdr: prepared.argsXdr,
        accessToken,
        stellarSigner,
        evmSigner,
        connectedEvmAddress,
        isEvmConnected,
        signMessageAsync,
        evmConnectors,
        connectedEvmConnector,
        reconnectEvmAsync,
        evmConnectorId,
        evmConnectorType,
        evmConnectorName,
        socketfi,
        display: {
          description:
            prepared.requirements?.description ||
            `Authorize the AutoLayer x402 fee for ${name}`,
          values: [
            {
              amount:
                prepared?.requirements?.amount ||
                prepared?.requirements?.maxAmountRequired ||
                proposal?.price?.amount,
            },
            {
              token: prepared?.requirements?.asset || proposal?.price?.asset,
            },
            {
              payTo: prepared?.requirements?.payTo || proposal?.price?.payTo,
            },
            {
              automationId: proposal.automationId,
            },
          ],
        },
      });

      if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error("The wallet returned no payment authorization entry");
      }

      const paid = await AutoLayer.settlePayment(proposal, {
        paymentSessionId: prepared.paymentSessionId,
        signedAuthEntriesXdr: entries,
      });

      const paymentTransactionHash = transactionHash(paid);
      if (!paymentTransactionHash) {
        throw new Error(
          "AutoLayer settled the fee but returned no payment transaction hash"
        );
      }

      const activated = await AutoLayer.activate(proposal, {
        policyIdHex: proposal.expectedPolicyIdHex,
        transactionHash: sessionTransaction,

        /*
         * AutoLayer must schedule Agenda from the exact user-selected first
         * run timestamp, not from the earlier on-chain validAfterLedger.
         */
        firstRunAt: resolvedSchedule.firstRunAt,
      });

      console.log("the activation", activated);

      // if (!activationTransactionHash) {
      //   throw new Error(
      //     "AutoLayer activated the automation but returned no activation transaction hash"
      //   );
      // }

      const policy = proposal.sessionPolicyInput;

      await api.registerSession(
        {
          walletAddress: wallet,
          network,
          policyIdHex: proposal.expectedPolicyIdHex,
          delegatePublicKey: proposal.delegatePublicKey,
          label: name.trim(),
          validAfterLedger: policy.valid_after_ledger,
          expiresAtLedger: policy.expires_at_ledger,
          maxUses: policy.max_uses ?? null,
          allowedInvocations:
            proposal.policyMetadata?.allowedInvocations ||
            policy.permissions ||
            [],
          spendLimits:
            proposal.policyMetadata?.spendLimits || policy.spend_limits || [],
          automationId: proposal.automationId,
          automationType: type,
          schedule: {
            kind: "INTERVAL",
            expression: resolvedSchedule.expression,
            timezone: "UTC",
          },
          strategy,
          createTransactionHash: sessionTransaction,
          metadata: {
            scheduling: resolvedSchedule,
            x402: {
              amount:
                prepared?.requirements?.amount ||
                prepared?.requirements?.maxAmountRequired ||
                proposal?.price?.amount,
              asset: prepared?.requirements?.asset || proposal?.price?.asset,
              payTo: prepared?.requirements?.payTo || proposal?.price?.payTo,
              paymentSessionId: prepared.paymentSessionId,
            },
          },
        },
        accessToken
      );

      await api.registerAutomation(
        {
          walletAddress: wallet,
          network,
          automationId: proposal.automationId,
          policyIdHex: proposal.expectedPolicyIdHex,
          delegatePublicKey: proposal.delegatePublicKey,
          name: name.trim(),
          type,
          status: "ACTIVE",
          schedule: {
            kind: "INTERVAL",
            expression: resolvedSchedule.expression,
            timezone: "UTC",
          },
          strategy,
          maxRuns: repeatEnabled ? Number(maximumRuns) : 1,
          sessionCreationTransactionHash: sessionTransaction,
          activationTransactionHash:
            activated?.transactionHash || activated?.txHash || undefined,
          paymentStatus: paid?.paymentStatus || "PAID",
          metadata: {
            scheduling: resolvedSchedule,
            paymentTransactionHash,
          },
        },
        accessToken
      );

      toast.success("Automation activated");
      navigate("/automations");
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to pay for and activate the automation";
      setError(message);
      toast.error(message);
    } finally {
      setBusyAction("");
    }
  }

  function updateRecipient(
    id: string,
    key: "address" | "amount",
    value: string
  ) {
    setRecipients((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    );
  }

  function updateAllocation(
    id: string,
    key: "asset" | "weight",
    value: string
  ) {
    setRebalanceAssets((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    );
  }

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1_500);
  }

  const visualStep =
    step === 1 ? 1 : step === 2 ? 2 : sessionTransaction ? 4 : 3;

  const selectedType = STRATEGY_TYPES.find((item) => item.id === type);
  const quote = preparedPayment?.requirements
    ? {
        ...proposal,
        paymentRequirements: preparedPayment.requirements,
      }
    : proposal;
  const quotePaymentToken = resolvePaymentToken(
    quote?.price?.asset || quote?.paymentRequirements?.asset,
    quote?.paymentRequirements || {},
    tokens
  );

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <button
          type="button"
          disabled={Boolean(busyAction)}
          onClick={() =>
            step === 1
              ? navigate("/automations")
              : setStep((current) => Math.max(1, current - 1))
          }
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#EAECF0] bg-white px-4 text-sm font-medium text-[#344054] shadow-sm transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 1 ? "Back to automations" : "Previous step"}
        </button>

        <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-2.5 py-1 text-xs font-medium text-[#2F0FD1]">
                  <Bot className="h-3.5 w-3.5" />
                  AutoLayer
                </span>
                <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium text-[#667085]">
                  {network === "PUBLIC" ? "Mainnet" : "Testnet"}
                </span>
                <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium text-[#667085]">
                  {visualStep === 1
                    ? "Configure"
                    : visualStep === 2
                    ? "Review"
                    : visualStep === 3
                    ? "Authorize"
                    : "Activate"}
                </span>
                <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium capitalize text-[#667085]">
                  {authMethod} signer
                </span>
              </div>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#101828]">
                {visualStep === 1
                  ? "Create automation"
                  : visualStep === 2
                  ? "Review automation"
                  : visualStep === 3
                  ? "Authorize wallet session"
                  : "Pay and activate automation"}
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#667085]">
                Configure a strategy with a limited wallet session, transparent
                execution limits, and an x402 activation quote.
              </p>
            </div>

            <div className="rounded-2xl border border-[#EAECF0] bg-[#FCFCFD] px-4 py-3">
              <p className="text-[11px] text-[#667085]">
                Connected SocketFi wallet
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#667085]" />
                <p className="font-mono text-xs font-semibold text-[#101828]">
                  {shorten(wallet, 12, 10)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-[#EAECF0] pt-4">
            <SetupProgress currentStep={visualStep} />
          </div>
        </section>

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-[#FECDCA] bg-[#FEF3F2] p-4 text-sm text-[#B42318]">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Unable to continue</p>
              <p className="mt-1 leading-5">{error}</p>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void propose();
              }}
              className="space-y-4"
            >
              <section className="rounded-2xl border border-[#EAECF0] bg-white p-4">
                <SectionHeader
                  icon={Zap}
                  title="Strategy type"
                  description="Choose the automation you want AutoLayer to run."
                />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <StrategyTypeCard
                    active={type === "DCA"}
                    icon={RefreshCw}
                    title="Dollar-cost average"
                    description="Buy an asset gradually on a recurring schedule."
                    onClick={() => {
                      setType("DCA");
                      setError("");
                    }}
                  />
                  <StrategyTypeCard
                    active={type === "DISBURSEMENT"}
                    icon={Coins}
                    title="Disbursement"
                    description="Send scheduled payments to one or more recipients."
                    onClick={() => {
                      setType("DISBURSEMENT");
                      setError("");
                    }}
                  />
                  <StrategyTypeCard
                    active={type === "REBALANCE"}
                    icon={RefreshCw}
                    title="Rebalance"
                    description="Maintain target portfolio allocations automatically."
                    onClick={() => {
                      setType("REBALANCE");
                      setError("");
                    }}
                  />
                  {/* <StrategyTypeCard
                    active={type === "AMPLIDEX_LONG"}
                    icon={ArrowRight}
                    title="Amplidex long"
                    description="Open a scheduled leveraged long position."
                    onClick={() => {
                      setType("AMPLIDEX_LONG");
                      setError("");
                    }}
                  />
                  <StrategyTypeCard
                    active={type === "AMPLIDEX_SHORT"}
                    icon={ArrowLeft}
                    title="Amplidex short"
                    description="Open a scheduled leveraged short position."
                    onClick={() => {
                      setType("AMPLIDEX_SHORT");
                      setError("");
                    }}
                  /> */}
                </div>
              </section>

              <section className="rounded-2xl border border-[#EAECF0] bg-white p-4">
                <SectionHeader
                  icon={CalendarClock}
                  title="Name and schedule"
                  description="Set how often the strategy runs and when its delegated permission expires."
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Automation name" required>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Daily XLM purchase"
                      className={INPUT_CLASS}
                    />
                  </Field>

                  <Field label="First run" hint="" required>
                    <div className="relative">
                      <select
                        value={firstRunMode}
                        onChange={(event) =>
                          setFirstRunMode(event.target.value as FirstRunMode)
                        }
                        className={SELECT_CLASS}
                      >
                        <option value="NOW">
                          Immediately after activation
                        </option>
                        <option value="SCHEDULED">
                          At a specific date and time
                        </option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute bottom-3.5 right-3.5 h-4 w-4 text-[#667085]" />
                    </div>
                  </Field>

                  {firstRunMode === "SCHEDULED" ? (
                    <Field
                      label="First-run date and time"
                      hint="Entered in your local timezone and submitted to AutoLayer as UTC."
                      required
                    >
                      <input
                        type="datetime-local"
                        value={firstRunLocal}
                        min={localDateTimeValue(new Date(Date.now() + 30_000))}
                        onChange={(event) =>
                          setFirstRunLocal(event.target.value)
                        }
                        className={INPUT_CLASS}
                      />
                    </Field>
                  ) : null}

                  <div className="sm:col-span-2 rounded-2xl border border-[#EAECF0] bg-[#FCFCFD] p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={repeatEnabled}
                        onChange={(event) => {
                          setRepeatEnabled(event.target.checked);
                          setError("");
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2F0FD1] focus:ring-[#2F0FD1]"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-[#101828]">
                          Repeat this automation
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[#667085]">
                          Turn this on for repeated run. Repeated runs use
                          interval and maximum-run limits .
                        </span>
                      </span>
                    </label>
                  </div>

                  {repeatEnabled ? (
                    <>
                      <Field label="Repeat every" hint="" required>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={intervalValue}
                          onChange={(event) =>
                            setIntervalValue(event.target.value)
                          }
                          className={INPUT_CLASS}
                        />
                      </Field>

                      <Field label="Interval unit" required>
                        <div className="relative">
                          <select
                            value={intervalUnit}
                            onChange={(event) =>
                              setIntervalUnit(
                                event.target.value as ScheduleUnit
                              )
                            }
                            className={SELECT_CLASS}
                          >
                            {SCHEDULE_UNITS.map((unit) => (
                              <option key={unit.value} value={unit.value}>
                                {Number(intervalValue) === 1
                                  ? unit.singular
                                  : unit.plural}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute bottom-3.5 right-3.5 h-4 w-4 text-[#667085]" />
                        </div>
                      </Field>
                    </>
                  ) : null}

                  <Field
                    label="Session duration"
                    hint="How long the delegated account permission remains valid."
                    required
                  >
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={durationValue}
                      onChange={(event) => setDurationValue(event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </Field>

                  <Field
                    label="Duration unit"
                    hint="Session validity duration unit."
                    required
                  >
                    <div className="relative">
                      <select
                        value={durationUnit}
                        onChange={(event) =>
                          setDurationUnit(event.target.value as ScheduleUnit)
                        }
                        className={SELECT_CLASS}
                      >
                        {SCHEDULE_UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {Number(durationValue) === 1
                              ? unit.singular
                              : unit.plural}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute bottom-3.5 right-3.5 h-4 w-4 text-[#667085]" />
                    </div>
                  </Field>

                  {repeatEnabled ? (
                    <Field
                      label="Maximum runs"
                      hint="The session cannot authorize more successful repeated executions than this limit."
                      required
                    >
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        value={maximumRuns}
                        onChange={(event) => setMaximumRuns(event.target.value)}
                        className={INPUT_CLASS}
                      />
                    </Field>
                  ) : (
                    <Field label="Maximum runs">
                      <div className="mt-2 flex h-11 items-center rounded-xl border border-[#EAECF0] bg-[#F9FAFB] px-3.5 text-sm font-semibold text-[#344054]">
                        1
                        <span className="ml-auto text-xs font-normal text-[#667085]">
                          One-time automation
                        </span>
                      </div>
                    </Field>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[#EAECF0] bg-white p-4">
                <SectionHeader
                  icon={Coins}
                  title={`${selectedType?.label || "Strategy"} settings`}
                  description="Choose wallet or watchlist tokens. Custom token contracts remain available."
                />

                {type === "DCA" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TokenSelect
                      label="Spend token"
                      hint="Deducted from the wallet on each run."
                      value={assetIn}
                      onChange={setAssetIn}
                      tokens={tokens}
                      excludeAddress={assetOut}
                    />
                    <TokenSelect
                      label="Buy token"
                      hint="Received by the wallet after each swap."
                      value={assetOut}
                      onChange={setAssetOut}
                      tokens={tokens}
                      excludeAddress={assetIn}
                    />
                    <AmountInput
                      label="Amount per run"
                      value={amount}
                      onChange={setAmount}
                      token={selectedInputToken}
                    />
                    <Field label="Slippage protection">
                      <div className="mt-2 flex h-11 items-center rounded-xl border border-[#EAECF0] bg-[#F9FAFB] px-3.5 text-sm font-semibold text-[#344054]">
                        1.00%
                        <span className="ml-auto text-xs font-normal text-[#667085]">
                          Fixed safety limit
                        </span>
                      </div>
                    </Field>
                  </div>
                ) : type === "DISBURSEMENT" ? (
                  <div className="space-y-5">
                    <TokenSelect
                      label="Payment token"
                      value={assetIn}
                      onChange={setAssetIn}
                      tokens={tokens}
                    />

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#344054]">
                            Recipients
                          </p>
                          <p className="mt-1 text-xs text-[#667085]">
                            Add one recipient and amount per row.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setRecipients((current) => [
                              ...current,
                              {
                                id: createId("recipient"),
                                address: "",
                                amount: "",
                              },
                            ])
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#EAECF0] bg-white px-3 text-xs font-medium text-[#344054] shadow-sm transition hover:bg-[#F9FAFB]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add recipient
                        </button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {recipients.map((recipient, index) => (
                          <div
                            key={recipient.id}
                            className="grid gap-3 rounded-2xl border border-[#EAECF0] bg-[#FCFCFD] p-3 sm:grid-cols-[1fr_170px_44px]"
                          >
                            <input
                              value={recipient.address}
                              onChange={(event) =>
                                updateRecipient(
                                  recipient.id,
                                  "address",
                                  event.target.value
                                )
                              }
                              placeholder={`Recipient ${index + 1} address`}
                              className="h-11 min-w-0 rounded-xl border border-[#EAECF0] bg-white px-3 font-mono text-xs text-[#101828] outline-none transition focus:border-[#2F0FD1] focus:ring-4 focus:ring-[#EEF2FF]"
                            />
                            <input
                              inputMode="decimal"
                              value={recipient.amount}
                              onChange={(event) => {
                                if (/^\d*(\.\d*)?$/.test(event.target.value)) {
                                  updateRecipient(
                                    recipient.id,
                                    "amount",
                                    event.target.value
                                  );
                                }
                              }}
                              placeholder="Amount"
                              className="h-11 rounded-xl border border-[#EAECF0] bg-white px-3 text-sm text-[#101828] outline-none transition focus:border-[#2F0FD1] focus:ring-4 focus:ring-[#EEF2FF]"
                            />
                            <button
                              type="button"
                              disabled={recipients.length === 1}
                              onClick={() =>
                                setRecipients((current) =>
                                  current.filter(
                                    (item) => item.id !== recipient.id
                                  )
                                )
                              }
                              aria-label={`Remove recipient ${index + 1}`}
                              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#EAECF0] bg-white text-[#667085] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : type === "REBALANCE" ? (
                  <div className="space-y-5">
                    <AmountInput
                      label="Maximum trade per run"
                      value={amount}
                      onChange={setAmount}
                      token={selectedInputToken}
                      hint="Maximum amount the strategy may exchange during one rebalance."
                    />

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[#344054]">
                            Target allocations
                          </p>
                          <p
                            className={classNames(
                              "mt-1 text-xs",
                              Math.abs(allocationTotal - 100) < 0.001
                                ? "text-[#027A48]"
                                : "text-[#B54708]"
                            )}
                          >
                            Total: {allocationTotal || 0}% · must equal 100%
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setRebalanceAssets((current) => [
                              ...current,
                              {
                                id: createId("allocation"),
                                asset: "",
                                weight: "0",
                              },
                            ])
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#EAECF0] bg-white px-3 text-xs font-medium text-[#344054] shadow-sm transition hover:bg-[#F9FAFB]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add asset
                        </button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {rebalanceAssets.map((allocation, index) => (
                          <div
                            key={allocation.id}
                            className="grid gap-3 rounded-2xl border border-[#EAECF0] bg-[#FCFCFD] p-3 sm:grid-cols-[1fr_130px_44px]"
                          >
                            <div className="relative">
                              <select
                                value={allocation.asset}
                                onChange={(event) =>
                                  updateAllocation(
                                    allocation.id,
                                    "asset",
                                    event.target.value
                                  )
                                }
                                className="h-11 w-full appearance-none rounded-xl border border-[#EAECF0] bg-white px-3 pr-9 text-sm text-[#101828] outline-none transition focus:border-[#2F0FD1] focus:ring-4 focus:ring-[#EEF2FF]"
                              >
                                <option value="">
                                  Select asset {index + 1}
                                </option>
                                {tokens.map((token) => (
                                  <option key={token.id} value={token.address}>
                                    {token.symbol} · {token.balance}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[#667085]" />
                            </div>

                            <div className="relative">
                              <input
                                inputMode="decimal"
                                value={allocation.weight}
                                onChange={(event) => {
                                  if (
                                    /^\d*(\.\d*)?$/.test(event.target.value)
                                  ) {
                                    updateAllocation(
                                      allocation.id,
                                      "weight",
                                      event.target.value
                                    );
                                  }
                                }}
                                placeholder="Weight"
                                className="h-11 w-full rounded-xl border border-[#EAECF0] bg-white px-3 pr-8 text-sm text-[#101828] outline-none transition focus:border-[#2F0FD1] focus:ring-4 focus:ring-[#EEF2FF]"
                              />
                              <span className="absolute inset-y-0 right-3 flex items-center text-xs text-[#667085]">
                                %
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={rebalanceAssets.length <= 2}
                              onClick={() =>
                                setRebalanceAssets((current) =>
                                  current.filter(
                                    (item) => item.id !== allocation.id
                                  )
                                )
                              }
                              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#EAECF0] bg-white text-[#667085] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Market" required>
                      <div className="relative">
                        <select
                          value={marketPreset}
                          onChange={(event) =>
                            setMarketPreset(event.target.value)
                          }
                          className={SELECT_CLASS}
                        >
                          {MARKET_PRESETS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                          <option value="__CUSTOM__">Custom market…</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute bottom-3.5 right-3.5 h-4 w-4 text-[#667085]" />
                      </div>
                    </Field>

                    {marketPreset === "__CUSTOM__" ? (
                      <Field label="Custom market" required>
                        <input
                          value={customMarket}
                          onChange={(event) =>
                            setCustomMarket(event.target.value)
                          }
                          placeholder="AQUA-USDC"
                          className={INPUT_CLASS}
                        />
                      </Field>
                    ) : null}

                    <TokenSelect
                      label="Collateral token"
                      value={assetIn}
                      onChange={setAssetIn}
                      tokens={tokens}
                    />
                    <AmountInput
                      label="Collateral per run"
                      value={collateral}
                      onChange={setCollateral}
                      token={selectedInputToken}
                    />
                    <Field
                      label="Leverage"
                      hint="Allowed range: 1x–5x"
                      required
                    >
                      <div className="relative mt-2">
                        <input
                          type="number"
                          min="1"
                          max="5"
                          step="0.1"
                          value={leverage}
                          onChange={(event) => setLeverage(event.target.value)}
                          className="h-11 w-full rounded-xl border border-[#EAECF0] bg-white px-3.5 pr-10 text-sm text-[#101828] outline-none transition focus:border-[#2F0FD1] focus:ring-4 focus:ring-[#EEF2FF]"
                        />
                        <span className="absolute inset-y-0 right-4 flex items-center text-xs font-medium text-[#667085]">
                          x
                        </span>
                      </div>
                    </Field>
                    <Field label="Take-profit price" optional>
                      <input
                        inputMode="decimal"
                        value={takeProfit}
                        onChange={(event) => setTakeProfit(event.target.value)}
                        placeholder="No take profit"
                        className={INPUT_CLASS}
                      />
                    </Field>
                    <Field label="Stop-loss price" optional>
                      <input
                        inputMode="decimal"
                        value={stopLoss}
                        onChange={(event) => setStopLoss(event.target.value)}
                        placeholder="No stop loss"
                        className={INPUT_CLASS}
                      />
                    </Field>
                  </div>
                )}
              </section>

              <div className="sticky bottom-4 z-10 rounded-2xl border border-[#EAECF0] bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur">
                <button
                  type="submit"
                  disabled={Boolean(busyAction)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2F0FD1] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#2409B8] disabled:cursor-not-allowed disabled:bg-[#D0D5DD]"
                >
                  {busyAction === "propose" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Getting x402 quote...
                    </>
                  ) : (
                    <>
                      Continue to review
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
              <div className="rounded-2xl border border-[#EAECF0] bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-[#2F0FD1]" />
                  <h3 className="text-sm font-semibold text-[#101828]">
                    Automation summary
                  </h3>
                </div>
                <div className="space-y-3">
                  <SummaryItem label="Strategy" value={selectedType?.label} />
                  <SummaryItem label="Name" value={name} />
                  <SummaryItem label="Schedule" value={scheduleSummary} />
                  <SummaryItem
                    label="Session duration"
                    value={`${durationValue || 0} ${pluralizeScheduleUnit(
                      durationUnit,
                      Number(durationValue || 0)
                    )}`}
                  />
                  <SummaryItem
                    label="Maximum runs"
                    value={repeatEnabled ? maximumRuns || "0" : "1"}
                  />
                  <SummaryItem
                    label="Authorized volume"
                    value={`${estimatedStrategySpend || 0} ${
                      selectedInputToken?.symbol || "tokens"
                    }`}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#D1FADF] bg-[#F6FEF9] p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#027A48]" />
                  <h3 className="text-sm font-semibold text-[#101828]">
                    Scoped wallet access
                  </h3>
                </div>
                <p className="text-sm leading-6 text-[#667085]">
                  AutoLayer receives only the contract calls, spend limits,
                  expiry ledger, and maximum uses required by this strategy. It
                  never receives unrestricted wallet access.
                </p>
              </div>

              <div className="rounded-2xl border border-[#FEF0C7] bg-[#FFFCF5] p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-[#B54708]" />
                  <h3 className="text-sm font-semibold text-[#101828]">
                    Activation fee
                  </h3>
                </div>
                <p className="text-sm leading-6 text-[#667085]">
                  The exact x402 amount, payment token, treasury, and quote
                  validity appear on the next step before you authorize
                  anything.
                </p>
              </div>
            </aside>
          </section>
        ) : step === 2 && proposal ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <QuoteCard proposal={quote} tokens={tokens} />

              <section className="rounded-2xl border border-[#EAECF0] bg-white p-4">
                <SectionHeader
                  icon={ShieldCheck}
                  title="Scoped session policy"
                  description="Confirm the delegate, policy limits, allowed functions, and expiry before signing."
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryItem
                    label="Automation ID"
                    value={proposal.automationId}
                    mono
                  />
                  <SummaryItem
                    label="Policy ID"
                    value={
                      <span className="flex items-center justify-between gap-3">
                        <span>{proposal.expectedPolicyIdHex}</span>
                        <button
                          type="button"
                          onClick={() =>
                            void copy(proposal.expectedPolicyIdHex, "policy")
                          }
                          className="shrink-0 text-[#667085] hover:text-[#101828]"
                        >
                          {copied === "policy" ? (
                            <Check className="h-4 w-4 text-[#027A48]" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </span>
                    }
                    mono
                  />
                  <SummaryItem
                    label="Delegate"
                    value={proposal.delegatePublicKey}
                    mono
                  />
                  <SummaryItem
                    label="Valid after ledger"
                    value={proposal.sessionPolicyInput?.valid_after_ledger}
                  />
                  <SummaryItem
                    label="Expires at ledger"
                    value={proposal.sessionPolicyInput?.expires_at_ledger}
                  />
                  <SummaryItem
                    label="Maximum uses"
                    value={proposal.sessionPolicyInput?.max_uses ?? "Unlimited"}
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-[#EAECF0] bg-[#FCFCFD] p-4">
                  <p className="text-sm font-semibold text-[#101828]">
                    Allowed functions
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {proposal.sessionPolicyInput?.permissions?.length ? (
                      proposal.sessionPolicyInput.permissions.map(
                        (permission: any) => (
                          <span
                            key={`${permission.contract}-${permission.function}`}
                            className="rounded-full bg-[#EEF2FF] px-3 py-1.5 font-mono text-xs font-medium text-[#2F0FD1]"
                          >
                            {shorten(permission.contract, 7, 5)}.
                            {permission.function}
                          </span>
                        )
                      )
                    ) : (
                      <span className="text-sm text-[#667085]">
                        Defined by the generated strategy policy.
                      </span>
                    )}
                  </div>
                </div>
              </section>

              <div className="sticky bottom-4 z-10 rounded-2xl border border-[#EAECF0] bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur">
                <button
                  type="button"
                  onClick={() => void createSession()}
                  disabled={Boolean(busyAction)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2F0FD1] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#2409B8] disabled:cursor-not-allowed disabled:bg-[#D0D5DD]"
                >
                  {busyAction === "session" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Authorizing session...
                    </>
                  ) : (
                    <>
                      Authorize wallet session
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
              <div className="rounded-2xl border border-[#D1FADF] bg-[#F6FEF9] p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#027A48]" />
                  <h3 className="text-sm font-semibold text-[#101828]">
                    Proposal ready
                  </h3>
                </div>
                <p className="text-sm leading-6 text-[#667085]">
                  Nothing has been authorized yet. Review the generated policy
                  and x402 quote, then approve the scoped session in SocketFi.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EAECF0] bg-white p-5 shadow-sm">
                <div className="space-y-3">
                  <SummaryItem label="Strategy" value={selectedType?.label} />
                  <SummaryItem
                    label="Schedule"
                    value={
                      resolvedSchedule
                        ? resolvedSchedule.repeat
                          ? `First ${formatScheduleDate(
                              resolvedSchedule.firstRunAt
                            )} · every ${resolvedSchedule.expression}`
                          : `Once at ${formatScheduleDate(
                              resolvedSchedule.firstRunAt
                            )}`
                        : scheduleSummary
                    }
                  />
                  <SummaryItem
                    label="Maximum runs"
                    value={repeatEnabled ? maximumRuns : "1"}
                  />
                  <SummaryItem
                    label="Payment token"
                    value={quotePaymentToken.symbol || "See quote"}
                  />
                </div>
              </div>
            </aside>
          </section>
        ) : proposal ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <section className="rounded-2xl border border-[#D1FADF] bg-[#F6FEF9] p-5 shadow-sm">
                <CheckCircle2 className="h-6 w-6 text-[#027A48]" />
                <h2 className="mt-3 text-base font-semibold text-[#101828]">
                  Wallet session created
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#667085]">
                  The scoped policy is now on-chain. Complete the x402 payment
                  to activate the AutoLayer strategy.
                </p>
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-white px-3 py-2">
                  <p className="min-w-0 flex-1 break-all font-mono text-xs text-[#344054]">
                    {sessionTransaction}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copy(sessionTransaction, "sessionTx")}
                    className="text-[#667085] hover:text-[#101828]"
                  >
                    {copied === "sessionTx" ? (
                      <Check className="h-4 w-4 text-[#027A48]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </section>

              <QuoteCard proposal={quote} tokens={tokens} />

              <section className="rounded-2xl border border-[#EAECF0] bg-white p-4">
                <SectionHeader
                  icon={CircleDollarSign}
                  title="Payment authorization"
                  description="The final prompt authorizes only the exact x402 token transfer."
                />

                <div className="rounded-2xl border border-[#EAECF0] bg-[#FCFCFD] p-4 text-sm leading-6 text-[#667085]">
                  AutoLayer prepares the precise Stellar payment operation,
                  including the token, amount, treasury, and
                  signature-expiration ledger. SocketFi signs only that
                  authorization entry.
                </div>
              </section>

              <div className="sticky bottom-4 z-10 rounded-2xl border border-[#EAECF0] bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur">
                <button
                  type="button"
                  onClick={() => void prepareAndActivate()}
                  disabled={Boolean(busyAction)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2F0FD1] px-6 text-sm font-medium text-white shadow-sm transition hover:bg-[#2409B8] disabled:bg-[#D0D5DD]"
                >
                  {busyAction === "activate" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing payment...
                    </>
                  ) : (
                    <>
                      Pay fee and activate
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
              <div className="rounded-2xl border border-[#D1FADF] bg-[#F6FEF9] p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#027A48]" />
                  <h3 className="text-sm font-semibold text-[#101828]">
                    Session authorized
                  </h3>
                </div>
                <p className="text-sm leading-6 text-[#667085]">
                  The limited wallet session exists on-chain. Payment is the
                  only remaining step before AutoLayer schedules the automation.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EAECF0] bg-white p-5 shadow-sm">
                <div className="space-y-3">
                  <SummaryItem label="Automation" value={name} />
                  <SummaryItem label="Strategy" value={selectedType?.label} />
                  <SummaryItem
                    label="Schedule"
                    value={
                      resolvedSchedule
                        ? resolvedSchedule.repeat
                          ? `First ${formatScheduleDate(
                              resolvedSchedule.firstRunAt
                            )} · every ${resolvedSchedule.expression}`
                          : `Once at ${formatScheduleDate(
                              resolvedSchedule.firstRunAt
                            )}`
                        : scheduleSummary
                    }
                  />
                  <SummaryItem
                    label="Policy ID"
                    value={shorten(proposal.expectedPolicyIdHex, 12, 10)}
                    mono
                  />
                </div>
              </div>
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  );
}
