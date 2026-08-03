// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  HandCoins,
  Landmark,
  Layers3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  PoolContract,
  PoolV1,
  PoolV2,
  PositionsEstimate,
  RequestType,
} from "@blend-capital/blend-sdk";
import { Address, Networks, xdr } from "@stellar/stellar-sdk";
import { useStates } from "../context/StatesContext";
import { useSocketFiSorobanExecutor } from "../services/useSocketFiSorobanExecutor";

type AppNetwork = "PUBLIC" | "TESTNET";
type BlendAction = "supply" | "withdraw" | "borrow" | "repay";
type SortMode = "tvl" | "yield" | "borrow" | "utilization";
type PoolFilter = "all" | "active" | "on_ice" | "frozen";

type Reserve = {
  asset: string;
  index: number;
  symbol: string;
  name: string;
  decimals: number;
  supplyApr: number | null;
  supplyApy: number | null;
  borrowApr: number | null;
  borrowApy: number | null;
  utilizationPercent: number | null;
  collateralFactorPercent: number | null;
  liabilityFactorPercent: number | null;
  totalSupply: number;
  totalBorrow: number;
  availableLiquidity: number;
  priceUsd: number | null;
  suppliedUsd: number | null;
  borrowedUsd: number | null;
};
type Pool = {
  id: string;
  name: string;
  network: AppNetwork;
  version: string;
  status: number | null;
  statusLabel: "ACTIVE" | "ON_ICE" | "FROZEN" | "UNKNOWN";
  active: boolean;
  canSupply: boolean;
  canWithdraw: boolean;
  canBorrow: boolean;
  canRepay: boolean;
  reserveCount: number;
  suppliedUsd: number | null;
  borrowedUsd: number | null;
  backstopUsd: number | null;
  utilizationPercent: number | null;
  bestSupplyApr: number | null;
  lowestBorrowApr: number | null;
  reserves: Reserve[];
};
type Dashboard = {
  activePools: number;
  onIcePools: number;
  frozenPools: number;
  unknownPools: number;
  totalPools: number;
  totalSuppliedUsd: number | null;
  totalBorrowedUsd: number | null;
  totalBackstopUsd: number | null;
  bestOpportunity: null | {
    poolId: string;
    poolName: string;
    symbol: string;
    supplyApr: number;
  };
};
type UserReserve = Reserve & {
  balance: string | number;
  supplied: string;
  collateral: string;
  borrowed: string;
};

const API_BASE = String(import.meta.env.VITE_SOCKETFI_DIRECT_API_URL || "")
  .trim()
  .replace(/\/$/, "");
const api = (path: string) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
const networkOf = (value: unknown): AppNetwork =>
  String(value || "PUBLIC").toUpperCase() === "TESTNET" ? "TESTNET" : "PUBLIC";
const usd = (value?: number | null) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        notation: Math.abs(value!) >= 100000 ? "compact" : "standard",
        maximumFractionDigits: 2,
      }).format(value!)
    : "—";
