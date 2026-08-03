import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  HandCoins,
  Landmark,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStates } from "../../context/StatesContext";
import { useSocketFiSorobanExecutor } from "../../services/useSocketFiSorobanExecutor";
import { fetchBlendPools } from "./api";
import { StatCard, TokenIcon } from "./components";
import type { Dashboard, Pool, PoolFilter, SortMode } from "./types";
import { networkOf, percent, statusBadgeClasses, statusText, usd } from "./utils";

export default function BlendMarketsPage() {
  const navigate = useNavigate();
  const { allTokens } = useStates();
  const { network } = useSocketFiSorobanExecutor();
  const appNetwork = networkOf(network);

  const [pools, setPools] = useState<Pool[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("tvl");
  const [poolFilter, setPoolFilter] = useState<PoolFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const tokenMap = useMemo(
    () =>
      new Map(
        (allTokens || []).map((token: any) => [
          String(token?.contract || token?.address || "").toUpperCase(),
          token,
        ])
      ),
    [allTokens]
  );

  const shownPools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = pools.filter((pool) => {
      const matchesStatus =
        poolFilter === "all" ||
        (poolFilter === "active" && pool.statusLabel === "ACTIVE") ||
        (poolFilter === "on_ice" && pool.statusLabel === "ON_ICE") ||
        (poolFilter === "frozen" && pool.statusLabel === "FROZEN");
      const matchesQuery =
        !normalizedQuery ||
        pool.name.toLowerCase().includes(normalizedQuery) ||
        pool.id.toLowerCase().includes(normalizedQuery) ||
        pool.reserves?.some((reserve) =>
          [reserve.symbol, reserve.name, reserve.asset].some((value) =>
            String(value || "").toLowerCase().includes(normalizedQuery)
          )
        );
      return matchesStatus && matchesQuery;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "yield") return (b.bestSupplyApr || 0) - (a.bestSupplyApr || 0);
      if (sort === "borrow") return (a.lowestBorrowApr ?? Infinity) - (b.lowestBorrowApr ?? Infinity);
      if (sort === "utilization") return (b.utilizationPercent || 0) - (a.utilizationPercent || 0);
      return (b.suppliedUsd || 0) - (a.suppliedUsd || 0);
    });
  }, [pools, poolFilter, query, sort]);

  async function load(force = false, signal?: AbortSignal) {
    setLoading(true);
    setError("");
    try {
      const result = await fetchBlendPools(appNetwork, { refresh: force, signal });
      setPools(result.pools);
      setDashboard(result.dashboard);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(cause instanceof Error ? cause.message : "Unable to load Blend pools.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(false, controller.signal);
    return () => controller.abort();
  }, [appNetwork]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              <Landmark className="h-3.5 w-3.5" /> Blend Protocol
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Lending markets</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Compare verified pools, liquidity, borrowing costs, utilization, and supply yield before opening a market.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh markets
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Production pools" value={dashboard?.totalPools ?? pools.length} helper={`${dashboard?.activePools ?? 0} active · ${dashboard?.frozenPools ?? 0} frozen`} icon={Layers3} />
        <StatCard label="Total supplied" value={usd(dashboard?.totalSuppliedUsd)} icon={WalletCards} />
        <StatCard label="Total borrowed" value={usd(dashboard?.totalBorrowedUsd)} icon={HandCoins} />
        <StatCard label="Total backstop" value={usd(dashboard?.totalBackstopUsd)} icon={ShieldCheck} />
        <StatCard label="Best supply yield" value={percent(dashboard?.bestOpportunity?.supplyApr)} helper={dashboard?.bestOpportunity ? `${dashboard.bestOpportunity.symbol} · ${dashboard.bestOpportunity.poolName}` : "Not priced"} icon={TrendingUp} />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Available pools</h2>
            <p className="mt-1 text-sm text-slate-500">Opening a pool now navigates to a dedicated route and loads your position independently.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="relative sm:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pool or asset" className="h-11 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400" />
            </label>
            <select value={poolFilter} onChange={(event) => setPoolFilter(event.target.value as PoolFilter)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none">
              <option value="all">All pools</option><option value="active">Active</option><option value="on_ice">On ice</option><option value="frozen">Frozen</option>
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none">
              <option value="tvl">Highest supplied</option><option value="yield">Highest supply APR</option><option value="borrow">Lowest borrow APR</option><option value="utilization">Highest utilization</option>
            </select>
          </div>
        </div>

        {error ? <div className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div> : null}

        <div className="mt-5 grid gap-4">
          {!loading && shownPools.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center"><p className="font-semibold text-slate-800">No pools match this view</p><p className="mt-1 text-sm text-slate-500">Adjust the status filter or search term.</p></div> : null}

          {shownPools.map((pool) => (
            <button
              key={pool.id}
              type="button"
              onClick={() => navigate(`/pool/${pool.id}`)}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-950">{pool.name}</h3>
                    <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">{pool.version}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClasses(pool.statusLabel)}`}>{statusText(pool.statusLabel)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">{pool.id}</p>
                </div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">Open pool <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                {[["Supplied", usd(pool.suppliedUsd)], ["Borrowed", usd(pool.borrowedUsd)], ["Backstop", usd(pool.backstopUsd)], ["Best supply", percent(pool.bestSupplyApr)], ["Borrow APR", percent(pool.lowestBorrowApr)], ["Utilization", percent(pool.utilizationPercent)]].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-950">{value}</p></div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {pool.reserves?.map((reserve) => <TokenIcon key={reserve.asset} reserve={reserve} token={tokenMap.get(reserve.asset.toUpperCase())} />)}
                <span className="ml-1 text-xs text-slate-500">{pool.reserveCount} supported assets</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
