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
  PauseCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useStates } from "../../context/StatesContext";
import {
  Button,
  Card,
  InlineAlert,
  PageHeader,
  Section,
  StatusBadge,
  type StatusBadgeTone,
} from "../../components/ui";
import { formatDateTime } from "../../utils/formatters";

type Network = "PUBLIC" | "TESTNET";
type AutomationGroup = "RUNNING" | "PAUSED" | "FINISHED";

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
  sessionAuthorizationLimit?: number | null;
  maxUses?: number | null;
  remainingRuns?: number | null;
  schedule?: { kind?: string; expression?: string; timezone?: string };
  strategy?: Record<string, unknown>;
  agendaJobId?: string | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  activatedAt?: string | null;
  createdAt?: string;
  metadata?: {
    scheduling?: { firstRunAt?: string | null };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const STRATEGY_LABELS: Record<string, string> = {
  DISBURSEMENT: "Scheduled distribution",
  DCA: "Dollar-cost averaging",
  REBALANCE: "Portfolio rebalancing",
  AMPLIDEX_LONG: "Amplidex long",
  AMPLIDEX_SHORT: "Amplidex short",
};

const STRATEGY_SUMMARIES: Record<string, string> = {
  DISBURSEMENT: "Sends a scheduled distribution using your authorized wallet session.",
  DCA: "Makes recurring purchases using your authorized wallet session.",
  REBALANCE: "Adjusts your portfolio allocation using your authorized wallet session.",
  AMPLIDEX_LONG: "Runs an Amplidex long strategy using your authorized wallet session.",
  AMPLIDEX_SHORT: "Runs an Amplidex short strategy using your authorized wallet session.",
};

const GROUPS: Array<{
  id: AutomationGroup;
  label: string;
  description: string;
  statuses: string[];
}> = [
  {
    id: "RUNNING",
    label: "Running",
    description: "Authorized and scheduled",
    statuses: ["ACTIVE"],
  },
  {
    id: "PAUSED",
    label: "Paused",
    description: "Not currently executing",
    statuses: ["PAUSED"],
  },
  {
    id: "FINISHED",
    label: "Finished",
    description: "Completed, ended, or stopped",
    statuses: ["COMPLETED", "FAILED", "EXPIRED", "CANCELLED", "REVOKED"],
  },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function idOf(item: AutomationItem) {
  return String(item.id || item.automationId || "");
}

function statusOf(item: AutomationItem) {
  return String(item.state || item.status || "UNKNOWN").toUpperCase();
}

function strategyTypeOf(item: AutomationItem) {
  return String(item.type || "").toUpperCase();
}

function maxRunsOf(item: AutomationItem) {
  const value = item.scheduledRunLimit ?? item.maxUses;
  const limit = value == null ? null : Number(value);
  return limit != null && Number.isFinite(limit) ? limit : null;
}

function remainingRunsOf(item: AutomationItem) {
  if (item.remainingRuns != null) {
    const remaining = Number(item.remainingRuns);
    return Number.isFinite(remaining) ? Math.max(0, remaining) : null;
  }

  const limit = maxRunsOf(item);
  if (limit == null) return null;
  return Math.max(0, limit - Number(item.runCount || 0));
}

function normalize(response: unknown): AutomationItem[] {
  if (Array.isArray(response)) return response as AutomationItem[];
  if (!response || typeof response !== "object") return [];

  const record = response as Record<string, unknown>;
  for (const key of ["automations", "items", "data"]) {
    if (Array.isArray(record[key])) return record[key] as AutomationItem[];
  }
  return [];
}

function statusTone(status: string): StatusBadgeTone {
  if (status === "ACTIVE") return "success";
  if (status === "PAUSED" || status === "EXPIRED") return "warning";
  if (["FAILED", "CANCELLED", "REVOKED"].includes(status)) return "danger";
  if (status === "COMPLETED") return "information";
  return "neutral";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Running",
    PAUSED: "Paused",
    COMPLETED: "Completed",
    FAILED: "Failed",
    EXPIRED: "Expired",
    CANCELLED: "Cancelled",
    REVOKED: "Revoked",
  };
  return labels[status] || status.toLowerCase().replace(/_/g, " ");
}

function dateValue(value?: string | null) {
  return formatDateTime(value, { emptyValue: "Not available" });
}

function LoadingState() {
  return (
    <div className="grid gap-3 p-4 sm:p-5" role="status" aria-label="Loading automations">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-36 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-subtle)] sm:h-28"
        />
      ))}
      <span className="sr-only">Loading automations…</span>
    </div>
  );
}

