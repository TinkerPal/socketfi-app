import { encodeFunctionData, type Address, type Hash } from "viem";

import type {
  NearIntentExecution,
  NearIntentQuote,
  NearIntentStatus,
  SupportedEvmChain,
} from "../shared/near-intents.types";

const API_ORIGIN = (
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL || "http://localhost:3200"
).replace(/\/+$/, "");

const ROUTE_BASE = `${API_ORIGIN}/api/near-intents`;

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "to",
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

export type NearIntentChainOption = SupportedEvmChain & {
  usdc: {
    chainId: number;
    assetId: string;
    blockchain: string;
    symbol: string;
    decimals: number;
    contractAddress: Address;
  };
};

export type NearIntentAssetsResponse = {
  success: true;
  network: "PUBLIC";
  fetchedAt?: string;
  chains: NearIntentChainOption[];
  unavailableChains: unknown[];
  data?: {
    network?: "PUBLIC";
    fetchedAt?: string;
    chains?: NearIntentChainOption[];
    unavailableChains?: unknown[];
  };
};

type ApiErrorPayload = {
  success?: false;
  error?: string;
  message?: string;
  retryable?: boolean;
};

type WalletClientLike = {
  sendTransaction: (request: {
    account: Address;
    to: Address;
    data: `0x${string}`;
    value?: bigint;
  }) => Promise<Hash>;
};

function getApiMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const value = payload as ApiErrorPayload;

    if (typeof value.error === "string" && value.error) {
      return value.error;
    }

    if (typeof value.message === "string" && value.message) {
      return value.message;
    }
  }

  return fallback;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        payload,
        `NEAR Intents request failed with status ${response.status}.`
      )
    );
  }

  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    (payload as { success?: boolean }).success === false
  ) {
    throw new Error(
      getApiMessage(payload, "The NEAR Intents request was unsuccessful.")
    );
  }

  return payload as T;
}

function normalizeAssetsPayload(payload: unknown): NearIntentAssetsResponse {
  if (!payload || typeof payload !== "object") {
    throw new Error("The NEAR Intents assets endpoint returned invalid data.");
  }

  const value = payload as Partial<NearIntentAssetsResponse>;

  const chains = Array.isArray(value.chains)
    ? value.chains
    : Array.isArray(value.data?.chains)
    ? value.data.chains
    : [];

  const unavailableChains = Array.isArray(value.unavailableChains)
    ? value.unavailableChains
    : Array.isArray(value.data?.unavailableChains)
    ? value.data.unavailableChains
    : [];

  return {
    success: true,
    network: "PUBLIC",
    fetchedAt: value.fetchedAt ?? value.data?.fetchedAt,
    chains,
    unavailableChains,
    data: {
      network: "PUBLIC",
      fetchedAt: value.fetchedAt ?? value.data?.fetchedAt,
      chains,
      unavailableChains,
    },
  };
}

function normalizeQuotePayload(payload: unknown): NearIntentQuote {
  if (!payload || typeof payload !== "object") {
    throw new Error("The NEAR Intents quote endpoint returned invalid data.");
  }

  const value = payload as Record<string, unknown>;

  const data =
    value.data && typeof value.data === "object"
      ? (value.data as Record<string, unknown>)
      : value;

  if (
    typeof data.depositAddress !== "string" ||
    typeof data.amountIn !== "string" ||
    typeof data.amountInFormatted !== "string" ||
    typeof data.amountOut !== "string" ||
    typeof data.amountOutFormatted !== "string" ||
    typeof data.deadline !== "string" ||
    !data.sourceAsset ||
    typeof data.sourceAsset !== "object" ||
    !data.destinationAsset ||
    typeof data.destinationAsset !== "object"
  ) {
    throw new Error("The NEAR Intents quote response is incomplete.");
  }

  return data as unknown as NearIntentQuote;
}

function normalizeStatus(value: unknown): NearIntentStatus {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (
    normalized === "SUCCESS" ||
    normalized === "SUCCEEDED" ||
    normalized === "COMPLETE" ||
    normalized === "COMPLETED" ||
    normalized === "SETTLED" ||
    normalized === "EXECUTED"
  ) {
    return "SUCCESS";
  }

  if (normalized === "KNOWN_DEPOSIT_TX" || normalized === "DEPOSIT_DETECTED") {
    return "KNOWN_DEPOSIT_TX";
  }

  if (
    normalized === "PROCESSING" ||
    normalized === "PENDING" ||
    normalized === "IN_PROGRESS"
  ) {
    return "PROCESSING";
  }

  if (normalized === "INCOMPLETE_DEPOSIT") {
    return "INCOMPLETE_DEPOSIT";
  }

  if (normalized === "REFUNDED") {
    return "REFUNDED";
  }

  if (
    normalized === "FAILED" ||
    normalized === "FAILURE" ||
    normalized === "EXPIRED" ||
    normalized === "CANCELLED" ||
    normalized === "CANCELED"
  ) {
    return "FAILED";
  }

  return "PENDING_DEPOSIT";
}

