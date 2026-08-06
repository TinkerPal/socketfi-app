import { useEffect, useRef, useState } from "react";
import { Menu, SlidersHorizontal } from "lucide-react";
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

function pageTitle(pathname: string, hash: string) {
  if (pathname === "/" && hash === "#activity") return "Activity";
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/automations/new")) return "Create automation";
  if (pathname.startsWith("/automations/")) return "Automation details";
  if (pathname === "/automations") return "Automations";
  if (pathname.startsWith("/settings/guardians")) return "Guardians";
  if (pathname.startsWith("/settings/sessions")) return "Automation permissions";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/dapps/")) return "dApp details";
  if (pathname === "/dapps") return "dApps";
  if (pathname === "/wallet-access") return "Wallet access";
  if (pathname === "/social-intent") return "Social intent";
  if (pathname === "/sessions") return "Sessions";
  return "SocketFi";
}

export default function Layout() {
  const [sidebarIsOpen, setSidebarIsOpen] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { setLoginIsOpen, activeSession, processProgress } = useStates();

  useEffect(() => {
    setSidebarIsOpen(false);
  }, [location.pathname, location.hash]);

  function handleOpenCreateAccount() {
    setLoginIsOpen(true);
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[var(--color-canvas)]">
      {!activeSession && <SignUp />}
      <SendModal />
      <TokenSelectorModal />
      <WalletKitModal />
      <EvmWalletModal />

      {processProgress?.message?.length === 0 && <LoadingModal />}

      <SideNavBar
        onOpenCreate={handleOpenCreateAccount}
        onOpenQuickSettings={() => setQuickSettingsOpen(true)}
        sidebarIsOpen={sidebarIsOpen}
        setSidebarIsOpen={setSidebarIsOpen}
        returnFocusRef={menuButtonRef}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex min-h-16 shrink-0 items-center gap-3 border-b border-[var(--color-border-default)] bg-[var(--color-surface)]/95 px-3 backdrop-blur-xl lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setSidebarIsOpen(true)}
            aria-label="Open navigation"
            aria-expanded={sidebarIsOpen}
            aria-controls="mobile-navigation"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm outline-none hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              SocketFi
            </p>
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {pageTitle(location.pathname, location.hash)}
            </p>
          </div>

          {activeSession ? (
            <>
              <NetworkIndicator compact className="hidden min-[375px]:inline-flex" />
              <button
                type="button"
                onClick={() => setQuickSettingsOpen(true)}
                aria-label="Open Quick Settings"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm outline-none hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
              >
                <SlidersHorizontal className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </header>

        <main
          id="main-content"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        >
          <Outlet />
        </main>
      </div>

      <QuickSettingsDrawer
        open={quickSettingsOpen}
        setOpen={setQuickSettingsOpen}
      />
    </div>
  );
}
