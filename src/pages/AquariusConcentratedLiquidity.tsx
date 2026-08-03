// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Coins,
  Loader2,
  MinusCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useSocketFiSorobanExecutor } from "../services/useSocketFiSorobanExecutor";
import { useStates } from "../context/StatesContext";

const DEFAULT_ICON = "https://www.socket.fi/xlm-icon.svg";
const PRESETS = [
  { id: "narrow", label: "Narrow", percent: 2 },
  { id: "balanced", label: "Balanced", percent: 5 },
  { id: "wide", label: "Wide", percent: 15 },
];

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      payload?.error ||
        payload?.message ||
        `Request failed (${response.status})`
    );
  return payload?.data || payload;
}
function validDecimal(value: string) {
  return /^\d*\.?\d*$/.test(value);
}
function formatPrice(value?: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 8,
  }).format(value!);
}
function shortAtomic(value?: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(Number(BigInt(value || "0")));
  } catch {
    return value || "0";
  }
}
function TokenIcon({ token, size = 34 }: any) {
  const [failed, setFailed] = useState(false);
  const src = !failed ? token?.icon || DEFAULT_ICON : DEFAULT_ICON;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
    />
  );
}

export default function AquariusConcentratedLiquidity({
  pool,
  mode = "deposit",
  onModeChange,
  onBack,
}: any) {
  const { execute, network, walletAddress, SERVER_URL } =
    useSocketFiSorobanExecutor();
  const { toast } = useStates();
  const [state, setState] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [loadingState, setLoadingState] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lowerPrice, setLowerPrice] = useState("");
  const [upperPrice, setUpperPrice] = useState("");
  const [tickLower, setTickLower] = useState<number | null>(null);
  const [tickUpper, setTickUpper] = useState<number | null>(null);
  const [slippageBps, setSlippageBps] = useState(50);
  const [quote, setQuote] = useState<any>(null);
  const [selectedPosition, setSelectedPosition] = useState<any>(null);
  const [positionTickLower, setPositionTickLower] = useState("");
  const [positionTickUpper, setPositionTickUpper] = useState("");
  const [withdrawPercent, setWithdrawPercent] = useState(100);
  const [error, setError] = useState("");
  const [successHash, setSuccessHash] = useState("");
  const lastEdited = useRef<"A" | "B">("A");
  const quoteId = useRef(0);

  const params = useMemo(
    () => ({
      network,
      poolAddress: pool.address,
      walletAddress,
      tokenA: pool.tokenA.contract,
      tokenB: pool.tokenB.contract,
    }),
    [
      network,
      pool.address,
      pool.tokenA.contract,
      pool.tokenB.contract,
      walletAddress,
    ]
  );

  const loadState = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingState(true);
    setError("");
    try {
      const qs = new URLSearchParams(params as any);
      const next = await readJson(
        await fetch(`${SERVER_URL}/api/aquarius-concentrated/state?${qs}`)
      );
      setState(next);
      if (!lowerPrice || !upperPrice) {
        setRangeFromPercent(
          next.currentPrice,
          5,
          next.tickSpacing,
          next.currentTick
        );
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load concentrated pool state"
      );
    } finally {
      setLoadingState(false);
    }
  }, [SERVER_URL, params]);

  const loadPositions = useCallback(
    async (lowerOverride?: number, upperOverride?: number) => {
      if (!walletAddress) return;

      const lower = lowerOverride ?? Number(positionTickLower);
      const upper = upperOverride ?? Number(positionTickUpper);

      if (
        !Number.isInteger(lower) ||
        !Number.isInteger(upper) ||
        lower >= upper
      ) {
        setPositions([]);
        setSelectedPosition(null);
        setError("Enter a valid lower and upper tick to load a position.");
        return;
      }

      setLoadingPositions(true);
      setError("");

      try {
        const qs = new URLSearchParams({
          network,
          poolAddress: pool.address,
          walletAddress,
          tickLower: String(lower),
          tickUpper: String(upper),
        });

        const next = await readJson(
          await fetch(`${SERVER_URL}/api/aquarius-concentrated/positions?${qs}`)
        );

        const rows = Array.isArray(next.positions)
          ? next.positions.filter(
              (position) => BigInt(position.liquidityAtomic || "0") > 0n
            )
          : [];

        setPositionTickLower(String(lower));
        setPositionTickUpper(String(upper));
        setPositions(rows);
        setSelectedPosition(rows[0] || null);

        if (rows.length === 0) {
          setError(
            "No position exists for this wallet at the selected tick range."
          );
        }
      } catch (e) {
        setPositions([]);
        setSelectedPosition(null);
        setError(e instanceof Error ? e.message : "Unable to load position");
      } finally {
        setLoadingPositions(false);
      }
    },
    [
      SERVER_URL,
      network,
      pool.address,
      positionTickLower,
      positionTickUpper,
      walletAddress,
    ]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadState();
    return () => controller.abort();
  }, [loadState]);

  function setRangeFromPercent(
    currentPrice: number,
    percent: number,
    spacing: number,
    currentTick: number
  ) {
    if (!(currentPrice > 0) || !(spacing > 0)) return;
    const lower = currentPrice * (1 - percent / 100),
      upper = currentPrice * (1 + percent / 100);
    const rawLower = Math.log(lower) / Math.log(1.0001),
      rawUpper = Math.log(upper) / Math.log(1.0001);
    const tl = Math.floor(rawLower / spacing) * spacing,
      tu = Math.ceil(rawUpper / spacing) * spacing;
    setLowerPrice(String(lower));
    setUpperPrice(String(upper));
    setTickLower(tl);
    setTickUpper(tu);
    setQuote(null);
    setError("");
  }

  function applyPriceRange(lower: string, upper: string) {
    if (!state || Number(lower) <= 0 || Number(upper) <= Number(lower)) return;
    const spacing = state.tickSpacing;
    setTickLower(
      Math.floor(Math.log(Number(lower)) / Math.log(1.0001) / spacing) * spacing
    );
    setTickUpper(
      Math.ceil(Math.log(Number(upper)) / Math.log(1.0001) / spacing) * spacing
    );
    setQuote(null);
  }

  useEffect(() => {
    const id = ++quoteId.current;
    const controller = new AbortController();
    setQuote(null);
    setSuccessHash("");
    if (mode !== "deposit" || tickLower === null || tickUpper === null)
      return () => controller.abort();
    const sourceAmount = lastEdited.current === "A" ? amountA : amountB;
    if (!(Number(sourceAmount) > 0)) return () => controller.abort();
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      setError("");
      try {
        const next = await readJson(
          await fetch(`${SERVER_URL}/api/aquarius-concentrated/quote`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              ...params,
              tokenADecimals: pool.tokenA.decimals || 7,
              tokenBDecimals: pool.tokenB.decimals || 7,
              tickLower,
              tickUpper,
              amountA: lastEdited.current === "A" ? amountA || "0" : "0",
              amountB: lastEdited.current === "B" ? amountB || "0" : "0",
              slippageBps,
            }),
          })
        );
        if (id !== quoteId.current) return;
        setQuote(next);
        setTickLower(next.tickLower);
        setTickUpper(next.tickUpper);
        setLowerPrice(String(next.priceLower));
        setUpperPrice(String(next.priceUpper));
        if (lastEdited.current === "A") setAmountB(next.amountB);
        else setAmountA(next.amountA);
      } catch (e) {
        if (!controller.signal.aborted && id === quoteId.current)
          setError(e instanceof Error ? e.message : "Unable to quote position");
      } finally {
        if (id === quoteId.current) setQuoteLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    mode,
    amountA,
    amountB,
    tickLower,
    tickUpper,
    slippageBps,
    params,
    pool.tokenA.decimals,
    pool.tokenB.decimals,
    SERVER_URL,
  ]);

  async function executeQuote(next: any, description: string, txDetails: any) {
    if (next.expiresAt && Date.parse(next.expiresAt) <= Date.now())
      throw new Error("Quote expired; refresh it before continuing");
    return execute({
      contractId: next.contractId,
      functionName: next.functionName,
      argsXdr: next.argsXdr,
      description,
      values: [
        { key: "Pool", value: `${pool.tokenA.symbol}/${pool.tokenB.symbol}` },
        {
          key: "Range",
          value: `${formatPrice(Number(lowerPrice))} – ${formatPrice(
            Number(upperPrice)
          )}`,
        },
      ],
      txDetails: {
        ...txDetails,
        network,
        walletContractId: walletAddress,
        poolAddress: pool.address,
        poolType: "concentrated",
        tokenA: pool.tokenA.contract,
        tokenB: pool.tokenB.contract,
      },
    });
  }

  async function submitDeposit() {
    if (!quote) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await executeQuote(
        quote,
        `Add concentrated liquidity to ${pool.tokenA.symbol}/${pool.tokenB.symbol}`,
        {
          type: "liquidity/AQUARIUS/CONCENTRATED_ADD",
          tickLower: quote.tickLower,
          tickUpper: quote.tickUpper,
          amountA: quote.amountA,
          amountB: quote.amountB,
          minLiquidityAtomic: quote.minLiquidityAtomic,
        }
      );
      setSuccessHash(result.hash);
      toast.success("Concentrated liquidity position updated.");
      setAmountA("");
      setAmountB("");
      setQuote(null);
      setPositionTickLower(String(quote.tickLower));
      setPositionTickUpper(String(quote.tickUpper));
      await loadPositions(quote.tickLower, quote.tickUpper);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Position deposit failed";
      setError(m);
      toast.error(m);
    } finally {
      setSubmitting(false);
    }
  }

  async function buildAndSubmitPositionAction(kind: "withdraw" | "claim") {
    if (!selectedPosition) return;
    setSubmitting(true);
    setError("");
    try {
      const endpoint = kind === "withdraw" ? "withdraw-quote" : "claim-quote";
      let body: any = {
        ...params,
        tickLower: selectedPosition.tickLower,
        tickUpper: selectedPosition.tickUpper,
      };
      if (kind === "withdraw") {
        const owned = BigInt(selectedPosition.liquidityAtomic || "0");
        body = {
          ...body,
          tokenADecimals: pool.tokenA.decimals || 7,
          tokenBDecimals: pool.tokenB.decimals || 7,
          liquidityAtomic: (
            (owned * BigInt(withdrawPercent)) /
            100n
          ).toString(),
          slippageBps,
        };
      }
      const next = await readJson(
        await fetch(`${SERVER_URL}/api/aquarius-concentrated/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      );
      const result = await executeQuote(
        next,
        kind === "withdraw"
          ? `Withdraw concentrated liquidity from ${pool.tokenA.symbol}/${pool.tokenB.symbol}`
          : `Claim fees from ${pool.tokenA.symbol}/${pool.tokenB.symbol}`,
        {
          type:
            kind === "withdraw"
              ? "liquidity/AQUARIUS/CONCENTRATED_REMOVE"
              : "liquidity/AQUARIUS/CONCENTRATED_CLAIM",
          tickLower: selectedPosition.tickLower,
          tickUpper: selectedPosition.tickUpper,
          liquidityAtomic: body.liquidityAtomic,
        }
      );
      setSuccessHash(result.hash);
      toast.success(
        kind === "withdraw"
          ? "Position liquidity withdrawn."
          : "Position fees claimed."
      );
      await loadPositions(
        selectedPosition.tickLower,
        selectedPosition.tickUpper
      );
    } catch (e) {
      const m = e instanceof Error ? e.message : "Position action failed";
      setError(m);
      toast.error(m);
    } finally {
      setSubmitting(false);
    }
  }

  const inRange =
    state &&
    tickLower !== null &&
    tickUpper !== null &&
    state.currentTick >= tickLower &&
    state.currentTick < tickUpper;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Concentrated liquidity
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {pool.tokenA.symbol}/{pool.tokenB.symbol} position
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadState();
            if (positionTickLower && positionTickUpper) void loadPositions();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              loadingState || loadingPositions ? "animate-spin" : ""
            }`}
          />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Current price"
          value={
            state
              ? `${formatPrice(state.currentPrice)} ${pool.tokenB.symbol}/${
                  pool.tokenA.symbol
                }`
              : "—"
          }
        />
        <Stat label="Current tick" value={state?.currentTick ?? "—"} />
        <Stat label="Tick spacing" value={state?.tickSpacing ?? "—"} />
      </div>

      <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onModeChange?.("deposit")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
            mode === "deposit" ? "bg-white shadow-sm" : "text-slate-500"
          }`}
        >
          Add position
        </button>
        <button
          type="button"
          onClick={() => onModeChange?.("withdraw")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
            mode === "withdraw" ? "bg-white shadow-sm" : "text-slate-500"
          }`}
        >
          Manage positions
        </button>
      </div>

      {mode === "deposit" ? (
        <>
          <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Price range</p>
              {inRange !== null && (
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    inRange
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {inRange ? "In range" : "Out of range"}
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!state}
                  onClick={() =>
                    setRangeFromPercent(
                      state.currentPrice,
                      p.percent,
                      state.tickSpacing,
                      state.currentTick
                    )
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                >
                  {p.label} ±{p.percent}%
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="rounded-xl bg-slate-50 p-3">
                <span className="text-xs text-slate-500">Minimum price</span>
                <input
                  value={lowerPrice}
                  onChange={(e) => {
                    if (validDecimal(e.target.value)) {
                      setLowerPrice(e.target.value);
                      applyPriceRange(e.target.value, upperPrice);
                    }
                  }}
                  className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
                />
              </label>
              <label className="rounded-xl bg-slate-50 p-3">
                <span className="text-xs text-slate-500">Maximum price</span>
                <input
                  value={upperPrice}
                  onChange={(e) => {
                    if (validDecimal(e.target.value)) {
                      setUpperPrice(e.target.value);
                      applyPriceRange(lowerPrice, e.target.value);
                    }
                  }}
                  className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Aligned ticks: {tickLower ?? "—"} to {tickUpper ?? "—"}. A
              narrower range is more capital-efficient but can move out of range
              sooner.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
            <p className="text-sm font-semibold">Deposit amounts</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <AmountBox
                token={pool.tokenA}
                value={amountA}
                onChange={(v: string) => {
                  if (validDecimal(v)) {
                    lastEdited.current = "A";
                    setAmountA(v);
                    setAmountB("");
                  }
                }}
              />
              <AmountBox
                token={pool.tokenB}
                value={amountB}
                onChange={(v: string) => {
                  if (validDecimal(v)) {
                    lastEdited.current = "B";
                    setAmountB(v);
                    setAmountA("");
                  }
                }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-slate-500">Slippage tolerance</span>
              <select
                value={slippageBps}
                onChange={(e) => setSlippageBps(Number(e.target.value))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
              >
                <option value={10}>0.10%</option>
                <option value={50}>0.50%</option>
                <option value={100}>1.00%</option>
              </select>
            </div>
            {quote && (
              <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <Row
                  label="Expected liquidity"
                  value={shortAtomic(quote.expectedLiquidityAtomic)}
                />
                <Row
                  label="Minimum liquidity"
                  value={shortAtomic(quote.minLiquidityAtomic)}
                />
                <Row
                  label="Required pair"
                  value={`${quote.amountA} ${pool.tokenA.symbol} + ${quote.amountB} ${pool.tokenB.symbol}`}
                />
              </div>
            )}
            <Status
              error={error}
              loading={quoteLoading}
              successHash={successHash}
              network={network}
            />
            <button
              type="button"
              disabled={!quote || quoteLoading || submitting}
              onClick={() => void submitDeposit()}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {submitting ? "Confirming…" : "Add concentrated liquidity"}
            </button>
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div>
            <p className="text-sm font-semibold">Load a position</p>
            <p className="mt-1 text-xs text-slate-500">
              Aquarius positions are identified by wallet, lower tick, and upper
              tick.
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="rounded-xl bg-slate-50 p-3">
              <span className="text-xs text-slate-500">Lower tick</span>
              <input
                value={positionTickLower}
                onChange={(event) => {
                  setPositionTickLower(
                    event.target.value.replace(/[^0-9-]/g, "")
                  );
                  setPositions([]);
                  setSelectedPosition(null);
                }}
                inputMode="numeric"
                placeholder="e.g. -1200"
                className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
              />
            </label>
            <label className="rounded-xl bg-slate-50 p-3">
              <span className="text-xs text-slate-500">Upper tick</span>
              <input
                value={positionTickUpper}
                onChange={(event) => {
                  setPositionTickUpper(
                    event.target.value.replace(/[^0-9-]/g, "")
                  );
                  setPositions([]);
                  setSelectedPosition(null);
                }}
                inputMode="numeric"
                placeholder="e.g. 1200"
                className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={
              loadingPositions || !positionTickLower || !positionTickUpper
            }
            onClick={() => void loadPositions()}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold disabled:opacity-50"
          >
            {loadingPositions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {loadingPositions ? "Loading position…" : "Load position"}
          </button>

          {positions.length > 0 && (
            <div className="mt-4 grid gap-2">
              {positions.map((position) => (
                <button
                  key={`${position.tickLower}:${position.tickUpper}`}
                  type="button"
                  onClick={() => setSelectedPosition(position)}
                  className={`rounded-xl border p-3 text-left ${
                    selectedPosition?.tickLower === position.tickLower &&
                    selectedPosition?.tickUpper === position.tickUpper
                      ? "border-slate-950 ring-1 ring-slate-950"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold">
                      Ticks {position.tickLower} → {position.tickUpper}
                    </span>
                    <span className="text-xs text-slate-500">
                      {shortAtomic(position.liquidityAtomic)} liquidity
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedPosition && (
            <div className="mt-4 space-y-4">
              <div>
                <div className="flex justify-between text-sm">
                  <span>Withdraw amount</span>
                  <strong>{withdrawPercent}%</strong>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={withdrawPercent}
                  onChange={(event) =>
                    setWithdrawPercent(Number(event.target.value))
                  }
                  className="mt-2 w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void buildAndSubmitPositionAction("claim")}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold"
                >
                  <Coins className="h-4 w-4" />
                  Claim fees
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void buildAndSubmitPositionAction("withdraw")}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-semibold text-white"
                >
                  <MinusCircle className="h-4 w-4" />
                  Withdraw
                </button>
              </div>
            </div>
          )}

          <Status
            error={error}
            loading={false}
            successHash={successHash}
            network={network}
          />
        </section>
      )}
    </div>
  );
}
function Stat({ label, value }: any) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
function Row({ label, value }: any) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
function AmountBox({ token, value, onChange }: any) {
  return (
    <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        <TokenIcon token={token} />
        {token.symbol}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.0"
        inputMode="decimal"
        className="mt-3 w-full bg-transparent text-2xl font-semibold outline-none"
      />
    </label>
  );
}
function Status({ error, loading, successHash, network }: any) {
  return (
    <>
      {loading && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calculating position…
        </div>
      )}
      {error && (
        <div className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {successHash && (
        <a
          className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"
          href={`https://stellar.expert/explorer/${
            network === "PUBLIC" ? "public" : "testnet"
          }/tx/${successHash}`}
          target="_blank"
          rel="noreferrer"
        >
          <CheckCircle2 className="h-4 w-4" />
          Transaction submitted
        </a>
      )}
    </>
  );
}
