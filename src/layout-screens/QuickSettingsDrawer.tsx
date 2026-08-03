import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  AlertCircle,
  Check,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useStates } from "../context/StatesContext";

import TokenSelectorModal, {
  type SelectableToken,
} from "../pages/swaps/TokenSelectorModal";

type Network = "TESTNET" | "PUBLIC";
type NoticeType = "success" | "error" | "info";

interface QuickSettingsDrawerProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

interface WatchedToken {
  symbol: string;
  contract: string;
  decimals: number;
  icon: string | null;
  atomicBalance: string | null;
  balance: string | null;
  balanceStatus: "fresh" | "unavailable";
  balanceError?: string;
  hidden?: boolean;
}

interface TokenListResponse {
  success: boolean;
  network: Network;
  walletAddress: string;
  count: number;
  tokens: WatchedToken[];
  fetchedAt: string;
  error?: string;
}

interface AddTokenResponse {
  success: boolean;
  created: boolean;
  network: Network;
  token: {
    symbol: string;
    contract: string;
    decimals: number;
    icon: string | null;
  };
  error?: string;
}

interface RemoveTokenResponse {
  success: boolean;
  network: Network;
  contract: string;
  error?: string;
}

interface Notice {
  type: NoticeType;
  message: string;
}

interface SessionShape {
  userProfile?: {
    username?: string;
    address?: Partial<Record<Network, string>>;
  };
}

const API_ORIGIN = (
  import.meta.env.VITE_SERVER_DIRECT_URL ||
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL ||
  "http://localhost:3200"
).replace(/\/$/, "");

const HIDDEN_TOKENS_STORAGE_KEY = "socketfi:hidden-watched-tokens";
const PREFERENCES_STORAGE_KEY = "socketfi:wallet-preferences";

const DEFAULT_PREFERENCES = {
  hideZeroBalance: false,
  hideUnavailableBalances: false,
  autoShowNewAssets: true,
};

type Preferences = typeof DEFAULT_PREFERENCES;

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function maskAddress(value: string, visible = 8): string {
  if (!value || value.length <= visible * 2 + 3) {
    return value;
  }

  return `${value.slice(0, visible)}…${value.slice(-visible)}`;
}

