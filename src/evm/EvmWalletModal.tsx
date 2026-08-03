import { useEffect, useMemo, useState } from "react";
import type { Connector } from "wagmi";
import { useAccount, useConnect, useConnectors, useDisconnect } from "wagmi";
import {
  ArrowRight2,
  CloseCircle,
  DocumentDownload,
  Wallet3,
} from "iconsax-react";
import { Loader2 } from "lucide-react";

import { useStates } from "../context/StatesContext";

export const EVM_CONNECTED_EVENT = "socketfi:evm-wallet-connected";

interface EvmConnectedDetail {
  address: `0x${string}`;
  connectorId: string;
  connectorName: string;
}

interface WalletDisplayInfo {
  description: string;
  installUrl?: string;
  alwaysAvailable?: boolean;
}

const WALLET_DISPLAY_INFO: Record<string, WalletDisplayInfo> = {
  metamask: {
    description: "MetaMask browser or mobile wallet",
    installUrl: "https://metamask.io/download/",
  },

  "coinbase wallet": {
    description: "Coinbase Wallet or Smart Wallet",
    installUrl: "https://www.coinbase.com/wallet/downloads",
    alwaysAvailable: true,
  },

  walletconnect: {
    description: "Scan with a supported mobile wallet",
    alwaysAvailable: true,
  },

  rabby: {
    description: "Rabby browser or mobile wallet",
    installUrl: "https://rabby.io/",
  },

  phantom: {
    description: "Phantom multichain wallet",
    installUrl: "https://phantom.com/download",
  },

  "brave wallet": {
    description: "Brave browser wallet",
  },

  injected: {
    description: "Browser-injected EVM wallet",
  },
};

function normalizeName(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getDisplayInfo(connector: Connector): WalletDisplayInfo {
  const normalizedName = normalizeName(connector.name);
  const normalizedId = normalizeName(connector.id);

  return (
    WALLET_DISPLAY_INFO[normalizedName] ||
    WALLET_DISPLAY_INFO[normalizedId] || {
      description: "Connect using this EVM wallet",
    }
  );
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function getReadableError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;

    if (/user rejected|user denied|rejected the request/i.test(message)) {
      return "The connection request was cancelled.";
    }

    if (/already pending|request of type.*already pending/i.test(message)) {
      return "A wallet request is already open. Check your wallet extension.";
    }

    if (/connector not found|provider not found/i.test(message)) {
      return "The selected wallet is not installed or available.";
    }

    if (message) {
      return message;
    }
  }

  return "Unable to connect this wallet.";
}

function connectorIdentity(connector: Connector): string {
  return `${normalizeName(connector.id)}:${normalizeName(connector.name)}`;
}

function connectorPriority(connector: Connector): number {
  const value = `${connector.id} ${connector.name}`.toLowerCase();

  if (value.includes("metamask")) return 10;
  if (value.includes("coinbase")) return 20;
  if (value.includes("walletconnect")) return 30;
  if (value.includes("rabby")) return 40;
  if (value.includes("phantom")) return 50;
  if (value.includes("brave")) return 60;
  if (value.includes("injected")) return 100;

  return 70;
}

function buildVisibleConnectors(connectors: readonly Connector[]): Connector[] {
  const unique = new Map<string, Connector>();

  for (const connector of connectors) {
    const identity = connectorIdentity(connector);

    if (!unique.has(identity)) {
      unique.set(identity, connector);
    }
  }

  const result = Array.from(unique.values());

  /*
   * EIP-6963 may provide named installed wallets in addition to
   * a generic "Injected" connector. Keep the fallback, but place
   * it last.
   */
  return result.sort(
    (first, second) => connectorPriority(first) - connectorPriority(second)
  );
}