const percent = (value?: number | null) =>
  Number.isFinite(value)
    ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
        value!
      )}%`
    : "—";
const short = (value: string) =>
  value ? `${value.slice(0, 5)}…${value.slice(-4)}` : "TOKEN";

function atomic(value: string, decimals = 7) {
  try {
    const amount = BigInt(value || "0");
    const scalar = 10n ** BigInt(decimals);
    const whole = amount / scalar;
    const fraction = (amount % scalar)
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return value || "0";
  }
}
function toAtomic(value: string, decimals: number) {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim()))
    throw new Error("Enter a valid amount.");
  const [whole, fraction = ""] = value.trim().split(".");
  if (fraction.length > decimals)
    throw new Error(`Maximum ${decimals} decimal places.`);
  const result =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (result <= 0n) throw new Error("Amount must be greater than zero.");
  return result;
}
function extractCall(operationXdr: string) {
  const operation = xdr.Operation.fromXDR(operationXdr, "base64");
  const body = operation.body();
  if (body.switch() !== xdr.OperationType.invokeHostFunction())
    throw new Error("Unsupported Blend operation.");
  const host = body.invokeHostFunctionOp().hostFunction();
  if (host.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract())
    throw new Error("Unsupported Blend host function.");
  const invoke = host.invokeContract();
  return {
    contractId: Address.fromScAddress(invoke.contractAddress()).toString(),
    functionName: invoke.functionName().toString(),
    argsXdr: invoke.args()?.map((arg) => arg.toXDR("base64")),
  };
}
async function loadSdkPool(network: any, id: string) {
  const errors: string[] = [];
  try {
    return await PoolV2.load(network, id);
  } catch (error) {
    errors.push(`V2: ${error instanceof Error ? error.message : error}`);
  }
  try {
    return await PoolV1.load(network, id);
  } catch (error) {
    errors.push(`V1: ${error instanceof Error ? error.message : error}`);
  }
  throw new Error(errors.join(" | "));
}
async function fetchPools(
  network: AppNetwork,
  refresh = false,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({ network, includeInactive: "true" });
  if (refresh) params.set("refresh", "true");
  const response = await fetch(api(`/api/blend/pools?${params}`), {
    headers: { Accept: "application/json" },
    credentials: "include",
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success)
    throw new Error(
      body?.error || `Blend API failed with HTTP ${response.status}`
    );
  return {
    pools: Array.isArray(body.data?.pools) ? (body.data.pools as Pool[]) : [],
    dashboard: body.data?.dashboard as Dashboard,
  };
}
function Stat({ label, value, helper, icon: Icon }: any) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
          {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
        </div>
        <div className="h-fit rounded-xl bg-slate-100 p-2 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
function TokenIcon({ reserve, token }: { reserve: Reserve; token?: any }) {
  const image = token?.icon || token?.logo;
  return (
    <div
      title={`${reserve.symbol} · ${reserve.asset}`}
      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm"
    >
      {image ? (
        <img
          src={image}
          alt={reserve.symbol}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-[10px] font-bold text-slate-600">
          {reserve.symbol.slice(0, 4)}
        </span>
      )}
    </div>
  );
}

function actionAllowed(pool: Pool | null, action: BlendAction) {
  if (!pool) return false;

  switch (action) {
    case "supply":
      return Boolean(pool.canSupply);
    case "withdraw":
      return Boolean(pool.canWithdraw);
    case "borrow":
      return Boolean(pool.canBorrow);
    case "repay":
      return Boolean(pool.canRepay);
  }
}

function statusBadgeClasses(status: Pool["statusLabel"]) {
  if (status === "ACTIVE") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "ON_ICE") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "FROZEN") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-slate-100 text-slate-600";
}

function statusText(status: Pool["statusLabel"]) {
  if (status === "ACTIVE") return "Active";
  if (status === "ON_ICE") return "On ice";
  if (status === "FROZEN") return "Frozen";
  return "Unknown";
}

export default function BlendDapp() {
  const { allTokens, toast } = useStates();
  const { execute, network, walletAddress } = useSocketFiSorobanExecutor();
  const appNetwork = networkOf(network);
  const rpcUrl =
    appNetwork === "PUBLIC"
      ? import.meta.env.VITE_RPC_STELLAR ||
        import.meta.env.VITE_PUBLIC_RPC_URL ||
        import.meta.env.VITE_SOROBAN_PUBLIC_RPC
      : import.meta.env.VITE_TESTNET_RPC_URL ||
        import.meta.env.VITE_SOROBAN_TESTNET_RPC;
  const passphrase =
    appNetwork === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;

  const [pools, setPools] = useState<Pool[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [poolId, setPoolId] = useState("");
  const [asset, setAsset] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("tvl");
  const [poolFilter, setPoolFilter] = useState<PoolFilter>("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [userReserves, setUserReserves] = useState<UserReserve[]>([]);
  const [position, setPosition] = useState<any>(null);
  const [action, setAction] = useState<BlendAction>("supply");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successHash, setSuccessHash] = useState("");

  const tokenMap = useMemo(
    () =>
      new Map(
        (allTokens || []).map((token) => [
          String(token?.contract || token?.address || "").toUpperCase(),
          token,
        ])
      ),
    [allTokens]
  );
  const selectedPool = pools.find((pool) => pool.id === poolId) || null;
  const selectedReserve =
    userReserves.find((reserve) => reserve.asset === asset) || null;
  const shownPools = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = pools.filter((pool) => {
      const matchesStatus =
        poolFilter === "all" ||
        (poolFilter === "active" && pool.statusLabel === "ACTIVE") ||
        (poolFilter === "on_ice" && pool.statusLabel === "ON_ICE") ||
        (poolFilter === "frozen" && pool.statusLabel === "FROZEN");

      const matchesSearch =
        !q ||
        String(pool?.name || "")
          .toLowerCase()
          .includes(q) ||
        String(pool?.id || "")
          .toLowerCase()
          .includes(q) ||
        (Array.isArray(pool?.reserves) &&
          pool.reserves.some(
            (reserve) =>
              String(reserve?.symbol || "")
                .toLowerCase()
                .includes(q) ||
              String(reserve?.name || "")
                .toLowerCase()
                .includes(q) ||
              String(reserve?.asset || "")
                .toLowerCase()
                .includes(q)
          ));

      return matchesStatus && matchesSearch;
    });

    return [...filtered].sort((a, b) =>
      sort === "yield"
        ? (b.bestSupplyApr || 0) - (a.bestSupplyApr || 0)
        : sort === "borrow"
        ? (a.lowestBorrowApr ?? Infinity) - (b.lowestBorrowApr ?? Infinity)
        : sort === "utilization"
        ? (b.utilizationPercent || 0) - (a.utilizationPercent || 0)
        : (b.suppliedUsd || 0) - (a.suppliedUsd || 0)
    );
  }, [pools, query, sort, poolFilter]);

  async function refresh(force = false, signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const result = await fetchPools(appNetwork, force, signal);
      setPools(result.pools);
      setDashboard(result.dashboard);
      setPoolId((current) =>
        result?.pools?.some((p) => p.id === current)
          ? current
          : result.pools[0]?.id || ""
      );
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError"))
        setError(
          cause instanceof Error ? cause.message : "Unable to load Blend pools."
        );
    } finally {
      setLoading(false);
    }
  }
  async function loadUser(pool: Pool) {
    const poolReserves = Array.isArray(pool?.reserves) ? pool.reserves : [];

    const base: UserReserve[] = poolReserves.map((reserve) => ({
      ...reserve,
      balance:
        tokenMap.get(String(reserve?.asset || "").toUpperCase())?.balance ?? 0,
      supplied: "0",
      collateral: "0",
      borrowed: "0",
    }));

    setUserReserves(base);
    setAsset((current) =>
      base.some((reserve) => reserve.asset === current)
        ? current
        : base[0]?.asset ?? ""
    );
    setPosition(null);
    if (!walletAddress || !rpcUrl) return;
    setDetailLoading(true);
    try {
      const sdkPool = await loadSdkPool(
        {
          rpc: rpcUrl,
          passphrase,
          opts: { allowHttp: rpcUrl.startsWith("http://") },
        },
        pool.id
      );
      const oracle = await sdkPool.loadOracle();
      const user = await sdkPool.loadUser(walletAddress);
      try {
        setPosition(PositionsEstimate.build(sdkPool, oracle, user.positions));
      } catch {
        setPosition(null);
      }
      setUserReserves(
        (Array.isArray(pool?.reserves) ? pool.reserves : []).map((reserve) => {
          const p =
            user?.positions?.get?.(reserve.index) ||
            user?.positions?.[reserve.index] ||
            {};
          return {
            ...reserve,
            balance: tokenMap.get(reserve.asset.toUpperCase())?.balance ?? 0,
            supplied: String(p?.supply ?? p?.supplyCollateral ?? "0"),
            collateral: String(p?.collateral ?? p?.supplyCollateral ?? "0"),
            borrowed: String(p?.borrow ?? p?.borrowed ?? "0"),
          };
        })
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load your Blend position."
      );
    } finally {
      setDetailLoading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void refresh(false, controller.signal);
    return () => controller.abort();
  }, [appNetwork]);
  useEffect(() => {
    if (selectedPool) void loadUser(selectedPool);
  }, [poolId, walletAddress, rpcUrl, tokenMap]);

  useEffect(() => {
    if (!selectedPool || actionAllowed(selectedPool, action)) return;

    const nextAction: BlendAction = selectedPool.canSupply
      ? "supply"
      : selectedPool.canWithdraw
      ? "withdraw"
      : selectedPool.canRepay
      ? "repay"
      : "withdraw";

    setAction(nextAction);
  }, [selectedPool, action]);

  function open(pool: Pool) {
    setPoolId(pool.id);
    setDetailOpen(true);
    setTimeout(
      () =>
        document
          .getElementById("blend-detail")
          ?.scrollIntoView({ behavior: "smooth" }),
      0
    );
  }
  function requestType(value: BlendAction) {
    return value === "supply"
      ? RequestType.SupplyCollateral
      : value === "withdraw"
      ? RequestType.WithdrawCollateral
      : value === "borrow"
      ? RequestType.Borrow
      : RequestType.Repay;
  }
  async function submit() {
    if (!selectedPool || !selectedReserve || !walletAddress) return;
    setSubmitting(true);
    setError("");
    setSuccessHash("");
    try {
      if (!actionAllowed(selectedPool, action)) {
        throw new Error(
          `${action} is unavailable while this pool is ${statusText(
            selectedPool.statusLabel
          ).toLowerCase()}.`
        );
      }

      const amountAtomic = toAtomic(amount, selectedReserve.decimals);
      const operation = new PoolContract(selectedPool.id).submit({
        from: walletAddress,
        spender: walletAddress,
        to: walletAddress,
        requests: [
          {
            amount: amountAtomic,
            request_type: requestType(action),
            address: selectedReserve.asset,
          },
        ],
      });
      const call = extractCall(operation);
      const label = {
        supply: "Supply collateral",
        withdraw: "Withdraw collateral",
        borrow: "Borrow",
        repay: "Repay",
      }[action];
      const result = await execute({
        contractId: call.contractId,
        functionName: call.functionName,
        argsXdr: call.argsXdr,
        description: `${label} ${amount} ${selectedReserve.symbol} on ${selectedPool.name}`,
        values: [
          { key: "Action", value: label },
          { key: "Asset", value: selectedReserve.symbol },
          { key: "Amount", value: amount },
          { key: "Pool", value: selectedPool.name },
        ],
        txDetails: {
          type: `blend/${action}`,
          network: appNetwork,
          walletContractId: walletAddress,
          poolId: selectedPool.id,
          asset: selectedReserve.asset,
          symbol: selectedReserve.symbol,
          amount,
          amountAtomic: amountAtomic.toString(),
        },
      });
      setSuccessHash(result.hash);
      setAmount("");
      toast.success(`${label} submitted.`);
      await loadUser(selectedPool);
      await refresh(true);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Blend transaction failed.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }
  const explorer = successHash
    ? `https://stellar.expert/explorer/${
        appNetwork === "PUBLIC" ? "public" : "testnet"
      }/tx/${successHash}`
    : "";

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              <Landmark className="h-3.5 w-3.5" />
              Blend Protocol
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-slate-950">
              Lending opportunities
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Compare production pools, yields, liquidity, utilization and
              backstop coverage before interacting.
            </p>
          </div>
          <button
            onClick={() => void refresh(true)}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh markets
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Production pools"
          value={dashboard?.totalPools ?? pools.length}
          helper={`${dashboard?.activePools ?? 0} active · ${
            dashboard?.frozenPools ?? 0
          } frozen`}
          icon={Layers3}
        />
        <Stat
          label="Total supplied"
          value={usd(dashboard?.totalSuppliedUsd)}
          icon={WalletCards}
        />
        <Stat
          label="Total borrowed"
          value={usd(dashboard?.totalBorrowedUsd)}
          icon={HandCoins}
        />
        <Stat
          label="Total backstop"
          value={usd(dashboard?.totalBackstopUsd)}
          icon={ShieldCheck}
        />
        <Stat
          label="Best supply yield"
          value={percent(dashboard?.bestOpportunity?.supplyApr)}
          helper={
            dashboard?.bestOpportunity
              ? `${dashboard.bestOpportunity.symbol} · ${dashboard.bestOpportunity.poolName}`
              : "Not priced"
          }
          icon={TrendingUp}
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Production pools
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Reward-zone membership is a discovery signal, not a guarantee of
              safety.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pool or asset"
                className="h-11 rounded-xl border border-slate-200 pl-9 pr-3 text-sm sm:w-64"
              />
            </label>
            <select
              value={poolFilter}
              onChange={(event) =>
                setPoolFilter(event.target.value as PoolFilter)
              }
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
            >
              <option value="all">All reward-zone pools</option>
              <option value="active">Active pools</option>
              <option value="on_ice">On-ice pools</option>
              <option value="frozen">Frozen pools</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold"
            >
              <option value="tvl">Sort by supplied</option>
              <option value="yield">Sort by supply APR</option>
              <option value="borrow">Sort by borrow APR</option>
              <option value="utilization">Sort by utilization</option>
            </select>
          </div>
        </div>
        {error && (
          <div className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        <div className="mt-5 grid gap-4">
          {!loading && shownPools.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <p className="font-semibold text-slate-800">
                No pools match this filter
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Change the status filter or search term.
              </p>
            </div>
          ) : null}

          {shownPools.map((pool) => (
            <button
              key={pool.id}
              onClick={() => open(pool)}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:bg-white hover:shadow-md"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-950">
                      {pool.name}
                    </h3>
                    <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
                      {pool.version}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(
                        pool.statusLabel
                      )}`}
                    >
                      {statusText(pool.statusLabel)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{pool.id}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                  Open market <ArrowRight className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                {[
                  ["Supplied", usd(pool.suppliedUsd)],
                  ["Borrowed", usd(pool.borrowedUsd)],
                  ["Backstop", usd(pool.backstopUsd)],
                  ["Best supply", percent(pool.bestSupplyApr)],
                  ["Borrow APR", percent(pool.lowestBorrowApr)],
                  ["Utilization", percent(pool.utilizationPercent)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="mt-1 font-semibold text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {pool.reserves?.map((reserve) => (
                  <TokenIcon
                    key={reserve.asset}
                    reserve={reserve}
                    token={tokenMap.get(reserve.asset.toUpperCase())}
                  />
                ))}
                <span className="ml-1 text-xs text-slate-500">
                  {pool.reserveCount} supported assets
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {detailOpen && selectedPool && (
        <section
          id="blend-detail"
          className="scroll-mt-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-violet-600">
                Selected market
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                {selectedPool.name}
              </h2>
            </div>
            <button
              onClick={() => setDetailOpen(false)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
            >
              Close
            </button>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Asset
                </span>
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  disabled={detailLoading}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3"
                >
                  {userReserves?.map((reserve) => (
                    <option key={reserve.asset} value={reserve.asset}>
                      {reserve.symbol} · {percent(reserve.supplyApr)} supply
                    </option>
                  ))}
                </select>
              </label>
              {selectedPool.statusLabel === "ON_ICE" ? (
                <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  This pool is on ice. Borrowing is unavailable, but supplying,
                  withdrawing, and repaying remain available.
                </div>
              ) : null}

              {selectedPool.statusLabel === "FROZEN" ? (
                <div className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  This pool is frozen. Supplying and borrowing are unavailable.
                  You can still withdraw and repay.
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["supply", "Supply", ArrowDownToLine],
                  ["withdraw", "Withdraw", ArrowUpFromLine],
                  ["borrow", "Borrow", HandCoins],
                  ["repay", "Repay", RotateCcw],
                ].map(([id, label, Icon]: any) => {
                  const typedAction = id as BlendAction;
                  const allowed = actionAllowed(selectedPool, typedAction);

                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!allowed}
                      onClick={() => {
                        if (allowed) setAction(typedAction);
                      }}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                        action === id && allowed
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-600"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
              <label className="mt-5 block rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Amount · {selectedReserve?.symbol || "Asset"}
                </span>
                <input
                  value={amount}
                  onChange={(e) =>
                    /^\d*\.?\d*$/.test(e.target.value) &&
                    setAmount(e.target.value)
                  }
                  placeholder="0.0"
                  className="mt-2 w-full bg-transparent text-3xl font-semibold outline-none"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Wallet balance: {String(selectedReserve?.balance ?? 0)}
                </p>
              </label>
              {successHash && (
                <a
                  href={explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"
                >
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Transaction submitted
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <button
                onClick={() => void submit()}
                disabled={
                  !walletAddress ||
                  !selectedReserve ||
                  !amount ||
                  submitting ||
                  !actionAllowed(selectedPool, action)
                }
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CircleDollarSign className="h-4 w-4" />
                )}
                {submitting
                  ? "Confirming…"
                  : `${action[0].toUpperCase()}${action.slice(1)} ${
                      selectedReserve?.symbol || "asset"
                    }`}
              </button>
            </div>
            <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">
                Position and market
              </p>
              <div className="mt-4 space-y-3 text-sm">
                {[
                  ["Supply APR", percent(selectedReserve?.supplyApr)],
                  ["Supply APY", percent(selectedReserve?.supplyApy)],
                  ["Borrow APR", percent(selectedReserve?.borrowApr)],
                  ["Utilization", percent(selectedReserve?.utilizationPercent)],
                  [
                    "Available liquidity",
                    selectedReserve?.priceUsd == null
                      ? "—"
                      : usd(
                          selectedReserve.availableLiquidity *
                            selectedReserve.priceUsd
                        ),
                  ],
                  [
                    "Supplied",
                    atomic(
                      selectedReserve?.supplied || "0",
                      selectedReserve?.decimals
                    ),
                  ],
                  [
                    "Collateral",
                    atomic(
                      selectedReserve?.collateral || "0",
                      selectedReserve?.decimals
                    ),
                  ],
                  [
                    "Borrowed",
                    atomic(
                      selectedReserve?.borrowed || "0",
                      selectedReserve?.decimals
                    ),
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-semibold text-slate-950">
                      {value}
                    </span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Borrow limit</span>
                    <span className="font-semibold">
                      {position?.borrowLimit ?? "—"}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-between">
                    <span className="text-slate-500">Health factor</span>
                    <span className="font-semibold">
                      {position?.healthFactor ?? "—"}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-between">
                    <span className="text-slate-500">Net APR</span>
                    <span className="font-semibold">
                      {position?.netApr != null
                        ? percent(Number(position.netApr) * 100)
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
