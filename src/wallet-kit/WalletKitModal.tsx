import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight2,
  CloseCircle,
  DocumentDownload,
  Wallet3,
} from "iconsax-react";

import { useStates } from "../context/StatesContext";
import { WalletKitService } from "./services/global-service";

const STELLAR_CONNECTED_EVENT = "socketfi:stellar-wallet-connected";

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

async function resolveConnectedAddress(loginResult: unknown): Promise<string> {
  if (typeof loginResult === "string") {
    return loginResult;
  }

  const result = loginResult as WalletLoginResult;

  const direct = result?.address || result?.publicKey || result?.account;

  if (direct) {
    return direct;
  }

  const service = WalletKitService as unknown as {
    getAddress?: () => Promise<string | { address?: string }>;

    walletKit?: {
      getAddress?: () => Promise<string | { address?: string }>;
    };
  };

  if (typeof service.getAddress === "function") {
    const addressResult = await service.getAddress();

    return typeof addressResult === "string"
      ? addressResult
      : addressResult?.address || "";
  }

  if (typeof service.walletKit?.getAddress === "function") {
    const addressResult = await service.walletKit.getAddress();

    return typeof addressResult === "string"
      ? addressResult
      : addressResult?.address || "";
  }

  return "";
}

export default function WalletKitModal() {
  const [availability, setAvailability] = useState<Map<string, boolean>>(
    new Map()
  );

  const [isVisible, setIsVisible] = useState(false);

  const [shouldRender, setShouldRender] = useState(false);

  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const {
    walletKitIsOpen,
    setWalletKitIsOpen,
    setUserKey,
    setNetwork,
    setLoginIsOpen,
  } = useStates();

  const options = useMemo(
    () => WalletKitService.walletKit.modules as WalletKitOption[],
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAvailability() {
      const results = await Promise.allSettled(
        options.map((option) => option.isAvailable())
      );

      if (cancelled) {
        return;
      }

      const next = new Map<string, boolean>();

      results.forEach((result, index) => {
        next.set(
          options[index].productName,
          result.status === "fulfilled" && result.value === true
        );
      });

      setAvailability(next);
    }

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [options]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (walletKitIsOpen) {
      setShouldRender(true);

      timer = setTimeout(() => setIsVisible(true), 20);
    } else {
      setIsVisible(false);

      timer = setTimeout(() => setShouldRender(false), 200);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [walletKitIsOpen]);

  function closeModal() {
    if (connectingWallet) {
      return;
    }

    setWalletKitIsOpen(false);
    setErrorMessage("");

    /*
     * Return to the access modal if the user closes
     * the wallet picker without selecting a wallet.
     */
    setLoginIsOpen(true);
  }

  function openDownload(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function selectWallet(option: WalletKitOption) {
    const installed = availability.get(option.productName);

    if (!installed) {
      openDownload(option.productUrl);

      return;
    }

    try {
      setConnectingWallet(option.productName);

      setErrorMessage("");

      const loginResult = await WalletKitService.login(
        option.productId,
        setUserKey,
        setNetwork
      );

      const address = await resolveConnectedAddress(loginResult);

      if (!address) {
        throw new Error("The selected wallet did not return an address.");
      }

      setWalletKitIsOpen(false);

      window.dispatchEvent(
        new CustomEvent(STELLAR_CONNECTED_EVENT, {
          detail: {
            address,
            productId: option.productId,
            productName: option.productName,
          },
        })
      );
    } catch (error) {
      console.error("[wallet-kit/connect]", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect this wallet."
      );
    } finally {
      setConnectingWallet(null);
    }
  }

  if (!shouldRender) {
    return null;
  }

  return (
    <section
      className={`fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-md transition-opacity duration-200 sm:items-center sm:px-6 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={closeModal}
      aria-labelledby="wallet-kit-title"
    >
      <div
        role="dialog"
        aria-modal="true"
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
              id="wallet-kit-title"
              className="mt-4 text-xl font-semibold tracking-tight text-slate-950"
            >
              Choose a Stellar wallet
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Select an installed wallet to continue.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={closeModal}
            disabled={Boolean(connectingWallet)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CloseCircle size="20" />
          </button>
        </header>

        <div className="max-h-[62dvh] space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
          {options.map((option) => {
            const installed = availability.get(option.productName);

            const connecting = connectingWallet === option.productName;

            return (
              <button
                key={option.productId}
                type="button"
                onClick={() => selectWallet(option)}
                disabled={Boolean(connectingWallet)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <img
                  src={option.productIcon}
                  alt=""
                  className="h-11 w-11 rounded-2xl border border-slate-200 object-cover"
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-950">
                    {option.productName}
                  </span>

                  <span className="mt-0.5 block text-xs text-slate-500">
                    {connecting
                      ? "Connecting…"
                      : installed
                      ? "Installed"
                      : "Install wallet"}
                  </span>
                </span>

                {installed ? (
                  <ArrowRight2
                    size="18"
                    className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700"
                  />
                ) : (
                  <DocumentDownload size="19" className="text-slate-400" />
                )}
              </button>
            );
          })}

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
            SocketFi never receives your wallet recovery phrase or private key.
          </p>
        </footer>
      </div>
    </section>
  );
}
