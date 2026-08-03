import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  HandCoins,
  Landmark,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  PoolContract,
  PoolContractV1,
  PoolContractV2,
  PoolV1,
  PoolV2,
  PositionsEstimate,
  RequestType,
} from "@blend-capital/blend-sdk";
import { Networks } from "@stellar/stellar-sdk";
import { useNavigate, useParams } from "react-router-dom";
import { useStates } from "../../context/StatesContext";
import { useSocketFiSorobanExecutor } from "../../services/useSocketFiSorobanExecutor";
import { fetchBlendPool } from "./api";
import { MetricRow, StatCard, TokenIcon } from "./components";
import type { BlendAction, Pool, UserReserve } from "./types";
import {
  actionAllowed,
  atomic,
  extractCall,
  networkOf,
  percent,
  statusBadgeClasses,
  statusText,
  toAtomic,
  usd,
} from "./utils";

async function loadSdkPool(network: any, id: string) {
  const errors: string[] = [];
  try {
    return await PoolV2.load(network, id);
  } catch (error) {
    errors.push(
      `V2: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  try {
    return await PoolV1.load(network, id);
  } catch (error) {
    errors.push(
      `V1: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  throw new Error(errors.join(" | "));
}

function requestType(action: BlendAction) {
  if (action === "supply") return RequestType.SupplyCollateral;
  if (action === "withdraw") return RequestType.WithdrawCollateral;
  if (action === "borrow") return RequestType.Borrow;
  return RequestType.Repay;
}

export default function BlendPoolPage() {
  const navigate = useNavigate();
  const { poolContract = "" } = useParams<{ poolContract: string }>();
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

  const [pool, setPool] = useState<Pool | null>(null);
  const [userReserves, setUserReserves] = useState<UserReserve[]>([]);
  const [position, setPosition] = useState<any>(null);
  const [asset, setAsset] = useState("");
  const [action, setAction] = useState<BlendAction>("supply");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [positionLoading, setPositionLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successHash, setSuccessHash] = useState("");

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

  const selectedReserve =
    userReserves.find((reserve) => reserve.asset === asset) || null;

  async function loadPool(force = false, signal?: AbortSignal) {
    if (!poolContract) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchBlendPool(appNetwork, poolContract, {
        refresh: force,
        signal,
      });
      setPool(result);
      const base: UserReserve[] = result.reserves.map((reserve) => ({
        ...reserve,
        balance: tokenMap.get(reserve.asset.toUpperCase())?.balance ?? 0,
        supplied: "0",
        collateral: "0",
        borrowed: "0",
      }));
      setUserReserves(base);
      setAsset((current) =>
        base.some((reserve) => reserve.asset === current)
          ? current
          : base[0]?.asset || ""
      );
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load this Blend pool."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadPosition(currentPool: Pool) {
    const base = currentPool.reserves.map((reserve) => ({
      ...reserve,
      balance: tokenMap.get(reserve.asset.toUpperCase())?.balance ?? 0,
      supplied: "0",
      collateral: "0",
      borrowed: "0",
    }));
    setUserReserves(base);
    setPosition(null);

    if (!walletAddress || !rpcUrl) return;

    setPositionLoading(true);
    try {
      const sdkPool = await loadSdkPool(
        {
          rpc: rpcUrl,
          passphrase,
          opts: { allowHttp: rpcUrl.startsWith("http://") },
        },
        currentPool.id
      );
      const [oracle, user] = await Promise.all([
        sdkPool.loadOracle(),
        sdkPool.loadUser(walletAddress),
      ]);

      try {
        setPosition(PositionsEstimate.build(sdkPool, oracle, user.positions));
      } catch {
        setPosition(null);
      }

      setUserReserves(
        currentPool.reserves.map((reserve) => {
          const positions = user?.positions as
            | Record<number, any>
            | Record<string, any>
            | undefined;

          const reservePosition =
            positions?.[reserve.index] ??
            positions?.[String(reserve.index)] ??
            {};

          return {
            ...reserve,
            balance: tokenMap.get(reserve.asset.toUpperCase())?.balance ?? 0,
            supplied: String(
              reservePosition?.supply ??
                reservePosition?.supplyCollateral ??
                "0"
            ),
            collateral: String(
              reservePosition?.collateral ??
                reservePosition?.supplyCollateral ??
                "0"
            ),
            borrowed: String(
              reservePosition?.borrow ?? reservePosition?.borrowed ?? "0"
            ),
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
      setPositionLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadPool(false, controller.signal);
    return () => controller.abort();
  }, [appNetwork, poolContract]);

  useEffect(() => {
    if (pool) void loadPosition(pool);
  }, [pool?.id, walletAddress, rpcUrl, tokenMap]);

  useEffect(() => {
    if (!pool || actionAllowed(pool, action)) return;
    const fallback: BlendAction = pool.canSupply
      ? "supply"
      : pool.canWithdraw
      ? "withdraw"
      : pool.canRepay
      ? "repay"
      : "withdraw";
    setAction(fallback);
  }, [pool, action]);

  function createPoolContract(version: string, poolId: string) {
    if (String(version).toLowerCase().includes("v2")) {
      return new PoolContractV2(poolId);
    }

    return new PoolContractV1(poolId);
  }

  async function submit() {
    if (!pool || !selectedReserve || !walletAddress) return;
    setSubmitting(true);
    setError("");
    setSuccessHash("");
    try {
      if (!actionAllowed(pool, action)) {
        throw new Error(
          `${action} is unavailable while this pool is ${statusText(
            pool.statusLabel
          ).toLowerCase()}.`
        );
      }

      const amountAtomic = toAtomic(amount, selectedReserve.decimals);

      const sdkPool = await loadSdkPool(
        {
          rpc: rpcUrl,
          passphrase,
          opts: {
            allowHttp: rpcUrl.startsWith("http://"),
          },
        },
        pool.id
      );

      const poolContract = createPoolContract(pool.version, pool.id);
      const operation = poolContract.submit({
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
      const label =
        action === "supply"
          ? "Supply collateral"
          : action === "withdraw"
          ? "Withdraw collateral"
          : action === "borrow"
          ? "Borrow"
          : "Repay";
      const result = await execute({
        contractId: call.contractId,
        functionName: call.functionName,
        argsXdr: call.argsXdr,
        description: `${label} ${amount} ${selectedReserve.symbol} on ${pool.name}`,
        values: [
          { key: "Action", value: label },
          { key: "Asset", value: selectedReserve.symbol },
          { key: "Amount", value: amount },
          { key: "Pool", value: pool.name },
        ],
        txDetails: {
          type: `blend/${action}`,
          network: appNetwork,
          walletContractId: walletAddress,
          poolId: pool.id,
          asset: selectedReserve.asset,
          symbol: selectedReserve.symbol,
          amount,
          amountAtomic: amountAtomic.toString(),
        },
      });

      setSuccessHash(result.hash);
      setAmount("");
      toast.success(`${label} submitted.`);
      await Promise.all([loadPosition(pool), loadPool(true)]);
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

  if (loading && !pool) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-slate-200 bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
        <h1 className="mt-4 text-xl font-semibold text-slate-950">
          Pool unavailable
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {error || "This pool could not be loaded."}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to markets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" /> Back to markets
            </button>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                <Landmark className="h-3.5 w-3.5" /> Blend Pool
              </div>
              <span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">
                {pool.version}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClasses(
                  pool.statusLabel
                )}`}
              >
                {statusText(pool.statusLabel)}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              {pool.name}
            </h1>
            <p className="mt-2 break-all text-xs text-slate-400">{pool.id}</p>
          </div>
          <button
            onClick={() =>
              void Promise.all([loadPool(true), loadPosition(pool)])
            }
            disabled={loading || positionLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading || positionLoading ? "animate-spin" : ""
              }`}
            />{" "}
            Refresh pool
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Pool supplied"
          value={usd(pool.suppliedUsd)}
          icon={WalletCards}
        />
        <StatCard
          label="Pool borrowed"
          value={usd(pool.borrowedUsd)}
          icon={HandCoins}
        />
        <StatCard
          label="Backstop"
          value={usd(pool.backstopUsd)}
          icon={ShieldCheck}
        />
        <StatCard
          label="Best supply APR"
          value={percent(pool.bestSupplyApr)}
          icon={TrendingUp}
        />
        <StatCard
          label="Utilization"
          value={percent(pool.utilizationPercent)}
          icon={RefreshCw}
        />
      </section>

      {error ? (
        <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}
      {pool.statusLabel === "ON_ICE" ? (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          This pool is on ice. Borrowing is unavailable, while supplying,
          withdrawing, and repaying remain available.
        </div>
      ) : null}
      {pool.statusLabel === "FROZEN" ? (
        <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          This pool is frozen. Supplying and borrowing are unavailable;
          withdrawing and repaying remain available.
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Your pool position
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Wallet-specific supply, collateral, borrowing, and health
                  metrics.
                </p>
              </div>
              {positionLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              ) : null}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Borrow limit
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {position?.borrowLimit ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Health factor
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {position?.healthFactor ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Net APR
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {position?.netApr != null
                    ? percent(Number(position.netApr) * 100)
                    : "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Wallet
                </p>
                <p className="mt-2 truncate text-sm font-semibold text-slate-950">
                  {walletAddress || "Not connected"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Pool assets
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Select any reserve to inspect your balance and market metrics.
              </p>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 font-semibold">Asset</th>
                    <th className="pb-3 font-semibold">Supply APR</th>
                    <th className="pb-3 font-semibold">Borrow APR</th>
                    <th className="pb-3 font-semibold">Supplied</th>
                    <th className="pb-3 font-semibold">Borrowed</th>
                    <th className="pb-3 font-semibold">Wallet balance</th>
                  </tr>
                </thead>
                <tbody>
                  {userReserves.map((reserve) => (
                    <tr
                      key={reserve.asset}
                      onClick={() => setAsset(reserve.asset)}
                      className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 ${
                        reserve.asset === asset ? "bg-violet-50/50" : ""
                      }`}
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <TokenIcon
                            reserve={reserve}
                            token={tokenMap.get(reserve.asset.toUpperCase())}
                          />
                          <div>
                            <p className="font-semibold text-slate-950">
                              {reserve.symbol}
                            </p>
                            <p className="text-xs text-slate-400">
                              {reserve.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 font-semibold text-emerald-700">
                        {percent(reserve.supplyApr)}
                      </td>
                      <td className="py-4 font-semibold text-slate-950">
                        {percent(reserve.borrowApr)}
                      </td>
                      <td className="py-4 text-slate-700">
                        {atomic(reserve.supplied, reserve.decimals)}
                      </td>
                      <td className="py-4 text-slate-700">
                        {atomic(reserve.borrowed, reserve.decimals)}
                      </td>
                      <td className="py-4 text-slate-700">
                        {String(reserve.balance ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Manage position
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Supply, withdraw, borrow, or repay within this pool.
            </p>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-slate-700">
                Asset
              </span>
              <select
                value={asset}
                onChange={(event) => setAsset(event.target.value)}
                disabled={positionLoading}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-3 outline-none"
              >
                {userReserves.map((reserve) => (
                  <option key={reserve.asset} value={reserve.asset}>
                    {reserve.symbol} · {percent(reserve.supplyApr)} supply
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["supply", "Supply", ArrowDownToLine],
                ["withdraw", "Withdraw", ArrowUpFromLine],
                ["borrow", "Borrow", HandCoins],
                ["repay", "Repay", RotateCcw],
              ].map(([id, label, Icon]: any) => {
                const typedAction = id as BlendAction;
                const allowed = actionAllowed(pool, typedAction);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!allowed}
                    onClick={() => allowed && setAction(typedAction)}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      action === typedAction && allowed
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

            <label className="mt-4 block rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Amount · {selectedReserve?.symbol || "Asset"}
              </span>
              <input
                value={amount}
                onChange={(event) =>
                  /^\d*\.?\d*$/.test(event.target.value) &&
                  setAmount(event.target.value)
                }
                placeholder="0.0"
                className="mt-2 w-full bg-transparent text-3xl font-semibold text-slate-950 outline-none"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Wallet balance</span>
                <span>{String(selectedReserve?.balance ?? 0)}</span>
              </div>
            </label>

            {successHash ? (
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
            ) : null}

            <button
              onClick={() => void submit()}
              disabled={
                !walletAddress ||
                !selectedReserve ||
                !amount ||
                submitting ||
                !actionAllowed(pool, action)
              }
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
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

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">
              Selected asset metrics
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <MetricRow
                label="Supply APR"
                value={percent(selectedReserve?.supplyApr)}
              />
              <MetricRow
                label="Supply APY"
                value={percent(selectedReserve?.supplyApy)}
              />
              <MetricRow
                label="Borrow APR"
                value={percent(selectedReserve?.borrowApr)}
              />
              <MetricRow
                label="Borrow APY"
                value={percent(selectedReserve?.borrowApy)}
              />
              <MetricRow
                label="Utilization"
                value={percent(selectedReserve?.utilizationPercent)}
              />
              <MetricRow
                label="Collateral factor"
                value={percent(selectedReserve?.collateralFactorPercent)}
              />
              <MetricRow
                label="Liability factor"
                value={percent(selectedReserve?.liabilityFactorPercent)}
              />
              <MetricRow
                label="Available liquidity"
                value={
                  selectedReserve?.priceUsd == null
                    ? "—"
                    : usd(
                        selectedReserve.availableLiquidity *
                          selectedReserve.priceUsd
                      )
                }
              />
              <div className="border-t border-slate-200 pt-3">
                <MetricRow
                  label="Your supplied"
                  value={atomic(
                    selectedReserve?.supplied || "0",
                    selectedReserve?.decimals
                  )}
                />
              </div>
              <MetricRow
                label="Your collateral"
                value={atomic(
                  selectedReserve?.collateral || "0",
                  selectedReserve?.decimals
                )}
              />
              <MetricRow
                label="Your borrowed"
                value={atomic(
                  selectedReserve?.borrowed || "0",
                  selectedReserve?.decimals
                )}
              />
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
