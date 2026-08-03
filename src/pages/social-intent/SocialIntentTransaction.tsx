// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Filter,
  Globe,
  Info,
  Link2,
  MessageSquareText,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  Shield,
  Sparkles,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import TopStats from "../../components/TopStats";

const statusStyles = {
  pending_approval:
    "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  pending_sender: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  incoming_settled:
    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  request_received:
    "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200",
  approved: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  declined: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  failed: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
};

const statusLabel = {
  pending_approval: "Needs Approval",
  pending_sender: "Sender Pending",
  incoming_settled: "Completed",
  request_received: "Request Received",
  approved: "Approved",
  declined: "Declined",
  failed: "Failed",
};

const channelStyles = {
  x: "bg-black text-white",
  telegram: "bg-sky-500 text-white",
  discord: "bg-indigo-500 text-white",
  slack: "bg-fuchsia-600 text-white",
  web: "bg-slate-800 text-white",
};

const initialTransactions = [
  {
    id: "SI-1001",
    direction: "outgoing",
    type: "payment",
    status: "pending_approval",
    amount: "25.00",
    asset: "XLM",
    fiatEquivalent: "$2.81",
    counterparty: "@TinkerPal_",
    counterpartyLabel: "TinkerPal",
    counterpartyAddress: "GCPR...K2V5",
    sourcePlatform: "x",
    intentText: "@socketfi pay @TinkerPal_ 25 XLM for design review",
    note: "Design review bounty payment",
    createdAt: "2 min ago",
    network: "Testnet",
    fee: "0.03 XLM",
    risk: "Verified social handle match",
    txPreview: "transfer(payment)",
  },
  {
    id: "SI-1002",
    direction: "incoming",
    type: "payment",
    status: "incoming_settled",
    amount: "140.00",
    asset: "USDC",
    fiatEquivalent: "$140.00",
    counterparty: "@Rareblocks",
    counterpartyLabel: "Rareblocks",
    counterpartyAddress: "GAXJ...9T2A",
    sourcePlatform: "telegram",
    intentText: "Reward sent to your SocketFi ID from Telegram bot flow",
    note: "Campaign participation reward",
    createdAt: "18 min ago",
    network: "Testnet",
    fee: "Sponsored",
    risk: "Trusted app source",
    txPreview: "incoming transfer",
  },
  {
    id: "SI-1003",
    direction: "incoming",
    type: "request",
    status: "request_received",
    amount: "12.00",
    asset: "XLM",
    fiatEquivalent: "$1.35",
    counterparty: "@creatorhub",
    counterpartyLabel: "CreatorHub",
    counterpartyAddress: "GBYQ...1M8P",
    sourcePlatform: "discord",
    intentText: "CreatorHub requested 12 XLM from your wallet for badge mint",
    note: "Membership badge request",
    createdAt: "33 min ago",
    network: "Testnet",
    fee: "0.02 XLM",
    risk: "Request only, no funds moved",
    txPreview: "request(payment)",
  },
  {
    id: "SI-1004",
    direction: "outgoing",
    type: "payment",
    status: "approved",
    amount: "8.00",
    asset: "XLM",
    fiatEquivalent: "$0.90",
    counterparty: "@socketdev",
    counterpartyLabel: "SocketDev",
    counterpartyAddress: "GDHA...22QW",
    sourcePlatform: "slack",
    intentText: "Tip 8 XLM to @socketdev for support",
    note: "Support tip",
    createdAt: "1 hr ago",
    network: "Testnet",
    fee: "Sponsored",
    risk: "Approved from connected device",
    txPreview: "transfer(payment)",
  },
  {
    id: "SI-1005",
    direction: "outgoing",
    type: "payment",
    status: "declined",
    amount: "60.00",
    asset: "USDC",
    fiatEquivalent: "$60.00",
    counterparty: "@market-node",
    counterpartyLabel: "Market Node",
    counterpartyAddress: "GBPL...M7X1",
    sourcePlatform: "telegram",
    intentText: "Pay @market-node 60 USDC for analytics access",
    note: "Subscription checkout",
    createdAt: "3 hr ago",
    network: "Testnet",
    fee: "0.04 XLM",
    risk: "Declined by user",
    txPreview: "transfer(payment)",
  },
  {
    id: "SI-1006",
    direction: "incoming",
    type: "payment",
    status: "pending_sender",
    amount: "75.00",
    asset: "XLM",
    fiatEquivalent: "$8.42",
    counterparty: "@socialquest",
    counterpartyLabel: "SocialQuest",
    counterpartyAddress: "GA7T...31AD",
    sourcePlatform: "x",
    intentText: "Incoming reward initiated. Awaiting sender confirmation.",
    note: "Engagement campaign reward",
    createdAt: "5 hr ago",
    network: "Testnet",
    fee: "Sponsored",
    risk: "Awaiting counterparty confirmation",
    txPreview: "incoming transfer",
  },
];

