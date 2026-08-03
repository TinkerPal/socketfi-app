import type { AppNetwork, Dashboard, Pool } from "./types";

const API_BASE = String(import.meta.env.VITE_SOCKETFI_DIRECT_API_URL || "")
  .trim()
  .replace(/\/$/, "");

const api = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

export async function fetchBlendPools(
  network: AppNetwork,
  options: { refresh?: boolean; signal?: AbortSignal } = {}
): Promise<{ pools: Pool[]; dashboard: Dashboard | null }> {
  const params = new URLSearchParams({ network, includeInactive: "true" });
  if (options.refresh) params.set("refresh", "true");

  const response = await fetch(api(`/api/blend/pools?${params}`), {
    headers: { Accept: "application/json" },
    credentials: "include",
    signal: options.signal,
  });
  const body = await readJson(response);

  if (!response.ok || !body?.success) {
    throw new Error(body?.error || `Blend API failed with HTTP ${response.status}`);
  }

  return {
    pools: Array.isArray(body.data?.pools) ? body.data.pools : [],
    dashboard: body.data?.dashboard || null,
  };
}

export async function fetchBlendPool(
  network: AppNetwork,
  poolContract: string,
  options: { refresh?: boolean; signal?: AbortSignal } = {}
): Promise<Pool> {
  const { pools } = await fetchBlendPools(network, options);
  const pool = pools.find((item) => item.id === poolContract);
  if (!pool) throw new Error("Blend pool was not found on the selected network.");
  return pool;
}
