import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  Gauge,
  Loader2,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";
import { Address } from "@stellar/stellar-sdk";
import { useAccount, useConfig, usePublicClient, useSwitchChain } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { getAddress, isAddress, parseUnits } from "viem";

import { useStates } from "../context/StatesContext";
import {
  getCctpChains,
  getCctpStatus,
  prepareCctp,
  previewCctpFee,
  registerCctpBurn,
  type CctpChain,
  type CctpFeePreview,
  type CctpSpeed,
  type SocketFiNetwork,
} from "./cctp.client";
import { wagmiConfig } from "../evm/wagmi-config";

export type SupportedEvmChainId = (typeof wagmiConfig.chains)[number]["id"];

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "spender",
        type: "address",
      },
      {
        name: "amount",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
      },
    ],
  },
] as const;

const TOKEN_MESSENGER_ABI = [
  {
    type: "function",
    name: "depositForBurnWithHook",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "amount",
        type: "uint256",
      },
      {
        name: "destinationDomain",
        type: "uint32",
      },
      {
        name: "mintRecipient",
        type: "bytes32",
      },
      {
        name: "burnToken",
        type: "address",
      },
      {
        name: "destinationCaller",
        type: "bytes32",
      },
      {
        name: "maxFee",
        type: "uint256",
      },
      {
        name: "minFinalityThreshold",
        type: "uint32",
      },
      {
        name: "hookData",
        type: "bytes",
      },
    ],
    outputs: [
      {
        name: "nonce",
        type: "uint64",
      },
    ],
  },
] as const;

type Props = {
  destinationAccount: string;
  network: SocketFiNetwork;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (/rejected|denied|declined|user rejected/i.test(error.message)) {
      return "The wallet request was rejected.";
    }

    if (/chain.*not.*configured|unsupported chain/i.test(error.message)) {
      return "The selected network is not configured in the connected wallet.";
    }

    return error.message;
  }

  return "Unable to complete the CCTP transfer.";
}

function normalizeEvmAddress(value: string, label: string): `0x${string}` {
  const raw = String(value || "").trim();

  if (!isAddress(raw, { strict: false })) {
    throw new Error(`${label} is not a valid EVM address.`);
  }

  return getAddress(raw.toLowerCase());
}

function FeePreviewCard({
  preview,
  loading,
}: {
  preview: CctpFeePreview | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-800">
        <Loader2 className="h-4 w-4 animate-spin" />
        Refreshing Circle fee…
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {preview.speed === "FAST" ? (
            <Zap className="h-4 w-4 text-amber-600" />
          ) : (
            <Clock3 className="h-4 w-4 text-indigo-600" />
          )}

          <span className="text-sm font-semibold text-slate-900">
            {preview.speed === "FAST" ? "Fast transfer" : "Standard transfer"}
          </span>
        </div>

        <span className="text-xs font-medium text-slate-500">
          {preview.eta.label}
        </span>
      </div>

      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">You send</span>

          <span className="font-semibold text-slate-950">
            {preview.amount.formatted} USDC
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">Circle protocol fee ~</span>

          <span className="font-semibold text-slate-950">
            {preview.fee.formatted} USDC
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-2">
          <span className="text-slate-600">Account receives</span>

          <span className="font-semibold text-emerald-700">
            ≈ {preview.estimatedReceive.formatted} USDC
          </span>
        </div>
      </div>

      <p className="text-[11px] leading-5 text-slate-400">
        Fee rate: {preview.fee.minimumFeeBps} bps. Network gas is paid
        separately in the source chain&apos;s native token. {preview.disclaimer}
      </p>
    </div>
  );
}

