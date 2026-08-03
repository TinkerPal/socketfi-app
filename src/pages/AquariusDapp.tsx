// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  Droplets,
  ExternalLink,
  Loader2,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Search,
} from "lucide-react";

import AquariusSwapModal from "./socketfi-wallet/AquariusSwapModal";
import AquariusConcentratedLiquidity from "./AquariusConcentratedLiquidity";
import { useStates } from "../context/StatesContext";
import { useSocketFiSorobanExecutor } from "../services/useSocketFiSorobanExecutor";

type Action = "pools" | "deposit" | "withdraw";
type PoolSort = "totalVolume" | "txCount" | "tvl" | "volume24h";
type EditedSide = "A" | "B";

interface PoolToken {
  contract: string;
  symbol: string;
  name?: string;
  issuer?: string | null;
  asset?: string;
  decimals: number;
  icon?: string | null;
  reserveAtomic?: string;
}

interface AquariusPool {
  id: string;
  address: string;
  poolHash?: string;
  poolType?: string;
  tokenA: PoolToken;
  tokenB: PoolToken;
  feePercent?: number | null;
  feeBps?: number | null;
  tvlUsd?: number | null;
  apr?: number | null;
  volume24hUsd?: number | null;
  totalVolumeAtomic?: string;
  txCount?: number;
  totalSharesAtomic?: string;
  userSharesAtomic?: string;
  userSharePercent?: number;
  lpToken?: string | null;
  liquidityCapable?: boolean;
  stateStatus?: "ready" | "partial" | "unavailable";
  stateError?: string | null;
}

interface LiquidityQuote {
  contractId: string;
  functionName: string;
  argsXdr: string[];
  amountAAtomic?: string;
  amountBAtomic?: string;
  amountA?: string;
  amountB?: string;
  expectedSharesAtomic?: string;
  minSharesAtomic?: string;
  sharesAtomic?: string;
  expectedAmountA?: string;
  expectedAmountB?: string;
  expiresAt?: string;
}

const DEFAULT_ICON = "https://www.socket.fi/xlm-icon.svg";