function EmptyState({
  filtered,
  group,
  onCreate,
}: {
  filtered: boolean;
  group: AutomationGroup;
  onCreate: () => void;
}) {
  const groupLabel = GROUPS.find((item) => item.id === group)?.label.toLowerCase();
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]">
        <Bot className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-[var(--color-text-primary)]">
        No {groupLabel} automations
      </h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--color-text-secondary)]">
        {filtered
          ? "No automations in this group match the selected strategy type."
          : group === "RUNNING"
            ? "Create an automation to put a scheduled strategy to work."
            : `You do not have any ${groupLabel} automations.`}
      </p>
      {group === "RUNNING" && !filtered ? (
        <Button className="mt-5" leadingIcon={<Plus className="h-4 w-4" />} onClick={onCreate}>
          Create automation
        </Button>
      ) : null}
    </div>
  );
}

function AutomationCard({ item, onOpen }: { item: AutomationItem; onOpen: () => void }) {
  const status = statusOf(item);
  const type = strategyTypeOf(item);
  const label = STRATEGY_LABELS[type] || item.type || "Automation";
  const executions = Number(item.runCount || 0);
  const remaining = remainingRunsOf(item);
  const authorizationLimit = item.sessionAuthorizationLimit;
  const nextRun = item.nextRunAt || item.metadata?.scheduling?.firstRunAt;

  return (
    <Card padding="none" className="overflow-hidden shadow-none transition-colors hover:border-[var(--color-border-strong)]">
      <button
        type="button"
        onClick={onOpen}
        className="group block w-full p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)] sm:p-5"
        aria-label={`View ${item.name || label} details`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-information-surface)] text-[var(--color-information)]">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="min-w-0 truncate text-base font-semibold text-[var(--color-text-primary)]">
                {item.name || label}
              </h3>
              <StatusBadge tone={statusTone(status)}>{statusLabel(status)}</StatusBadge>
            </div>
            {item.name ? (
              <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">{label}</p>
            ) : null}
            <p className="mt-1 max-w-2xl text-sm leading-5 text-[var(--color-text-secondary)]">
              {STRATEGY_SUMMARIES[type] || "Runs a strategy using your authorized wallet session."}
            </p>
          </div>
          <ChevronRight className="mt-2 hidden h-5 w-5 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
        </div>

        <dl className="mt-4 grid gap-3 border-t border-[var(--color-border-default)] pt-4 sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Executions
            </dt>
            <dd className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
              {maxRunsOf(item) == null ? executions : `${executions} of ${maxRunsOf(item)}`}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
              {status === "ACTIVE" ? <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}
              {status === "ACTIVE" ? "Next run" : "Last result"}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
              {status === "ACTIVE" ? dateValue(nextRun) : item.lastRunAt ? dateValue(item.lastRunAt) : "No run recorded"}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Authorization
            </dt>
            <dd className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
              {remaining != null
                ? `${remaining} execution${remaining === 1 ? "" : "s"} remaining`
                : authorizationLimit != null
                  ? `${authorizationLimit} execution limit`
                  : "Session authorized"}
            </dd>
          </div>
        </dl>
      </button>
    </Card>
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
  const [error, setError] = useState("");
  const [group, setGroup] = useState<AutomationGroup>("RUNNING");
  const [strategyType, setStrategyType] = useState("");

  const load = useCallback(
    async (quiet = false) => {
      if (!wallet) {
        setAllItems([]);
        setError("");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      quiet ? setRefreshing(true) : setLoading(true);
      setError("");
      try {
        const response: unknown = await AutoLayer.fetchAll(wallet, { network });
        setAllItems(normalize(response));
      } catch (loadError) {
        const message = errorMessage(loadError, "Unable to load automations");
        setError(message);
        toast.error(message);
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

  const counts = useMemo(
    () =>
      Object.fromEntries(
        GROUPS.map((entry) => [
          entry.id,
          allItems.filter((item) => entry.statuses.includes(statusOf(item))).length,
        ])
      ) as Record<AutomationGroup, number>,
    [allItems]
  );

  const items = useMemo(() => {
    const statuses = GROUPS.find((entry) => entry.id === group)?.statuses || [];
    return allItems.filter(
      (item) =>
        statuses.includes(statusOf(item)) &&
        (!strategyType || strategyTypeOf(item) === strategyType)
    );
  }, [allItems, group, strategyType]);

  const currentGroup = GROUPS.find((entry) => entry.id === group) ?? GROUPS[0];

  return (
    <main className="min-h-screen bg-[var(--color-canvas)]">
      <div className="mx-auto w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow={`${network === "PUBLIC" ? "Mainnet" : "Testnet"} · AutoLayer`}
          title="Automations"
          description="Keep track of scheduled wallet strategies, when they will run next, and how much authorization remains."
          actions={
            <Button
              className="w-full sm:w-auto"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => navigate("/automations/new")}
            >
              Create automation
            </Button>
          }
        />

        {error ? (
          <InlineAlert
            tone="danger"
            title="We couldn’t load your automations"
            icon={<AlertCircle className="h-5 w-5" />}
          >
            <p>{error}</p>
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              leadingIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void load()}
            >
              Try again
            </Button>
          </InlineAlert>
        ) : null}

        <Section
          surface
          title="Your automations"
          description="Choose a group to see what is running now, paused, or finished."
          actions={
            <Button
              variant="secondary"
              size="sm"
              disabled={refreshing || loading}
              leadingIcon={<RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />}
              onClick={() => void load(true)}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          }
        >
          <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Automation status groups">
            {GROUPS.map((entry) => {
              const selected = entry.id === group;
              const Icon = entry.id === "RUNNING" ? CheckCircle2 : entry.id === "PAUSED" ? PauseCircle : Clock3;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="automation-list"
                  onClick={() => setGroup(entry.id)}
                  className={`rounded-[var(--radius-control)] border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] ${
                    selected
                      ? "border-[var(--color-action-primary)] bg-[var(--color-information-surface)]"
                      : "border-[var(--color-border-default)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                      <Icon className="h-4 w-4" aria-hidden="true" /> {entry.label}
                    </span>
                    <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{counts[entry.id]}</span>
                  </div>
                  <span className="mt-1 block text-xs text-[var(--color-text-muted)]">{entry.description}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3 border-y border-[var(--color-border-default)] py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{currentGroup.label}</h2>
              <p className="text-xs text-[var(--color-text-muted)]">{currentGroup.description}</p>
            </div>
            <label className="relative block w-full sm:w-64">
              <span className="sr-only">Filter by strategy type</span>
              <select
                value={strategyType}
                onChange={(event) => setStrategyType(event.target.value)}
                className="min-h-11 w-full appearance-none rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface)] px-3 pr-9 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-action-primary)] focus:ring-2 focus:ring-[var(--color-action-primary)]"
              >
                <option value="">All strategy types</option>
                {Object.entries(STRATEGY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
            </label>
          </div>

          <div id="automation-list" role="tabpanel" className="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6">
            {loading ? (
              <LoadingState />
            ) : error && allItems.length === 0 ? null : items.length === 0 ? (
              <EmptyState
                filtered={Boolean(strategyType)}
                group={group}
                onCreate={() => navigate("/automations/new")}
              />
            ) : (
              <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
                {items.map((item, index) => {
                  const id = idOf(item);
                  return (
                    <AutomationCard
                      key={id || `${strategyTypeOf(item)}-${index}`}
                      item={item}
                      onOpen={() => id && navigate(`/automations/${id}`)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </Section>
      </div>
    </main>
  );
}
