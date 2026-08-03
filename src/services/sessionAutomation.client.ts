export type Network = "PUBLIC" | "TESTNET";

export type SessionStatus = "ACTIVE" | "REVOKED" | "EXPIRED" | "INVALIDATED";

export type AutomationStatus =
  | "DRAFT"
  | "AWAITING_SESSION"
  | "AWAITING_PAYMENT"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type AutomationType =
  | "DISBURSEMENT"
  | "DCA"
  | "REBALANCE"
  | "AMPLIDEX_LONG"
  | "AMPLIDEX_SHORT";

const ORIGIN = (
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL || "http://localhost:3200"
).replace(/\/+$/, "");

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${ORIGIN}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : `Request failed (${response.status})`
    );
  }

  return body.data as T;
}

function buildQuery(
  values: Record<string, string | number | boolean | null | undefined>
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "string" && value.trim() === "") {
      continue;
    }

    params.set(key, String(value));
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

export const api = {
  listSessions: (
    network: Network,
    token: string,
    status?: SessionStatus | "",
    search?: string,
    page = 1,
    limit = 25
  ) =>
    request<any>(
      `/api/sessions${buildQuery({
        network,
        status,
        q: search?.trim(),
        page,
        limit,
      })}`,
      token
    ),

  getSession: (network: Network, policyIdHex: string, token: string) =>
    request<any>(
      `/api/sessions/${encodeURIComponent(network)}/${encodeURIComponent(
        policyIdHex
      )}`,
      token
    ),

  registerSession: (body: any, token: string) =>
    request<any>("/api/sessions/register", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  confirmRevoke: (body: any, token: string) =>
    request<any>("/api/sessions/confirm-revocation", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  confirmRevokeAll: (body: any, token: string) =>
    request<any>("/api/sessions/confirm-revoke-all", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listAutomations: (
    network: Network,
    token: string,
    status?: AutomationStatus | "",
    type?: AutomationType | ""
  ) =>
    request<any[]>(
      `/api/automations${buildQuery({
        network,
        status,
        type,
      })}`,
      token
    ),

  getAutomation: (id: string, token: string) =>
    request<any>(`/api/automations/${encodeURIComponent(id)}`, token),

  registerAutomation: (body: any, token: string) =>
    request<any>("/api/automations/register", token, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateAutomation: (
    id: string,
    status: "ACTIVE" | "PAUSED" | "CANCELLED",
    token: string
  ) =>
    request<any>(`/api/automations/${encodeURIComponent(id)}/status`, token, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
