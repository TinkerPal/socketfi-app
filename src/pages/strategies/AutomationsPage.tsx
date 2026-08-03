// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { AutoLayer } from "@autolayer/sdk";
import {
  AlertCircle,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useStates } from "../../context/StatesContext";

type Network = "PUBLIC" | "TESTNET";
type AutomationView = "ACTIVE" | "EXPIRED" | "CANCELLED" | "HISTORY";

type AutomationItem = {
  id?: string;
  automationId?: string;
  walletAddress?: string;
  network?: Network;
  type?: string;
  status?: string;
  state?: string;
  name?: string;
  policyIdHex?: string | null;
  expectedPolicyIdHex?: string | null;
  runCount?: number;
  scheduledRunLimit?: number | null;
  maxUses?: number | null;
  remainingRuns?: number | null;
  schedule?: { kind?: string; expression?: string; timezone?: string };
  strategy?: Record<string, any>;
  agendaJobId?: string | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  activatedAt?: string | null;
  createdAt?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
};

const STRATEGY_LABELS: Record<string, string> = {
  DISBURSEMENT: "Disbursement",
  DCA: "Dollar-cost averaging",
  REBALANCE: "Portfolio rebalancing",
  AMPLIDEX_LONG: "Amplidex long",
  AMPLIDEX_SHORT: "Amplidex short",
};

const VIEW_TABS = [
  { id: "ACTIVE", label: "Active", description: "Currently authorized" },
  { id: "EXPIRED", label: "Expired", description: "Session validity ended" },
  { id: "CANCELLED", label: "Cancelled", description: "Revoked by the owner" },
  { id: "HISTORY", label: "History", description: "Completed and failed" },
] as const;

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function shorten(value?: string | null, start = 10, end = 8) {
  if (!value) return "—";
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not scheduled";
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function idOf(item: AutomationItem) {
  return String(item.id || item.automationId || "");
}

function policyOf(item: AutomationItem) {
  return String(item.policyIdHex || item.expectedPolicyIdHex || "");
}

function statusOf(item: AutomationItem) {
  return String(item.state || item.status || "UNKNOWN").toUpperCase();
}

function maxRunsOf(item: AutomationItem) {
  if (item.scheduledRunLimit != null) return Number(item.scheduledRunLimit);
  if (item.maxUses != null) return Number(item.maxUses);
  return null;
}

function formatRunProgress(item: AutomationItem) {
  const count = Number(item.runCount || 0);
  const max = maxRunsOf(item);
  return max == null ? `${count}` : `${count} / ${max}`;
}

function statusClasses(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "border-[#ABEFC6] bg-[#ECFDF3] text-[#027A48]";
    case "CANCELLED":
    case "REVOKED":
    case "FAILED":
      return "border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]";
    case "EXPIRED":
    case "PAUSED":
      return "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]";
    case "COMPLETED":
      return "border-[#B2DDFF] bg-[#EFF8FF] text-[#175CD3]";
    default:
      return "border-[#EAECF0] bg-[#F9FAFB] text-[#475467]";
  }
}