function normalizePoolType(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function safeText(value: unknown): string {
  const text = String(value ?? "").trim();
  return text === "undefined" || text === "null" ? "" : text;
}

function safeAtomic(value: unknown): bigint {
  try {
    const text = String(value ?? "0").trim();
    return /^\d+$/.test(text) ? BigInt(text) : 0n;
  } catch {
    return 0n;
  }
}

function atomicToDecimal(value: unknown, decimals = 7): string {
  const atomic = safeAtomic(value);
  const safeDecimals = Number.isInteger(decimals)
    ? Math.max(0, Math.min(18, decimals))
    : 7;

  if (safeDecimals === 0) return atomic.toString();

  const text = atomic.toString().padStart(safeDecimals + 1, "0");
  const whole = text.slice(0, -safeDecimals) || "0";
  const fraction = text.slice(-safeDecimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function compactAtomic(value: unknown, decimals = 7): string {
  const numeric = Number(atomicToDecimal(value, decimals));
  if (!Number.isFinite(numeric)) return "—";

  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(numeric) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function compactNumber(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

function money(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(value)}%`;
}

function poolKey(pool?: AquariusPool | null): string {
  return safeText(pool?.address) || safeText(pool?.id);
}

function poolLabel(pool?: AquariusPool | null): string {
  return pool ? `${pool.tokenA.symbol}/${pool.tokenB.symbol}` : "Unknown pool";
}

function normalizePool(pool: AquariusPool): AquariusPool {
  const address = safeText(pool?.address);
  const poolHash = safeText(pool?.poolHash || pool?.id);

  return {
    ...pool,
    id: address || poolHash,
    address,
    poolHash,
    poolType: normalizePoolType(pool?.poolType),
    tokenA: {
      ...pool.tokenA,
      contract: safeText(pool.tokenA?.contract),
      symbol: safeText(pool.tokenA?.symbol) || "TOKEN",
      name: safeText(pool.tokenA?.name) || safeText(pool.tokenA?.symbol),
      issuer: safeText(pool.tokenA?.issuer) || null,
      icon: safeText(pool.tokenA?.icon) || DEFAULT_ICON,
      decimals: Number.isInteger(Number(pool.tokenA?.decimals))
        ? Number(pool.tokenA.decimals)
        : 7,
      reserveAtomic: safeText(pool.tokenA?.reserveAtomic) || "0",
    },
    tokenB: {
      ...pool.tokenB,
      contract: safeText(pool.tokenB?.contract),
      symbol: safeText(pool.tokenB?.symbol) || "TOKEN",
      name: safeText(pool.tokenB?.name) || safeText(pool.tokenB?.symbol),
      issuer: safeText(pool.tokenB?.issuer) || null,
      icon: safeText(pool.tokenB?.icon) || DEFAULT_ICON,
      decimals: Number.isInteger(Number(pool.tokenB?.decimals))
        ? Number(pool.tokenB.decimals)
        : 7,
      reserveAtomic: safeText(pool.tokenB?.reserveAtomic) || "0",
    },
    lpToken: safeText(pool?.lpToken) || null,
  };
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return payload;
}

function TokenIcon({ token }: { token?: PoolToken | null }) {
  const [source, setSource] = useState(token?.icon || DEFAULT_ICON);

  useEffect(() => {
    setSource(token?.icon || DEFAULT_ICON);
  }, [token?.icon]);

  return (
    <img
      src={source}
      alt=""
      onError={() => {
        if (source !== DEFAULT_ICON) setSource(DEFAULT_ICON);
      }}
      className="h-9 w-9 shrink-0 rounded-full border border-white bg-white object-cover shadow-sm"
    />
  );
}

export default function AquariusDapp() {
  const { allTokens, toast } = useStates();
  const { execute, network, walletAddress, SERVER_URL } =
    useSocketFiSorobanExecutor();

  const [action, setAction] = useState<Action>("pools");
  const [swapOpen, setSwapOpen] = useState(false);
  const [pools, setPools] = useState<AquariusPool[]>([]);
  const [selectedPoolAddress, setSelectedPoolAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [poolType, setPoolType] = useState("all");
  const [sortBy, setSortBy] = useState<PoolSort>("totalVolume");
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [shareAmount, setShareAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [quote, setQuote] = useState<LiquidityQuote | null>(null);
  const [error, setError] = useState("");
  const [successHash, setSuccessHash] = useState("");

  const poolsRequest = useRef(0);
  const quoteRequest = useRef(0);
  const lastEditedSide = useRef<EditedSide>("A");
  const applyingQuote = useRef(false);

  const selectedPool = useMemo(
    () => pools.find((pool) => poolKey(pool) === selectedPoolAddress) || null,
    [pools, selectedPoolAddress]
  );

  const selectedPoolType = normalizePoolType(selectedPool?.poolType);
  const isConcentratedPool = selectedPoolType === "concentrated";

  const loadPools = useCallback(async () => {
    if (!walletAddress) {
      setPools([]);
      setSelectedPoolAddress("");
      return;
    }

    const requestId = ++poolsRequest.current;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        network,
        walletAddress,
        poolType,
        sortBy,
        order: "desc",
        limit: "24",
        scanLimit: "250",
        minTxCount: "1",
        enrichState: "true",
      });

      const payload = await readJson(
        await fetch(`${SERVER_URL}/api/aquarius-pools?${params.toString()}`, {
          headers: { Accept: "application/json" },
        })
      );

      if (requestId !== poolsRequest.current) return;

      const rawPools = payload?.data?.pools || payload?.pools || [];
      const nextPools = Array.isArray(rawPools)
        ? rawPools
            .map(normalizePool)
            .filter(
              (pool) =>
                Boolean(pool.address) &&
                Boolean(pool.tokenA.contract) &&
                Boolean(pool.tokenB.contract)
            )
        : [];

      setPools(nextPools);
      setSelectedPoolAddress((current) => {
        if (current && nextPools.some((pool) => poolKey(pool) === current)) {
          return current;
        }

        return poolKey(nextPools[0] || null);
      });
    } catch (cause) {
      if (requestId === poolsRequest.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load Aquarius pools."
        );
      }
    } finally {
      if (requestId === poolsRequest.current) setLoading(false);
    }
  }, [SERVER_URL, network, walletAddress, poolType, sortBy]);

  useEffect(() => {
    void loadPools();
  }, [loadPools]);

  useEffect(() => {
    const requestId = ++quoteRequest.current;
    const controller = new AbortController();

    setQuote(null);
    setSuccessHash("");

    if (!selectedPool || !["deposit", "withdraw"].includes(action)) {
      return () => controller.abort();
    }

    // Concentrated pools must never enter the classic quote endpoint.
    if (normalizePoolType(selectedPool.poolType) === "concentrated") {
      setQuoteLoading(false);
      return () => controller.abort();
    }

    const hasInput =
      action === "deposit"
        ? Number(lastEditedSide.current === "A" ? amountA : amountB) > 0
        : Number(shareAmount) > 0;

    if (!hasInput) {
      setQuoteLoading(false);
      return () => controller.abort();
    }

    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      setError("");

      try {
        const payload = await readJson(
          await fetch(`${SERVER_URL}/api/aquarius-liquidity/quote`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              network,
              walletAddress,
              action,
              poolId: selectedPool.poolHash || selectedPool.id,
              poolAddress: selectedPool.address,
              amountA:
                action === "deposit" && lastEditedSide.current === "A"
                  ? amountA || "0"
                  : "0",
              amountB:
                action === "deposit" && lastEditedSide.current === "B"
                  ? amountB || "0"
                  : "0",
              shares: action === "withdraw" ? shareAmount || "0" : "0",
              slippageBps,
            }),
          })
        );

        if (requestId !== quoteRequest.current) return;

        const nextQuote = payload?.data || payload;
        setQuote(nextQuote);

        if (action === "deposit") {
          applyingQuote.current = true;

          if (lastEditedSide.current === "A") {
            setAmountB(String(nextQuote.amountB ?? ""));
          } else {
            setAmountA(String(nextQuote.amountA ?? ""));
          }

          queueMicrotask(() => {
            applyingQuote.current = false;
          });
        }
      } catch (cause) {
        if (!controller.signal.aborted && requestId === quoteRequest.current) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to quote liquidity operation."
          );
        }
      } finally {
        if (requestId === quoteRequest.current) setQuoteLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    action,
    selectedPoolAddress,
    selectedPool?.poolType,
    selectedPool?.poolHash,
    amountA,
    amountB,
    shareAmount,
    slippageBps,
    network,
    walletAddress,
    SERVER_URL,
  ]);

  const filteredPools = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pools;

    return pools.filter((pool) =>
      [
        pool.tokenA.symbol,
        pool.tokenB.symbol,
        pool.tokenA.asset,
        pool.tokenB.asset,
        pool.address,
        pool.poolHash,
        pool.poolType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [pools, search]);

  function resetForm() {
    setAmountA("");
    setAmountB("");
    setShareAmount("");
    setQuote(null);
    setError("");
    setSuccessHash("");
  }

  function openPool(pool: AquariusPool, nextAction: Action = "deposit") {
    setSelectedPoolAddress(poolKey(pool));
    setAction(nextAction);
    resetForm();
  }

  function selectPool(address: string) {
    setSelectedPoolAddress(address);
    resetForm();
  }

  function updateDepositAmount(side: EditedSide, value: string) {
    if (!/^\d*\.?\d*$/.test(value)) return;

    lastEditedSide.current = side;

    if (side === "A") {
      setAmountA(value);
      if (!applyingQuote.current) setAmountB("");
    } else {
      setAmountB(value);
      if (!applyingQuote.current) setAmountA("");
    }
  }

  async function submitLiquidity() {
    if (!selectedPool || !quote || isConcentratedPool) return;

    if (quote.expiresAt && Date.parse(quote.expiresAt) <= Date.now()) {
      setError("Liquidity quote expired. Change the amount to refresh it.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await execute({
        contractId: quote.contractId,
        functionName: quote.functionName,
        argsXdr: quote.argsXdr,
        description:
          action === "deposit"
            ? `Add liquidity to ${poolLabel(selectedPool)} on Aquarius`
            : `Withdraw liquidity from ${poolLabel(selectedPool)} on Aquarius`,
        values:
          action === "deposit"
            ? [
                {
                  key: selectedPool.tokenA.symbol,
                  value: quote.amountA || amountA || "0",
                },
                {
                  key: selectedPool.tokenB.symbol,
                  value: quote.amountB || amountB || "0",
                },
                {
                  key: "Minimum LP shares",
                  value: quote.minSharesAtomic || "—",
                },
                {
                  key: "Slippage",
                  value: `${(slippageBps / 100).toFixed(2)}%`,
                },
              ]
            : [
                { key: "LP shares", value: shareAmount },
                {
                  key: `Expected ${selectedPool.tokenA.symbol}`,
                  value: quote.expectedAmountA || "—",
                },
                {
                  key: `Expected ${selectedPool.tokenB.symbol}`,
                  value: quote.expectedAmountB || "—",
                },
              ],
        txDetails: {
          type:
            action === "deposit"
              ? "liquidity/AQUARIUS/ADD"
              : "liquidity/AQUARIUS/REMOVE",
          network,
          walletContractId: walletAddress,
          poolId: selectedPool.poolHash || selectedPool.id,
          poolHash: selectedPool.poolHash,
          poolAddress: selectedPool.address,
          poolType: selectedPool.poolType,
          tokenA: selectedPool.tokenA.contract,
          tokenB: selectedPool.tokenB.contract,
          amountA: quote.amountA || amountA,
          amountB: quote.amountB || amountB,
          shares: shareAmount,
        },
      });

      setSuccessHash(result.hash);
      setAmountA("");
      setAmountB("");
      setShareAmount("");
      setQuote(null);

      toast.success(
        action === "deposit" ? "Liquidity added." : "Liquidity withdrawn."
      );

      await loadPools();
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Liquidity transaction failed.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 ring-1 ring-cyan-100">
              <Droplets className="h-3.5 w-3.5" /> Aquarius AMM
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Swap and manage liquidity
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Browse active pools, manage classic LP shares, and create
              concentrated range positions with your SocketFi smart account.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSwapOpen(true)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <ArrowLeftRight className="h-4 w-4" /> Swap assets
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap gap-2">
          {[
            ["pools", "Pools", Droplets],
            ["deposit", "Add liquidity", PlusCircle],
            ["withdraw", "Withdraw liquidity", MinusCircle],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setAction(id as Action);
                setQuote(null);
                setError("");
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                action === id
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => void loadPools()}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {action === "pools" ? (
          <div className="mt-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search token, pool, or contract"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-slate-300 focus:bg-white"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={poolType}
                  onChange={(event) => setPoolType(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                >
                  <option value="all">All pool types</option>
                  <option value="constant_product">Constant product</option>
                  <option value="stable">Stable</option>
                  <option value="concentrated">Concentrated</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as PoolSort)
                  }
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                >
                  <option value="totalVolume">Top cumulative volume</option>
                  <option value="txCount">Most transactions</option>
                  <option value="tvl">Highest TVL</option>
                  <option value="volume24h">Highest 24h volume</option>
                </select>
              </div>
            </div>

            {error ? (
              <div className="mt-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            ) : null}

            {loading && pools.length === 0 ? (
              <div className="mt-6 flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                Aquarius pools…
              </div>
            ) : filteredPools.length === 0 ? (
              <div className="mt-6 flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
                No matching pools.
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredPools.map((pool) => {
                  const hasPosition = safeAtomic(pool.userSharesAtomic) > 0n;

                  return (
                    <button
                      key={pool.address}
                      type="button"
                      onClick={() => openPool(pool, "deposit")}
                      className="group flex min-h-[245px] flex-col rounded-2xl border border-slate-200 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-slate-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex -space-x-2">
                            <TokenIcon token={pool.tokenA} />
                            <TokenIcon token={pool.tokenB} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-slate-950">
                              {poolLabel(pool)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {normalizePoolType(pool.poolType) ||
                                "Aquarius pool"}{" "}
                              · {percent(pool.feePercent)} fee
                            </p>
                          </div>
                        </div>

                        {hasPosition ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                        ) : null}
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                        <MetricCard
                          label="Transactions"
                          value={compactNumber(pool.txCount)}
                        />
                        <MetricCard
                          label="Cumulative volume"
                          value={compactAtomic(pool.totalVolumeAtomic, 7)}
                        />
                        <MetricCard label="TVL" value={money(pool.tvlUsd)} />
                        <MetricCard label="APR" value={percent(pool.apr)} />
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-4 text-xs font-semibold">
                        <span className="text-slate-500">
                          {normalizePoolType(pool.poolType) === "concentrated"
                            ? "Range position"
                            : "Classic liquidity"}
                        </span>
                        <span className="text-slate-900 group-hover:underline">
                          Manage pool
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : isConcentratedPool && selectedPool ? (
          <div className="mt-5 rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700">
                Pool
              </label>
              <select
                value={selectedPoolAddress}
                onChange={(event) => selectPool(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-sm"
              >
                {pools.map((pool) => (
                  <option key={pool.address} value={pool.address}>
                    {poolLabel(pool)} · {normalizePoolType(pool.poolType)}
                  </option>
                ))}
              </select>
            </div>

            <AquariusConcentratedLiquidity
              key={selectedPool.address}
              pool={selectedPool}
              mode={action === "withdraw" ? "withdraw" : "deposit"}
              onModeChange={(nextMode: "deposit" | "withdraw") =>
                setAction(nextMode)
              }
              onBack={() => setAction("pools")}
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Pool
                </label>
                <select
                  value={selectedPoolAddress}
                  onChange={(event) => selectPool(event.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 text-sm"
                >
                  {pools.map((pool) => (
                    <option key={pool.address} value={pool.address}>
                      {poolLabel(pool)} · {normalizePoolType(pool.poolType)}
                    </option>
                  ))}
                </select>
              </div>

              {action === "deposit" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <AmountInput
                    token={selectedPool?.tokenA}
                    value={amountA}
                    onChange={(value) => updateDepositAmount("A", value)}
                  />
                  <AmountInput
                    token={selectedPool?.tokenB}
                    value={amountB}
                    onChange={(value) => updateDepositAmount("B", value)}
                  />
                </div>
              ) : (
                <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    LP shares to withdraw
                  </span>
                  <input
                    value={shareAmount}
                    onChange={(event) => {
                      if (/^\d*\.?\d*$/.test(event.target.value)) {
                        setShareAmount(event.target.value);
                      }
                    }}
                    placeholder="0.0"
                    inputMode="decimal"
                    className="mt-2 w-full bg-transparent text-2xl font-semibold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShareAmount(
                        atomicToDecimal(selectedPool?.userSharesAtomic, 7)
                      )
                    }
                    disabled={safeAtomic(selectedPool?.userSharesAtomic) <= 0n}
                    className="mt-2 text-xs font-semibold text-indigo-700 disabled:text-slate-400"
                  >
                    Use maximum
                  </button>
                </label>
              )}

              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-500">
                  Slippage tolerance
                </span>
                <select
                  value={slippageBps}
                  onChange={(event) =>
                    setSlippageBps(Number(event.target.value))
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                >
                  <option value={10}>0.10%</option>
                  <option value={50}>0.50%</option>
                  <option value={100}>1.00%</option>
                </select>
              </div>

              {quoteLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-700">
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing
                  liquidity quote…
                </div>
              ) : null}

              {error ? (
                <div className="flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              ) : null}

              {successHash ? (
                <a
                  href={`https://stellar.expert/explorer/${
                    network === "PUBLIC" ? "public" : "testnet"
                  }/tx/${successHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"
                >
                  Transaction submitted <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}

              <button
                type="button"
                disabled={!quote || quoteLoading || submitting}
                onClick={() => void submitLiquidity()}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : action === "deposit" ? (
                  <PlusCircle className="h-4 w-4" />
                ) : (
                  <MinusCircle className="h-4 w-4" />
                )}
                {submitting
                  ? "Confirming…"
                  : action === "deposit"
                  ? "Add liquidity"
                  : "Withdraw liquidity"}
              </button>
            </div>

            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Position preview
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <PreviewRow
                  label="Pool"
                  value={selectedPool ? poolLabel(selectedPool) : "—"}
                />
                <PreviewRow label="Pool type" value={selectedPoolType || "—"} />
                <PreviewRow
                  label="Fee"
                  value={percent(selectedPool?.feePercent)}
                />
                <PreviewRow
                  label="Wallet LP shares"
                  value={
                    safeAtomic(selectedPool?.userSharesAtomic) > 0n
                      ? atomicToDecimal(selectedPool?.userSharesAtomic, 7)
                      : "—"
                  }
                />

                {action === "deposit" && quote ? (
                  <>
                    <PreviewRow
                      label="Expected LP shares"
                      value={quote.expectedSharesAtomic || "—"}
                    />
                    <PreviewRow
                      label="Minimum LP shares"
                      value={quote.minSharesAtomic || "—"}
                    />
                  </>
                ) : null}

                {action === "withdraw" ? (
                  <>
                    <PreviewRow
                      label={`Expected ${selectedPool?.tokenA.symbol || "A"}`}
                      value={quote?.expectedAmountA || "—"}
                    />
                    <PreviewRow
                      label={`Expected ${selectedPool?.tokenB.symbol || "B"}`}
                      value={quote?.expectedAmountB || "—"}
                    />
                  </>
                ) : null}
              </div>
            </aside>
          </div>
        )}
      </section>

      <AquariusSwapModal
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        tokens={allTokens || []}
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function AmountInput({
  token,
  value,
  onChange,
}: {
  token?: PoolToken | null;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <TokenIcon token={token} /> {token?.symbol || "Token"}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0.0"
        inputMode="decimal"
        className="mt-3 w-full bg-transparent text-2xl font-semibold outline-none"
      />
    </label>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
