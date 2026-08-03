import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeftRight,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { CloseCircle } from "iconsax-react";
import { useSocketFi } from "@socketfi/react";
import {
  useAccount,
  useConnectors,
  useReconnect,
  useSignMessage,
  type Connector,
} from "wagmi";
import {
  Address,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";

import { WalletToken, useStates } from "../../context/StatesContext";
import { WalletKitService } from "../../wallet-kit/services/global-service";

import TokenSelectorModal from "../swaps/TokenSelectorModal";

type Network = "TESTNET" | "PUBLIC";
type WalletConnectionMethod = "passkey" | "stellar" | "evm";

export interface SwapToken {
  id?: string;
  address?: string;
  contract?: string;
  symbol?: string;
  name?: string;
  icon?: string | null;
  decimals?: number;
  balance?: string | number | null;
}

interface SwapQuote {
  network: Network;
  routerContractId: string;
  tokenIn: string;
  tokenOut: string;
  amountInAtomic: string;
  quotedOutAtomic: string;
  minimumOutAtomic: string;
  swapChainXdr: string;
  pools: string[];
  tokens: string[];
  slippageBps: number;
  quotedAt: string;
  expiresAt: string;
}

interface SocketFiSession {
  accessToken?: string;
  socketfiAccessToken?: string;
  connectionMethod?: WalletConnectionMethod;
  authMethod?: WalletConnectionMethod;
  walletType?: WalletConnectionMethod;
  stellarSigner?: string;
  stellarPublicKey?: string;
  evmAddress?: `0x${string}`;
  evmConnectorId?: string;
  evmConnectorType?: string;
  evmConnectorName?: string;
  userProfile?: {
    userId?: string;
    connectionMethod?: WalletConnectionMethod;
    authMethod?: WalletConnectionMethod;
    walletType?: WalletConnectionMethod;
    stellarSigner?: string;
    stellarPublicKey?: string;
    evmAddress?: `0x${string}`;
    evmConnectorId?: string;
    evmConnectorType?: string;
    evmConnectorName?: string;
    address?: Partial<Record<Network, string>>;
  };
}

interface DirectPreparation {
  sessionId: string;
  transactionXdr: string;
  unsignedAuthEntryXdr: string;
  authPreimageXdr: string;
  signatureExpirationLedger: number;
  networkPassphrase: string;
  rpcUrl: string;
}

interface EvmPreparation {
  sessionId: string;
  signaturePayloadHex: `0x${string}`;
  evmAddress?: `0x${string}`;
  walletAddress?: string;
  network?: Network;
}

interface SwapSuccessState {
  transactionHash: string;
  amountIn: string;
  amountOut: string;
  minimumOut: string;
  symbolIn: string;
  symbolOut: string;
  rate: string;
  slippageBps: number;
  poolCount: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tokens: SwapToken[];
}

const SERVER_URL = (
  import.meta.env.VITE_SERVER_DIRECT_URL ||
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL ||
  "http://localhost:3200"
).replace(/\/$/, "");

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to complete swap.";
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.message ||
        `Request failed (${response.status})`
    );
  }
  return payload as T;
}

function tokenContract(token?: SwapToken | null): string {
  return String(token?.contract || token?.address || token?.id || "").trim();
}

function tokenSymbol(token?: SwapToken | null): string {
  return String(token?.symbol || token?.name || "TOKEN")
    .trim()
    .toUpperCase();
}

function decimals(token?: SwapToken | null): number {
  const value = Number(token?.decimals ?? 7);
  return Number.isInteger(value) && value >= 0 && value <= 18 ? value : 7;
}

function decimalToAtomic(value: string, places: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized))
    throw new Error("Enter a valid amount.");
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > places)
    throw new Error(`Maximum ${places} decimal places.`);
  const result =
    BigInt(whole) * 10n ** BigInt(places) +
    BigInt(fraction.padEnd(places, "0") || "0");
  if (result <= 0n) throw new Error("Amount must be greater than zero.");
  return result;
}

