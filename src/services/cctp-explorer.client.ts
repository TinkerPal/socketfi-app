export type ExplorerNetwork = "PUBLIC" | "TESTNET";
export type ExplorerSpeed = "FAST" | "STANDARD";
export type ExplorerStatus =
  | "PREPARED"
  | "BURN_SUBMITTED"
  | "BURN_CONFIRMED"
  | "ATTESTING"
  | "ATTESTATION_READY"
  | "MINT_SUBMITTED"
  | "SUCCESS"
  | "FAILED_RETRYABLE"
  | "FAILED_FINAL"
  | "SUPERSEDED"
  | "EXPIRED";

export type ExplorerTransfer = {
  id: string;
  idempotencyKey: string;
  network: ExplorerNetwork;
  status: ExplorerStatus;
  statusLabel: string;
  statusCategory: "PENDING" | "SUCCESS" | "WARNING" | "FAILED";
  progress: number;
  isPending: boolean;
  source: {
    chainId: number;
    domain: number;
    chainName: string;
    sender: string;
    txHash: string | null;
    explorerUrl: string | null;
  };
  destination: {
    chainName: string;
    domain: number;
    recipient: string;
    txHash: string | null;
    explorerUrl: string | null;
  };
  token: {
    symbol: "USDC";
    decimals: 6;
    amountAtomic: string;
    amount: string;
    protocolFeeAtomic: string;
    protocolFee: string;
    estimatedReceivedAtomic: string;
    estimatedReceived: string;
  };
  speed: ExplorerSpeed;
  finalityThreshold: 1000 | 2000;
  retryCount: number;
  lastError: string | null;
  supersededBySessionId: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type ExplorerSummary = {
  transfers: number;
  successful: number;
  pending: number;
  failed: number;
  successRate: number;
  volumeUsdc: string;
  window: "24h" | "7d" | "30d" | "all";
  network: ExplorerNetwork | "ALL";
};

export type ExplorerListResponse = {
  items: ExplorerTransfer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type ExplorerFilters = {
  q?: string;
  network?: ExplorerNetwork;
  status?: ExplorerStatus;
  speed?: ExplorerSpeed;
  chainId?: number;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest";
};

const API_ORIGIN = (
  import.meta.env.VITE_SERVER_DIRECT_URL ||
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL ||
  "http://localhost:3200"
).replace(/\/+$/, "");

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_ORIGIN}/api/cctp-explorer${path}`, {
    method: "GET",
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : `Explorer request failed with status ${response.status}`
    );
  }

  return body.data as T;
}

function queryString(values: Record<string, unknown>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listCctpTransfers(
  filters: ExplorerFilters,
  signal?: AbortSignal
) {
  return request<ExplorerListResponse>(
    `/transfers${queryString(filters)}`,
    signal
  );
}

export function getCctpTransfer(identifier: string, signal?: AbortSignal) {
  return request<ExplorerTransfer>(
    `/transfers/${encodeURIComponent(identifier)}`,
    signal
  );
}

export function getCctpExplorerSummary(
  values: {
    network?: ExplorerNetwork;
    window?: "24h" | "7d" | "30d" | "all";
  },
  signal?: AbortSignal
) {
  return request<ExplorerSummary>(`/summary${queryString(values)}`, signal);
}
