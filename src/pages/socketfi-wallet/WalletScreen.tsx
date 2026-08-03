import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { useStates } from "../../context/StatesContext";
import { curatedList } from "../../utils/curated-asset-list";
import AquariusSwapModal from "./AquariusSwapModal";

type Network = "TESTNET" | "PUBLIC" | string;

interface WalletTokenPrice {
  selectedPrice?: string | number | null;
}

interface WalletToken {
  id?: string;
  address?: string;
  contract?: string;
  symbol?: string;
  name?: string;
  icon?: string | null;
  decimals?: number;
  balance?: string | number | null;
  atomicBalance?: string | null;
  balanceStatus?: "fresh" | "unavailable";
  balanceError?: string;
  price?: WalletTokenPrice | null;
}

interface PortfolioDetail {
  values?: Record<string, string | number | null | undefined>;
  portfolio?: Record<string, string | number | null | undefined>;
}

interface WalletAction {
  id?: string | number;
  name?: string;
  type?: string;
  onClick?: () => void;
}

interface SessionShape {
  userProfile?: {
    username?: string;
    address?: Partial<Record<"TESTNET" | "PUBLIC", string>>;
  };
}

interface TokenListResponse {
  success: boolean;
  network: "TESTNET" | "PUBLIC";
  username: string;
  walletAddress: string;
  count: number;
  tokens: WalletToken[];
  fetchedAt: string;
  error?: string;
}

interface WalletContextValue {
  selectedNetwork: Network;
  updateData: number;
  activeSession?: SessionShape | null;
  allTokens?: WalletToken[] | null;
  buttons?: WalletAction[] | null;
  portfolioDetail?: PortfolioDetail | null;
  setAllTokens?: (tokens: WalletToken[]) => void;
  triggerUpdate?: () => void;
  setIsOpenSend: (value: boolean) => void;
}

type ActionVariant = "primary" | "tinted" | "soft";

interface WalletActionButtonProps {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  variant?: ActionVariant;
  to?: string;
}

interface TokenViewProps {
  tokens: WalletToken[];
  selectedNetwork: Network;
  portfolioDetail?: PortfolioDetail | null;
}

interface TokenIdentityProps {
  token: WalletToken;
  selectedNetwork: Network;
}

interface AssetMetricProps {
  label: string;
  value: string;
}

const DEFAULT_TOKEN_ICON = "/cryptoIcons/default-token.svg";
const XLM_TOKEN_ICON = "/cryptoIcons/XLM.svg";

const API_ORIGIN = (
  import.meta.env.VITE_SERVER_DIRECT_URL ||
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL ||
  "http://localhost:3200"
).replace(/\/$/, "");

const HIDDEN_TOKENS_STORAGE_KEY = "socketfi:hidden-watched-tokens";

function normalizeNetwork(value: Network): "TESTNET" | "PUBLIC" {
  return String(value || "").toUpperCase() === "PUBLIC" ? "PUBLIC" : "TESTNET";
}

function hiddenStorageKey(
  network: "TESTNET" | "PUBLIC",
  walletAddress: string
): string {
  return `${HIDDEN_TOKENS_STORAGE_KEY}:${network}:${walletAddress}`;
}

function getHiddenContracts(
  network: "TESTNET" | "PUBLIC",
  walletAddress: string
): Set<string> {
  if (!walletAddress) {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(
      hiddenStorageKey(network, walletAddress)
    );

    if (!raw) {
      return new Set();
    }

    const values = JSON.parse(raw);

    if (!Array.isArray(values)) {
      return new Set();
    }

    return new Set(
      values
        .map((value) =>
          String(value || "")
            .trim()
            .toUpperCase()
        )
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

async function readApiResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error ||
        payload.message ||
        `Request failed with status ${response.status}`
    );
  }

  return payload as T;
}

function normalizeApiToken(token: WalletToken): WalletToken {
  const contract = String(token.contract || token.address || token.id || "")
    .trim()
    .toUpperCase();

  const rawSymbol = String(token.symbol || token.name || "TOKEN").trim();
  const symbol =
    rawSymbol.toLowerCase() === "native" ? "XLM" : rawSymbol.toUpperCase();

  return {
    ...token,
    id: contract,
    address: contract,
    contract,
    symbol,
    name: token.name || symbol,
    icon: token.icon || null,
    balance: token.balance ?? "0",
  };
}

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function normalizeAssetId(token: WalletToken): string {
  return (
    token.contract?.trim() ||
    token.address?.trim() ||
    token.id?.trim() ||
    token.symbol?.trim() ||
    "unknown-token"
  );
}

