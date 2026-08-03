import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  Copy,
  ExternalLink,
  Link2,
} from "lucide-react";
import { CloseCircle } from "iconsax-react";
import { QRCodeSVG } from "qrcode.react";
import { v4 as uuidv4 } from "uuid";
import { useSocketFi } from "@socketfi/react";
import { useAccount, useSignMessage } from "wagmi";
import {
  Address,
  FeeBumpTransaction,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";

import { useStates } from "../context/StatesContext";
import { WalletKitService } from "../wallet-kit/services/global-service";
import TokenTransact from "./TokenTransact";
import { formatValue, mask_middle } from "../utils/helper-functions";
import { SocketFiTenant } from "../config/tenant.config";

type Network = "TESTNET" | "PUBLIC";
type WalletConnectionMethod = "passkey" | "stellar" | "evm";

interface WalletToken {
  address?: string;
  contract?: string;
  symbol?: string;
  balance?: string | number;
  amount?: string;
  decimals?: number;
  price?: {
    selectedPrice?: string | number;
  };
  [key: string]: unknown;
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

  userProfile?: {
    userId?: string;

    connectionMethod?: WalletConnectionMethod;
    authMethod?: WalletConnectionMethod;
    walletType?: WalletConnectionMethod;

    stellarSigner?: string;
    stellarPublicKey?: string;
    evmAddress?: `0x${string}`;

    address?: Partial<Record<Network, string>>;
  };

  [key: string]: unknown;
}

interface DirectTransactionPreparation {
  sessionId: string;
  transactionXdr: string;
  unsignedAuthEntryXdr: string;
  authPreimageXdr: string;
  signatureExpirationLedger: number;
  networkPassphrase: string;
  rpcUrl: string;
}

interface EvmTransactionPreparation {
  sessionId: string;
  signaturePayloadHex: `0x${string}`;
  evmAddress?: `0x${string}`;
  walletAddress?: string;
  network?: Network;
  signatureExpirationLedger?: number;
  networkPassphrase?: string;
  feePayer?: string;
  expiresInMs?: number;
}

interface WalletAuthEntryResult {
  signedAuthEntry?: string;
  signature?: string;
  signerAddress?: string;
  data?: {
    signedAuthEntry?: string;
    signature?: string;
  };
}

const DIRECT_SERVER_URL =
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL || "http://localhost:3200";

function getReadableError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Something went wrong.";
}

function publicDepositUrl(
  tenant: SocketFiTenant,
  walletAddress: string
): string {
  return `https://${tenant?.hostname}/${walletAddress}`;
}

function transactionExplorerUrl(
  network: Network,
  transactionHash: string
): string {
  const explorerNetwork = network === "PUBLIC" ? "public" : "testnet";

  return `https://stellar.expert/explorer/${explorerNetwork}/tx/${transactionHash}`;
}

function toTokenAmount(value: string, decimals = 7): bigint {
  const normalized = String(value ?? "").trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Enter a valid token amount.");
  }

  const [wholePart, fractionalPart = ""] = normalized.split(".");

  if (fractionalPart.length > decimals) {
    throw new Error(
      `This token supports a maximum of ${decimals} decimal places.`
    );
  }

  const paddedFraction = fractionalPart.padEnd(decimals, "0");

  const amount =
    BigInt(wholePart) * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0");

  if (amount <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  return amount;
}

function buildTransferArgsXdr({
  from,
  to,
  amount,
}: {
  from: string;
  to: string;
  amount: bigint;
}): string[] {
  return [
    nativeToScVal(from, {
      type: "address",
    }),
    nativeToScVal(to, {
      type: "address",
    }),
    nativeToScVal(amount, {
      type: "i128",
    }),
  ].map((argument) => argument.toXDR("base64"));
}

function extractTransactionHash(response: unknown): string | undefined {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const value = response as {
    txHash?: unknown;
    hash?: unknown;
    transactionHash?: unknown;
    data?: {
      txHash?: unknown;
      hash?: unknown;
      transactionHash?: unknown;
    };
  };

  const hash =
    value.txHash ??
    value.hash ??
    value.transactionHash ??
    value.data?.txHash ??
    value.data?.hash ??
    value.data?.transactionHash;

  return typeof hash === "string" && hash.length > 0 ? hash : undefined;
}