function formatBalance(value: string | null): string {
  if (value === null || value === "") {
    return "Unavailable";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return value;
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 7,
  }).format(numeric);
}

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);

    if (!stored) {
      return fallback;
    }

    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function hiddenStorageKey(network: Network, walletAddress: string): string {
  return `${HIDDEN_TOKENS_STORAGE_KEY}:${network}:${walletAddress}`;
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

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-slate-950 sm:text-base">
            {title}
          </h3>

          {description ? (
            <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">
          {label}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>

      <span
        className={cx(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition",
          checked ? "bg-slate-950" : "bg-slate-300"
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </span>
    </button>
  );
}

function TokenIcon({ token }: { token: WatchedToken }) {
  const [imageFailed, setImageFailed] = useState(false);

  if (token.icon && !imageFailed) {
    return (
      <img
        src={token.icon}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className="h-11 w-11 shrink-0 rounded-2xl border border-slate-200 bg-white object-cover"
      />
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
      <CircleDollarSign className="h-5 w-5" />
    </span>
  );
}

function TokenRow({
  token,
  removing,
  onToggleHidden,
  onRemove,
}: {
  token: WatchedToken;
  removing: boolean;
  onToggleHidden: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <TokenIcon token={token} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-950">
              {token.symbol}
            </p>

            <span
              className={cx(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                token.balanceStatus === "fresh"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              )}
            >
              {token.balanceStatus === "fresh" ? "Live" : "Unavailable"}
            </span>
          </div>

          <p className="mt-0.5 truncate text-xs text-slate-400">
            {maskAddress(token.contract, 7)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-slate-950">
            {formatBalance(token.balance)}
          </p>

          <p className="mt-0.5 text-xs text-slate-500">{token.symbol}</p>
        </div>
      </div>

      {token.balanceError ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{token.balanceError}</span>
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onToggleHidden}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          {token.hidden ? (
            <>
              <Eye className="h-4 w-4" />
              Show in wallet
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4" />
              Hide from wallet
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {removing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Remove
        </button>
      </div>
    </article>
  );
}

export default function QuickSettingsDrawer({
  open,
  setOpen,
}: QuickSettingsDrawerProps) {
  const navigate = useNavigate();

  const {
    activeSession,
    selectedNetwork,
    setAllTokens,
    triggerUpdate,
    swapDappTokenSelectorIsOpen,
    setSwapDappTokenSelectorIsOpen,
    toOrFrom,
    setToOrFrom,
    dappTokenIn,
    setDappTokenIn,
    dappTokenOut,
    setDappTokenOut,
    selectedTransactToken,
    setSelectedTransactToken,
  } = useStates();

  const session = activeSession as SessionShape | null;
  const network = selectedNetwork as Network;

  const walletAddress = session?.userProfile?.address?.[network] || "";

  const username = session?.userProfile?.username || "";

  const [query, setQuery] = useState("");
  const [tokens, setTokens] = useState<WatchedToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addingToken, setAddingToken] = useState(false);
  const [removingContract, setRemovingContract] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [addTokenSelected, setAddTokenSelected] = useState(false);

  const [preferences, setPreferences] = useState<Preferences>(() =>
    readJsonStorage(PREFERENCES_STORAGE_KEY, DEFAULT_PREFERENCES)
  );

  const [hiddenContracts, setHiddenContracts] = useState<Set<string>>(
    () => new Set<string>()
  );

  const requestIdRef = useRef(0);
  const selectorSnapshotRef = useRef<{
    toOrFrom: unknown;
    dappTokenIn: unknown;
    dappTokenOut: unknown;
    selectedTransactToken: unknown;
  } | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setHiddenContracts(new Set());
      return;
    }

    const stored = readJsonStorage<string[]>(
      hiddenStorageKey(network, walletAddress),
      []
    );

    setHiddenContracts(new Set(stored));
  }, [network, walletAddress]);

  useEffect(() => {
    window.localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences)
    );
  }, [preferences]);

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    window.localStorage.setItem(
      hiddenStorageKey(network, walletAddress),
      JSON.stringify(Array.from(hiddenContracts))
    );
  }, [hiddenContracts, network, walletAddress]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      // TokenSelectorModal owns Escape while it is open.
      if (swapDappTokenSelectorIsOpen || addingToken) {
        return;
      }

      setOpen(false);
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [addingToken, open, setOpen, swapDappTokenSelectorIsOpen]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 1_800);

    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(
      () => setNotice(null),
      notice.type === "error" ? 6_000 : 3_500
    );

    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (open && username && walletAddress) {
      void loadTokens(false);
    }
  }, [open, network, username, walletAddress]);

  const decoratedTokens = useMemo(
    () =>
      tokens.map((token) => ({
        ...token,
        hidden: hiddenContracts.has(token.contract),
      })),
    [hiddenContracts, tokens]
  );

  const visibleTokens = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return decoratedTokens.filter((token) => {
      const matchesQuery =
        !normalizedQuery ||
        token.symbol.toLowerCase().includes(normalizedQuery) ||
        token.contract.toLowerCase().includes(normalizedQuery);

      const balanceNumber = Number(token.balance || 0);

      const matchesZeroPreference =
        !preferences.hideZeroBalance ||
        token.balance === null ||
        !Number.isFinite(balanceNumber) ||
        balanceNumber !== 0;

      const matchesAvailabilityPreference =
        !preferences.hideUnavailableBalances || token.balanceStatus === "fresh";

      return (
        matchesQuery && matchesZeroPreference && matchesAvailabilityPreference
      );
    });
  }, [decoratedTokens, preferences, query]);

  const hiddenCount = decoratedTokens.filter((token) => token.hidden).length;

  function updateMainWalletTokens(nextTokens: WatchedToken[]) {
    const visible = nextTokens
      .filter((token) => !hiddenContracts.has(token.contract))
      .map((token) => ({
        id: token.contract,
        address: token.contract,
        contract: token.contract,
        code: token.symbol,
        symbol: token.symbol,
        name: token.symbol,
        decimals: token.decimals,
        icon: token.icon,
        balance: token.balance || "0",
        atomicBalance: token.atomicBalance,
        balanceStatus: token.balanceStatus,
      }));

    setAllTokens?.(visible);
  }

  async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${API_ORIGIN}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    return readApiResponse<T>(response);
  }

  async function loadTokens(isRefresh: boolean) {
    if (!username || !walletAddress) {
      setTokens([]);
      setNotice({
        type: "error",
        message:
          "A username and SocketFi wallet address are required to load tokens.",
      });
      return;
    }

    const requestId = ++requestIdRef.current;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadingTokens(true);
    }

    try {
      const params = new URLSearchParams({
        network,
        username,
        walletAddress,
      });

      const data = await apiRequest<TokenListResponse>(
        `/api/wallet/tokens?${params.toString()}`,
        {
          method: "GET",
        }
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      const nextTokens = Array.isArray(data.tokens) ? data.tokens : [];

      setTokens(nextTokens);
      setLastFetchedAt(data.fetchedAt || new Date().toISOString());
      updateMainWalletTokens(nextTokens);
    } catch (error) {
      console.error("[quick-settings/load-tokens]", error);

      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingTokens(false);
        setRefreshing(false);
      }
    }
  }

  async function addToken(input: { contract: string; icon?: string }) {
    if (!username || !walletAddress) {
      setNotice({
        type: "error",
        message:
          "A username and SocketFi wallet address are required to add tokens.",
      });
      return;
    }

    setAddingToken(true);
    setNotice(null);

    try {
      const data = await apiRequest<AddTokenResponse>("/api/wallet/tokens", {
        method: "POST",
        body: JSON.stringify({
          network,
          username,
          walletAddress,
          contract: input.contract,
          icon: input.icon,
        }),
      });

      setSwapDappTokenSelectorIsOpen(false);

      setNotice({
        type: "success",
        message: data.created
          ? `${data.token.symbol} added to your watchlist.`
          : `${data.token.symbol} metadata refreshed.`,
      });

      if (preferences.autoShowNewAssets) {
        setHiddenContracts((current) => {
          const next = new Set(current);
          next.delete(data.token.contract);
          return next;
        });
      }

      await loadTokens(true);
      triggerUpdate?.();
    } catch (error) {
      console.error("[quick-settings/add-token]", error);

      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });

      throw error;
    } finally {
      setAddTokenSelected(false);
      setAddingToken(false);
    }
  }

  function openTokenSelector(event?: React.MouseEvent<HTMLButtonElement>) {
    setAddTokenSelected(true);
    event?.preventDefault();
    event?.stopPropagation();

    if (!username || !walletAddress || addingToken) {
      return;
    }

    setNotice(null);

    selectorSnapshotRef.current = {
      toOrFrom,
      dappTokenIn,
      dappTokenOut,
      selectedTransactToken,
    };

    // The existing selector requires one of its normal selection targets.
    setToOrFrom("from");

    // Mount after the opening click has fully completed. The wrapper below
    // disables only the selector backdrop, so this cannot be closed by the
    // same pointer interaction or by the drawer backdrop.
    window.setTimeout(() => {
      setSwapDappTokenSelectorIsOpen(true);
    }, 0);
  }

  function restoreSelectorContext() {
    const snapshot = selectorSnapshotRef.current;

    if (!snapshot) {
      return;
    }

    setToOrFrom(snapshot.toOrFrom);
    setDappTokenIn(snapshot.dappTokenIn as any);
    setDappTokenOut(snapshot.dappTokenOut as any);
    setSelectedTransactToken(snapshot.selectedTransactToken as any);
    selectorSnapshotRef.current = null;
  }

  function closeTokenSelector() {
    restoreSelectorContext();
    setSwapDappTokenSelectorIsOpen(false);
  }

  async function handleSelectedToken(token: SelectableToken) {
    if (!addTokenSelected) {
      return null;
    }
    // The selector updates swap context before invoking onSelect. Restore it
    // because this selector instance is being used only to add a watch token.
    restoreSelectorContext();

    const contract = String(token?.contract || token?.address || "")
      .trim()
      .toUpperCase();

    if (!contract) {
      setNotice({
        type: "error",
        message: "The selected asset does not include a token contract.",
      });
      return;
    }

    const iconValue = String(token?.icon || "").trim();
    const icon =
      iconValue && /^https:\/\//i.test(iconValue) ? iconValue : undefined;

    try {
      await addToken({
        contract,
        icon,
      });
    } catch {
      /*
       * The selector closes itself immediately after selection. Reopen it when
       * verification fails so the user can choose or enter another asset.
       */
      setSwapDappTokenSelectorIsOpen(true);
    }
  }

  async function removeToken(contract: string) {
    if (!username || !walletAddress) {
      setNotice({
        type: "error",
        message:
          "A username and SocketFi wallet address are required to remove tokens.",
      });
      return;
    }

    const confirmed = window.confirm(
      "Remove this token from your SocketFi watchlist?"
    );

    if (!confirmed) {
      return;
    }

    setRemovingContract(contract);
    setNotice(null);

    try {
      await apiRequest<RemoveTokenResponse>(
        `/api/wallet/tokens/${encodeURIComponent(
          contract
        )}?${new URLSearchParams({
          network,
          username,
          walletAddress,
        }).toString()}`,
        {
          method: "DELETE",
        }
      );

      setHiddenContracts((current) => {
        const next = new Set(current);
        next.delete(contract);
        return next;
      });

      setNotice({
        type: "success",
        message: "Token removed from your watchlist.",
      });

      await loadTokens(true);
      triggerUpdate?.();
    } catch (error) {
      console.error("[quick-settings/remove-token]", error);

      setNotice({
        type: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setRemovingContract(null);
    }
  }

  function toggleHidden(contract: string) {
    setHiddenContracts((current) => {
      const next = new Set(current);

      if (next.has(contract)) {
        next.delete(contract);
      } else {
        next.add(contract);
      }

      const nextTokens = tokens.filter((token) => !next.has(token.contract));
      updateMainWalletTokens(nextTokens);

      return next;
    });
  }

  async function copyAddress() {
    if (!walletAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
    } catch {
      setNotice({
        type: "error",
        message: "Unable to copy the wallet address.",
      });
    }
  }

  function openFullSettings() {
    setOpen(false);
    navigate("/settings");
  }

  return (
    <>
      <div
        className={cx(
          "pointer-events-none fixed inset-0 transition",
          swapDappTokenSelectorIsOpen ? "z-[40]" : "z-[90]",
          open && "pointer-events-auto"
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Close quick settings"
          onMouseDown={(event) => {
            event.preventDefault();

            if (!swapDappTokenSelectorIsOpen && !addingToken) {
              setOpen(false);
            }
          }}
          className={cx(
            "absolute inset-0 bg-slate-950/35 backdrop-blur-[3px] transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0"
          )}
        />

        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-settings-title"
          className={cx(
            "absolute right-0 top-0 h-full w-full transform border-l border-slate-200 bg-slate-50 shadow-[0_20px_70px_rgba(15,23,42,0.22)] transition-transform duration-300 ease-out sm:max-w-[470px]",
            open ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <SlidersHorizontal className="h-5 w-5" />
                  </span>

                  <h2
                    id="quick-settings-title"
                    className="mt-4 text-xl font-semibold tracking-tight text-slate-950"
                  >
                    Wallet settings
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Manage watched assets and lightweight wallet preferences.
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Close quick settings"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                    <Wallet className="h-4 w-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {username || "No active account"}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {walletAddress || "No wallet available"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void copyAddress()}
                    disabled={!walletAddress}
                    aria-label="Copy wallet address"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 disabled:opacity-40"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-700" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    {network}
                  </span>

                  {lastFetchedAt ? (
                    <span className="text-[11px] text-slate-400">
                      Balances refreshed{" "}
                      {new Date(lastFetchedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : null}
                </div>
              </div>

              {notice ? (
                <div
                  role={notice.type === "error" ? "alert" : "status"}
                  className={cx(
                    "mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm leading-5",
                    notice.type === "success" &&
                      "border-emerald-200 bg-emerald-50 text-emerald-800",
                    notice.type === "error" &&
                      "border-rose-200 bg-rose-50 text-rose-700",
                    notice.type === "info" &&
                      "border-slate-200 bg-slate-50 text-slate-700"
                  )}
                >
                  {notice.type === "error" ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  {notice.message}
                </div>
              ) : null}
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <Section
                title="Watched assets"
                description="Saved assets are loaded with fresh on-chain balances."
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadTokens(true)}
                      disabled={refreshing || loadingTokens || !walletAddress}
                      aria-label="Refresh token balances"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      <RefreshCw
                        className={cx("h-4 w-4", refreshing && "animate-spin")}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={openTokenSelector}
                      disabled={!username || !walletAddress || addingToken}
                      className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                      Add token
                    </button>
                  </div>
                }
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search symbol or contract"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>
                    {tokens.length} watched · {hiddenCount} hidden
                  </span>

                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="font-semibold text-indigo-700"
                    >
                      Clear search
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3">
                  {loadingTokens ? (
                    <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                      <p className="mt-3 text-sm font-semibold text-slate-800">
                        Loading fresh balances…
                      </p>
                    </div>
                  ) : visibleTokens.length > 0 ? (
                    visibleTokens.map((token) => (
                      <TokenRow
                        key={token.contract}
                        token={token}
                        removing={removingContract === token.contract}
                        onToggleHidden={() => toggleHidden(token.contract)}
                        onRemove={() => void removeToken(token.contract)}
                      />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-9 text-center">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                        <CircleDollarSign className="h-5 w-5" />
                      </span>

                      <p className="mt-4 text-sm font-semibold text-slate-900">
                        {tokens.length === 0
                          ? "No watched tokens yet"
                          : "No matching assets"}
                      </p>

                      <p className="mx-auto mt-1 max-w-[280px] text-xs leading-5 text-slate-500">
                        {tokens.length === 0
                          ? "Add a token contract and SocketFi will verify its metadata and fetch its wallet balance."
                          : "Change your search or display preferences."}
                      </p>

                      {tokens.length === 0 ? (
                        <button
                          type="button"
                          onClick={openTokenSelector}
                          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white"
                        >
                          <Plus className="h-4 w-4" />
                          Add first token
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </Section>

              {/* <Section
                title="Display preferences"
                description="These settings apply locally to this browser."
              >
                <div className="space-y-3">
                  <Toggle
                    checked={preferences.hideZeroBalance}
                    onChange={(value) =>
                      setPreferences((current) => ({
                        ...current,
                        hideZeroBalance: value,
                      }))
                    }
                    label="Hide zero-balance assets"
                    description="Keep the watchlist focused on assets with a balance."
                  />

                  <Toggle
                    checked={preferences.hideUnavailableBalances}
                    onChange={(value) =>
                      setPreferences((current) => ({
                        ...current,
                        hideUnavailableBalances: value,
                      }))
                    }
                    label="Hide unavailable balances"
                    description="Hide token contracts whose balance could not be refreshed."
                  />

                  <Toggle
                    checked={preferences.autoShowNewAssets}
                    onChange={(value) =>
                      setPreferences((current) => ({
                        ...current,
                        autoShowNewAssets: value,
                      }))
                    }
                    label="Show newly added assets"
                    description="Automatically include newly watched tokens in the main wallet view."
                  />
                </div>
              </Section> */}

              <Section
                title="More settings"
                description="Open the full settings page for account and security controls."
              >
                <button
                  type="button"
                  onClick={openFullSettings}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Settings className="h-5 w-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-950">
                      Account and security
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Manage sessions, recovery, limits, and connected access.
                    </span>
                  </span>

                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
                </button>
              </Section>
            </div>

            <footer className="border-t border-slate-200 bg-white px-4 py-4 sm:px-5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={openTokenSelector}
                  disabled={!username || !walletAddress || addingToken}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  Add token
                </button>

                <button
                  type="button"
                  onClick={openFullSettings}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Link2 className="h-4 w-4" />
                  Full settings
                </button>
              </div>
            </footer>
          </div>
        </aside>
      </div>

      {/*
       * TokenSelectorModal is intentionally unchanged. When it is used from
       * this drawer, disable pointer events on only its full-screen backdrop
       * and restore them on the actual dialog. This prevents the selector's
       * backdrop onMouseDown from firing immediately after the Add token click.
       * The close button, token rows, search input, and custom-asset form remain
       * fully interactive.
       */}
      <div
        className={cx(
          "[&>div]:pointer-events-none [&>div>div]:pointer-events-auto",
          !swapDappTokenSelectorIsOpen && "hidden"
        )}
      >
        <TokenSelectorModal
          onClose={closeTokenSelector}
          onSelect={(token) => {
            void handleSelectedToken(token);
          }}
        />
      </div>

      {addingToken && addTokenSelected ? (
        <div className="pointer-events-none fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/10">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-xl ring-1 ring-slate-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying and adding token…
          </div>
        </div>
      ) : null}
    </>
  );
}