function normalizeSymbol(symbol?: string): string {
  return symbol?.trim().toUpperCase() || "TOKEN";
}

function formatAmount(
  value: unknown,
  options: {
    maximumSignificantDigits?: number;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  const number = Number(value);

  if (!Number.isFinite(number) || number === 0) {
    return "0.00";
  }

  const absolute = Math.abs(number);

  if (absolute >= 1) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: options.minimumFractionDigits ?? 2,
      maximumFractionDigits: options.maximumFractionDigits ?? 6,
    }).format(number);
  }

  return new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: options.maximumSignificantDigits ?? 6,
  }).format(number);
}

function formatFiat(value: unknown): string {
  if (typeof value === "string" && value.trim().startsWith("$")) {
    return value;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "$0.00";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function formatPortfolioPercent(value: unknown): string {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0.00%";
  }

  /*
   * Supports either:
   * - ratio form: 0.25
   * - percentage form: 25
   */
  const percentage = Math.abs(number) <= 1 ? number * 100 : number;

  return `${percentage.toFixed(2)}%`;
}

function findCuratedAsset(token: WalletToken) {
  const tokenId = normalizeAssetId(token).toLowerCase();

  return curatedList.find((item) => item?.contract?.toLowerCase() === tokenId);
}

function getTokenIcon(selectedNetwork: Network, token: WalletToken): string {
  if (token.icon) {
    return token.icon;
  }

  const curatedAsset = findCuratedAsset(token);

  if (curatedAsset?.icon) {
    return curatedAsset.icon;
  }

  const symbol = normalizeSymbol(token.symbol);

  /*
   * Prefer a symbol-specific icon if your public folder contains it.
   * onError falls back to a generic asset icon.
   */
  if (symbol === "XLM") {
    return XLM_TOKEN_ICON;
  }

  return `/cryptoIcons/${symbol}.svg`;
}

function getTokenAccent(symbol?: string) {
  const normalized = normalizeSymbol(symbol);

  if (["USDC", "USDT", "EURC"].includes(normalized)) {
    return {
      badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      label: "Stable",
    };
  }

  if (["XLM", "BTC", "ETH"].includes(normalized)) {
    return {
      badge: "bg-sky-50 text-sky-700 ring-sky-200",
      label: "Core",
    };
  }

  return {
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
    label: "Asset",
  };
}

function getActionVariant(action: WalletAction, index: number): ActionVariant {
  const normalized = String(action.type || action.name || "").toLowerCase();

  if (normalized.includes("send") || normalized.includes("transfer")) {
    return "primary";
  }

  if (normalized.includes("receive") || normalized.includes("deposit")) {
    return "soft";
  }

  return index === 0 ? "primary" : "tinted";
}

function getActionIcon(action: WalletAction): ReactNode {
  const normalized = String(action.type || action.name || "").toLowerCase();

  if (normalized.includes("receive") || normalized.includes("deposit")) {
    return <ArrowDownLeft className="h-4 w-4" />;
  }

  return <ArrowUpRight className="h-4 w-4" />;
}

function WalletActionButton({
  label,
  icon,
  onClick,
  variant = "soft",
  to,
}: WalletActionButtonProps) {
  const baseClass =
    "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

  const variantClass: Record<ActionVariant, string> = {
    primary:
      "bg-slate-950 text-white shadow-sm hover:-translate-y-0.5 hover:bg-slate-800",
    tinted:
      "border border-indigo-100 bg-indigo-50 text-indigo-700 hover:-translate-y-0.5 hover:bg-indigo-100",
    soft: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:bg-slate-50",
  };

  const content = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classNames(baseClass, variantClass[variant])}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(baseClass, variantClass[variant])}
    >
      {content}
    </button>
  );
}

function TokenIcon({ token, selectedNetwork }: TokenIdentityProps) {
  return (
    <img
      className="h-10 w-10 shrink-0 rounded-full border border-slate-200 bg-white object-cover"
      src={getTokenIcon(selectedNetwork, token)}
      alt={`${normalizeSymbol(token.symbol)} icon`}
      loading="lazy"
      onError={(event) => {
        if (event.currentTarget.src.endsWith(DEFAULT_TOKEN_ICON)) {
          return;
        }

        event.currentTarget.src = DEFAULT_TOKEN_ICON;
      }}
    />
  );
}

function TokenIdentity({ token, selectedNetwork }: TokenIdentityProps) {
  const accent = getTokenAccent(token.symbol);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <TokenIcon token={token} selectedNetwork={selectedNetwork} />

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-950">
            {normalizeSymbol(token.symbol)}
          </p>

          <span
            className={classNames(
              "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
              accent.badge
            )}
          >
            {accent.label}
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs text-slate-500">
          {token.name || normalizeAssetId(token)}
        </p>
      </div>
    </div>
  );
}