export default function CircleCctpDeposit({ destinationAccount }: Props) {
  const { address, chainId, connector, isConnected } = useAccount();

  const wagmiConfig = useConfig();

  const { switchChainAsync, isPending: switching } = useSwitchChain();

  const {
    setLoginIsOpen,
    setWalletKitIsOpen,
    setEvmWalletIsOpen,
    selectedNetwork,
  } = useStates();

  const network = selectedNetwork;

  const [chains, setChains] = useState<CctpChain[]>([]);

  const [selectedChainId, setSelectedChainId] = useState<SupportedEvmChainId>(
    (chainId as SupportedEvmChainId) ?? 8453
  );

  const publicClient = usePublicClient({
    chainId: selectedChainId,
  });

  const [amount, setAmount] = useState("");
  const [speed, setSpeed] = useState<CctpSpeed>("STANDARD");

  const [loadingChains, setLoadingChains] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [preview, setPreview] = useState<CctpFeePreview | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);

  const previewRequest = useRef(0);

  const selected = useMemo(
    () => chains.find((item) => item.chainId === selectedChainId) || null,
    [chains, selectedChainId]
  );

  const amountValid = /^\d+(?:\.\d{1,6})?$/.test(amount) && Number(amount) > 0;

  const destinationValid = useMemo(() => {
    try {
      Address.fromString(destinationAccount);

      return destinationAccount.startsWith("C");
    } catch {
      return false;
    }
  }, [destinationAccount]);

  /*
   * Load available CCTP source chains whenever the selected
   * SocketFi network changes.
   */
  useEffect(() => {
    let active = true;

    setLoadingChains(true);
    setError("");

    getCctpChains(network)
      .then((next) => {
        if (!active) {
          return;
        }

        setChains(next);

        setSelectedChainId((current) => {
          if (chainId && next.some((item) => item.chainId === chainId)) {
            return chainId as SupportedEvmChainId;
          }

          if (next.some((item) => item.chainId === current)) {
            return current;
          }

          return next[0] ? (next[0].chainId as SupportedEvmChainId) : current;
        });
      })
      .catch((cause) => {
        if (active) {
          setError(errorMessage(cause));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingChains(false);
        }
      });

    return () => {
      active = false;
    };
  }, [network, chainId]);

  /*
   * Synchronize the selected source chain when the user manually
   * changes the active chain inside their wallet.
   *
   * Only synchronize when the wallet chain is one of the chains
   * supported by this CCTP flow.
   */
  useEffect(() => {
    if (!chainId || switching || submitting) {
      return;
    }

    const supported = chains.some((item) => item.chainId === chainId);

    if (supported && chainId !== selectedChainId) {
      setSelectedChainId(chainId as SupportedEvmChainId);
      setError("");
    }
  }, [chainId, chains, selectedChainId, switching, submitting]);

  /*
   * Refresh the fee preview when the source chain, amount,
   * transfer speed, or SocketFi network changes.
   */
  useEffect(() => {
    const requestId = ++previewRequest.current;
    const controller = new AbortController();

    if (!selected || !amountValid) {
      setPreview(null);
      setLoadingPreview(false);

      return () => controller.abort();
    }

    const timer = window.setTimeout(() => {
      setLoadingPreview(true);
      setError("");

      previewCctpFee({
        network,
        chainId: selected.chainId,
        amount,
        speed,
        signal: controller.signal,
      })
        .then((value) => {
          if (requestId === previewRequest.current) {
            setPreview(value);
          }
        })
        .catch((cause) => {
          if (controller.signal.aborted) {
            return;
          }

          if (requestId === previewRequest.current) {
            setPreview(null);
            setError(errorMessage(cause));
          }
        })
        .finally(() => {
          if (requestId === previewRequest.current) {
            setLoadingPreview(false);
          }
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [network, selected, amount, amountValid, speed]);

  function openWallet() {
    setLoginIsOpen(false);
    setWalletKitIsOpen(false);
    setEvmWalletIsOpen(true);
  }

  /*
   * Switch the connected wallet as soon as the user selects a
   * different source chain.
   */
  async function handleSourceChainChange(nextChainId: number): Promise<void> {
    setError("");
    setPhase("");

    const nextChain = chains.find((item) => item.chainId === nextChainId);

    if (!nextChain) {
      setError("The selected source network is unavailable.");
      return;
    }

    const configuredChain = wagmiConfig.chains.find(
      (item) => item.id === nextChainId
    );

    if (!configuredChain) {
      setError(`${nextChain.label} is not configured in Wagmi.`);
      return;
    }

    /*
     * No switch is needed when the wallet is already on the
     * selected chain.
     */
    if (chainId === nextChainId) {
      setSelectedChainId(nextChainId as SupportedEvmChainId);
      setPreview(null);
      return;
    }

    try {
      setPhase(`Switching wallet to ${nextChain.label}…`);

      const switchedChain = await switchChainAsync({
        chainId: nextChainId as SupportedEvmChainId,
      });

      /*
       * Some connectors return the switched chain. Validate it
       * before updating local state.
       */
      if (switchedChain?.id && switchedChain.id !== nextChainId) {
        throw new Error(`The wallet did not switch to ${nextChain.label}.`);
      }

      setSelectedChainId(nextChainId as SupportedEvmChainId);
      setPreview(null);
      setPhase("");
    } catch (cause) {
      console.error("[circle-cctp/switch-chain]", cause);

      setPhase("");
      setError(errorMessage(cause));
    }
  }

  /*
   * Ensure the wallet is on the required chain immediately before
   * submitting transactions.
   */
  async function ensureWalletChain(requiredChain: CctpChain): Promise<void> {
    const configuredChain = wagmiConfig.chains.find(
      (item) => item.id === requiredChain.chainId
    );

    if (!configuredChain) {
      throw new Error(`${requiredChain.label} is not configured in Wagmi.`);
    }

    if (chainId === requiredChain.chainId) {
      return;
    }

    setPhase(`Switching wallet to ${requiredChain.label}…`);

    const switchedChain = await switchChainAsync({
      chainId: requiredChain.chainId as SupportedEvmChainId,
    });

    if (switchedChain?.id && switchedChain.id !== requiredChain.chainId) {
      throw new Error(`The wallet did not switch to ${requiredChain.label}.`);
    }
  }

  async function poll(sessionId: string) {
    const deadline = Date.now() + 35 * 60_000;

    while (Date.now() < deadline) {
      const status = await getCctpStatus(sessionId);

      setResult(status);

      if (status.status === "SUCCESS") {
        return status;
      }

      if (status.status === "FAILED") {
        throw new Error(status.error || "The CCTP settlement failed.");
      }

      setPhase("Waiting for Circle attestation and Stellar mint…");

      await new Promise((resolve) => window.setTimeout(resolve, 5_000));
    }

    throw new Error("Timed out waiting for Stellar settlement.");
  }

  async function submit() {
    if (!destinationValid) {
      setError("Invalid SocketFi C... destination.");
      return;
    }

    if (!address || !connector || !selected) {
      setError("Connect an EVM wallet and select a source chain.");
      return;
    }

    if (!amountValid) {
      setError("Enter a valid USDC amount with at most 6 decimals.");
      return;
    }

    if (!preview) {
      setError("Wait for the fee preview before confirming the transfer.");
      return;
    }

    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      /*
       * Defensive chain check. The user may have manually changed
       * networks after selecting the source chain.
       */
      await ensureWalletChain(selected);

      const selectedViemChain = wagmiConfig.chains.find(
        (item) => item.id === selected.chainId
      );

      if (!selectedViemChain) {
        throw new Error(`${selected.label} is not configured in Wagmi.`);
      }

      const selectedPublicClient =
        publicClient ||
        wagmiConfig.getClient({
          chainId: selected.chainId as SupportedEvmChainId,
        });

      if (!selectedPublicClient) {
        throw new Error(
          `No public client is configured for ${selected.label}.`
        );
      }

      const activeWalletClient = await getWalletClient(wagmiConfig, {
        chainId: selected.chainId,
        connector,
      });

      if (activeWalletClient.chain?.id !== selected.chainId) {
        throw new Error(
          `The connected wallet is not active on ${selected.label}.`
        );
      }

      setPhase("Refreshing fee and preparing transfer…");

      const prepared = await prepareCctp({
        network,
        chainId: selected.chainId,
        sender: address,
        recipient: destinationAccount,
        amount,
        speed,
      });

      if (prepared.feePreview) {
        setPreview(prepared.feePreview);
      }

      const atomicAmount = parseUnits(amount, 6);

      const usdcAddress = normalizeEvmAddress(selected.usdc, "USDC contract");

      const messengerAddress = normalizeEvmAddress(
        selected.tokenMessengerV2,
        "TokenMessengerV2 contract"
      );

      setPhase("Approve USDC spending in your wallet…");

      const approveHash = await activeWalletClient.writeContract({
        account: address,
        chain: selectedViemChain,
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [messengerAddress, atomicAmount],
      });

      await selectedPublicClient.waitForTransactionReceipt({
        hash: approveHash,
      });

      setPhase("Confirm the CCTP burn in your wallet…");

      const burnHash = await activeWalletClient.writeContract({
        account: address,
        chain: selectedViemChain,
        address: messengerAddress,
        abi: TOKEN_MESSENGER_ABI,
        functionName: "depositForBurnWithHook",
        args: [
          BigInt(prepared.amount),
          prepared.destinationDomain,
          prepared.mintRecipient,
          usdcAddress,
          prepared.destinationCaller,
          BigInt(prepared.maxFee),
          prepared.minFinalityThreshold,
          prepared.hookData,
        ],
      });

      localStorage.setItem(
        "socketfi:cctp:pending",
        JSON.stringify({
          sessionId: prepared.sessionId,
          burnTxHash: burnHash,
          network,
          sourceChainId: selected.chainId,
          destinationAccount,
          createdAt: new Date().toISOString(),
        })
      );

      /*
       * Wait for the source-chain burn to succeed before registering
       * it with the backend.
       */
      setPhase("Waiting for the source-chain burn confirmation…");

      const burnReceipt = await selectedPublicClient.waitForTransactionReceipt({
        hash: burnHash,
      });

      if (burnReceipt.status !== "success") {
        throw new Error("The CCTP burn transaction failed.");
      }

      setPhase("Registering burn for settlement…");

      setResult(
        await registerCctpBurn({
          sessionId: prepared.sessionId,
          burnTxHash: burnHash,
        })
      );

      await poll(prepared.sessionId);

      localStorage.removeItem("socketfi:cctp:pending");

      setPhase("USDC delivered to SocketFi.");
      setAmount("");
      setPreview(null);
    } catch (cause) {
      console.error("[circle-cctp]", cause);
      setError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        onClick={openWallet}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
      >
        <Wallet className="h-4 w-4" />
        Connect EVM wallet
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />

          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-950">
              EVM wallet connected
            </p>

            <p className="truncate text-xs text-emerald-700">{address}</p>
          </div>
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Source network
        </span>

        <select
          value={selectedChainId}
          disabled={
            loadingChains || submitting || switching || chains.length === 0
          }
          onChange={(event) => {
            void handleSourceChainChange(Number(event.target.value));
          }}
          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingChains ? (
            <option value={selectedChainId}>Loading networks…</option>
          ) : chains.length === 0 ? (
            <option value={selectedChainId}>No supported networks</option>
          ) : (
            chains.map((item) => (
              <option
                key={`${item.chainId}-${item.label}`}
                value={item.chainId}
              >
                {item.label}
                {chainId === item.chainId ? " — connected" : ""}
              </option>
            ))
          )}
        </select>

        {switching ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-indigo-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Waiting for wallet network switch…
          </p>
        ) : selected && chainId !== selected.chainId ? (
          <p className="mt-2 text-xs text-amber-700">
            Wallet is currently connected to a different network.
          </p>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Amount (USDC)
        </span>

        <input
          value={amount}
          disabled={submitting || switching}
          onChange={(event) => {
            const value = event.target.value;

            if (value === "" || /^\d*\.?\d{0,6}$/.test(value)) {
              setAmount(value);
            }
          }}
          inputMode="decimal"
          placeholder="10.00"
          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <div>
        <span className="text-sm font-semibold text-slate-700">
          Transfer speed
        </span>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["STANDARD", "FAST"] as const).map((value) => {
            const active = speed === value;

            const disabled =
              submitting ||
              switching ||
              (value === "FAST" && preview?.fastAvailable === false);

            return (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() => setSpeed(value)}
                className={`rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  active
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {value === "FAST" ? (
                    <Zap className="h-4 w-4" />
                  ) : (
                    <Gauge className="h-4 w-4" />
                  )}

                  {value === "FAST" ? "Fast" : "Standard"}
                </div>

                <p
                  className={`mt-1 text-xs ${
                    active ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {value === "FAST"
                    ? "Faster, route fee may apply"
                    : "Finalized settlement, usually free"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <FeePreviewCard preview={preview} loading={loadingPreview} />

      <button
        type="button"
        disabled={
          submitting ||
          switching ||
          !selected ||
          !amountValid ||
          loadingPreview ||
          !preview ||
          chainId !== selected.chainId
        }
        onClick={() => void submit()}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting || switching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}

        {switching
          ? "Switching network…"
          : submitting
          ? "Processing CCTP transfer…"
          : "Bridge USDC to SocketFi"}
      </button>

      {phase ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          {phase}
        </div>
      ) : null}

      {result?.status === "SUCCESS" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
            <Check className="h-4 w-4" />
            USDC delivered
          </div>

          <div className="mt-3 grid gap-2">
            {result.sourceExplorerUrl ? (
              <a
                href={result.sourceExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"
              >
                Source burn
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}

            {result.stellarExplorerUrl ? (
              <a
                href={result.stellarExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"
              >
                Stellar mint and forward
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}
    </div>
  );
}
