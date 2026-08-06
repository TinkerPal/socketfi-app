import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { useDisconnect } from "wagmi";
import {
  Activity,
  Bot,
  Check,
  Copy,
  Download,
  ExternalLink,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { startAuthentication } from "@simplewebauthn/browser";

import Logo from "../assets/socketLogo.svg";
import NetworkIndicator from "../components/NetworkIndicator";
import { useStates } from "../context/StatesContext";
import { removeAuthSession } from "../storage/indexdb-session-store";
import { removeAuthSession as removeLocalAuthSession } from "../utils/localStorage";
import { postRequest } from "../utils/fetch-functions";

type Network = "TESTNET" | "PUBLIC";

interface NavigationItem {
  id: "overview" | "dapps" | "automations";
  label: string;
  icon: ComponentType<{ className?: string }>;
  link: string;
}

interface SideNavBarProps {
  sidebarIsOpen: boolean;
  setSidebarIsOpen: (open: boolean) => void;
  onOpenCreate: () => void;
  onOpenQuickSettings: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

interface SidebarNavProps {
  onClose: () => void;
  onOpenCreate: () => void;
  onOpenQuickSettings: () => void;
  onLogout: () => Promise<void>;
  onUpgrade: () => Promise<void>;
  isUpgrading: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    link: "/",
  },
  {
    id: "dapps",
    label: "dApps",
    icon: Grid2X2,
    link: "/dapps",
  },
  {
    id: "automations",
    label: "Automations",
    icon: Bot,
    link: "/automations",
  },
];

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function getWalletAddress(
  activeSession: unknown,
  network: Network
): string | null {
  const session = activeSession as {
    userProfile?: {
      address?: Partial<Record<Network, string>>;
    };
  } | null;

  return session?.userProfile?.address?.[network] || null;
}

function maskAddress(address: string, visible = 7) {
  if (address.length <= visible * 2 + 3) return address;
  return `${address.slice(0, visible)}…${address.slice(-visible)}`;
}

function focusTrap(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const elements = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)
  );
  if (!elements.length) return;
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function SidebarNav({
  onClose,
  onOpenCreate,
  onOpenQuickSettings,
  onLogout,
  onUpgrade,
  isUpgrading,
}: SidebarNavProps) {
  const { activeSession, selectedNetwork, toast, versionInfo } = useStates();
  const location = useLocation();
  const [copied, setCopied] = useState(false);
  const network = selectedNetwork as Network;
  const accountAddress = getWalletAddress(activeSession, network) || "";
  const isAuthenticated = Boolean(activeSession);
  const bridgeExplorerUrl =
    import.meta.env.VITE_CCTP_EXPLORER_URL?.trim() || "/explorer";

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2_000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  function itemIsActive(item: NavigationItem) {
    if (item.id === "overview") {
      return location.pathname === "/";
    }
    if (item.id === "dapps") {
      return location.pathname.startsWith("/dapps");
    }
    return location.pathname.startsWith("/automations");
  }

  function buildExplorerUrl(address: string) {
    const stellarNetwork = network === "PUBLIC" ? "public" : "testnet";
    return `https://stellar.expert/explorer/${stellarNetwork}/contract/${address}`;
  }

  async function copyAddress() {
    if (!accountAddress) return;
    try {
      await navigator.clipboard.writeText(accountAddress);
      setCopied(true);
      toast.success("Smart account ID copied.");
    } catch (error) {
      console.error("[sidebar/copy-address]", error);
      toast.error("Unable to copy the account ID.");
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="hidden px-2 pb-5 lg:block">
        <NavLink
          to="/"
          className="inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
          aria-label="SocketFi Overview"
        >
          <img src={Logo} alt="SocketFi" className="h-10 w-auto" />
        </NavLink>
      </div>

      {isAuthenticated ? (
        <nav className="flex-1" aria-label="Primary navigation">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Workspace
          </p>
          <div className="mt-2 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = itemIsActive(item);
              return (
                <NavLink
                  key={item.id}
                  to={item.link}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={classNames(
                    "group flex min-h-11 items-center rounded-[var(--radius-control)] border px-3 py-2.5 text-sm font-semibold outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
                    active
                      ? "border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] shadow-sm"
                      : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  <Icon
                    className={classNames(
                      "mr-3 h-5 w-5 shrink-0",
                      active
                        ? "text-[var(--color-action-primary)]"
                        : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      ) : (
        <div className="flex flex-1 flex-col justify-center rounded-[var(--radius-panel)] border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] p-4 text-center">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Access your SocketFi account
          </p>
          <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">
            Sign in or create an account to view balances, activity, and automations.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCreate();
            }}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-action-primary)] px-4 text-sm font-semibold text-[var(--color-text-inverse)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
          >
            Access account
          </button>
        </div>
      )}

      {isAuthenticated ? (
        <div className="mt-6 space-y-3 border-t border-[var(--color-border-default)] pt-5">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              classNames(
                "group flex min-h-11 items-center rounded-[var(--radius-control)] border px-3 py-2.5 text-sm font-semibold outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]",
                isActive
                  ? "border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
              )
            }
          >
            <Settings className="mr-3 h-5 w-5 text-[var(--color-text-muted)]" />
            Settings
          </NavLink>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-surface-subtle)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  Smart account
                </p>
                <p className="mt-1 truncate font-mono text-xs font-semibold text-[var(--color-text-primary)]" title={accountAddress}>
                  {maskAddress(accountAddress)}
                </p>
              </div>
              <NetworkIndicator compact />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => void copyAddress()}
                aria-label={copied ? "Account address copied" : "Copy account address"}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
              >
                {copied ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : <Copy className="h-4 w-4" />}
              </button>
              <a
                href={buildExplorerUrl(accountAddress)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open account in Stellar Expert"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={bridgeExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open Bridge Explorer"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
              >
                <Activity className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQuickSettings();
                }}
                aria-label="Open Quick Settings"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          {versionInfo?.needUpdate ? (
            <button
              type="button"
              onClick={() => void onUpgrade()}
              disabled={isUpgrading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-3 text-sm font-semibold text-[var(--color-warning)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {isUpgrading ? "Updating…" : "Update wallet"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void onLogout()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-danger-surface)] hover:text-[var(--color-danger)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function SideNavBar({
  sidebarIsOpen,
  setSidebarIsOpen,
  onOpenCreate,
  onOpenQuickSettings,
  returnFocusRef,
}: SideNavBarProps) {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const { disconnect } = useDisconnect();
  const drawerRef = useRef<HTMLElement>(null);

  const {
    activeSession,
    setActiveSession,
    updateSession,
    setTransactionStats,
    selectedNetwork,
    triggerUpdate,
    setIsTransacting,
    toast,
    setSessionId,
  } = useStates();

  const location = useLocation();
  const navigate = useNavigate();
  const network = selectedNetwork as Network;
  const activeWalletAddress = useMemo(
    () => getWalletAddress(activeSession, network),
    [activeSession, network]
  );

  useEffect(() => {
    setSidebarIsOpen(false);
  }, [location.hash, location.pathname, setSidebarIsOpen]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) setSidebarIsOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setSidebarIsOpen]);

  useEffect(() => {
    if (!sidebarIsOpen) return;
    const previousOverflow = document.body.style.overflow;
    const returnFocusTarget = returnFocusRef.current;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => drawerRef.current?.focus(), 0);

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSidebarIsOpen(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
      returnFocusTarget?.focus();
    };
  }, [returnFocusRef, setSidebarIsOpen, sidebarIsOpen]);

  async function upgradeHandler() {
    if (!activeSession || !activeWalletAddress || isUpgrading) return;
    const sessionId = uuidv4();
    try {
      setIsUpgrading(true);
      setIsTransacting?.(true);
      setSessionId(sessionId);
      const signatureOptions = await postRequest(
        "init-sign-transaction",
        {
          contractId: activeWalletAddress,
          network,
          callFunction: "upgrade",
          sId: sessionId,
        },
        activeSession.accessToken
      );
      if (!signatureOptions?.options) {
        throw new Error("Unable to prepare the wallet update.");
      }
      const signatureData = await startAuthentication({
        optionsJSON: signatureOptions.options,
      });
      const transaction = await postRequest(
        "upgrade-wallet-with-sig",
        {
          contractId: activeWalletAddress,
          network,
          sigData: signatureData,
          sId: sessionId,
        },
        activeSession.accessToken
      );
      if (!transaction) throw new Error("The wallet update did not complete.");
      toast.success("Wallet updated successfully.");
      triggerUpdate();
    } catch (error) {
      console.error("[wallet/upgrade]", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to update the wallet."
      );
      setSessionId("");
    } finally {
      setSessionId("");
      setIsUpgrading(false);
      setIsTransacting?.(false);
    }
  }

  async function logoutHandler() {
    try {
      try {
        disconnect();
      } catch (error) {
        console.warn("[wallet/logout/evm-disconnect]", error);
      }
      await removeAuthSession();
      await Promise.resolve(removeLocalAuthSession());
      setActiveSession(null);
      setTransactionStats(null);
      setSessionId("");
      await updateSession();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("[wallet/logout]", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to disconnect the wallet."
      );
    }
  }

  const sidebarContent = (
    <SidebarNav
      onClose={() => setSidebarIsOpen(false)}
      onOpenCreate={onOpenCreate}
      onOpenQuickSettings={onOpenQuickSettings}
      onLogout={logoutHandler}
      onUpgrade={upgradeHandler}
      isUpgrading={isUpgrading}
    />
  );

  return (
    <>
      {sidebarIsOpen ? (
        <div className="fixed inset-0 z-[210] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarIsOpen(false)}
            className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-sm"
          />
          <aside
            id="mobile-navigation"
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-navigation-title"
            onKeyDown={focusTrap}
            className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col bg-[var(--color-surface)] shadow-2xl outline-none motion-reduce:transition-none"
          >
            <header className="flex min-h-16 items-center justify-between border-b border-[var(--color-border-default)] px-4">
              <div>
                <img src={Logo} alt="" className="h-8 w-auto" />
                <h2 id="mobile-navigation-title" className="sr-only">
                  SocketFi navigation
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setSidebarIsOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
              {sidebarContent}
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden h-dvh w-72 shrink-0 border-r border-[var(--color-border-default)] bg-[var(--color-surface)] lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
          <SidebarNav
            onClose={() => undefined}
            onOpenCreate={onOpenCreate}
            onOpenQuickSettings={onOpenQuickSettings}
            onLogout={logoutHandler}
            onUpgrade={upgradeHandler}
            isUpgrading={isUpgrading}
          />
        </div>
      </aside>
    </>
  );
}