async function readJsonResponse(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      typeof data?.error === "string"
        ? data.error
        : typeof data?.message === "string"
        ? data.message
        : `Request failed with status ${response.status}`;

    throw new Error(errorMessage);
  }

  return data;
}

function decodeBase64Bytes(value: string): Uint8Array {
  const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");

  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("Invalid base64 authorization signature.");
  }

  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  const binary = window.atob(padded);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeStellarAuthSignature(result: unknown): Uint8Array {
  if (result == null) {
    throw new Error(
      "The Stellar wallet did not return an authorization signature."
    );
  }

  if (result instanceof Uint8Array) {
    if (result.length !== 64) {
      throw new Error(
        `Expected a 64-byte Stellar signature; received ${result.length}.`
      );
    }

    return result;
  }

  if (Array.isArray(result)) {
    return decodeStellarAuthSignature(Uint8Array.from(result));
  }

  let encodedValue: unknown = result;

  if (typeof result === "object") {
    const walletResult = result as WalletAuthEntryResult;

    encodedValue =
      walletResult.signedAuthEntry ??
      walletResult.signature ??
      walletResult.data?.signedAuthEntry ??
      walletResult.data?.signature;
  }

  if (typeof encodedValue !== "string" || !encodedValue.trim()) {
    throw new Error(
      "The Stellar wallet returned an unsupported authorization signature."
    );
  }

  const clean = encodedValue.trim();

  if (/^[0-9a-fA-F]{128}$/.test(clean)) {
    const pairs = clean.match(/.{2}/g);

    if (!pairs) {
      throw new Error(
        "Unable to decode the hexadecimal authorization signature."
      );
    }

    return Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
  }

  const firstDecoded = decodeBase64Bytes(clean);

  if (firstDecoded.length === 64) {
    return firstDecoded;
  }

  const nestedBase64 = new TextDecoder("utf-8", {
    fatal: true,
  })
    .decode(firstDecoded)
    .trim();

  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(nestedBase64)) {
    throw new Error(
      `Expected a 64-byte signature; the first decoded value contained ${firstDecoded.length} bytes.`
    );
  }

  const rawSignature = decodeBase64Bytes(nestedBase64);

  if (rawSignature.length !== 64) {
    throw new Error(
      `Expected a 64-byte Stellar signature; received ${rawSignature.length}.`
    );
  }

  return rawSignature;
}

function buildWalletAuthStellarScVal(rawSignature: Uint8Array): xdr.ScVal {
  const stellarSignature = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("signature"),
      val: xdr.ScVal.scvBytes(rawSignature as any),
    }),
  ]);

  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Stellar"), stellarSignature]);
}

function buildSignedSocketFiAuthEntry({
  unsignedAuthEntryXdr,
  rawSignature,
  signatureExpirationLedger,
}: {
  unsignedAuthEntryXdr: string;
  rawSignature: Uint8Array;
  signatureExpirationLedger: number;
}): xdr.SorobanAuthorizationEntry {
  const unsignedEntry = xdr.SorobanAuthorizationEntry.fromXDR(
    unsignedAuthEntryXdr,
    "base64"
  );

  if (
    unsignedEntry.credentials().switch() !==
    xdr.SorobanCredentialsType.sorobanCredentialsAddress()
  ) {
    throw new Error(
      "The prepared SocketFi authorization entry is not address-based."
    );
  }

  const credentials = unsignedEntry.credentials().address();

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: credentials.address(),
        nonce: credentials.nonce(),
        signatureExpirationLedger,
        signature: buildWalletAuthStellarScVal(rawSignature),
      })
    ),
    rootInvocation: unsignedEntry.rootInvocation(),
  });
}