function normalize(response: any): AutomationItem[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.automations)) return response.automations;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function Metric({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-[#667085]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#101828]">
        {value}
      </p>
      {helper ? (
        <p className="mt-0.5 truncate text-[11px] text-[#98A2B3]">{helper}</p>
      ) : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
  showCreate,
  onCreate,
}: {
  title: string;
  description: string;
  showCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F2F4F7] text-[#667085]">
        <Bot className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-[#101828]">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-[#667085]">
        {description}
      </p>
      {showCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#2F0FD1] px-4 text-sm font-semibold text-white transition hover:bg-[#2409B8]"
        >
          <Plus className="h-4 w-4" /> Create automation
        </button>
      ) : null}
    </div>
  );
}

export default function AutomationsPage() {
  const navigate = useNavigate();
  const { activeSession, selectedNetwork, toast } = useStates();
  const network = selectedNetwork as Network;
  const wallet = activeSession?.userProfile?.address?.[network] || "";

  const [allItems, setAllItems] = useState<AutomationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<AutomationView>("ACTIVE");
  const [strategyType, setStrategyType] = useState("");

  const load = useCallback(
    async (quiet = false) => {
      if (!wallet) {
        setAllItems([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      quiet ? setRefreshing(true) : setLoading(true);
      try {
        const response = await AutoLayer.fetchAll(wallet, { network });

        console.log("[AutoLayer.fetchAll]", response);
        setAllItems(normalize(response));
      } catch (error) {
        toast.error(errorMessage(error, "Unable to load automations"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [network, toast, wallet]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(
    () =>
      allItems.filter((item) => {
        const status = statusOf(item);
        if (
          strategyType &&
          String(item.type || "").toUpperCase() !== strategyType
        )
          return false;
        if (view === "ACTIVE")
          return status === "ACTIVE" || status === "PAUSED";
        if (view === "EXPIRED") return status === "EXPIRED";
        if (view === "CANCELLED")
          return status === "CANCELLED" || status === "REVOKED";
        return status === "COMPLETED" || status === "FAILED";
      }),
    [allItems, strategyType, view]
  );

  const summary = useMemo(
    () => ({
      visible: items.length,
      successfulRuns: items.reduce(
        (total, item) => total + Number(item.runCount || 0),
        0
      ),
    }),
    [items]
  );

  const currentView = VIEW_TABS.find((tab) => tab.id === view)!;

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto w-full  space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-[#EAECF0] bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-2.5 py-1 text-xs font-medium text-[#2F0FD1]">
                  <Bot className="h-3.5 w-3.5" /> AutoLayer
                </span>
                <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-medium text-[#667085]">
                  {network === "PUBLIC" ? "Mainnet" : "Testnet"}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#101828]">
                Automations
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#667085]">
                Manage active strategies and review sessions that have expired,
                completed, failed, or been revoked.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/automations/new")}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2F0FD1] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2409B8]"
            >
              <Plus className="h-4 w-4" /> New automation
            </button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#EAECF0] bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium text-[#667085]">Current view</p>
            <p className="mt-1 text-xl font-semibold text-[#101828]">
              {summary.visible}
            </p>
            <p className="mt-0.5 text-xs text-[#98A2B3]">{currentView.label}</p>
          </div>
          <div className="rounded-2xl border border-[#EAECF0] bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium text-[#667085]">
              Successful runs
            </p>
            <p className="mt-1 text-xl font-semibold text-[#101828]">
              {summary.successfulRuns}
            </p>
            <p className="mt-0.5 text-xs text-[#98A2B3]">
              Across visible automations
            </p>
          </div>
          <div className="rounded-2xl border border-[#EAECF0] bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium text-[#667085]">Wallet access</p>
            <div className="mt-1 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#027A48]" />
              <p className="text-sm font-semibold text-[#101828]">
                Scoped sessions
              </p>
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-[#98A2B3]">
              {shorten(wallet, 12, 10)}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[#EAECF0] bg-white shadow-sm">
          <div className="border-b border-[#EAECF0] px-4 pt-4 sm:px-5">
            <div className="flex gap-1 overflow-x-auto pb-0">
              {VIEW_TABS.map((tab) => {
                const selected = tab.id === view;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setView(tab.id)}
                    className={classNames(
                      "min-w-fit border-b-2 px-3 pb-3 pt-1 text-left transition",
                      selected
                        ? "border-[#2F0FD1] text-[#2F0FD1]"
                        : "border-transparent text-[#667085] hover:text-[#344054]"
                    )}
                  >
                    <span className="block text-sm font-semibold">
                      {tab.label}
                    </span>
                    <span className="mt-0.5 hidden text-[11px] sm:block">
                      {tab.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#EAECF0] bg-[#FCFCFD] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="relative w-full sm:w-64">
              <select
                value={strategyType}
                onChange={(event) => setStrategyType(event.target.value)}
                className="h-10 w-full appearance-none rounded-xl border border-[#D0D5DD] bg-white px-3 pr-9 text-sm text-[#344054] outline-none transition focus:border-[#2F0FD1] focus:ring-4 focus:ring-[#EEF2FF]"
              >
                <option value="">All strategy types</option>
                {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#667085]" />
            </div>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => void load(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={classNames("h-4 w-4", refreshing && "animate-spin")}
              />{" "}
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#2F0FD1]" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title={
                view === "ACTIVE"
                  ? "No active automations"
                  : `No ${currentView.label.toLowerCase()} automations`
              }
              description={
                view === "ACTIVE"
                  ? "Create an automation to start running a scoped, scheduled strategy."
                  : "There are no automations matching this view and strategy filter."
              }
              showCreate={view === "ACTIVE"}
              onCreate={() => navigate("/automations/new")}
            />
          ) : (
            <div className="divide-y divide-[#EAECF0]">
              {items.map((item) => {
                const id = idOf(item);
                const status = statusOf(item);
                const strategyLabel =
                  STRATEGY_LABELS[String(item.type || "").toUpperCase()] ||
                  item.type ||
                  "Automation";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigate(`/automations/${id}`)}
                    className="block w-full px-4 py-4 text-left transition hover:bg-[#FCFCFD] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2F0FD1] sm:px-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#2F0FD1]">
                          <Bot className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-semibold text-[#101828] sm:text-base">
                              {item.name || strategyLabel}
                            </h2>
                            <span
                              className={classNames(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                statusClasses(status)
                              )}
                            >
                              {status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-[#667085]">
                            {strategyLabel}
                          </p>
                          <p
                            title={policyOf(item)}
                            className="mt-1 truncate font-mono text-[11px] text-[#98A2B3]"
                          >
                            Policy {shorten(policyOf(item), 12, 10)}
                          </p>
                        </div>
                      </div>
                      <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-3 lg:max-w-2xl">
                        <Metric
                          label="Runs"
                          value={formatRunProgress(item)}
                          helper="Successful executions"
                        />
                        <Metric
                          label="Schedule"
                          value={item.schedule?.expression || "One time"}
                          helper={item.schedule?.timezone || "UTC"}
                        />
                        <Metric
                          label={status === "ACTIVE" ? "Next run" : "Last run"}
                          value={formatDate(
                            status === "ACTIVE"
                              ? item.nextRunAt ||
                                  item.metadata?.scheduling?.firstRunAt
                              : item.lastRunAt ||
                                  item.activatedAt ||
                                  item.createdAt
                          )}
                        />
                      </div>
                      <div className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3.5 text-sm font-semibold text-[#344054]">
                        View details <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