function AssetMetric({ label, value }: AssetMetricProps) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function AssetTable({
  tokens,
  selectedNetwork,
  portfolioDetail,
}: TokenViewProps) {
  return (
    <div className="hidden overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm md:block">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Asset
              </th>

              <th className="hidden px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 lg:table-cell">
                Allocation
              </th>

              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Price
              </th>

              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Balance
              </th>

              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Value
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {tokens.map((token) => {
              const tokenId = normalizeAssetId(token);

              const tokenValue = portfolioDetail?.values?.[tokenId];

              const tokenPortfolio = portfolioDetail?.portfolio?.[tokenId];

              return (
                <tr key={tokenId} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <TokenIdentity
                      token={token}
                      selectedNetwork={selectedNetwork}
                    />
                  </td>

                  <td className="hidden px-4 py-4 text-sm font-medium text-slate-700 lg:table-cell">
                    {formatPortfolioPercent(tokenPortfolio)}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-slate-700">
                    {formatFiat(token.price?.selectedPrice)}
                  </td>

                  <td className="px-4 py-4 text-sm font-semibold text-slate-950">
                    {formatAmount(token.balance)}
                  </td>

                  <td className="px-5 py-4 text-right text-sm font-semibold text-slate-950">
                    {formatFiat(tokenValue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileAssetCards({
  tokens,
  selectedNetwork,
  portfolioDetail,
}: TokenViewProps) {
  return (
    <div className="space-y-3 md:hidden">
      {tokens.map((token) => {
        const tokenId = normalizeAssetId(token);

        const tokenValue = portfolioDetail?.values?.[tokenId];

        const tokenPortfolio = portfolioDetail?.portfolio?.[tokenId];

        return (
          <article
            key={tokenId}
            className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <TokenIdentity token={token} selectedNetwork={selectedNetwork} />

              <div className="max-w-[42%] text-right">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {formatFiat(tokenValue)}
                </p>

                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {formatFiat(token.price?.selectedPrice)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3">
              <AssetMetric
                label="Balance"
                value={formatAmount(token.balance)}
              />

              <AssetMetric
                label="Allocation"
                value={formatPortfolioPercent(tokenPortfolio)}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EmptyAssetsState() {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
        <Plus className="h-5 w-5" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-950">
        No assets to display
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        Deposit funds or add tokens to your watchlist to see them here.
      </p>
    </div>
  );
}

export default function WalletScreen() {
  const {
    selectedNetwork,
    activeSession,
    allTokens,
    buttons,
    portfolioDetail,
    updateData,
    setAllTokens,
  } = useStates() as WalletContextValue;

  const network = normalizeNetwork(selectedNetwork);

  const username = activeSession?.userProfile?.username?.trim() || "";

  const walletAddress =
    activeSession?.userProfile?.address?.[network]?.trim() || "";

  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);
  const [tokenLoadError, setTokenLoadError] = useState("");
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [swapModalOpen, setSwapModalOpen] = useState(false);

  /*
   * Prevent an older request from overwriting a newer wallet/network request.
   */
  const requestIdRef = useRef(0);

  const fetchWalletTokens = useCallback(
    async (refresh = false) => {
      if (!username || !walletAddress) {
        requestIdRef.current += 1;
        setAllTokens?.([]);
        setTokenLoadError("");
        setLastFetchedAt(null);
        return;
      }

      const requestId = ++requestIdRef.current;

      if (refresh) {
        setIsRefreshingTokens(true);
      } else {
        setIsLoadingTokens(true);
      }

      setTokenLoadError("");

      try {
        const query = new URLSearchParams({
          network,
          username,
          walletAddress,
        });

        let response: Response;

        try {
          response = await fetch(
            `${API_ORIGIN}/api/wallet/tokens?${query.toString()}`,
            {
              method: "GET",
              headers: {
                Accept: "application/json",
              },
            }
          );
        } catch {
          throw new Error(
            `Cannot connect to the SocketFi API at ${API_ORIGIN}.`
          );
        }

        const data = await readApiResponse<TokenListResponse>(response);

        if (requestId !== requestIdRef.current) {
          return;
        }

        const hiddenContracts = getHiddenContracts(network, walletAddress);

        const nextTokens = (Array.isArray(data.tokens) ? data.tokens : [])
          .map(normalizeApiToken)
          .filter(
            (token) =>
              token.contract &&
              !hiddenContracts.has(String(token.contract).toUpperCase())
          );

        setAllTokens?.(nextTokens);
        setLastFetchedAt(data.fetchedAt || new Date().toISOString());
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.error("[wallet-screen/load-tokens]", error);

        setTokenLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load wallet tokens."
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoadingTokens(false);
          setIsRefreshingTokens(false);
        }
      }
    },
    [network, setAllTokens, username, walletAddress, updateData]
  );

  /*
   * Fetch immediately when WalletScreen mounts, and fetch again whenever the
   * active username, wallet address, or network changes.
   */
  useEffect(() => {
    void fetchWalletTokens(false);

    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchWalletTokens]);

  /*
   * The drawer stores hidden-token preferences in localStorage. Listen for
   * changes from another tab/window and refresh the visible wallet list.
   */
  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    const key = hiddenStorageKey(network, walletAddress);

    function handleStorage(event: StorageEvent) {
      if (event.key === key) {
        void fetchWalletTokens(true);
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchWalletTokens, network, walletAddress]);

  const tokens = useMemo(
    () =>
      Array.isArray(allTokens)
        ? allTokens.filter((token): token is WalletToken =>
            Boolean(token && normalizeAssetId(token))
          )
        : [],
    [allTokens]
  );

  const availableActions = useMemo(
    () =>
      Array.isArray(buttons)
        ? buttons.filter(
            (button) =>
              button &&
              typeof button.name === "string" &&
              button.name.trim().length > 0
          )
        : [],
    [buttons]
  );

  function runAction(action: WalletAction) {
    action.onClick?.();
  }

  const hasIdentity = Boolean(username && walletAddress);

  return (
    <>
      <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-50 via-indigo-50/70 to-white px-4 py-5 sm:px-6">
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-200/25 blur-3xl" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                <Wallet className="h-3.5 w-3.5" />
                Portfolio
              </div>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px]">
                Your assets
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                View current balances and manage the tokens in your wallet.
              </p>
            </div>

            <div className="grid h-full w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:w-auto xl:min-w-[460px]">
              {availableActions.map((action, index) => (
                <WalletActionButton
                  key={action.id ?? `${action.name}-${index}`}
                  label={action.name || "Wallet action"}
                  variant={getActionVariant(action, index)}
                  icon={getActionIcon(action)}
                  onClick={() => runAction(action)}
                />
              ))}

              <WalletActionButton
                label="Swap Assets"
                onClick={() => setSwapModalOpen(true)}
                variant="tinted"
                icon={<ArrowLeftRight className="h-4 w-4" />}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                Assets
              </h3>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Fresh on-chain balances for your watched assets.
              </p>

              {lastFetchedAt ? (
                <p className="mt-1 text-xs text-slate-400">
                  Last refreshed{" "}
                  {new Date(lastFetchedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void fetchWalletTokens(true)}
              disabled={!hasIdentity || isLoadingTokens || isRefreshingTokens}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={classNames(
                  "h-4 w-4",
                  isRefreshingTokens && "animate-spin"
                )}
              />
              <span className="hidden sm:inline">
                {isRefreshingTokens ? "Refreshing…" : "Refresh"}
              </span>
            </button>
          </header>

          {tokenLoadError ? (
            <div
              role="alert"
              className="flex items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-rose-800">
                    Unable to load assets
                  </p>

                  <p className="mt-1 break-words text-xs leading-5 text-rose-700">
                    {tokenLoadError}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void fetchWalletTokens(true)}
                className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100"
              >
                Retry
              </button>
            </div>
          ) : null}

          {!hasIdentity ? (
            <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <Wallet className="mx-auto h-6 w-6 text-slate-500" />

              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                Wallet session required
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                Sign in to load your watched tokens and current balances.
              </p>
            </div>
          ) : isLoadingTokens ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[22px] border border-slate-200 bg-slate-50 px-5 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />

              <p className="mt-3 text-sm font-semibold text-slate-800">
                Loading wallet assets…
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Fetching fresh balances from the selected network.
              </p>
            </div>
          ) : tokens.length > 0 ? (
            <>
              <AssetTable
                tokens={tokens}
                selectedNetwork={selectedNetwork}
                portfolioDetail={portfolioDetail}
              />

              <MobileAssetCards
                tokens={tokens}
                selectedNetwork={selectedNetwork}
                portfolioDetail={portfolioDetail}
              />
            </>
          ) : (
            <EmptyAssetsState />
          )}
        </div>
      </section>

      <AquariusSwapModal
        open={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        tokens={tokens}
      />
    </>
  );
}
