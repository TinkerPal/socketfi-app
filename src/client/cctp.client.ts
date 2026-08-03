export type SocketFiNetwork = "PUBLIC" | "TESTNET";
export type CctpSpeed = "FAST" | "STANDARD";

export type CctpChain = {
  chainId: number;
  domain: number;
  label: string;
  network: SocketFiNetwork;
  nativeSymbol?: string;
  usdc: `0x${string}`;
  tokenMessengerV2: `0x${string}`;
  explorerTxUrl: string;
};

export type CctpFeePreview = {
  network: SocketFiNetwork;
  chainId: number;
  sourceDomain: number;
  destinationDomain: number;
  sourceChain: {
    chainId: number;
    domain: number;
    label: string;
    network: SocketFiNetwork;
    nativeSymbol: string | null;
    usdc: `0x${string}`;
    tokenMessengerV2: `0x${string}`;
  };
  speed: CctpSpeed;
  finalityThreshold: number;
  amount: {
    symbol: "USDC";
    decimals: 6;
    formatted: string;
    atomic: string;
  };
  fee: {
    type: string;
    minimumFeeBps: string;
    percentage: number;
    formatted: string;
    atomic: string;
    symbol: "USDC";
  };
  maxFee: {
    formatted: string;
    atomic: string;
    symbol: "USDC";
  };
  estimatedReceive: {
    formatted: string;
    atomic: string;
    symbol: "USDC";
  };
  eta: {
    minSeconds: number;
    maxSeconds: number;
    label: string;
  };
  fastAvailable: boolean;
  generatedAt: string;
  expiresAt: string;
  disclaimer: string;
};

export type PreparedCctp = {
  reused?: boolean;
  sessionId: string;
  expiresAt: string;
  source: CctpChain;
  amount: string;
  maxFee: string;
  minFinalityThreshold: number;
  destinationDomain: number;
  mintRecipient: `0x${string}`;
  destinationCaller: `0x${string}`;
  hookData: `0x${string}`;
  stellarForwarder: string;
  feePreview?: CctpFeePreview;
};

const API_ORIGIN = (
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL || "http://localhost:3200"
).replace(/\/$/, "");

const API_KEY = String(import.meta.env.VITE_CCTP_APP_API_KEY || "").trim();
const BASE_URL = `${API_ORIGIN}/api/cctp`;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_KEY) {
    throw new Error("VITE_CCTP_APP_API_KEY is not configured");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "x-api-key": API_KEY,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });

  console.log("the response here is", response);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.success === false) {
    throw new Error(
      payload?.error || `CCTP request failed with status ${response.status}`
    );
  }

  return (payload?.data ?? payload) as T;
}

export async function getCctpChains(network: SocketFiNetwork) {
  const payload = await request<{ chains: CctpChain[] }>(
    `/chains?network=${encodeURIComponent(network)}&t=${Date.now()}`
  );
  return payload.chains;
}

export async function previewCctpFee(input: {
  network: SocketFiNetwork;
  chainId: number;
  amount: string;
  speed: CctpSpeed;
  signal?: AbortSignal;
}) {
  return request<CctpFeePreview>("/preview", {
    method: "POST",
    signal: input.signal,
    body: JSON.stringify({
      network: input.network,
      chainId: input.chainId,
      amount: input.amount,
      speed: input.speed,
    }),
  });
}

export async function prepareCctp(input: {
  network: SocketFiNetwork;
  chainId: number;
  sender: string;
  recipient: string;
  amount: string;
  speed: CctpSpeed;
}) {
  return request<PreparedCctp>("/prepare", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      idempotencyKey: crypto.randomUUID(),
    }),
  });
}

export async function registerCctpBurn(input: {
  sessionId: string;
  burnTxHash: string;
}) {
  return request<any>("/settle", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getCctpStatus(sessionId: string) {
  return request<any>(
    `/status/${encodeURIComponent(sessionId)}?t=${Date.now()}`
  );
}
