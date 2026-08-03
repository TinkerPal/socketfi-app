import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Address } from "@stellar/stellar-sdk";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWalletClient,
} from "wagmi";

import {
  createNearIntentQuote,
  getNearIntentAssets,
  sendNearIntentDeposit,
  waitForNearIntentSettlement,
} from "./near-intents";
import type {
  NearIntentExecution,
  NearIntentQuote,
  SocketFiNetwork,
} from "./near-intents.types";
import { useStates } from "../context/StatesContext";

type Props = {
  destinationAccount: string;
  network: SocketFiNetwork;
};

type NearIntentAssetsResult = Awaited<ReturnType<typeof getNearIntentAssets>>;

type ChainOption = NearIntentAssetsResult["chains"][number];

type AssetFetchState = "idle" | "fetching" | "success" | "empty" | "error";

interface AssetPayloadShape {
  success?: boolean;
  chains?: unknown;
  unavailableChains?: unknown;
  data?: {
    chains?: unknown;
    unavailableChains?: unknown;
  };
  error?: string;
  message?: string;
}

function normalizeChains(result: unknown): ChainOption[] {
  const candidate = Array.isArray(result)
    ? result
    : result && typeof result === "object"
    ? Array.isArray((result as AssetPayloadShape).chains)
      ? (result as AssetPayloadShape).chains
      : Array.isArray((result as AssetPayloadShape).data?.chains)
      ? (result as AssetPayloadShape).data?.chains
      : []
    : [];

  return candidate
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const value = item as Record<string, unknown>;
      const parsedChainId = Number(value.chainId);

      if (
        !Number.isInteger(parsedChainId) ||
        parsedChainId <= 0 ||
        typeof value.label !== "string" ||
        typeof value.blockchain !== "string" ||
        typeof value.nativeSymbol !== "string" ||
        !value.usdc ||
        typeof value.usdc !== "object"
      ) {
        return null;
      }

      return {
        ...value,
        chainId: parsedChainId,
      } as ChainOption;
    })
    .filter((item): item is ChainOption => item !== null);
}

function normalizeUnavailableChains(result: unknown): unknown[] {
  if (!result || typeof result !== "object") {
    return [];
  }

  const payload = result as AssetPayloadShape;

  if (Array.isArray(payload.unavailableChains)) {
    return payload.unavailableChains;
  }

  if (Array.isArray(payload.data?.unavailableChains)) {
    return payload.data.unavailableChains;
  }

  return [];
}

function validSocketFiAccount(value: string): boolean {
  try {
    Address.fromString(value);
    return value.startsWith("C");
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (/rejected|denied|declined/i.test(error.message)) {
      return "The wallet request was rejected.";
    }

    if (/insufficient funds|gas/i.test(error.message)) {
      return "Insufficient native token to pay source-network gas.";
    }

    return error.message;
  }

  return "Unable to complete the bridge transfer.";
}

function sourceExplorer(chainId: number, hash: string): string {
  const roots: Record<number, string> = {
    1: "https://etherscan.io/tx/",
    8453: "https://basescan.org/tx/",
    42161: "https://arbiscan.io/tx/",
    137: "https://polygonscan.com/tx/",
  };

  return `${roots[chainId] || "https://blockscan.com/tx/"}${hash}`;
}