const initialSettings = {
  enabled: true,
  incomingEnabled: true,
  outgoingApprovalRequired: true,
  allowRequests: true,
  autoRejectUnknownSources: false,
  notifications: true,
  limitPerIntent: "250",
  trustedApps: ["Telegram Bot", "SocketFi X Agent", "Discord Quest Bot"],
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function platformLabel(key) {
  switch (key) {
    case "x":
      return "X";
    case "telegram":
      return "Telegram";
    case "discord":
      return "Discord";
    case "slack":
      return "Slack";
    default:
      return "Web";
  }
}

function platformIcon(key) {
  switch (key) {
    case "telegram":
      return <Send className="h-3.5 w-3.5" />;
    case "discord":
      return <Bell className="h-3.5 w-3.5" />;
    case "slack":
      return <Sparkles className="h-3.5 w-3.5" />;
    case "x":
      return <MessageSquareText className="h-3.5 w-3.5" />;
    default:
      return <Globe className="h-3.5 w-3.5" />;
  }
}

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={classNames(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2",
        checked ? "bg-indigo-600" : "bg-slate-300",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      )}
      aria-pressed={checked}
      aria-disabled={disabled}
    >
      <span
        className={classNames(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="rounded-2xl bg-slate-100 p-4 text-slate-600">
        <Bell className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}

function DetailCard({ title, icon, content }) {
  return (
    <div className="rounded-[18px] border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="text-slate-500">{icon}</span>
        {title}
      </div>
      <div className="mt-2">{content}</div>
    </div>
  );
}

function TransactionDetails({
  transaction,
  onApprove,
  onDecline,
  onCopy,
  compact = false,
}) {
  if (!transaction) {
    return (
      <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">
          Select a transaction to see details.
        </p>
      </div>
    );
  }

  const needsApproval = transaction.status === "pending_approval";
  const showRequestActions =
    transaction.type === "request" && transaction.status === "request_received";

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={classNames(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              channelStyles[transaction.sourcePlatform]
            )}
          >
            {platformIcon(transaction.sourcePlatform)}
            {platformLabel(transaction.sourcePlatform)}
          </span>
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {transaction.direction === "incoming" ? "Incoming" : "Outgoing"}
          </span>
          <span
            className={classNames(
              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
              statusStyles[transaction.status]
            )}
          >
            {statusLabel[transaction.status]}
          </span>
        </div>

        <div className="mt-4">
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            {transaction.amount} {transaction.asset}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {transaction.fiatEquivalent}
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <InfoItem
            label="Counterparty"
            value={transaction.counterpartyLabel}
          />
          <InfoItem label="Social handle" value={transaction.counterparty} />
          <InfoItem label="Intent ID" value={transaction.id} />
          <InfoItem label="Created" value={transaction.createdAt} />
          <InfoItem label="Network" value={transaction.network} />
          <InfoItem label="Fee" value={transaction.fee} />
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="rounded-[18px] bg-[#f7f9fc] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MessageSquareText className="h-4 w-4 text-slate-500" />
            Intent message
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {transaction.intentText}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DetailCard
            title="Wallet route"
            icon={<Link2 className="h-4 w-4" />}
            content={
              <div className="space-y-2 text-sm text-slate-600">
                <p>{transaction.txPreview}</p>
                <button
                  type="button"
                  onClick={() => onCopy(transaction.counterpartyAddress)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  <Copy className="h-4 w-4" />
                  Copy address
                </button>
              </div>
            }
          />
          <DetailCard
            title="Security context"
            icon={<Shield className="h-4 w-4" />}
            content={
              <p className="text-sm leading-6 text-slate-600">
                {transaction.risk}
              </p>
            }
          />
        </div>

        <DetailCard
          title="Note"
          icon={<Info className="h-4 w-4" />}
          content={
            <p className="text-sm leading-6 text-slate-600">
              {transaction.note || "No note provided."}
            </p>
          }
        />

        {(needsApproval || showRequestActions) && (
          <div className="rounded-[18px] border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                <Clock3 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-amber-900">
                  {showRequestActions
                    ? "Review payment request"
                    : "Approval required before broadcast"}
                </h3>
                <p className="mt-1 text-sm leading-6 text-amber-800/90">
                  {showRequestActions
                    ? "This request came in through a social platform. You can approve it to proceed with payment or decline it to dismiss the request."
                    : "This social intent was triggered outside the wallet and is waiting for your confirmation before it is signed and submitted."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div
          className={classNames(
            "flex flex-col gap-3",
            compact ? "" : "sm:flex-row"
          )}
        >
          {(needsApproval || showRequestActions) && (
            <>
              <button
                type="button"
                onClick={onApprove}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </button>
              <button
                type="button"
                onClick={onDecline}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <XCircle className="h-4 w-4" />
                Decline
              </button>
            </>
          )}

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh status
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" />
            View raw payload
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsRow({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="pr-4">
          <h3 className="text-sm font-semibold text-slate-900 sm:text-base">
            {title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

function SettingsPanel({ settings, setSettings }) {
  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 text-slate-900">
      <div className="rounded-[18px] border border-slate-200 bg-[#f7f9fc] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Settings2 className="h-5 w-5 text-slate-500" />
              Social intent controls
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Configure how your wallet handles social-triggered payments,
              requests, and approvals.
            </p>
          </div>
          <div className="rounded-2xl bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
            {settings.enabled ? "Enabled" : "Disabled"}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <SettingsRow
          title="Enable social intent"
          description="Allow your wallet to receive and process transaction intents from connected social platforms."
          checked={settings.enabled}
          onChange={(next) => updateSetting("enabled", next)}
        />
        <SettingsRow
          title="Allow incoming social payments"
          description="Accept incoming social intent transfers and payment notifications into your queue."
          checked={settings.incomingEnabled}
          onChange={(next) => updateSetting("incomingEnabled", next)}
          disabled={!settings.enabled}
        />
        <SettingsRow
          title="Require approval for outgoing intents"
          description="Every outgoing payment triggered from a social platform will wait here until you confirm it."
          checked={settings.outgoingApprovalRequired}
          onChange={(next) => updateSetting("outgoingApprovalRequired", next)}
          disabled={!settings.enabled}
        />
        <SettingsRow
          title="Allow payment requests"
          description="Show request intents from social apps so you can choose whether to pay them."
          checked={settings.allowRequests}
          onChange={(next) => updateSetting("allowRequests", next)}
          disabled={!settings.enabled}
        />
        <SettingsRow
          title="Auto-reject unknown sources"
          description="Automatically reject intents from untrusted apps or unverifiable social sources."
          checked={settings.autoRejectUnknownSources}
          onChange={(next) => updateSetting("autoRejectUnknownSources", next)}
          disabled={!settings.enabled}
        />
        <SettingsRow
          title="Notifications"
          description="Notify you whenever a social payment, request, or approval is waiting in your queue."
          checked={settings.notifications}
          onChange={(next) => updateSetting("notifications", next)}
          disabled={!settings.enabled}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block text-sm font-semibold text-slate-900">
            Per-intent limit
          </label>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Maximum value a single social intent can request or transfer before
            extra checks are needed.
          </p>
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="number"
              min="0"
              value={settings.limitPerIntent}
              onChange={(e) => updateSetting("limitPerIntent", e.target.value)}
              className="w-full bg-transparent text-base font-semibold text-slate-900 outline-none"
            />
            <span className="rounded-xl bg-white px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-slate-200">
              USD
            </span>
          </div>
        </div>

        <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Trusted apps
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Apps or bots currently approved to trigger social intents to
                your wallet.
              </p>
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Add app
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {settings.trustedApps.map((app) => (
              <div
                key={app}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white p-2 text-slate-600 ring-1 ring-slate-200">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {app}
                    </p>
                    <p className="text-xs text-slate-500">Connected source</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SocialIntentTransaction() {
  const [activeTab, setActiveTab] = useState("all");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedId, setSelectedId] = useState(
    initialTransactions[0]?.id ?? null
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [toast, setToast] = useState("");

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const tabMatch =
        activeTab === "all" ? true : item.direction === activeTab;
      const statusMatch =
        statusFilter === "all" ? true : item.status === statusFilter;
      const query = search.trim().toLowerCase();
      const searchMatch =
        query.length === 0
          ? true
          : [
              item.id,
              item.counterparty,
              item.counterpartyLabel,
              item.asset,
              item.note,
              item.intentText,
              item.type,
            ]
              .join(" ")
              .toLowerCase()
              .includes(query);

      return tabMatch && statusMatch && searchMatch;
    });
  }, [transactions, activeTab, search, statusFilter]);

  const selectedTransaction = useMemo(() => {
    return transactions.find((item) => item.id === selectedId) || null;
  }, [transactions, selectedId]);

  useEffect(() => {
    if (activeTab === "settings") return;

    if (filteredTransactions.length === 0) {
      setSelectedId(null);
      return;
    }

    const selectedStillVisible = filteredTransactions.some(
      (item) => item.id === selectedId
    );

    if (!selectedStillVisible) {
      setSelectedId(filteredTransactions[0].id);
    }
  }, [activeTab, filteredTransactions, selectedId]);

  const summary = useMemo(() => {
    const pendingApprovals = transactions.filter(
      (item) => item.status === "pending_approval"
    ).length;
    const incomingCount = transactions.filter(
      (item) => item.direction === "incoming"
    ).length;
    const outgoingCount = transactions.filter(
      (item) => item.direction === "outgoing"
    ).length;
    const settledVolume = transactions
      .filter(
        (item) =>
          item.status === "incoming_settled" || item.status === "approved"
      )
      .reduce((sum, item) => sum + Number(item.amount), 0)
      .toFixed(2);

    return { pendingApprovals, incomingCount, outgoingCount, settledVolume };
  }, [transactions]);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const updateTransactionStatus = (id, nextStatus) => {
    setTransactions((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status: nextStatus } : item
      )
    );

    if (nextStatus === "approved")
      showToast("Social intent approved successfully.");
    if (nextStatus === "declined") showToast("Social intent declined.");
  };

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast("Copied to clipboard.");
    } catch {
      showToast("Unable to copy.");
    }
  };

  const openTransaction = (id) => {
    setSelectedId(id);
    setMobileDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <div className="flex min-h-screen">
        <div className="min-w-0 flex-1">
          <div className="mx-auto  px-4 py-5 sm:px-6 lg:px-8">
            <div className="space-y-5">
              <section>
                <div className="flex flex-col gap-2">
                  <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
                    Social Intent Transact
                  </h1>
                  <p className="text-sm text-slate-500">
                    Manage social-triggered transfers, requests, and wallet
                    approval flow in one place.
                  </p>
                </div>
              </section>

              <TopStats
                data={[
                  {
                    id: "pending",
                    label: "Pending approvals",
                    value: 1,
                    icon: Clock3,
                  },
                  {
                    id: "incoming",
                    label: "Incoming Intents",
                    value: 5,
                    icon: ArrowDownLeft,
                  },
                  {
                    id: "outgoing",
                    label: "Outgoing Intents",
                    value: 12,
                    icon: ArrowUpRight,
                  },
                  {
                    id: "settled",
                    label: "Settled volume",
                    value: 123.1,
                    icon: Wallet,
                  },
                ]}
              />

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                <section className="min-w-0 rounded-[22px] border border-[#dbe3ef] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <div className="border-b border-slate-200 px-4 pt-4 sm:px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="-mx-1 overflow-x-auto pb-1">
                        <div className="flex min-w-max items-center gap-8 border-b border-slate-200 px-1">
                          {[
                            { key: "all", label: "All Activity" },
                            { key: "incoming", label: "Incoming Intent" },
                            { key: "outgoing", label: "Outgoing Intent" },
                            { key: "settings", label: "Intent Settings" },
                          ].map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setActiveTab(tab.key)}
                              className={classNames(
                                "whitespace-nowrap border-b-2 px-0 pb-4 pt-1 text-sm font-semibold transition",
                                activeTab === tab.key
                                  ? "border-indigo-500 text-indigo-600"
                                  : "border-transparent text-slate-500 hover:text-slate-700"
                              )}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {activeTab !== "settings" && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end lg:pb-3">
                          <div className="relative min-w-0 flex-1 sm:min-w-[240px] lg:w-[300px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                              placeholder="Search here"
                              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            />
                          </div>
                          <div className="relative sm:flex-none">
                            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <select
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 sm:w-auto"
                            >
                              <option value="all">All statuses</option>
                              <option value="pending_approval">
                                Needs Approval
                              </option>
                              <option value="incoming_settled">
                                Completed
                              </option>
                              <option value="request_received">Requests</option>
                              <option value="approved">Approved</option>
                              <option value="declined">Declined</option>
                              <option value="pending_sender">
                                Sender Pending
                              </option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 sm:p-6">
                    {activeTab === "settings" ? (
                      <SettingsPanel
                        settings={settings}
                        setSettings={setSettings}
                      />
                    ) : filteredTransactions.length === 0 ? (
                      <EmptyState
                        title="No social intents found"
                        description="Try changing your filters or search terms. Once intents start coming in from connected social channels, they will appear here."
                      />
                    ) : (
                      <div className="space-y-3">
                        {filteredTransactions.map((item) => {
                          const needsApproval =
                            item.status === "pending_approval";
                          const isSelected = item.id === selectedId;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openTransaction(item.id)}
                              className={classNames(
                                "w-full rounded-[18px] border px-4 py-4 text-left transition-all sm:px-5",
                                isSelected
                                  ? "border-indigo-200 bg-[#f5f7ff] shadow-sm"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                              )}
                              aria-pressed={isSelected}
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={classNames(
                                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                        channelStyles[item.sourcePlatform]
                                      )}
                                    >
                                      {platformIcon(item.sourcePlatform)}
                                      {platformLabel(item.sourcePlatform)}
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                      {item.direction === "incoming"
                                        ? "Incoming"
                                        : "Outgoing"}
                                    </span>
                                    <span
                                      className={classNames(
                                        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                        statusStyles[item.status]
                                      )}
                                    >
                                      {statusLabel[item.status]}
                                    </span>
                                  </div>

                                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-900 sm:text-base">
                                        <span>{item.counterpartyLabel}</span>
                                        <ChevronRight className="h-4 w-4 text-slate-400" />
                                        <span>
                                          {item.amount} {item.asset}
                                        </span>
                                      </div>
                                      <p className="mt-1 truncate text-sm text-slate-500">
                                        {item.intentText}
                                      </p>
                                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 sm:text-sm">
                                        <span>{item.id}</span>
                                        <span>{item.createdAt}</span>
                                        <span>{item.network}</span>
                                        <span>{item.fee}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                                      <div>
                                        <p className="text-lg font-semibold text-slate-900">
                                          {item.amount} {item.asset}
                                        </p>
                                        <p className="text-sm text-slate-400">
                                          {item.fiatEquivalent}
                                        </p>
                                      </div>
                                      {needsApproval && (
                                        <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                          <AlertTriangle className="h-3.5 w-3.5" />
                                          Action needed
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                <aside className="hidden xl:block xl:sticky xl:top-5 xl:self-start">
                  <TransactionDetails
                    transaction={selectedTransaction}
                    onApprove={() =>
                      selectedTransaction &&
                      updateTransactionStatus(
                        selectedTransaction.id,
                        "approved"
                      )
                    }
                    onDecline={() =>
                      selectedTransaction &&
                      updateTransactionStatus(
                        selectedTransaction.id,
                        "declined"
                      )
                    }
                    onCopy={copyText}
                  />
                </aside>
              </div>
            </div>
          </div>
        </div>
      </div>

      {mobileDetailOpen && selectedTransaction && activeTab !== "settings" && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileDetailOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Social intent details
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedTransaction.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileDetailOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <TransactionDetails
              transaction={selectedTransaction}
              onApprove={() =>
                updateTransactionStatus(selectedTransaction.id, "approved")
              }
              onDecline={() =>
                updateTransactionStatus(selectedTransaction.id, "declined")
              }
              onCopy={copyText}
              compact
            />
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