function WalletIcon({ connector }: { connector: Connector }) {
  const [failed, setFailed] = useState(false);

  if (connector.icon && !failed) {
    return (
      <img
        src={connector.icon}
        alt=""
        onError={() => setFailed(true)}
        className="h-11 w-11 rounded-2xl border border-slate-200 bg-white object-contain p-1.5"
      />
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold uppercase text-white">
      {connector.name.trim().charAt(0) || "W"}
    </span>
  );
}

export default function EvmWalletModal() {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [connectingUid, setConnectingUid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const connectors = useConnectors();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { isConnected } = useAccount();

  const { evmWalletIsOpen, setEvmWalletIsOpen, setLoginIsOpen } = useStates();

  const options = useMemo(
    () => buildVisibleConnectors(connectors),
    [connectors]
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (evmWalletIsOpen) {
      setShouldRender(true);
      timer = setTimeout(() => setIsVisible(true), 20);
    } else {
      setIsVisible(false);
      timer = setTimeout(() => setShouldRender(false), 200);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [evmWalletIsOpen]);

  useEffect(() => {
    if (!evmWalletIsOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !connectingUid) {
        closeModal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [evmWalletIsOpen, connectingUid]);

  function closeModal() {
    if (connectingUid) {
      return;
    }

    setErrorMessage("");
    setEvmWalletIsOpen(false);

    /*
     * Return to the main access modal if the wallet picker
     * was closed without a completed connection.
     */
    setLoginIsOpen(true);
  }

  function openInstallPage(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function connectorIsAvailable(connector: Connector): Promise<boolean> {
    const info = getDisplayInfo(connector);
    const identity = `${connector.id} ${connector.name}`.toLowerCase();

    if (info.alwaysAvailable) {
      return true;
    }

    if (identity.includes("walletconnect")) {
      return true;
    }

    if (identity.includes("coinbase")) {
      return true;
    }

    try {
      const provider = await connector.getProvider();
      return Boolean(provider);
    } catch {
      return false;
    }
  }

  async function selectWallet(connector: Connector) {
    if (connectingUid) {
      return;
    }

    const info = getDisplayInfo(connector);

    try {
      setConnectingUid(connector.uid);
      setErrorMessage("");

      const available = await connectorIsAvailable(connector);

      if (!available && info.installUrl) {
        openInstallPage(info.installUrl);
        return;
      }

      /*
       * Prevent an old wagmi connection from being silently reused
       * when the user deliberately selects another wallet.
       */
      if (isConnected) {
        await disconnectAsync();
      }

      const result = await connectAsync({
        connector,
      });

      const address = result.accounts?.[0];

      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(
          "The selected wallet did not return a valid EVM address."
        );
      }

      const normalizedAddress = address.toLowerCase() as `0x${string}`;

      const detail: EvmConnectedDetail = {
        address: normalizedAddress,
        connectorId: connector.id,
        connectorName: connector.name,
      };

      setEvmWalletIsOpen(false);
      setErrorMessage("");

      /*
       * Your EVM authentication flow should listen for this event,
       * request the network-bound challenge from the backend and
       * ask this connected wallet to sign it.
       */
      window.dispatchEvent(
        new CustomEvent<EvmConnectedDetail>(EVM_CONNECTED_EVENT, {
          detail,
        })
      );
    } catch (error) {
      console.error("[evm-wallet/connect]", error);
      setErrorMessage(getReadableError(error));
    } finally {
      setConnectingUid(null);
    }
  }

  if (!shouldRender) {
    return null;
  }

  return (
    <section
      className={`fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-md transition-opacity duration-200 sm:items-center sm:px-6 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={closeModal}
      aria-labelledby="evm-wallet-title"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-describedby="evm-wallet-description"
        onClick={(event) => event.stopPropagation()}
        className={`w-full max-w-[470px] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.24)] transition duration-200 ${
          isVisible ? "translate-y-0 scale-100" : "translate-y-5 scale-[0.98]"
        }`}
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-5 sm:px-6">
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Wallet3 size="22" variant="Bulk" />
            </div>

            <h2
              id="evm-wallet-title"
              className="mt-4 text-xl font-semibold tracking-tight text-slate-950"
            >
              Choose an EVM wallet
            </h2>

            <p
              id="evm-wallet-description"
              className="mt-1 text-sm leading-6 text-slate-500"
            >
              Connect a browser wallet or scan with your mobile wallet.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close wallet picker"
            onClick={closeModal}
            disabled={Boolean(connectingUid)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloseCircle size="20" />
          </button>
        </header>

        <div className="max-h-[62dvh] space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
          {options.length > 0 ? (
            options.map((connector) => {
              const connecting = connectingUid === connector.uid;
              const info = getDisplayInfo(connector);
              const isWalletConnect = `${connector.id} ${connector.name}`
                .toLowerCase()
                .includes("walletconnect");

              return (
                <button
                  key={connector.uid}
                  type="button"
                  onClick={() => void selectWallet(connector)}
                  disabled={Boolean(connectingUid)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <WalletIcon connector={connector} />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-950">
                      {connector.name}
                    </span>

                    <span className="mt-0.5 block text-xs text-slate-500">
                      {connecting
                        ? "Connecting…"
                        : isWalletConnect && isMobileDevice()
                        ? "Open a wallet app"
                        : info.description}
                    </span>
                  </span>

                  {connecting ? (
                    <Loader2
                      size={18}
                      className="animate-spin text-slate-500"
                    />
                  ) : info.installUrl ? (
                    <ArrowRight2
                      size="18"
                      className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700"
                    />
                  ) : (
                    <DocumentDownload
                      size="19"
                      className="hidden text-slate-400"
                    />
                  )}
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center">
              <p className="text-sm font-medium text-slate-800">
                No EVM connectors are configured.
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Check your wagmi configuration and WalletConnect project ID.
              </p>
            </div>
          )}

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>

        <footer className="border-t border-slate-200 px-5 py-4">
          <p className="text-center text-xs leading-5 text-slate-400">
            SocketFi only requests a signature. It never receives your recovery
            phrase or private key.
          </p>
        </footer>
      </div>
    </section>
  );
}
