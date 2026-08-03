export type SocketFiNetwork = "PUBLIC" | "TESTNET";

export type SocketFiTenant = {
  id: "mainnet" | "testnet";
  network: SocketFiNetwork;
  hostname: string;
  appName: string;
  apiUrl: string;
  explorerUrl: string;
};

const normalizeHostname = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "");

const MAINNET_HOST =
  import.meta.env.VITE_MAINNET_HOST?.trim() || "socketfi.app";

const TESTNET_HOST =
  import.meta.env.VITE_TESTNET_HOST?.trim() || "testnet.socketfi.app";

const API_URL = (
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL || "http://localhost:3200"
).replace(/\/+$/, "");

const TENANTS: Record<"mainnet" | "testnet", SocketFiTenant> = {
  mainnet: {
    id: "mainnet",
    network: "PUBLIC",
    hostname: normalizeHostname(MAINNET_HOST),
    appName: "SocketFi",
    apiUrl: API_URL,
    explorerUrl:
      import.meta.env.VITE_PUBLIC_EXPLORER_URL?.trim() ||
      "https://socketfi.app/explorer",
  },

  testnet: {
    id: "testnet",
    network: "TESTNET",
    hostname: normalizeHostname(TESTNET_HOST),
    appName: "SocketFi Testnet",
    apiUrl: API_URL,
    explorerUrl:
      import.meta.env.VITE_TESTNET_EXPLORER_URL?.trim() ||
      "https://socketfi.app/explorer",
  },
};

export function resolveSocketFiTenant(
  hostname: string = window.location.hostname
): SocketFiTenant {
  const normalized = normalizeHostname(hostname);

  if (normalized === TENANTS.mainnet.hostname) {
    return TENANTS.mainnet;
  }

  if (normalized === TENANTS.testnet.hostname) {
    return TENANTS.testnet;
  }

  /*
   * Local-development mapping.
   *
   * localhost:5173 -> TESTNET by default
   * localhost:5174 -> PUBLIC
   */
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  ) {
    return window.location.port === "5174" ? TENANTS.mainnet : TENANTS.testnet;
  }

  throw new Error(`Unsupported SocketFi hostname: ${normalized}`);
}

export const socketFiTenant = resolveSocketFiTenant();

export const SOCKETFI_NETWORK = socketFiTenant.network;