function atomicToDecimal(value: string, places: number): string {
  const digits = BigInt(value || "0")
    .toString()
    .padStart(places + 1, "0");
  const whole = digits.slice(0, -places) || "0";
  const fraction = places ? digits.slice(-places).replace(/0+$/, "") : "";
  return fraction ? `${whole}.${fraction}` : whole;
}

function formatRate(amountIn: string, amountOut: string): string {
  const input = Number(amountIn);
  const output = Number(amountOut);
  if (!Number.isFinite(input) || !Number.isFinite(output) || input <= 0)
    return "—";
  return new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 8,
  }).format(output / input);
}

function getConnectionMethod(
  session: SocketFiSession | undefined,
  stellarSigner: string
): WalletConnectionMethod {
  const method =
    session?.connectionMethod ??
    session?.authMethod ??
    session?.walletType ??
    session?.userProfile?.connectionMethod ??
    session?.userProfile?.authMethod ??
    session?.userProfile?.walletType;
  if (method === "evm" || method === "stellar" || method === "passkey")
    return method;
  return stellarSigner ? "stellar" : "passkey";
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeStellarSignature(result: unknown): Uint8Array {
  if (result instanceof Uint8Array && result.length === 64) return result;
  let value: unknown = result;
  if (result && typeof result === "object") {
    const object = result as any;
    value =
      object.signedAuthEntry ??
      object.signature ??
      object.data?.signedAuthEntry ??
      object.data?.signature;
  }
  if (typeof value !== "string")
    throw new Error("Stellar wallet returned no authorization signature.");
  if (/^[0-9a-fA-F]{128}$/.test(value)) {
    return Uint8Array.from(
      value.match(/.{2}/g)!.map((pair) => parseInt(pair, 16))
    );
  }
  const first = decodeBase64(value);
  if (first.length === 64) return first;
  const nested = new TextDecoder().decode(first).trim();
  const second = decodeBase64(nested);
  if (second.length !== 64)
    throw new Error("Invalid Stellar authorization signature length.");
  return second;
}

function walletAuthScVal(signature: Uint8Array): xdr.ScVal {
  const inner = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signature"),
      val: xdr.ScVal.scvBytes(signature as any),
    }),
  ]);
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Stellar"), inner]);
}

function signedAuthEntry(prepared: DirectPreparation, signature: Uint8Array) {
  const unsigned = xdr.SorobanAuthorizationEntry.fromXDR(
    prepared.unsignedAuthEntryXdr,
    "base64"
  );
  const credentials = unsigned.credentials().address();
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: credentials.address(),
        nonce: credentials.nonce(),
        signatureExpirationLedger: prepared.signatureExpirationLedger,
        signature: walletAuthScVal(signature),
      })
    ),
    rootInvocation: unsigned.rootInvocation(),
  });
}

function injectAuth(
  transactionXdr: string,
  passphrase: string,
  walletAddress: string,
  authEntry: xdr.SorobanAuthorizationEntry
) {
  const transaction = TransactionBuilder.fromXDR(transactionXdr, passphrase);
  const envelope = transaction.toEnvelope();
  const operations = envelope.v1().tx().operations();
  if (operations.length !== 1)
    throw new Error("Expected one Soroban operation.");
  const invoke = operations[0].body().invokeHostFunctionOp();
  let replaced = false;
  const entries = (invoke.auth() || []).map((entry) => {
    try {
      const address = Address.fromScAddress(
        entry.credentials().address().address()
      ).toString();
      if (address !== walletAddress) return entry;
      replaced = true;
      return authEntry;
    } catch {
      return entry;
    }
  });
  if (!replaced) entries.push(authEntry);
  invoke.auth(entries);
  return TransactionBuilder.fromXDR(envelope.toXDR("base64"), passphrase);
}

