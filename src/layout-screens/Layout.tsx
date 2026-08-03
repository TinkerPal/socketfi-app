import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Menu,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";

import LoadingModal from "../components/LoadingModal";
import NetworkIndicator from "../components/NetworkIndicator";
import SendModal from "../components/SendModal";
import TokenSelectorModal from "../pages/swaps/TokenSelectorModal";

import WalletKitModal from "../wallet-kit/WalletKitModal";
import { useStates } from "../context/StatesContext";
import SideNavBar from "./SideNavBar";
import QuickSettingsDrawer from "./QuickSettingsDrawer";
import EvmWalletModal from "../evm/EvmWalletModal";
import SignUp from "../pages/login-files/Signup";

type Network = "TESTNET" | "PUBLIC";

interface SessionShape {
  userProfile?: {
    address?: Partial<Record<Network, string>>;
  };
}

interface ResolvedAccount {
  address: string;
  label: string;
  username: string;
}

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function maskAddress(address: string, visibleCharacters = 7): string {
  if (!address) {
    return "";
  }

  if (address.length <= visibleCharacters * 2 + 3) {
    return address;
  }

  return `${address.slice(0, visibleCharacters)}…${address.slice(
    -visibleCharacters
  )}`;
}

function getSessionAddress(activeSession: unknown, network: Network): string {
  const session = activeSession as SessionShape | null;

  return session?.userProfile?.address?.[network] || "";
}

export default function Layout() {
  const [sidebarIsOpen, setSidebarIsOpen] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const location = useLocation();

  const {
    setLoginIsOpen,
    activeSession,
    processProgress,
    selectedNetwork,
    toast,
  } = useStates();

  const network = selectedNetwork as Network;

  const bridgeExplorerUrl =
    import.meta.env.VITE_CCTP_EXPLORER_URL?.trim() || "/explorer";

  const account = useMemo<ResolvedAccount>(
    () => ({
      address: getSessionAddress(activeSession, network),
      label: "Your wallet",
      username: "",
    }),
    [activeSession, network]
  );

  const hasAccount = Boolean(account.address);

  useEffect(() => {
    if (!quickSettingsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setQuickSettingsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleEscape);
    };
  }, [quickSettingsOpen]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 2_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  useEffect(() => {
    setSidebarIsOpen(false);
  }, [location.pathname]);

  function handleOpenSidebar() {
    setSidebarIsOpen(true);
  }

  function handleOpenCreateAccount() {
    setLoginIsOpen(true);
  }

  function buildExplorerUrl(address: string): string {
    const stellarNetwork = network === "PUBLIC" ? "public" : "testnet";

    return `https://stellar.expert/explorer/${stellarNetwork}/contract/${address}`;
  }

  function openAccountInExplorer() {
    if (!account.address) {
      return;
    }

    window.open(
      buildExplorerUrl(account.address),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function copyAddress() {
    if (!account.address) {
      return;
    }

    try {
      await navigator.clipboard.writeText(account.address);

      setCopied(true);
      toast.success("Smart account ID copied.");
    } catch (error) {
      console.error("[layout/copy-address]", error);

      toast.error("Unable to copy the account ID.");
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      {!activeSession && <SignUp />}
      <SendModal />
      <TokenSelectorModal />
      <WalletKitModal />
      <EvmWalletModal />

      {processProgress?.message?.length === 0 && <LoadingModal />}

      <SideNavBar
        onOpenCreate={handleOpenCreateAccount}
        sidebarIsOpen={sidebarIsOpen}
        setSidebarIsOpen={setSidebarIsOpen}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
          {/* Mobile */}
          <div className="lg:hidden">
            <div className="flex h-14 items-center gap-2 px-4">
              <button
                type="button"
                onClick={handleOpenSidebar}
                aria-label="Open navigation"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1" />

              <a
                href={bridgeExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Bridge Explorer"
                title="Bridge Explorer"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <ExternalLink className="h-4 w-4" />
              </a>

              <NetworkIndicator compact />

              <button
                type="button"
                onClick={() => setQuickSettingsOpen(true)}
                disabled={!activeSession}
                aria-label="Open quick settings"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>

            {hasAccount ? (
              <div className="border-t border-slate-100 px-4 py-3">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                      {account.label}
                    </p>

                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <div className="min-w-0 truncate text-left text-sm font-semibold text-slate-950 transition ">
                        {maskAddress(account.address, 7)}
                      </div>

                      {account.username ? (
                        <span className="max-w-[120px] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {account.username}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={openAccountInExplorer}
                      aria-label="Open wallet in explorer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void copyAddress()}
                      aria-label={
                        copied ? "Address copied" : "Copy wallet address"
                      }
                      className={classNames(
                        "inline-flex h-9 w-9 items-center justify-center rounded-xl transition focus:outline-none focus:ring-2 focus:ring-slate-300",
                        copied
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                      )}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Desktop */}
          <div className="hidden h-16 items-center justify-between gap-6 px-5 lg:flex xl:px-8">
            <div className="min-w-0 flex-1">
              {hasAccount ? (
                <div className="flex min-w-0 items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                      {account.label}
                    </p>

                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <div className="max-w-[520px] truncate text-left text-sm font-semibold text-slate-950 transition  2xl:max-w-none">
                        <span className="2xl:hidden">
                          {maskAddress(account.address, 10)}
                        </span>

                        <span className="hidden 2xl:inline">
                          {account.address}
                        </span>
                      </div>

                      {account.username ? (
                        <span className="max-w-[180px] truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {account.username}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void copyAddress()}
                    aria-label={
                      copied ? "Address copied" : "Copy wallet address"
                    }
                    className={classNames(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition focus:outline-none focus:ring-2 focus:ring-slate-300",
                      copied
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                    )}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={openAccountInExplorer}
                    aria-label="Open wallet in explorer"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">SocketFi Wallet</p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <a
                href={bridgeExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Bridge Explorer
                <ExternalLink className="h-4 w-4" />
              </a>

              <div className="h-7 w-px bg-slate-200" aria-hidden="true" />

              <NetworkIndicator />

              <button
                type="button"
                onClick={() => setQuickSettingsOpen(true)}
                disabled={!activeSession}
                aria-label="Open quick settings"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Settings2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="h-full min-h-0 w-full overflow-y-auto">
            <div className="mx-auto min-h-full w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <QuickSettingsDrawer
        open={quickSettingsOpen}
        setOpen={setQuickSettingsOpen}
      />
    </div>
  );
}
