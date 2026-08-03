import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useDisconnect } from "wagmi";
import {
  Bot,
  CircleGauge,
  Download,
  Grid2X2,
  KeyRound,
  LogOut,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { startAuthentication } from "@simplewebauthn/browser";

import Logo from "../assets/socketLogo.svg";
import { useStates } from "../context/StatesContext";
import { removeAuthSession } from "../storage/indexdb-session-store";
import { removeAuthSession as removeLocalAuthSession } from "../utils/localStorage";
import { postRequest } from "../utils/fetch-functions";

type Network = "TESTNET" | "PUBLIC";

interface NavigationItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  link: string;
  badge?: {
    text: string;
    tone: "indigo" | "slate";
  };
}

interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

interface SideNavBarProps {
  sidebarIsOpen: boolean;
  setSidebarIsOpen: (open: boolean) => void;
  onOpenCreate: () => void;
}

interface SidebarNavProps {
  onClose: () => void;
  onOpenCreate: () => void;
  onLogout: () => Promise<void>;
  onUpgrade: () => Promise<void>;
  isUpgrading: boolean;
}

const navigationGroups: NavigationGroup[] = [
  {
    title: "Wallet",
    items: [
      {
        id: "wallet",
        label: "My Wallet",
        icon: Wallet,
        link: "/",
      },
      // {
      //   id: "explorer",
      //   label: "Bridge Explorer",
      //   icon: CircleGauge,
      //   link: "/explorer",
      //   badge: {
      //     text: "Public",
      //     tone: "slate",
      //   },
      // },
      {
        id: "dapps",
        label: "dApps",
        icon: Grid2X2,
        link: "/dapps",
      },
    ],
  },
  {
    title: "Advanced",
    items: [
      // {
      //   id: "sessions",
      //   label: "Sessions",
      //   icon: KeyRound,
      //   link: "/sessions",
      // },
      {
        id: "strategies",
        label: "Strategies & Automation",
        icon: Bot,
        link: "/automations",
      },
    ],
  },
];

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

function SidebarNav({
  onClose,
  onOpenCreate,
  onLogout,
  onUpgrade,
  isUpgrading,
}: SidebarNavProps) {
  const { activeSession, versionInfo } = useStates();

  const isAuthenticated = Boolean(activeSession);

  return (
    <div className="flex min-h-full flex-col">
      <div className="hidden border-b border-slate-200 px-4 pb-4 lg:block">
        <NavLink
          to="/"
          className="inline-flex items-center"
          aria-label="SocketFi Wallet"
        >
          <img src={Logo} alt="SocketFi" className="h-10 w-auto" />
        </NavLink>
      </div>

      <div className="mt-5">
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => void onLogout()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <LogOut className="h-4.5 w-4.5" />
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCreate();
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Create account or log in
          </button>
        )}
      </div>

      <nav className="mt-8 flex-1 space-y-7" aria-label="Primary navigation">
        {navigationGroups
          .filter((group) => group.title !== "Advanced" || isAuthenticated)
          .map((group) => (
            <div key={group.title}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {group.title}
              </p>

              <div className="mt-2 space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.id}
                      to={item.link}
                      end={item.link === "/"}
                      onClick={onClose}
                      className={({ isActive }) =>
                        classNames(
                          "group flex min-h-11 items-center rounded-xl px-3 py-2.5 text-sm font-medium transition",
                          isActive
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={classNames(
                              "mr-3 h-5 w-5 shrink-0",
                              isActive
                                ? "text-white"
                                : "text-slate-400 group-hover:text-slate-700"
                            )}
                          />

                          <span className="truncate">{item.label}</span>

                          {item.badge ? (
                            <span
                              className={classNames(
                                "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                                item.badge.tone === "indigo"
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "bg-slate-200 text-slate-700"
                              )}
                            >
                              {item.badge.text}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
      </nav>

      {isAuthenticated ? (
        <div className="mt-8 border-t border-slate-200 pt-5">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              classNames(
                "group flex min-h-11 items-center rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Settings
                  className={classNames(
                    "mr-3 h-5 w-5",
                    isActive ? "text-white" : "text-slate-400"
                  )}
                />
                Account settings
              </>
            )}
          </NavLink>

          <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Wallet version
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {versionInfo?.needUpdate ? "Update available" : "Up to date"}
                </p>
              </div>

              <span
                className={classNames(
                  "h-2.5 w-2.5 rounded-full",
                  versionInfo?.needUpdate ? "bg-amber-400" : "bg-emerald-500"
                )}
                aria-hidden="true"
              />
            </div>

            {versionInfo?.needUpdate ? (
              <button
                type="button"
                onClick={() => void onUpgrade()}
                disabled={isUpgrading}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {isUpgrading ? "Updating…" : "Update wallet"}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">
            Advanced controls
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Log in to manage sessions, strategies, automation, and account
            settings.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SideNavBar({
  sidebarIsOpen,
  setSidebarIsOpen,
  onOpenCreate,
}: SideNavBarProps) {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const { disconnect } = useDisconnect();

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
  }, [location.pathname, setSidebarIsOpen]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setSidebarIsOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [setSidebarIsOpen]);

  useEffect(() => {
    if (!sidebarIsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [sidebarIsOpen, setSidebarIsOpen]);

  async function upgradeHandler() {
    if (!activeSession || !activeWalletAddress || isUpgrading) {
      return;
    }

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

      if (!transaction) {
        throw new Error("The wallet update did not complete.");
      }

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
      /*
       * Disconnect the active wagmi connector/session first.
       */
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

  return (
    <>
      {sidebarIsOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarIsOpen(false)}
            className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-[2px]"
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="SocketFi navigation"
            className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col bg-white shadow-2xl"
          >
            <header className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <img src={Logo} alt="SocketFi" className="h-9 w-auto" />

              <button
                type="button"
                aria-label="Close sidebar"
                onClick={() => setSidebarIsOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              <SidebarNav
                onClose={() => setSidebarIsOpen(false)}
                onOpenCreate={onOpenCreate}
                onLogout={logoutHandler}
                onUpgrade={upgradeHandler}
                isUpgrading={isUpgrading}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-slate-200 bg-white lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <SidebarNav
            onClose={() => undefined}
            onOpenCreate={onOpenCreate}
            onLogout={logoutHandler}
            onUpgrade={upgradeHandler}
            isUpgrading={isUpgrading}
          />
        </div>
      </aside>
    </>
  );
}