function buildSwapArgs(wallet: string, quote: SwapQuote): string[] {
  return [
    nativeToScVal(wallet, { type: "address" }),
    xdr.ScVal.fromXDR(quote.swapChainXdr, "base64"),
    nativeToScVal(quote.tokenIn, { type: "address" }),
    nativeToScVal(BigInt(quote.amountInAtomic), { type: "u128" }),
    nativeToScVal(BigInt(quote.minimumOutAtomic), { type: "u128" }),
  ].map((value) => value.toXDR("base64"));
}

function normalizedEvmAddress(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function connectorMatches(
  connector: Connector,
  expectedId?: string,
  expectedType?: string,
  expectedName?: string
): boolean {
  const connectorId = connector.id.toLowerCase();
  const connectorType = String(connector.type || "").toLowerCase();
  const connectorName = connector.name.toLowerCase();

  return Boolean(
    (expectedId && connectorId === expectedId.toLowerCase()) ||
      (expectedType && connectorType === expectedType.toLowerCase()) ||
      (expectedName && connectorName === expectedName.toLowerCase())
  );
}

function selectReconnectConnectors(
  connectors: readonly Connector[],
  currentConnector: Connector | undefined,
  expectedId?: string,
  expectedType?: string,
  expectedName?: string
): readonly Connector[] {
  const expected = connectors.find((connector) =>
    connectorMatches(connector, expectedId, expectedType, expectedName)
  );

  if (expected) return [expected];

  if (currentConnector) {
    const configuredCurrent = connectors.find(
      (connector) => connector.uid === currentConnector.uid
    );
    if (configuredCurrent) return [configuredCurrent];
  }

  // With one configured connector, reconnect it directly. When older SocketFi
  // sessions do not yet store a connector id and several connectors exist,
  // Wagmi safely checks its persisted authorized connectors. We still verify
  // that the returned account is the exact SocketFi-linked EVM address.
  return connectors.length === 1 ? [connectors[0]] : connectors;
}

function transactionHash(value: any): string {
  return (
    value?.txHash ||
    value?.hash ||
    value?.transactionHash ||
    value?.data?.txHash ||
    value?.data?.hash ||
    ""
  );
}

function transactionExplorerUrl(network: Network, hash: string): string {
  return `https://stellar.expert/explorer/${
    network === "PUBLIC" ? "public" : "testnet"
  }/tx/${hash}`;
}

function SwapSuccess({
  network,
  result,
  onClose,
  closeSwap,
  onSwapAgain,
}: {
  network: Network;
  result: SwapSuccessState;
  onClose: () => void;
  closeSwap: () => void;
  onSwapAgain: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const explorerUrl = transactionExplorerUrl(network, result.transactionHash);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyHash() {
    await navigator.clipboard.writeText(result.transactionHash);
    setCopied(true);
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="swap-success-title"
      className="w-full max-w-[520px] overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
    >
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
        <div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Check className="h-6 w-6" />
          </span>
          <h2
            id="swap-success-title"
            className="mt-4 text-xl font-semibold tracking-tight text-slate-950"
          >
            Swap submitted
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Your Aquarius swap was submitted successfully to the Stellar
            network.
          </p>
        </div>
        <button
          type="button"
          onClick={closeSwap}
          aria-label="Close swap result"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
        >
          <CloseCircle className="h-6 w-6" />
        </button>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
              You paid
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              {result.amountIn} {result.symbolIn}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-emerald-700">
              Estimated received
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              {result.amountOut} {result.symbolOut}
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex items-start justify-between gap-4">
            <span className="text-slate-500">Rate</span>
            <span className="text-right font-semibold text-slate-950">
              1 {result.symbolIn} = {result.rate} {result.symbolOut}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-slate-500">Minimum received</span>
            <span className="text-right font-semibold text-slate-950">
              {result.minimumOut} {result.symbolOut}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-slate-500">Slippage tolerance</span>
            <span className="font-semibold text-slate-950">
              {(result.slippageBps / 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-slate-500">Aquarius route</span>
            <span className="font-semibold text-slate-950">
              {result.poolCount} pool{result.poolCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-slate-500">Network</span>
            <span className="font-semibold text-slate-950">{network}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm">
              <ExternalLink className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-950">
                Transaction explorer
              </p>
              <p className="mt-1 break-all text-xs leading-5 text-slate-500">
                {result.transactionHash.slice(0, 15)}…
                {result.transactionHash.slice(-10)}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copyHash()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}{" "}
              {copied ? "Copied" : "Copy hash"}
            </button>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
            >
              <ExternalLink className="h-4 w-4" /> View transaction
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSwapAgain}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            Swap again
          </button>
          <button
            type="button"
            onClick={closeSwap}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
          >
            Done
          </button>
        </div>
      </div>
    </section>
  );
}

export default function AquariusSwapModal({ open, onClose, tokens }: Props) {
  const socketfi = useSocketFi();
  const {
    address: connectedEvmAddress,
    connector: connectedEvmConnector,
    isConnected: isEvmConnected,
  } = useAccount();
  const connectors = useConnectors();
  const { reconnectAsync } = useReconnect();
  const { signMessageAsync } = useSignMessage();
  const {
    selectedNetwork,
    activeSession,
    userKey,
    triggerUpdate,
    toast,
    setSessionId,
    swapDappTokenSelectorIsOpen,
    setSwapDappTokenSelectorIsOpen,
    setToOrFrom,
    setDappTokenIn,
    setDappTokenOut,
  } = useStates();

  function closeSwap() {
    setSuccess(null);
    setAmount("");
    setQuote(null);
    setError("");
    setPhase("");
    onClose();
  }
  const network = (
    String(selectedNetwork).toUpperCase() === "PUBLIC" ? "PUBLIC" : "TESTNET"
  ) as Network;
  const session = activeSession as SocketFiSession | undefined;
  const walletAddress = session?.userProfile?.address?.[network] || "";
  const stellarSigner =
    session?.stellarSigner ||
    session?.stellarPublicKey ||
    session?.userProfile?.stellarSigner ||
    session?.userProfile?.stellarPublicKey ||
    userKey ||
    "";
  const storedEvmAddress =
    session?.evmAddress || session?.userProfile?.evmAddress || "";
  const storedEvmConnectorId =
    session?.evmConnectorId || session?.userProfile?.evmConnectorId || "";
  const storedEvmConnectorType =
    session?.evmConnectorType || session?.userProfile?.evmConnectorType || "";
  const storedEvmConnectorName =
    session?.evmConnectorName || session?.userProfile?.evmConnectorName || "";
  const accessToken =
    session?.accessToken || session?.socketfiAccessToken || "";
  const connectionMethod = getConnectionMethod(session, stellarSigner);

  const usableTokens = useMemo(
    () => tokens.filter((token) => tokenContract(token).startsWith("C")),
    [tokens]
  );
  const [customTokens, setCustomTokens] = useState<SwapToken[]>([]);
  const selectableTokens = useMemo(() => {
    const seen = new Set<string>();
    return [...usableTokens, ...customTokens].filter((token) => {
      const contract = tokenContract(token).toUpperCase();
      if (!contract || seen.has(contract)) return false;
      seen.add(contract);
      return true;
    });
  }, [usableTokens, customTokens]);
  const [tokenInId, setTokenInId] = useState("");
  const [tokenOutId, setTokenOutId] = useState("");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [showSettings, setShowSettings] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<"in" | "out" | null>(
    null
  );
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("");
  const [success, setSuccess] = useState<SwapSuccessState | null>(null);
  const quoteRequest = useRef(0);

  const tokenIn =
    selectableTokens.find((token) => tokenContract(token) === tokenInId) ||
    selectableTokens[0] ||
    null;
  const tokenOut =
    selectableTokens.find((token) => tokenContract(token) === tokenOutId) ||
    selectableTokens.find(
      (token) => tokenContract(token) !== tokenContract(tokenIn)
    ) ||
    null;
  const amountNumber = Number(amount);
  const balance = Number(tokenIn?.balance || 0);
  const amountValid =
    /^\d+(?:\.\d+)?$/.test(amount) &&
    amountNumber > 0 &&
    amountNumber <= balance;
  const quotedOut =
    quote && tokenOut
      ? atomicToDecimal(quote.quotedOutAtomic, decimals(tokenOut))
      : "";
  const minimumOut =
    quote && tokenOut
      ? atomicToDecimal(quote.minimumOutAtomic, decimals(tokenOut))
      : "";

  function toWalletToken(token: SwapToken): WalletToken {
    return {
      ...token,
    };
  }

  useEffect(() => {
    if (!open) return;
    const first = selectableTokens[0];
    const second = selectableTokens.find(
      (token) => tokenContract(token) !== tokenContract(first)
    );
    setTokenInId((current) =>
      current && usableTokens.some((token) => tokenContract(token) === current)
        ? current
        : tokenContract(first)
    );
    setTokenOutId((current) =>
      current && usableTokens.some((token) => tokenContract(token) === current)
        ? current
        : tokenContract(second)
    );
  }, [open, selectableTokens]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (swapDappTokenSelectorIsOpen) return;
      onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, swapDappTokenSelectorIsOpen]);

  useEffect(() => {
    if (!open && swapDappTokenSelectorIsOpen) {
      // setSwapDappTokenSelectorIsOpen(false);
      setSelectorTarget(null);
    }
  }, [open, swapDappTokenSelectorIsOpen, setSwapDappTokenSelectorIsOpen]);

  useEffect(() => {
    const requestId = ++quoteRequest.current;
    const controller = new AbortController();
    setQuote(null);
    setError("");

    if (
      !open ||
      !tokenIn ||
      !tokenOut ||
      tokenContract(tokenIn) === tokenContract(tokenOut) ||
      !amountValid
    ) {
      setQuoteLoading(false);
      return () => controller.abort();
    }

    const timer = window.setTimeout(async () => {
      setQuoteLoading(true);
      try {
        const amountAtomic = decimalToAtomic(
          amount,
          decimals(tokenIn)
        ).toString();
        const response = await fetch(`${SERVER_URL}/api/aquarius-swap/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            network,
            walletAddress,
            tokenIn: tokenContract(tokenIn),
            tokenOut: tokenContract(tokenOut),
            amountAtomic,
            slippageBps,
          }),
        });
        const result = await readJson<{ data: SwapQuote }>(response);
        if (requestId === quoteRequest.current) setQuote(result.data);
      } catch (cause) {
        if (!controller.signal.aborted && requestId === quoteRequest.current)
          setError(errorMessage(cause));
      } finally {
        if (requestId === quoteRequest.current) setQuoteLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, network, tokenInId, tokenOutId, amount, slippageBps, amountValid]);

  function openTokenSelector(target: "in" | "out") {
    setSelectorTarget(target);
    setToOrFrom(target === "in" ? "from" : "to");

    if (tokenIn) {
      setDappTokenIn(toWalletToken(tokenIn));
    }

    if (tokenOut) {
      setDappTokenOut(toWalletToken(tokenOut));
    }

    setSwapDappTokenSelectorIsOpen(true);
  }

  function reverseTokens() {
    setTokenInId(tokenContract(tokenOut));
    setTokenOutId(tokenContract(tokenIn));
    setAmount("");
    setQuote(null);
  }

  async function submitWithStellar(argsXdr: string[]) {
    const prepared = await readJson<DirectPreparation>(
      await fetch(`${SERVER_URL}/api/stellar-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          network,
          stellarPublicKey: stellarSigner,
          walletAddress,
          contractId: quote!.routerContractId,
          callFunction: { name: "swap_chained" },
          argsXdr,
        }),
      })
    );

    const rawSignature = decodeStellarSignature(
      await WalletKitService.signAuthEntry(
        prepared.authPreimageXdr,
        network,
        stellarSigner
      )
    );
    const authEntry = signedAuthEntry(prepared, rawSignature);
    let transaction = injectAuth(
      prepared.transactionXdr,
      prepared.networkPassphrase,
      walletAddress,
      authEntry
    );
    const server = new rpc.Server(prepared.rpcUrl);
    const simulation = await server.simulateTransaction(transaction);
    if (rpc.Api.isSimulationError(simulation))
      throw new Error(`Swap simulation failed: ${simulation.error}`);
    transaction = rpc.assembleTransaction(transaction, simulation).build();
    transaction = injectAuth(
      transaction.toXDR(),
      prepared.networkPassphrase,
      walletAddress,
      authEntry
    );
    const signedTransactionXdr = await WalletKitService.signTx(
      transaction.toXDR(),
      network
    );
    return readJson<any>(
      await fetch(`${SERVER_URL}/api/stellar-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          sessionId: prepared.sessionId,
          signedTransactionXdr,
          txDetails: {
            type: "swap",
            walletContractId: walletAddress,
            network,
            amountIn: amount,
            amountOutMinimum: minimumOut,
            tokenIn: tokenContract(tokenIn),
            tokenOut: tokenContract(tokenOut),
            symbolIn: tokenSymbol(tokenIn),
            symbolOut: tokenSymbol(tokenOut),
            router: quote!.routerContractId,
          },
        }),
      })
    );
  }

  async function submitWithEvm(argsXdr: string[]) {
    if (!storedEvmAddress) {
      throw new Error("This SocketFi account has no linked EVM address.");
    }

    const expectedAddress = normalizedEvmAddress(storedEvmAddress);
    let signingAddress = connectedEvmAddress;

    if (
      !isEvmConnected ||
      !signingAddress ||
      normalizedEvmAddress(signingAddress) !== expectedAddress
    ) {
      setPhase("Reconnecting the EVM wallet linked to this account…");

      const reconnectConnectors = selectReconnectConnectors(
        connectors,
        connectedEvmConnector,
        storedEvmConnectorId,
        storedEvmConnectorType,
        storedEvmConnectorName
      );

      if (reconnectConnectors.length === 0) {
        throw new Error(
          "The EVM wallet connector linked to this SocketFi account is unavailable."
        );
      }

      const reconnected = await reconnectAsync();

      console.log("the reconnected is", reconnected);

      const reconnectedAddress = reconnected[0].accounts.find(
        (account) => normalizedEvmAddress(account) === expectedAddress
      );

      const connection = reconnected[0];

      if (!connection) {
        throw new Error("The linked EVM wallet did not reconnect.");
      }

      const activeAddress = connection.accounts[0];

      if (!reconnectedAddress) {
        throw new Error(
          activeAddress
            ? `Wrong EVM account active. Switch ${
                connection.connector.name
              } to ${storedEvmAddress.slice(0, 6)}…${storedEvmAddress.slice(
                -4
              )} and try again.`
            : "The linked EVM wallet did not return an account."
        );
      }

      signingAddress = reconnectedAddress;
    }

    setPhase("Preparing the EVM swap authorization…");

    const prepared = await readJson<EvmPreparation>(
      await fetch(`${SERVER_URL}/api/evm-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare",
          network,
          evmAddress: storedEvmAddress.toLowerCase(),
          walletAddress,
          contractId: quote!.routerContractId,
          callFunction: { name: "swap_chained" },
          argsXdr,
        }),
      })
    );
    setPhase("Approve the swap in your EVM wallet…");
    const signature = await signMessageAsync({
      account: signingAddress!,
      message: { raw: prepared.signaturePayloadHex },
    });
    return readJson<any>(
      await fetch(`${SERVER_URL}/api/evm-transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          sessionId: prepared.sessionId,
          signature,
          txDetails: {
            type: "swap",
            walletContractId: walletAddress,
            network,
            amountIn: amount,
            amountOutMinimum: minimumOut,
            tokenIn: tokenContract(tokenIn),
            tokenOut: tokenContract(tokenOut),
            symbolIn: tokenSymbol(tokenIn),
            symbolOut: tokenSymbol(tokenOut),
            router: quote!.routerContractId,
          },
        }),
      })
    );
  }

  async function submitSwap() {
    if (!quote || !tokenIn || !tokenOut || !walletAddress) return;
    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      setError("Quote expired. Refresh the quote and try again.");
      return;
    }
    setSubmitting(true);
    setError("");
    setPhase("Preparing the Aquarius swap…");
    const localSessionId = crypto.randomUUID();
    setSessionId(localSessionId);
    try {
      const argsXdr = buildSwapArgs(walletAddress, quote);
      let result: any;
      if (connectionMethod === "passkey") {
        if (!accessToken)
          throw new Error("Your SocketFi session expired. Sign in again.");
        result = await socketfi.signAndSubmitTx({
          contractId: quote.routerContractId,
          callFunction: { name: "swap_chained" },
          argsXdr,
          accessToken,
          displayMode: "full",
          description: `Swap ${amount} ${tokenSymbol(
            tokenIn
          )} for ${tokenSymbol(tokenOut)} on Aquarius`,
          values: [
            { key: "You pay", value: `${amount} ${tokenSymbol(tokenIn)}` },
            {
              key: "Minimum received",
              value: `${minimumOut} ${tokenSymbol(tokenOut)}`,
            },
            { key: "Slippage", value: `${(slippageBps / 100).toFixed(2)}%` },
            {
              key: "Route",
              value: `${quote.pools.length} pool${
                quote.pools.length === 1 ? "" : "s"
              }`,
            },
          ],
        });
      } else if (connectionMethod === "stellar") {
        if (!stellarSigner)
          throw new Error(
            "Reconnect the Stellar wallet linked to this account."
          );
        setPhase("Approve the swap in your Stellar wallet…");
        result = await submitWithStellar(argsXdr);
      } else {
        setPhase("Approve the swap in your EVM wallet…");
        result = await submitWithEvm(argsXdr);
      }
      const hash = transactionHash(result);
      if (!hash)
        throw new Error("Swap submitted but no transaction hash was returned.");
      setDappTokenIn(null);
      setDappTokenOut(null);
      setSuccess({
        transactionHash: hash,
        amountIn: amount,
        amountOut: quotedOut,
        minimumOut,
        symbolIn: tokenSymbol(tokenIn),
        symbolOut: tokenSymbol(tokenOut),
        rate: formatRate(amount, quotedOut),
        slippageBps,
        poolCount: quote.pools.length,
      });
      setPhase("");
      triggerUpdate();
    } catch (cause) {
      console.error("[aquarius-swap]", cause);
      setError(errorMessage(cause));
      toast.error(errorMessage(cause));
    } finally {
      setSubmitting(false);
      setSessionId("");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/45 backdrop-blur-md"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4">
        {success ? (
          <SwapSuccess
            network={network}
            result={success}
            onClose={onClose}
            closeSwap={closeSwap}
            onSwapAgain={() => {
              setSuccess(null);
              setAmount("");
              setQuote(null);
              setError("");
              setPhase("");
            }}
          />
        ) : (
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="swap-title"
            className="w-full max-w-[520px] overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
          >
            <header className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-700 text-white">
                  <ArrowLeftRight className="h-6 w-6" />
                </span>
                <h2
                  id="swap-title"
                  className="mt-4 text-xl font-semibold text-slate-950"
                >
                  Swap assets
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Best-path swap through Aquarius, protected by your slippage
                  limit.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close swap"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500"
              >
                <CloseCircle className="h-6 w-6" />
              </button>
            </header>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              {success ? null : (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        You pay
                      </span>
                      <span className="text-xs text-slate-500">
                        Balance {balance || 0}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-3">
                      <input
                        value={amount}
                        onChange={(event) =>
                          /^\d*\.?\d*$/.test(event.target.value) &&
                          setAmount(event.target.value)
                        }
                        placeholder="0.0"
                        inputMode="decimal"
                        className="min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => openTokenSelector("in")}
                        className="inline-flex max-w-[190px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                      >
                        {tokenIn?.icon ? (
                          <img
                            src={tokenIn.icon}
                            alt=""
                            className="h-6 w-6 rounded-full"
                          />
                        ) : null}
                        <span className="truncate">{tokenSymbol(tokenIn)}</span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAmount(String(balance || ""))}
                      className="mt-2 text-xs font-semibold text-indigo-700"
                    >
                      Max
                    </button>
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={reverseTokens}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      You receive (estimated)
                    </span>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1 text-2xl font-semibold text-slate-950">
                        {quoteLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          quotedOut || "0.0"
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openTokenSelector("out")}
                        className="inline-flex max-w-[190px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                      >
                        {tokenOut?.icon ? (
                          <img
                            src={tokenOut.icon}
                            alt=""
                            className="h-6 w-6 rounded-full"
                          />
                        ) : null}
                        <span className="truncate">
                          {tokenSymbol(tokenOut)}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSettings((value) => !value)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
                  >
                    <Settings2 className="h-4 w-4" /> Slippage{" "}
                    {(slippageBps / 100).toFixed(2)}%
                  </button>
                  {showSettings ? (
                    <div className="grid grid-cols-4 gap-2">
                      {[10, 50, 100].map((bps) => (
                        <button
                          key={bps}
                          type="button"
                          onClick={() => setSlippageBps(bps)}
                          className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                            slippageBps === bps
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-200"
                          }`}
                        >
                          {bps / 100}%
                        </button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={slippageBps}
                        onChange={(event) =>
                          setSlippageBps(
                            Math.max(
                              1,
                              Math.min(500, Number(event.target.value) || 1)
                            )
                          )
                        }
                        className="rounded-xl border border-slate-200 px-2 text-sm"
                      />
                    </div>
                  ) : null}

                  {quote ? (
                    <div className="space-y-2 rounded-2xl border border-slate-200 p-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Rate</span>
                        <span className="font-semibold">
                          1 {tokenSymbol(tokenIn)} ={" "}
                          {formatRate(amount, quotedOut)}{" "}
                          {tokenSymbol(tokenOut)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Minimum received</span>
                        <span className="font-semibold">
                          {minimumOut} {tokenSymbol(tokenOut)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Route</span>
                        <span className="font-semibold">
                          {quote.pools.length} pool
                          {quote.pools.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Price impact</span>
                        <span className="text-slate-400">
                          Included in quote
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {error ? (
                    <div
                      role="alert"
                      className="flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  ) : null}
                  {phase ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {phase}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => quote && void submitSwap()}
                    disabled={
                      !quote ||
                      quoteLoading ||
                      submitting ||
                      !amountValid ||
                      tokenContract(tokenIn) === tokenContract(tokenOut)
                    }
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : quoteLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowLeftRight className="h-4 w-4" />
                    )}
                    {submitting
                      ? "Swapping…"
                      : quoteLoading
                      ? "Fetching best rate…"
                      : "Swap assets"}
                  </button>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      <TokenSelectorModal
        onClose={() => {
          setSelectorTarget(null);
          setSwapDappTokenSelectorIsOpen(false);
        }}
        onSelect={(selectedToken) => {
          const selected = selectedToken as SwapToken;
          const contract = tokenContract(selected);

          if (!contract) {
            setError("The selected asset has no contract address.");
            return;
          }

          if (
            !selectableTokens.some(
              (token) =>
                tokenContract(token).toUpperCase() === contract.toUpperCase()
            )
          ) {
            setCustomTokens((current) => [...current, selected]);
          }

          if (selectorTarget === "in") {
            setTokenInId(contract);
            setAmount("");
          } else if (selectorTarget === "out") {
            setTokenOutId(contract);
          }

          setQuote(null);
          setError("");
          setSelectorTarget(null);
        }}
      />
    </div>
  );
}
