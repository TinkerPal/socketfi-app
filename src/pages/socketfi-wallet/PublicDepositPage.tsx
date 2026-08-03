import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { Address } from "@stellar/stellar-sdk";

import { useStates } from "../../context/StatesContext";
import { postRequest } from "../../utils/fetch-functions";
import { WalletKitService } from "../../wallet-kit/services/global-service";
import EvmWalletModal from "../../evm/EvmWalletModal";
import CircleCctpDeposit from "../../client/CircleCctpDeposit";

type Network = "TESTNET" | "PUBLIC";

interface WalletKitOption {
  productId: string;
  productName: string;
  productUrl: string;
  productIcon: string;
  isAvailable: () => Promise<boolean>;
}

interface WalletLoginResult {
  address?: string;
  publicKey?: string;
  account?: string;
}

interface PrepareDepositResponse {
  xdr?: string;
  transactionXdr?: string;
  sessionId?: string;
  networkPassphrase?: string;
}

interface SubmitDepositResponse {
  data?: {
    txHash?: string;
  };
  txHash?: string;
}

function normalizeNetwork(value?: string): Network {
  return value?.toLowerCase() === "public" ? "PUBLIC" : "TESTNET";
}

function isValidAddress(value: string): boolean {
  try {
    Address.fromString(value);

    return true;
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to complete the request.";
}

async function resolveConnectedAddress(loginResult: unknown): Promise<string> {
  if (typeof loginResult === "string") {
    return loginResult;
  }

  const result = loginResult as WalletLoginResult;

  const directAddress = result?.address || result?.publicKey || result?.account;

  if (directAddress) {
    return directAddress;
  }

  const service = WalletKitService as unknown as {
    getAddress?: () => Promise<string | { address?: string }>;

    walletKit?: {
      getAddress?: () => Promise<string | { address?: string }>;
    };
  };

  if (typeof service.getAddress === "function") {
    const address = await service.getAddress();

    return typeof address === "string" ? address : address?.address || "";
  }

  if (typeof service.walletKit?.getAddress === "function") {
    const address = await service.walletKit.getAddress();

    return typeof address === "string" ? address : address?.address || "";
  }

  return "";
}

function getPreparedXdr(prepared?: PrepareDepositResponse | null): string {
  return prepared?.xdr || prepared?.transactionXdr || "";
}

function getTransactionExplorerUrl(
  network: Network,
  transactionHash: string
): string {
  const explorerNetwork = network === "PUBLIC" ? "public" : "testnet";

  return `https://stellar.expert/explorer/${explorerNetwork}/tx/${encodeURIComponent(
    transactionHash
  )}`;
}

function maskAddress(value: string, visible = 8): string {
  if (!value || value.length <= visible * 2 + 3) {
    return value;
  }

  return `${value.slice(0, visible)}…${value.slice(-visible)}`;
}

function StellarDepositPage() {
  const { address = "" } = useParams<{
    address: string;
  }>();

  const {
    setUserKey,
    setNetwork,
    selectedNetwork,
    evmWalletIsOpen,
    setEvmWalletIsOpen,
  } = useStates();

  const network = normalizeNetwork(selectedNetwork);

  const [tokenAddress, setTokenAddress] = useState("");

  const [amount, setAmount] = useState("");

  const [connectedAddress, setConnectedAddress] = useState("");

  const [connectedWalletName, setConnectedWalletName] = useState("");

  const [walletPickerOpen, setWalletPickerOpen] = useState(false);

  const [walletAvailability, setWalletAvailability] = useState<
    Map<string, boolean>
  >(new Map());

  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [copied, setCopied] = useState(false);

  const [message, setMessage] = useState("");

  const [transactionHash, setTransactionHash] = useState("");

  const [messageType, setMessageType] = useState<"success" | "error" | "info">(
    "info"
  );

  const walletOptions = useMemo(
    () => WalletKitService.walletKit.modules as WalletKitOption[],
    []
  );

  const validTarget = useMemo(
    () => isValidAddress(address) && address.startsWith("C"),
    [address]
  );

  const validToken = useMemo(
    () =>
      tokenAddress.trim() !== "" &&
      isValidAddress(tokenAddress.trim()) &&
      tokenAddress.trim().startsWith("C"),
    [tokenAddress]
  );

  const validAmount = useMemo(() => {
    const numericAmount = Number(amount);

    return (
      amount.trim() !== "" &&
      Number.isFinite(numericAmount) &&
      numericAmount > 0
    );
  }, [amount]);

  const canSubmit =
    validTarget &&
    validToken &&
    validAmount &&
    Boolean(connectedAddress) &&
    !isSubmitting;

  const transactionExplorerUrl = useMemo(
    () =>
      transactionHash
        ? getTransactionExplorerUrl(network, transactionHash)
        : "",
    [network, transactionHash]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      const results = await Promise.allSettled(
        walletOptions.map((option) => option.isAvailable())
      );

      if (cancelled) {
        return;
      }

      const availability = new Map<string, boolean>();

      results.forEach((result, index) => {
        availability.set(
          walletOptions[index].productName,
          result.status === "fulfilled" && result.value === true
        );
      });

      setWalletAvailability(availability);
    }

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [walletOptions]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 2_000);

    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(
      () => setMessage(""),
      messageType === "error" ? 6_000 : 4_000
    );

    return () => window.clearTimeout(timer);
  }, [message, messageType]);

  useEffect(() => {
    if (!walletPickerOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !connectingWallet) {
        setWalletPickerOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;

      window.removeEventListener("keydown", handleEscape);
    };
  }, [connectingWallet, walletPickerOpen]);

  function showMessage(type: "success" | "error" | "info", value: string) {
    setMessageType(type);
    setMessage(value);
  }

  function openWalletDownload(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function selectWallet(option: WalletKitOption) {
    const installed = walletAvailability.get(option.productName);

    if (!installed) {
      openWalletDownload(option.productUrl);

      return;
    }

    try {
      setConnectingWallet(option.productName);

      setMessage("");

      /*
       * This is the same integration used by the
       * existing SocketFi WalletKit modal.
       *
       * productId must be supplied. Calling login()
       * with no productId causes:
       * Wallet id "undefined" is not supported.
       */
      const loginResult = await WalletKitService.login(
        option.productId,
        setUserKey,
        setNetwork
      );

      const connected = await resolveConnectedAddress(loginResult);

      if (!connected) {
        throw new Error(
          "The selected Stellar wallet did not return an address."
        );
      }

      if (!isValidAddress(connected) || !connected.startsWith("G")) {
        throw new Error(
          "The selected wallet did not return a valid Stellar account address."
        );
      }

      setConnectedAddress(connected);

      setConnectedWalletName(option.productName);

      setWalletPickerOpen(false);

      showMessage("success", `${option.productName} connected.`);
    } catch (error) {
      console.error("[public-deposit/connect-wallet]", error);

      showMessage("error", getErrorMessage(error));
    } finally {
      setConnectingWallet(null);
    }
  }

  function disconnectWallet() {
    setConnectedAddress("");
    setConnectedWalletName("");
    setUserKey("");
    showMessage("info", "Wallet disconnected.");
  }

  async function submitDeposit() {
    if (!validTarget) {
      showMessage("error", "This SocketFi wallet address is invalid.");

      return;
    }

    if (!connectedAddress) {
      showMessage("error", "Connect a Stellar wallet first.");

      return;
    }

    if (!validToken) {
      showMessage("error", "Enter a valid token contract address.");

      return;
    }

    if (!validAmount) {
      showMessage("error", "Enter a valid amount greater than zero.");

      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setTransactionHash("");

    try {
      const prepared = (await postRequest("public-deposit-prepare", {
        network,
        stellarPublicKey: connectedAddress,
        walletAddress: address,
        tokenAddress: tokenAddress.trim(),
        amount: amount.trim(),
      })) as PrepareDepositResponse;

      const transactionXdr = getPreparedXdr(prepared);

      if (!prepared || !transactionXdr || !prepared.sessionId) {
        throw new Error("The deposit transaction could not be prepared.");
      }

      /*
       * WalletKitService.login(productId, ...)
       * selected and stored the active wallet module.
       * signTx therefore signs through that same wallet.
       */
      const signedXdr = await WalletKitService.signTx(transactionXdr, network);

      if (!signedXdr) {
        throw new Error(
          "The selected wallet did not return a signed transaction."
        );
      }

      const submitted = (await postRequest("public-deposit-submit", {
        network,
        signedTx: signedXdr,
        sessionId: prepared.sessionId,
      })) as SubmitDepositResponse;

      const transactionHash = submitted?.data?.txHash || submitted?.txHash;

      if (!transactionHash) {
        throw new Error(
          "The deposit completed, but the server did not return a transaction hash."
        );
      }

      setTransactionHash(transactionHash);
      showMessage("success", "Deposit completed successfully.");
      setAmount("");
    } catch (error) {
      console.error("[public-deposit/submit]", error);

      showMessage("error", getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);

      setCopied(true);
    } catch {
      showMessage("error", "Unable to copy the recipient address.");
    }
  }

  return (
    <main className="min-h-dvh bg-slate-50 p-4">
      <div className="mx-auto w-full max-w-[520px]">
        <section className="mt-2 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
          <header className="border-b border-slate-200 bg-gradient-to-br from-indigo-50 to-white px-6 py-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Wallet className="h-5 w-5" />
            </div>

            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
              Deposit to SocketFi
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Connect an external Stellar wallet and deposit directly into this
              SocketFi account.
            </p>
          </header>

          <div className="space-y-5 px-6 py-6">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                Recipient
              </p>

              <div className="mt-2 flex items-center gap-3">
                <p className="min-w-0 flex-1 break-all text-sm font-semibold text-slate-950">
                  {maskAddress(address, 12)}
                </p>

                <button
                  type="button"
                  onClick={() => void copyAddress()}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100"
                  aria-label="Copy recipient"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-700" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="mt-2 text-xs font-medium text-slate-500">
                {network}
              </p>
            </div>

            {!validTarget ? (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Invalid SocketFi wallet address.
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Token contract
              </span>

              <input
                value={tokenAddress}
                onChange={(event) => setTokenAddress(event.target.value)}
                placeholder="C..."
                spellCheck={false}
                autoComplete="off"
                className={`mt-2 h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none transition focus:ring-4 ${
                  tokenAddress && !validToken
                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                    : "border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
                }`}
              />

              {tokenAddress && !validToken ? (
                <p className="mt-1.5 text-xs font-medium text-rose-600">
                  Enter a valid token contract beginning with C.
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Amount
              </span>

              <input
                value={amount}
                onChange={(event) => {
                  const value = event.target.value;

                  if (value === "" || /^\d*\.?\d*$/.test(value)) {
                    setAmount(value);
                  }
                }}
                inputMode="decimal"
                placeholder="0.00"
                className={`mt-2 h-12 w-full rounded-2xl border bg-white px-4 text-sm outline-none transition focus:ring-4 ${
                  amount && !validAmount
                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                    : "border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
                }`}
              />

              {amount && !validAmount ? (
                <p className="mt-1.5 text-xs font-medium text-rose-600">
                  Enter an amount greater than zero.
                </p>
              ) : null}
            </label>

            {connectedAddress ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-emerald-900">
                      {connectedWalletName || "Stellar wallet"} connected
                    </p>

                    <p className="mt-0.5 truncate text-xs text-emerald-700">
                      {connectedAddress}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={disconnectWallet}
                    className="text-xs font-semibold text-emerald-800 underline underline-offset-2"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setWalletPickerOpen(true)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Wallet className="h-4 w-4" />
                Connect Stellar wallet
              </button>
            )}

            <button
              type="button"
              onClick={() => void submitDeposit()}
              disabled={!canSubmit}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  Deposit now
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {transactionHash && transactionExplorerUrl ? (
              <section
                role="status"
                aria-labelledby="deposit-success-title"
                className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50"
              >
                <div className="flex items-start gap-3 px-4 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200">
                    <Check className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2
                      id="deposit-success-title"
                      className="text-sm font-semibold text-emerald-950"
                    >
                      Deposit completed
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                      The transfer was confirmed on the {network} network.
                    </p>

                    <p
                      title={transactionHash}
                      className="mt-2 truncate font-mono text-[11px] text-emerald-700"
                    >
                      {transactionHash}
                    </p>
                  </div>
                </div>

                <div className="border-t border-emerald-200 bg-white/70 p-3">
                  <a
                    href={transactionExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2"
                  >
                    View on Stellar Expert
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </section>
            ) : null}

            {message && !(messageType === "success" && transactionHash) ? (
              <div
                role={messageType === "error" ? "alert" : "status"}
                className={`rounded-2xl border px-4 py-3 text-sm leading-5 ${
                  messageType === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : messageType === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                {message}
              </div>
            ) : null}

            <p className="text-center text-xs leading-5 text-slate-400">
              The connected Stellar wallet signs and pays for this deposit.
              SocketFi never receives its private key.
            </p>
          </div>
        </section>
      </div>

      {walletPickerOpen ? (
        <section
          className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-md sm:items-center sm:px-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !connectingWallet) {
              setWalletPickerOpen(false);
            }
          }}
          aria-labelledby="public-wallet-picker-title"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-[470px] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.24)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Wallet className="h-5 w-5" />
                </div>

                <h2
                  id="public-wallet-picker-title"
                  className="mt-4 text-xl font-semibold tracking-tight text-slate-950"
                >
                  Choose a Stellar wallet
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Select an installed wallet to fund this SocketFi account.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close wallet picker"
                disabled={Boolean(connectingWallet)}
                onClick={() => setWalletPickerOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-2 px-4 py-4 sm:px-5 sm:py-5">
              {walletOptions.map((option) => {
                const installed = walletAvailability.get(option.productName);

                const connecting = connectingWallet === option.productName;

                return (
                  <button
                    key={option.productId}
                    type="button"
                    disabled={Boolean(connectingWallet)}
                    onClick={() => void selectWallet(option)}
                    className="group flex w-full items-center gap-4 rounded-[20px] border border-transparent px-4 py-4 text-left transition hover:border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <img
                      src={option.productIcon}
                      alt=""
                      className="h-12 w-12 rounded-2xl border border-slate-200 object-cover"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-950">
                        {option.productName}
                      </span>

                      <span className="mt-1 block text-xs text-slate-500">
                        {connecting
                          ? "Connecting…"
                          : installed
                          ? "Installed"
                          : "Install wallet"}
                      </span>
                    </span>

                    {connecting ? (
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-700" />
                    ) : installed ? (
                      <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
                    ) : (
                      <Download className="h-5 w-5 text-slate-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

export default function PublicDepositPage() {
  const { evmWalletIsOpen, selectedNetwork } = useStates();
  const { address = "" } = useParams<{
    address: string;
  }>();
  const [fundingMethod, setFundingMethod] = useState<"stellar" | "cctp">(
    "stellar"
  );
  const network = normalizeNetwork(selectedNetwork);
  const validTarget = isValidAddress(address) && address.startsWith("C");

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto w-full max-w-[520px] px-4 pt-6 sm:px-6">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-200/70 p-1">
          <button
            type="button"
            onClick={() => setFundingMethod("stellar")}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              fundingMethod === "stellar"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Stellar wallet
          </button>
          <button
            type="button"
            onClick={() => setFundingMethod("cctp")}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              fundingMethod === "cctp"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Bridge via Circle CCTP
          </button>
        </div>
      </div>

      {fundingMethod === "stellar" ? (
        <StellarDepositPage />
      ) : (
        <main className="px-4 pb-6 sm:px-6">
          <div className="mx-auto w-full max-w-[520px]">
            <section className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
              <header className="border-b border-slate-200 bg-gradient-to-br from-indigo-50 to-white px-6 py-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Wallet className="h-5 w-5" />
                </div>
                <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                  Bridge to SocketFi
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Burn USDC on supported EVM chains and mint it directly into
                  this smart account.
                </p>
              </header>

              <div className="space-y-5 px-6 py-6">
                <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                    Recipient
                  </p>
                  <p className="mt-2 break-all text-sm font-semibold text-slate-950">
                    {maskAddress(address, 12)}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {network}
                  </p>
                </div>

                {!validTarget ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    Invalid SocketFi smart-account address.
                  </div>
                ) : (
                  <>
                    {" "}
                    {evmWalletIsOpen ? (
                      <EvmWalletModal />
                    ) : (
                      <CircleCctpDeposit
                        destinationAccount={address}
                        network={selectedNetwork}
                      />
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