function normalizeExecutionPayload(payload: unknown): NearIntentExecution {
  if (!payload || typeof payload !== "object") {
    throw new Error("The NEAR Intents status endpoint returned invalid data.");
  }

  const value = payload as Record<string, unknown>;

  const data =
    value.data && typeof value.data === "object"
      ? (value.data as Record<string, unknown>)
      : undefined;

  const provider =
    data?.provider && typeof data.provider === "object"
      ? (data.provider as Record<string, unknown>)
      : value;

  const rawStatus =
    value.status ??
    provider.status ??
    provider.state ??
    provider.swapStatus ??
    provider.swap_status ??
    provider.quoteStatus;

  const swapDetails =
    provider.swapDetails && typeof provider.swapDetails === "object"
      ? provider.swapDetails
      : value.swapDetails && typeof value.swapDetails === "object"
      ? value.swapDetails
      : undefined;

  return {
    status: normalizeStatus(rawStatus),
    ...(swapDetails
      ? {
          swapDetails: swapDetails as NearIntentExecution["swapDetails"],
        }
      : {}),
  };
}

export async function getNearIntentAssets(
  signal?: AbortSignal
): Promise<NearIntentAssetsResponse> {
  const url = `${ROUTE_BASE}/assets?refresh=1&t=${Date.now()}`;

  console.info("[near-intents/api] GET", url);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  const payload = await readJsonResponse<unknown>(response);

  console.info("[near-intents/api] assets payload", payload);

  return normalizeAssetsPayload(payload);
}

export async function createNearIntentQuote(input: {
  network: "PUBLIC" | "TESTNET";
  chainId: number;
  amount: string;
  sender: string;
  recipient: string;
  slippageBps?: number;
}): Promise<NearIntentQuote> {
  const response = await fetch(`${ROUTE_BASE}/quote`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = await readJsonResponse<unknown>(response);

  return normalizeQuotePayload(payload);
}

export async function sendNearIntentDeposit({
  quote,
  account,
  walletClient,
  waitForReceipt,
}: {
  quote: NearIntentQuote;
  account: Address;
  walletClient: WalletClientLike;
  waitForReceipt: (hash: Hash) => Promise<unknown>;
}): Promise<Hash> {
  const tokenAddress = quote.sourceAsset.contractAddress as Address;

  const depositAddress = quote.depositAddress as Address;

  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [depositAddress, BigInt(quote.amountIn)],
  });

  const hash = await walletClient.sendTransaction({
    account,
    to: tokenAddress,
    data,
    value: 0n,
  });

  await waitForReceipt(hash);

  const response = await fetch(`${ROUTE_BASE}/deposit`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      depositAddress,
      txHash: hash,
    }),
  });

  await readJsonResponse(response);

  return hash;
}

export async function getNearIntentStatus(
  depositAddress: string,
  signal?: AbortSignal
): Promise<NearIntentExecution> {
  const response = await fetch(
    `${ROUTE_BASE}/status/${encodeURIComponent(
      depositAddress
    )}?t=${Date.now()}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
      headers: {
        Accept: "application/json",
      },
    }
  );

  const payload = await readJsonResponse<unknown>(response);

  return normalizeExecutionPayload(payload);
}

function waitWithAbort(
  milliseconds: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Settlement polling aborted.", "AbortError"));

      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, milliseconds);

    const onAbort = () => {
      window.clearTimeout(timer);
      cleanup();

      reject(new DOMException("Settlement polling aborted.", "AbortError"));
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, {
      once: true,
    });
  });
}

export async function waitForNearIntentSettlement(
  depositAddress: string,
  options: {
    signal?: AbortSignal;
    intervalMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<NearIntentExecution> {
  const intervalMs = options.intervalMs ?? 5_000;
  const timeoutMs = options.timeoutMs ?? 30 * 60_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (options.signal?.aborted) {
      throw new DOMException("Settlement polling aborted.", "AbortError");
    }

    const result = await getNearIntentStatus(depositAddress, options.signal);

    if (
      result.status === "SUCCESS" ||
      result.status === "REFUNDED" ||
      result.status === "FAILED" ||
      result.status === "INCOMPLETE_DEPOSIT"
    ) {
      return result;
    }

    await waitWithAbort(intervalMs, options.signal);
  }

  throw new Error("Timed out while waiting for the NEAR Intents settlement.");
}
