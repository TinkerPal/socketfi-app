import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import type { TokenWithChainDetails } from "@allbridge/bridge-core-sdk";

import { useStates } from "../../context/StatesContext";
import {
  executeAllbridgeTransfer,
  getEvmSourceChain,
  getSorobanDestination,
  quoteAllbridgeTransfer,
  waitForAllbridgeSettlement,
  type BridgeQuote,
} from "../../allbridge/allbridge";

type Network = "TESTNET" | "PUBLIC";

type Props = {
  destinationAccount: string;
  network: Network;
};

const EVM_CONNECTED_EVENT = "socketfi:evm-wallet-connected";

function readableError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unable to complete this transfer.";
  }

  if (/user rejected|user denied|rejected the request/i.test(error.message)) {
    return "The wallet request was cancelled.";
  }

  if (/insufficient funds/i.test(error.message)) {
    return "The connected wallet does not have enough balance for the transfer and source-chain gas.";
  }

  if (/chain.*mismatch|wrong network|switch chain/i.test(error.message)) {
    return "The wallet network changed. Select a supported EVM network and try again.";
  }

  return error.message;
}

function mask(value: string) {
  return value.length > 18 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value;
}

export default function AllbridgeDeposit({
  destinationAccount,
  network,
}: Props) {
  const { setLoginIsOpen, setWalletKitIsOpen, setEvmWalletIsOpen } =
    useStates();

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [sourceTokens, setSourceTokens] = useState<TokenWithChainDetails[]>([]);
  const [destinationTokens, setDestinationTokens] = useState<
    TokenWithChainDetails[]
  >([]);
  const [sourceTokenAddress, setSourceTokenAddress] = useState("");
  const [destinationTokenAddress, setDestinationTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [sourceChainName, setSourceChainName] = useState("");
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [destinationTxHash, setDestinationTxHash] = useState("");
  const [settlementPending, setSettlementPending] = useState(false);

  const sourceToken = useMemo(
    () =>
      sourceTokens.find((token) => token.tokenAddress === sourceTokenAddress),
    [sourceTokenAddress, sourceTokens]
  );

  const destinationToken = useMemo(
    () =>
      destinationTokens.find(
        (token) => token.tokenAddress === destinationTokenAddress
      ),
    [destinationTokenAddress, destinationTokens]
  );

  const validAmount =
    amount.trim() !== "" &&
    Number.isFinite(Number(amount)) &&
    Number(amount) > 0;

  function connectEvmWallet() {
    setError("");
    setLoginIsOpen(false);
    setWalletKitIsOpen(false);
    setEvmWalletIsOpen(true);
  }

  useEffect(() => {
    const clearAfterConnect = () => setError("");
    window.addEventListener(EVM_CONNECTED_EVENT, clearAfterConnect);

    return () => {
      window.removeEventListener(EVM_CONNECTED_EVENT, clearAfterConnect);
    };
  }, []);

  useEffect(() => {
    setQuote(null);
    setTxHash("");
    setDestinationTxHash("");
    setSettlementPending(false);
    setSourceChainName("");
    setSourceTokens([]);
    setDestinationTokens([]);
    setSourceTokenAddress("");
    setDestinationTokenAddress("");

    if (network !== "PUBLIC" || !isConnected || !chainId) {
      setLoadingAssets(false);
      return;
    }

    let cancelled = false;
    setLoadingAssets(true);
    setError("");

    void Promise.all([getEvmSourceChain(chainId), getSorobanDestination()])
      .then(([sourceChain, destinationChain]) => {
        if (cancelled) return;

        if (!sourceChain) {
          throw new Error(
            `Allbridge does not support the connected EVM network (chain ID ${chainId}).`
          );
        }

        if (!destinationChain) {
          throw new Error("Allbridge Soroban destination is unavailable.");
        }

        const sourceAssets = sourceChain.tokens.filter(
          (token) => Boolean(token.tokenAddress) && Boolean(token.symbol)
        );
        const destinationAssets = destinationChain.tokens.filter(
          (token) => token.symbol.toUpperCase() === "USDC"
        );

        if (!sourceAssets.length) {
          throw new Error(
            `Allbridge has no transferable assets for ${sourceChain.name}.`
          );
        }

        if (!destinationAssets.length) {
          throw new Error(
            "Allbridge USDC on Stellar/Soroban is currently unavailable."
          );
        }

        setSourceChainName(sourceChain.name);
        setSourceTokens(sourceAssets);
        setDestinationTokens(destinationAssets);
        setSourceTokenAddress(sourceAssets[0].tokenAddress);
        setDestinationTokenAddress(destinationAssets[0].tokenAddress);
      })
      .catch((reason) => {
        if (!cancelled) setError(readableError(reason));
      })
      .finally(() => {
        if (!cancelled) setLoadingAssets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [chainId, isConnected, network]);

  useEffect(() => {
    setQuote(null);

    if (!validAmount || !sourceToken || !destinationToken) {
      setQuoting(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      setQuoting(true);
      setError("");

      void quoteAllbridgeTransfer(amount, sourceToken, destinationToken)
        .then((nextQuote) => {
          if (!cancelled) setQuote(nextQuote);
        })
        .catch((reason) => {
          if (!cancelled) setError(readableError(reason));
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [amount, destinationToken, sourceToken, validAmount]);

  async function bridge() {
    if (network !== "PUBLIC") {
      setError("Allbridge funding is only available on PUBLIC.");
      return;
    }

    if (!address || !isConnected) {
      connectEvmWallet();
      return;
    }

    if (
      !walletClient ||
      !publicClient ||
      !sourceToken ||
      !destinationToken ||
      !validAmount ||
      !quote
    ) {
      setError("Complete the transfer details and wait for a valid quote.");
      return;
    }

    if (walletClient.chain?.id !== chainId) {
      setError(
        "The active wallet network does not match the selected source network."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setTxHash("");
      setDestinationTxHash("");
      setSettlementPending(false);

      const hash = await executeAllbridgeTransfer({
        account: address,
        amount,
        destinationAccount,
        sourceToken,
        destinationToken,
        walletClient,
        waitForReceipt: (transactionHash) =>
          publicClient.waitForTransactionReceipt({
            hash: transactionHash,
            confirmations: 1,
          }),
      });

      setTxHash(hash);
      setAmount("");
      setQuote(null);
      setSettlementPending(true);

      void waitForAllbridgeSettlement(sourceToken.chainSymbol, hash)
        .then((status) => {
          setDestinationTxHash(
            status.receive?.txId || status.receive?.hash || ""
          );
        })
        .catch((reason) => {
          setError(readableError(reason));
        })
        .finally(() => {
          setSettlementPending(false);
        });
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setSubmitting(false);
    }
  }

  if (network !== "PUBLIC") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Allbridge is mainnet-only</p>
            <p className="mt-1 text-amber-800">
              Allbridge does not publish a Stellar/Soroban testnet deployment.
              Use the Stellar wallet option on TESTNET, or open this deposit URL
              with the PUBLIC network to bridge real assets.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!isConnected ? (
        <button
          type="button"
          onClick={connectEvmWallet}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
        >
          <Wallet className="h-4 w-4" />
          Connect EVM wallet
        </button>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-950">
            EVM wallet connected
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            {mask(address || "")} · {sourceChainName || `Chain ${chainId}`}
          </p>
        </div>
      )}

      {loadingAssets ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Allbridge assets…
        </div>
      ) : isConnected && sourceTokens.length ? (
        <>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Pay with
            </span>
            <select
              value={sourceTokenAddress}
              onChange={(event) => {
                setSourceTokenAddress(event.target.value);
                setQuote(null);
                setError("");
              }}
              disabled={submitting}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sourceTokens.map((token) => (
                <option
                  key={`${token.chainSymbol}:${token.tokenAddress}`}
                  value={token.tokenAddress}
                >
                  {token.symbol} on {sourceChainName}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Amount</span>
            <input
              value={amount}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "" || /^\d*\.?\d*$/.test(value)) {
                  setAmount(value);
                }
              }}
              disabled={submitting}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">Recipient receives</span>
              <span className="font-semibold text-slate-950">
                {quoting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : quote && destinationToken ? (
                  `≈ ${quote.amountToReceive} ${destinationToken.symbol}`
                ) : (
                  "—"
                )}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Delivered by Allbridge Core directly to the SocketFi smart
              account. Source-chain network gas is paid with the connected
              network’s native token.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void bridge()}
            disabled={
              submitting || quoting || !quote || !validAmount || !walletClient
            }
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirming bridge…
              </>
            ) : (
              <>
                Bridge to SocketFi
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}
        </div>
      ) : null}

      {txHash ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-950">
                {destinationTxHash
                  ? "Bridge completed"
                  : settlementPending
                  ? "Bridge in progress"
                  : "Bridge submitted"}
              </p>
              <p className="mt-1 truncate font-mono text-xs text-emerald-800">
                {txHash}
              </p>
              {destinationTxHash ? (
                <p className="mt-1 truncate font-mono text-xs text-emerald-800">
                  Destination: {destinationTxHash}
                </p>
              ) : null}
              <a
                href="https://core.allbridge.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline"
              >
                Open Allbridge <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-center text-xs leading-5 text-slate-400">
        Your wallet approves and submits the transfer directly to Allbridge
        Core. SocketFi never controls your funds or private keys.
      </p>
    </div>
  );
}