function AssetFetchIndicator({
  state,
  chainCount,
  onRefresh,
  loading,
}: {
  state: AssetFetchState;
  chainCount: number;
  onRefresh: () => void;
  loading: boolean;
}) {
  const successful = state === "success";
  const failed = state === "error" || state === "empty";

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs ${
        successful
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : failed
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : successful ? (
          <Wifi className="h-4 w-4 shrink-0" />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0" />
        )}

        <span className="truncate font-semibold">
          {loading
            ? "Fetching NEAR Intents routes…"
            : successful
            ? `${chainCount} supported route${
                chainCount === 1 ? "" : "s"
              } loaded`
            : state === "empty"
            ? "The server responded, but returned no supported routes"
            : state === "error"
            ? "Unable to fetch supported routes"
            : "Route discovery has not started"}
        </span>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-current/15 bg-white/70 transition hover:bg-white disabled:opacity-50"
        aria-label="Refresh supported routes"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

export default function NearIntentDeposit({
  destinationAccount,
  network,
}: Props) {
  const { address: account, chainId, isConnected } = useAccount();

  const [selectedChainId, setSelectedChainId] = useState<number>(
    chainId || 8453
  );

  const { data: walletClient } = useWalletClient();

  const publicClient = usePublicClient({
    chainId: selectedChainId,
  });

  const { switchChainAsync, isPending: switching } = useSwitchChain();

  const { setLoginIsOpen, setWalletKitIsOpen, setEvmWalletIsOpen } =
    useStates();

  const [chains, setChains] = useState<ChainOption[]>([]);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<NearIntentQuote | null>(null);
  const [status, setStatus] = useState<NearIntentExecution["status"] | "">("");
  const [txHash, setTxHash] = useState("");

  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetFetchState, setAssetFetchState] =
    useState<AssetFetchState>("idle");
  const [lastAssetsFetchedAt, setLastAssetsFetchedAt] = useState<Date | null>(
    null
  );

  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const quoteRequest = useRef(0);
  const assetsRequest = useRef(0);
  const settlementAbort = useRef<AbortController | null>(null);
  const assetsAbort = useRef<AbortController | null>(null);

  const safeChains = Array.isArray(chains) ? chains : [];

  const selected = useMemo(
    () => safeChains.find((item) => item.chainId === selectedChainId),
    [safeChains, selectedChainId]
  );

  const numericAmount = Number(amount);

  const amountValid =
    amount !== "" && Number.isFinite(numericAmount) && numericAmount > 0;

  const productionReady =
    network === "PUBLIC" && validSocketFiAccount(destinationAccount);

  const loadAssets = useCallback(async () => {
    const requestId = ++assetsRequest.current;

    assetsAbort.current?.abort();

    const controller = new AbortController();
    assetsAbort.current = controller;

    setLoadingAssets(true);
    setAssetFetchState("fetching");
    setError("");

    console.info("[near-intents/assets] request started", {
      requestId,
      network,
      destinationAccount,
      walletChainId: chainId,
    });

    try {
      const result = await getNearIntentAssets(controller.signal);

      if (controller.signal.aborted || requestId !== assetsRequest.current) {
        return;
      }

      console.info("[near-intents/assets] raw response", result);

      const loadedChains = normalizeChains(result);
      const unavailableChains = normalizeUnavailableChains(result);

      console.info("[near-intents/assets] normalized response", {
        loadedChains,
        unavailableChains,
        loadedCount: loadedChains.length,
      });

      setChains(loadedChains);
      setLastAssetsFetchedAt(new Date());

      if (loadedChains.length === 0) {
        setAssetFetchState("empty");

        setError(
          unavailableChains.length > 0
            ? "The NEAR Intents server responded, but none of the configured USDC routes are currently available. Check the browser console for unavailable-chain details."
            : "The NEAR Intents server responded successfully, but returned no supported USDC routes."
        );

        return;
      }

      setAssetFetchState("success");

      setSelectedChainId((currentChainId) => {
        const walletChainIsSupported =
          typeof chainId === "number" &&
          loadedChains.some((item) => item.chainId === chainId);

        const currentChainIsSupported = loadedChains.some(
          (item) => item.chainId === currentChainId
        );

        if (walletChainIsSupported) {
          return chainId;
        }

        if (currentChainIsSupported) {
          return currentChainId;
        }

        return loadedChains[0].chainId;
      });
    } catch (cause) {
      if (
        controller.signal.aborted ||
        (cause instanceof DOMException && cause.name === "AbortError")
      ) {
        console.info("[near-intents/assets] request aborted", {
          requestId,
        });

        return;
      }

      console.error("[near-intents/assets] request failed", cause);

      if (requestId === assetsRequest.current) {
        setChains([]);
        setAssetFetchState("error");
        setError(errorMessage(cause));
      }
    } finally {
      if (!controller.signal.aborted && requestId === assetsRequest.current) {
        setLoadingAssets(false);
      }
    }
  }, [chainId, destinationAccount, network]);

  useEffect(() => {
    void loadAssets();

    return () => {
      assetsAbort.current?.abort();
    };
  }, [loadAssets]);

  useEffect(() => {
    setQuote(null);
    setStatus("");
    setTxHash("");
    setError("");
    settlementAbort.current?.abort();
  }, [amount, selectedChainId, account, destinationAccount, network]);

  useEffect(
    () => () => {
      settlementAbort.current?.abort();
      assetsAbort.current?.abort();
    },
    []
  );

  function openWallet() {
    setError("");
    setLoginIsOpen(false);
    setWalletKitIsOpen(false);
    setEvmWalletIsOpen(true);
  }

  async function requestQuote() {
    if (!productionReady) {
      setError(
        network === "TESTNET"
          ? "NEAR Intents has no testnet. Use a PUBLIC SocketFi account."
          : "Invalid SocketFi smart-account address."
      );

      return;
    }

    if (!account || !selected || !amountValid) {
      setError(
        safeChains.length === 0
          ? "No supported NEAR Intents USDC route is currently available."
          : "Connect a wallet, select a supported chain, and enter an amount."
      );

      return;
    }

    const id = ++quoteRequest.current;

    setQuoting(true);
    setError("");

    console.info("[near-intents/quote] request started", {
      requestId: id,
      network,
      chainId: selected.chainId,
      amount,
      sender: account,
      recipient: destinationAccount,
    });

    try {
      if (chainId !== selected.chainId) {
        await switchChainAsync({
          chainId: selected.chainId,
        });
      }

      const result = await createNearIntentQuote({
        network,
        chainId: selected.chainId,
        amount,
        sender: account,
        recipient: destinationAccount,
        slippageBps: 100,
      });

      console.info("[near-intents/quote] response", result);

      if (id === quoteRequest.current) {
        setQuote(result);
      }
    } catch (cause) {
      console.error("[near-intents/quote] request failed", cause);

      if (id === quoteRequest.current) {
        setError(errorMessage(cause));
      }
    } finally {
      if (id === quoteRequest.current) {
        setQuoting(false);
      }
    }
  }

  async function deposit() {
    if (!quote || !walletClient || !publicClient || !account) {
      return;
    }

    setSubmitting(true);
    setError("");
    setStatus("PENDING_DEPOSIT");

    console.info("[near-intents/deposit] transaction started", {
      depositAddress: quote.depositAddress,
      amountIn: quote.amountIn,
      amountInFormatted: quote.amountInFormatted,
      sourceChainId: selected?.chainId,
      sender: account,
    });

    try {
      const hash = await sendNearIntentDeposit({
        quote,
        account,
        walletClient,
        waitForReceipt: (transactionHash) =>
          publicClient.waitForTransactionReceipt({
            hash: transactionHash,
            confirmations: 1,
            timeout: 180_000,
          }),
      });

      console.info("[near-intents/deposit] source transaction confirmed", {
        hash,
      });

      setTxHash(hash);

      settlementAbort.current?.abort();
      settlementAbort.current = new AbortController();

      const result = await waitForNearIntentSettlement(quote.depositAddress, {
        signal: settlementAbort.current.signal,
      });

      console.info("[near-intents/settlement] final response", result);

      setStatus(result.status);

      if (result.status !== "SUCCESS") {
        setError(
          result.status === "REFUNDED"
            ? "The intent was refunded to your source wallet."
            : `The intent ended with status ${result.status}.`
        );
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        console.error("[near-intents/deposit] failed", cause);
        setError(errorMessage(cause));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (network === "TESTNET") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-semibold">Mainnet only</p>

            <p className="mt-1">
              NEAR Intents does not operate a testnet. Switch this SocketFi
              account to PUBLIC and test first with a small mainnet amount.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <AssetFetchIndicator
        state={assetFetchState}
        chainCount={safeChains.length}
        onRefresh={() => void loadAssets()}
        loading={loadingAssets}
      />

      {lastAssetsFetchedAt ? (
        <p className="-mt-3 text-right text-[11px] text-slate-400">
          Routes checked{" "}
          {lastAssetsFetchedAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      ) : null}

      {!isConnected || !account ? (
        <button
          type="button"
          onClick={openWallet}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
        >
          <Wallet className="h-4 w-4" />
          Connect EVM wallet
        </button>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />

            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-950">
                EVM wallet connected
              </p>

              <p className="truncate text-xs text-emerald-700">{account}</p>
            </div>
          </div>
        </div>
      )}

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Source network
        </span>

        <select
          value={selectedChainId}
          disabled={loadingAssets || submitting}
          onChange={(event) => setSelectedChainId(Number(event.target.value))}
          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
        >
          {loadingAssets ? (
            <option value={selectedChainId}>Loading supported routes…</option>
          ) : safeChains.length === 0 ? (
            <option value={selectedChainId}>No USDC routes available</option>
          ) : (
            safeChains.map((item) => (
              <option key={item.chainId} value={item.chainId}>
                {item.label} · USDC
              </option>
            ))
          )}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Amount (USDC)
        </span>

        <input
          value={amount}
          disabled={submitting}
          onChange={(event) => {
            if (
              event.target.value === "" ||
              /^\d*\.?\d{0,6}$/.test(event.target.value)
            ) {
              setAmount(event.target.value);
            }
          }}
          inputMode="decimal"
          placeholder="10.00"
          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
        />
      </label>

      {!quote ? (
        <button
          type="button"
          disabled={
            loadingAssets ||
            safeChains.length === 0 ||
            !account ||
            !selected ||
            !amountValid ||
            quoting ||
            switching
          }
          onClick={() => void requestQuote()}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {quoting || switching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}

          {switching
            ? "Switching network…"
            : quoting
            ? "Getting quote…"
            : "Review bridge"}
        </button>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">You send</span>

            <span className="text-sm font-semibold text-slate-950">
              {quote.amountInFormatted} USDC
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">SocketFi receives</span>

            <span className="text-sm font-semibold text-slate-950">
              ≈ {quote.amountOutFormatted} USDC
            </span>
          </div>

          <p className="text-xs leading-5 text-slate-500">
            Quote expires {new Date(quote.deadline).toLocaleTimeString()}.
            Source gas is paid in {selected?.nativeSymbol}.
          </p>

          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void requestQuote()}
              aria-label="Refresh quote"
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white"
            >
              <RefreshCw
                className={`h-4 w-4 ${quoting ? "animate-spin" : ""}`}
              />
            </button>

            <button
              type="button"
              disabled={submitting || Date.parse(quote.deadline) <= Date.now()}
              onClick={() => void deposit()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}

              {submitting ? "Bridging…" : "Confirm and bridge"}
            </button>
          </div>
        </div>
      )}

      {status ? (
        <div
          className={`rounded-2xl border p-4 text-sm ${
            status === "SUCCESS"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-indigo-200 bg-indigo-50 text-indigo-900"
          }`}
        >
          <div className="flex items-center gap-2 font-semibold">
            {status === "SUCCESS" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            {status === "SUCCESS"
              ? "USDC delivered to SocketFi"
              : status.replaceAll("_", " ")}
          </div>

          {txHash && selected ? (
            <a
              href={sourceExplorer(selected.chainId, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline"
            >
              View source transaction
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <p className="text-center text-xs leading-5 text-slate-400">
        Powered by NEAR Intents. SocketFi never receives your private key.
      </p>
    </div>
  );
}