function injectSocketFiAuthEntry({
  transactionXdr,
  networkPassphrase,
  walletAddress,
  signedAuthEntry,
}: {
  transactionXdr: string;
  networkPassphrase: string;
  walletAddress: string;
  signedAuthEntry: xdr.SorobanAuthorizationEntry;
}): Transaction {
  const transaction = TransactionBuilder.fromXDR(
    transactionXdr,
    networkPassphrase
  );

  const envelope = transaction.toEnvelope();
  const operations = envelope.v1().tx().operations();

  if (operations.length !== 1) {
    throw new Error("Expected exactly one Soroban operation.");
  }

  const operationBody = operations[0].body();

  if (operationBody.switch() !== xdr.OperationType.invokeHostFunction()) {
    throw new Error("Expected an invokeHostFunction operation.");
  }

  const invokeOperation = operationBody.invokeHostFunctionOp();
  const currentAuthEntries = invokeOperation.auth() || [];

  let replaced = false;

  const nextAuthEntries = currentAuthEntries.map((entry) => {
    try {
      if (
        entry.credentials().switch() !==
        xdr.SorobanCredentialsType.sorobanCredentialsAddress()
      ) {
        return entry;
      }

      const entryAddress = Address.fromScAddress(
        entry.credentials().address().address()
      ).toString();

      if (entryAddress !== walletAddress) {
        return entry;
      }

      replaced = true;
      return signedAuthEntry;
    } catch {
      return entry;
    }
  });

  if (!replaced) {
    nextAuthEntries.push(signedAuthEntry);
  }

  invokeOperation.auth(nextAuthEntries);

  const rebuilt = TransactionBuilder.fromXDR(
    envelope.toXDR("base64"),
    networkPassphrase
  );

  if (rebuilt instanceof FeeBumpTransaction) {
    throw new Error("Unexpected fee-bump transaction.");
  }

  return rebuilt;
}

function getConnectionMethod(
  session: SocketFiSession | undefined,
  stellarSigner: string
): WalletConnectionMethod {
  const configuredMethod =
    session?.connectionMethod ??
    session?.authMethod ??
    session?.walletType ??
    session?.userProfile?.connectionMethod ??
    session?.userProfile?.authMethod ??
    session?.userProfile?.walletType;

  if (configuredMethod === "evm") {
    return "evm";
  }

  if (configuredMethod === "stellar") {
    return "stellar";
  }

  if (configuredMethod === "passkey") {
    return "passkey";
  }

  return stellarSigner ? "stellar" : "passkey";
}

