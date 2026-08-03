// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import {
  SlidersHorizontal,
  Plus,
  Eye,
  EyeOff,
  Search,
  ChevronRight,
  Shield,
  Wallet,
  Link2,
  Mail,
  Send,
  MessageCircle,
  Globe,
  BadgeCheck,
  ExternalLink,
  Settings2,
  Sparkles,
  CircleDollarSign,
  Copy,
  Check,
} from "lucide-react";
import QuickSettingsDrawer from "./QuickSettingsDrawer";

/**
 * SocketFi Quick Settings Drawer
 * ---------------------------------
 * Ready-to-use React + Tailwind side drawer for quick wallet controls.
 *
 * What is included:
 * - Right-side modal drawer with overlay
 * - Esc to close
 * - Click overlay to close
 * - Body scroll lock when open
 * - Asset search UI
 * - Add token CTA
 * - Hide/show token UI
 * - Hidden token management section
 * - Limits & approvals quick settings
 * - Connected profiles quick view
 * - Preferences toggles
 * - Responsive desktop/mobile behavior
 *
 * What you need to hook up:
 * - token add logic
 * - token visibility persistence
 * - allowance update action
 * - external owner wallet action
 * - manage profiles action
 * - full settings navigation
 */

const defaultTokens = [
  {
    id: "xlm",
    code: "XLM",
    name: "Stellar Lumens",
    balance: "0.000",
    verified: true,
    hidden: false,
    watched: true,
  },
  {
    id: "usdc",
    code: "USDC",
    name: "USD Coin",
    balance: "0.000",
    verified: true,
    hidden: false,
    watched: true,
  },
  {
    id: "socket",
    code: "SOCKET",
    name: "Socket Token",
    balance: "0.000",
    verified: false,
    hidden: true,
    watched: false,
  },
];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function TestLayout() {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [tokens, setTokens] = useState(defaultTokens);
  const [preferences, setPreferences] = useState({
    hideZeroBalance: false,
    hideLowBalance: false,
    showVerifiedOnly: false,
    autoShowNewAssets: true,
  });

  const walletSummary = {
    socketfiId: "shollsonline",
    address: "CBICQBDXU7ZIBZ34E4BFCGNGJAQL7KVPSIHTTYLJDUILYKTK73JKGHIY",
    maxAllowance: "0.00",
    externalWallet: "Not configured",
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletSummary.address);
      setCopied(true);
    } catch (error) {
      console.error("Failed to copy address", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white px-4 py-4 lg:min-h-screen lg:w-[260px] lg:border-b-0 lg:border-r lg:px-4 lg:py-6">
          <div className="flex items-center justify-between lg:block">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-black tracking-tight text-black">
                socket
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Quick settings
            </button>
          </div>

          <div className="mt-6 hidden lg:block">
            <button className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
              Disconnect Wallet
            </button>
          </div>

          <nav className="mt-6 hidden lg:block space-y-3">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Wallet
            </p>
            <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
              My Wallet
            </div>
            <div className="px-4 py-3 text-sm font-medium text-slate-700">
              dApps Hub
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700">
              <span>Social Intent</span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 ring-1 ring-indigo-200">
                New
              </span>
            </div>

            <p className="px-3 pt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Access
            </p>
            <div className="px-4 py-3 text-sm font-medium text-slate-700">
              Wallet Access
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="px-4 py-3 text-sm font-medium text-slate-700">
                Account Settings
              </div>
              <div className="px-4 py-3 text-sm font-medium text-slate-400">
                Version: Latest
              </div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <div className="min-w-0 font-semibold text-slate-900">
                    SocketFi ID:{" "}
                    <span className="font-medium text-slate-500">
                      {walletSummary.socketfiId}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 font-semibold text-slate-900">
                    <span>Address:</span>
                    <span className="truncate font-medium text-slate-500 max-w-[420px]">
                      {walletSummary.address}
                    </span>
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
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

              <div className="flex items-center gap-3 self-end lg:self-auto">
                <button className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  PUBLIC
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  aria-label="Open quick settings"
                >
                  <Settings2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
            <div className="max-w-6xl">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                Wallet Details
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                View balances, manage assets, and control transactions across
                your wallet.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  "Total Balance (USD)",
                  "Transaction Vol (USD)",
                  "Transactions Count",
                  "Settled volume",
                ].map((item, idx) => (
                  <div
                    key={item}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          {item}
                        </p>
                        <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
                          {idx < 2 ? "0.000" : "-"}
                        </p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                        <Sparkles className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[32px] border border-slate-200 bg-white px-6 py-16 text-center shadow-sm sm:px-10 sm:py-24">
                <p className="mx-auto max-w-3xl text-xl tracking-tight text-slate-600 sm:text-2xl">
                  You currently have zero tokens in your smart wallet. Click the
                  button below to deposit tokens.
                </p>
                <button className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  <Plus className="h-4 w-4" />
                  Deposit Tokens
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <QuickSettingsDrawer open={open} setOpen={setOpen} />
    </div>
  );
}