function ReceiveDeposit({
  tenant,
  walletAddress,
  onClose,
}: {
  tenant: SocketFiTenant;
  walletAddress: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"address" | "link" | null>(null);

  console.log("the tenant hereeee is", tenant);

  const link = useMemo(
    () => publicDepositUrl(tenant, walletAddress),
    [tenant, walletAddress]
  );

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(null);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  async function copy(value: string, field: "address" | "link"): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(field);
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="receive-title"
      className="w-full max-w-[520px] overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
    >
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
        <div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <ArrowDownToLine className="h-[22px] w-[22px]" />
          </span>

          <h2
            id="receive-title"
            className="mt-4 text-xl font-semibold tracking-tight text-slate-950"
          >
            Receive funds
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Share this address or payment link. Anyone can deposit without
            accessing your SocketFi account.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close transaction"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
        >
          <CloseCircle className="h-6 w-6" />
        </button>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto w-fit rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <QRCodeSVG value={link} size={190} level="M" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
            Your SocketFi account
          </p>

          <div className="mt-2 flex items-center gap-3">
            <p className="min-w-0 flex-1 break-all text-sm font-semibold leading-6 text-slate-950">
              {mask_middle(walletAddress, 15, "*****")}
            </p>

            <button
              type="button"
              onClick={() => void copy(walletAddress, "address")}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100"
              aria-label="Copy wallet address"
            >
              {copied === "address" ? (
                <Check className="h-4 w-4 text-emerald-700" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          <span className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
            {tenant?.network}
          </span>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm">
              <Link2 className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-950">
                Public deposit link
              </p>

              <p className="mt-1 break-all text-xs leading-5 text-slate-500">
                {mask_middle(link, 15, "*****")}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copy(link, "link")}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              {copied === "link" ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}

              {copied === "link" ? "Copied" : "Copy link"}
            </button>

            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
            >
              <ExternalLink className="h-4 w-4" />
              Open link
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function WithdrawalSuccess({
  network,
  transactionHash,
  amount,
  symbol,
  recipient,
  onClose,
}: {
  network: Network;
  transactionHash: string;
  amount: string;
  symbol: string;
  recipient: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const explorerUrl = useMemo(
    () => transactionExplorerUrl(network, transactionHash),
    [network, transactionHash]
  );

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  async function copyHash(): Promise<void> {
    await navigator.clipboard.writeText(transactionHash);
    setCopied(true);
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdrawal-success-title"
      className="w-full max-w-[520px] overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
    >
      <header className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
        <div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <Check className="h-6 w-6" />
          </span>

          <h2
            id="withdrawal-success-title"
            className="mt-4 text-xl font-semibold tracking-tight text-slate-950"
          >
            Withdrawal successful
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Your transaction was submitted successfully to the Stellar network.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close success message"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
        >
          <CloseCircle className="h-6 w-6" />
        </button>
      </header>

      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-emerald-700">
            Amount withdrawn
          </p>

          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {amount} {symbol}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
            Recipient
          </p>

          <p className="mt-2 break-all text-sm font-semibold leading-6 text-slate-950">
            {mask_middle(recipient, 15, "*****")}
          </p>

          <span className="mt-3 inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
            {network}
          </span>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm">
              <ExternalLink className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-950">
                Transaction Explorer
              </p>

              <p className="mt-1 break-all text-xs leading-5 text-slate-500">
                {mask_middle(transactionHash, 15, "*****")}
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
              )}

              {copied ? "Copied" : "Copy hash"}
            </button>

            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
            >
              <ExternalLink className="h-4 w-4" />
              View transaction
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-950"
        >
          Done
        </button>
      </div>
    </section>
  );
}

export default function SendModal() {
  const socketfi = useSocketFi();
  const { address: connectedEvmAddress, isConnected: isEvmConnected } =
    useAccount();
  const { signMessageAsync } = useSignMessage();

  const [isTransacting, setIsTransacting] = useState(false);
  const [successfulTransactionHash, setSuccessfulTransactionHash] =
    useState("");
  const [successfulRecipient, setSuccessfulRecipient] = useState("");
  const [successfulAmount, setSuccessfulAmount] = useState("");
  const [successfulSymbol, setSuccessfulSymbol] = useState("");

  const {
    selectedTransactToken,
    activeSession,
    userKey,
    triggerUpdate,
    processProgress,
    isOpenSend,
    setIsOpenSend,
    onCloseSend,
    buttons,
    needWalletConnect,
    activeButton,
    selectedNetwork,
    toast,
    openHandler,
    hasExtra,
    extra,
    recipientSpender,
    dappTokenIn,
    setSessionId,
    allTokens,
    transactingToken,
    transactingSymbol,

    tenant,
  } = useStates();

  const network = selectedNetwork as Network;
  const session = activeSession as SocketFiSession | undefined;

  const walletContractId = useMemo(
    () => session?.userProfile?.address?.[network] || "",
    [session, network]
  );

  const storedStellarSigner = useMemo(
    () =>
      session?.stellarSigner ??
      session?.stellarPublicKey ??
      session?.userProfile?.stellarSigner ??
      session?.userProfile?.stellarPublicKey ??
      "",
    [session]
  );

  const stellarSigner = useMemo(
    () => storedStellarSigner || userKey || "",
    [storedStellarSigner, userKey]
  );

  const storedEvmAddress = useMemo(
    () => session?.evmAddress ?? session?.userProfile?.evmAddress ?? "",
    [session]
  );

  const connectionMethod = useMemo(
    () => getConnectionMethod(session, storedStellarSigner),
    [session, storedStellarSigner]
  );

  const accessToken = useMemo(
    () => session?.accessToken ?? session?.socketfiAccessToken ?? "",
    [session]
  );

  const transactingAmount = useMemo(
    () =>
      network === "TESTNET"
        ? String(selectedTransactToken?.amount || "")
        : String(dappTokenIn?.amount || ""),
    [network, selectedTransactToken, dappTokenIn]
  );

  const tokenContractId = useMemo(
    () =>
      selectedTransactToken?.contract ||
      selectedTransactToken?.address ||
      transactingToken ||
      "",
    [selectedTransactToken, transactingToken]
  );

  const tokenDecimals = useMemo(() => {
    const parsedDecimals = Number(selectedTransactToken?.decimals ?? 7);

    if (
      !Number.isInteger(parsedDecimals) ||
      parsedDecimals < 0 ||
      parsedDecimals > 18
    ) {
      return 7;
    }

    return parsedDecimals;
  }, [selectedTransactToken]);

  const availableBalance = useMemo(() => {
    if (network === "TESTNET") {
      return Number(selectedTransactToken?.balance || 0);
    }

    return Number(
      allTokens?.find(
        (token: WalletToken) =>
          token?.contract === tokenContractId ||
          token?.address === tokenContractId
      )?.balance || 0
    );
  }, [allTokens, network, selectedTransactToken, tokenContractId]);

  const amountValue = Number(transactingAmount);

  const hasInvalidAmount =
    transactingAmount !== "" &&
    (!Number.isFinite(amountValue) || amountValue <= 0);

  const amountExceedsBalance =
    transactingAmount !== "" &&
    Number.isFinite(amountValue) &&
    amountValue > availableBalance;

  const amountHasError = hasInvalidAmount || amountExceedsBalance;

  const disableConfirmButton =
    isTransacting ||
    amountHasError ||
    !transactingAmount ||
    !recipientSpender ||
    !Number.isFinite(amountValue) ||
    amountValue <= 0;

  const description = useMemo(() => {
    if (activeButton === "withdraw") {
      return {
        long: "Withdraw tokens from your SocketFi account to another Stellar account.",
        short: "Withdraw tokens",
      };
    }

    return null;
  }, [activeButton]);

  const topStat = useMemo(
    () => ({
      name: "SocketFi wallet balance",
      address: walletContractId,
      balance: {
        value: availableBalance,
        symbol: transactingSymbol || "",
      },
    }),
    [availableBalance, transactingSymbol, walletContractId]
  );

  useEffect(() => {
    if (!isOpenSend) {
      setSuccessfulTransactionHash("");
      setSuccessfulRecipient("");
      setSuccessfulAmount("");
      setSuccessfulSymbol("");
    }
  }, [isOpenSend]);

  function resetSuccessState() {
    console.log("reset ran");
    setSuccessfulTransactionHash("");
    setSuccessfulRecipient("");
    setSuccessfulAmount("");
    setSuccessfulSymbol("");
    setSessionId("");
  }

  function closeModal() {
    resetSuccessState();
    setIsOpenSend(false);
    onCloseSend();
  }

  function validateWithdrawal(): boolean {
    if (!walletContractId) {
      toast.error("Wallet contract not found.");
      return false;
    }

    if (!tokenContractId) {
      toast.error("Select a token first.");
      return false;
    }

    if (!recipientSpender?.trim()) {
      toast.error("Enter a valid recipient address.");
      return false;
    }

    try {
      Address.fromString(recipientSpender.trim());
    } catch {
      toast.error("Enter a valid Stellar recipient address.");
      return false;
    }

    if (!transactingAmount) {
      toast.error("Enter a valid token amount.");
      return false;
    }

    try {
      toTokenAmount(transactingAmount, tokenDecimals);
    } catch (error) {
      toast.error(getReadableError(error));
      return false;
    }

    if (amountExceedsBalance) {
      toast.error("Amount exceeds the available balance.");
      return false;
    }

    if (connectionMethod === "passkey" && !accessToken) {
      toast.error("Your SocketFi session has expired. Please sign in again.");
      return false;
    }

    if (connectionMethod === "stellar" && !stellarSigner) {
      toast.error(
        "Reconnect the Stellar wallet used to create this SocketFi account."
      );
      return false;
    }

    if (connectionMethod === "evm") {
      if (!storedEvmAddress) {
        toast.error(
          "The EVM wallet linked to this SocketFi account was not found. Please sign in again."
        );
        return false;
      }

      if (!isEvmConnected || !connectedEvmAddress) {
        toast.error(
          "Reconnect the EVM wallet used to create this SocketFi account."
        );
        return false;
      }

      if (
        connectedEvmAddress.toLowerCase() !== storedEvmAddress.toLowerCase()
      ) {
        toast.error(
          "The connected EVM wallet does not match this SocketFi account."
        );
        return false;
      }
    }

    return true;
  }

  function buildTxDetails(overrides: Record<string, unknown> = {}) {
    return {
      id: session?.userProfile?.userId,
      walletContractId,
      network,
      ...overrides,
    };
  }

  async function withdrawWithSocketFiSdk({ argsXdr }: { argsXdr: string[] }) {
    return socketfi.signAndSubmitTx({
      contractId: tokenContractId,
      callFunction: {
        name: "transfer",
      },
      argsXdr,
      accessToken,
      displayMode: "full",
      description: `Withdraw ${transactingAmount} ${
        transactingSymbol || "tokens"
      } from your SocketFi account`,
      values: [
        {
          key: "From",
          value: walletContractId,
        },
        {
          key: "Recipient",
          value: recipientSpender.trim(),
        },
        {
          key: "Amount",
          value: `${transactingAmount} ${transactingSymbol || ""}`.trim(),
        },
        {
          key: "Network",
          value: network,
        },
      ],
    });
  }

  async function withdrawWithStellarWallet({ argsXdr }: { argsXdr: string[] }) {
    const prepareResponse = await fetch(
      `${DIRECT_SERVER_URL}/api/stellar-transactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "prepare",
          network,
          stellarPublicKey: stellarSigner,
          walletAddress: walletContractId,
          contractId: tokenContractId,
          callFunction: {
            name: "transfer",
          },
          argsXdr,
        }),
      }
    );

    const prepared = (await readJsonResponse(
      prepareResponse
    )) as DirectTransactionPreparation;

    const requiredFields: Array<keyof DirectTransactionPreparation> = [
      "sessionId",
      "transactionXdr",
      "unsignedAuthEntryXdr",
      "authPreimageXdr",
      "signatureExpirationLedger",
      "networkPassphrase",
      "rpcUrl",
    ];

    for (const field of requiredFields) {
      if (prepared?.[field] == null) {
        throw new Error(
          `Direct Stellar transaction preparation did not return ${field}.`
        );
      }
    }

    const authSignatureResult = await WalletKitService.signAuthEntry(
      prepared.authPreimageXdr,
      network,
      stellarSigner
    );

    console.log("the signed auth entry is", authSignatureResult);

    const rawSignature = decodeStellarAuthSignature(authSignatureResult);

    const signedAuthEntry = buildSignedSocketFiAuthEntry({
      unsignedAuthEntryXdr: prepared.unsignedAuthEntryXdr,
      rawSignature,
      signatureExpirationLedger: prepared.signatureExpirationLedger,
    });

    let transactionWithAuth = injectSocketFiAuthEntry({
      transactionXdr: prepared.transactionXdr,
      networkPassphrase: prepared.networkPassphrase,
      walletAddress: walletContractId,
      signedAuthEntry,
    });

    const rpcServer = new rpc.Server(prepared.rpcUrl);

    const finalSimulation = await rpcServer.simulateTransaction(
      transactionWithAuth
    );

    if (rpc.Api.isSimulationError(finalSimulation)) {
      throw new Error(
        `SocketFi authorization simulation failed: ${finalSimulation.error}`
      );
    }

    let finalTransaction = rpc
      .assembleTransaction(transactionWithAuth, finalSimulation)
      .build();

    finalTransaction = injectSocketFiAuthEntry({
      transactionXdr: finalTransaction.toXDR(),
      networkPassphrase: prepared.networkPassphrase,
      walletAddress: walletContractId,
      signedAuthEntry,
    });

    const signedTransactionXdr = await WalletKitService.signTx(
      finalTransaction.toXDR(),
      network
    );

    if (typeof signedTransactionXdr !== "string" || !signedTransactionXdr) {
      throw new Error(
        "The Stellar wallet did not return a signed transaction."
      );
    }

    const submitResponse = await fetch(
      `${DIRECT_SERVER_URL}/api/stellar-transactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "submit",
          sessionId: prepared.sessionId,
          signedTransactionXdr,
          txDetails: buildTxDetails({
            type: "withdraw",
            amountOut: transactingAmount,
            tokenOut: tokenContractId,
            symbolOut: transactingSymbol,
            to: recipientSpender.trim(),
            from: walletContractId,
          }),
        }),
      }
    );

    return readJsonResponse(submitResponse);
  }

  async function withdrawWithEvmWallet({ argsXdr }: { argsXdr: string[] }) {
    if (!connectedEvmAddress || !isEvmConnected) {
      throw new Error(
        "Reconnect the EVM wallet used to create this SocketFi account."
      );
    }

    if (!storedEvmAddress) {
      throw new Error(
        "The EVM wallet linked to this SocketFi account was not found."
      );
    }

    const normalizedConnectedAddress =
      connectedEvmAddress.toLowerCase() as `0x${string}`;
    const normalizedStoredAddress =
      storedEvmAddress.toLowerCase() as `0x${string}`;

    if (normalizedConnectedAddress !== normalizedStoredAddress) {
      throw new Error(
        "The connected EVM wallet does not match this SocketFi account."
      );
    }

    const prepareResponse = await fetch(
      `${DIRECT_SERVER_URL}/api/evm-transactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "prepare",
          network,
          evmAddress: normalizedStoredAddress,
          walletAddress: walletContractId,
          contractId: tokenContractId,
          callFunction: {
            name: "transfer",
          },
          argsXdr,
        }),
      }
    );

    const prepared = (await readJsonResponse(
      prepareResponse
    )) as EvmTransactionPreparation;

    if (!prepared.sessionId) {
      throw new Error(
        "EVM transaction preparation did not return a session ID."
      );
    }

    if (
      !prepared.signaturePayloadHex ||
      !/^0x[0-9a-fA-F]{64}$/.test(prepared.signaturePayloadHex)
    ) {
      throw new Error(
        "EVM transaction preparation returned an invalid signing payload."
      );
    }

    if (
      prepared.evmAddress &&
      prepared.evmAddress.toLowerCase() !== normalizedStoredAddress
    ) {
      throw new Error(
        "The prepared EVM transaction does not match the connected wallet."
      );
    }

    if (prepared.walletAddress && prepared.walletAddress !== walletContractId) {
      throw new Error(
        "The prepared EVM transaction does not match this SocketFi account."
      );
    }

    if (prepared.network && prepared.network !== network) {
      throw new Error(
        "The prepared EVM transaction does not match the selected Stellar network."
      );
    }

    /*
     * Sign the exact 32-byte Soroban authorization payload. Passing the
     * payload through `raw` prevents wagmi from signing the visible hex text.
     */
    const signature = await signMessageAsync({
      account: connectedEvmAddress,
      message: {
        raw: prepared.signaturePayloadHex,
      },
    });

    if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
      throw new Error("The EVM wallet returned an invalid signature.");
    }

    const submitResponse = await fetch(
      `${DIRECT_SERVER_URL}/api/evm-transactions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "submit",
          sessionId: prepared.sessionId,
          signature,
          txDetails: buildTxDetails({
            type: "withdraw",
            amountOut: transactingAmount,
            tokenOut: tokenContractId,
            symbolOut: transactingSymbol,
            to: recipientSpender.trim(),
            from: walletContractId,
          }),
        }),
      }
    );

    return readJsonResponse(submitResponse);
  }

  async function submitWithdrawal() {
    if (!validateWithdrawal()) {
      return;
    }

    const sessionId = uuidv4();

    setSessionId(sessionId);
    setIsTransacting(true);

    try {
      const amount = toTokenAmount(transactingAmount, tokenDecimals);

      const recipient = recipientSpender.trim();

      const argsXdr = buildTransferArgsXdr({
        from: walletContractId,
        to: recipient,
        amount,
      });

      const selectedToken =
        allTokens?.find(
          (token: WalletToken) =>
            token?.contract === tokenContractId ||
            token?.address === tokenContractId
        ) ?? selectedTransactToken;

      const price = formatValue(selectedToken?.price?.selectedPrice || 0);

      let transaction: unknown;

      switch (connectionMethod) {
        case "stellar":
          transaction = await withdrawWithStellarWallet({
            argsXdr,
          });
          break;

        case "evm":
          transaction = await withdrawWithEvmWallet({
            argsXdr,
          });
          break;

        case "passkey":
          transaction = await withdrawWithSocketFiSdk({
            argsXdr,
          });
          break;

        default:
          throw new Error("Unsupported wallet connection method.");
      }

      if (!transaction) {
        throw new Error("The withdrawal was not submitted.");
      }

      const transactionHash = extractTransactionHash(transaction);

      if (!transactionHash) {
        throw new Error(
          "The withdrawal succeeded, but no transaction hash was returned."
        );
      }

      /*
       * Keep the modal open and replace the transaction form
       * with the success view.
       */
      setSuccessfulTransactionHash(transactionHash);
      setSuccessfulRecipient(recipient);
      setSuccessfulAmount(transactingAmount);
      setSuccessfulSymbol(transactingSymbol || "");
      setSessionId("");

      triggerUpdate();

      console.info("[wallet/withdrawal]", {
        sessionId,
        connectionMethod,
        walletContractId,
        tokenContractId,
        recipient,
        amount: transactingAmount,
        amountAtomic: amount.toString(),
        price,
        transactionHash,
      });
    } catch (error) {
      console.error("[wallet/withdrawal]", error);
      toast.error(getReadableError(error));
      setSessionId("");
    } finally {
      setIsTransacting(false);
    }
  }

  const requiresStellarReconnect =
    activeButton === "withdraw" &&
    connectionMethod === "stellar" &&
    !stellarSigner &&
    needWalletConnect;

  const requiresEvmReconnect =
    activeButton === "withdraw" &&
    connectionMethod === "evm" &&
    (!isEvmConnected ||
      !connectedEvmAddress ||
      !storedEvmAddress ||
      connectedEvmAddress.toLowerCase() !== storedEvmAddress.toLowerCase()) &&
    needWalletConnect;

  const requiresWalletReconnect =
    requiresStellarReconnect || requiresEvmReconnect;

  /*
   * A successful local withdrawal must remain visible even if
   * another progress message exists in the shared context.
   */
  if (
    !isOpenSend ||
    (processProgress.message.length > 0 && !successfulTransactionHash)
  ) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[20] overflow-y-auto bg-slate-950/45 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4 lg:p-6">
        {successfulTransactionHash ? (
          <WithdrawalSuccess
            network={network}
            transactionHash={successfulTransactionHash}
            amount={successfulAmount}
            symbol={successfulSymbol}
            recipient={successfulRecipient}
            onClose={closeModal}
          />
        ) : (
          <>
            {activeButton === "deposit" && (
              <ReceiveDeposit
                tenant={tenant}
                walletAddress={walletContractId}
                onClose={closeModal}
              />
            )}

            {activeButton === "withdraw" && (
              <TokenTransact
                needWalletConnect={needWalletConnect}
                hasExtra={hasExtra}
                extra={extra}
                isLoading={isTransacting}
                onClickButton={
                  requiresWalletReconnect ? openHandler : submitWithdrawal
                }
                buttonMessage={
                  requiresStellarReconnect
                    ? "Connect Stellar wallet"
                    : requiresEvmReconnect
                    ? "Connect EVM wallet"
                    : isTransacting
                    ? "Confirming…"
                    : "Confirm withdrawal"
                }
                isModal
                onCloseModal={closeModal}
                buttons={buttons}
                description={description}
                topStat={topStat}
                availableBalance={availableBalance}
                amountHasError={amountHasError}
                hasInvalidAmount={hasInvalidAmount}
                amountExceedsBalance={amountExceedsBalance}
                disableConfirmButton={
                  requiresWalletReconnect ? false : disableConfirmButton
                }
                mode="withdraw"
                recipientAddress={recipientSpender}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
