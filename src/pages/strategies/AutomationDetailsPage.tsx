// @ts-nocheck
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AutoLayer } from "@autolayer/sdk";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { nativeToScVal } from "@stellar/stellar-sdk";
import { useSocketFi } from "@socketfi/react";
import { useAccount, useConnectors, useReconnect, useSignMessage } from "wagmi";

import { useStates } from "../../context/StatesContext";
import {
  getSocketFiAuthMethod,
  getSocketFiEvmSigner,
  getSocketFiStellarSigner,
  signAndSubmitSmartAccountInvocation,
} from "../../services/automationWalletSigning";
import {
  Button,
  Card,
  InlineAlert,
  PageHeader,
  Section,
  StatusBadge,
  type StatusBadgeTone,
} from "../../components/ui";
import { formatDateTime, shortenAddress } from "../../utils/formatters";

type Network = "PUBLIC" | "TESTNET";
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
  delegatePublicKey?: string;
  runCount?: number;
  spentAmount?: string;
  scheduledRunLimit?: number | null;
  maxUses?: number | null;
  sessionAuthorizationLimit?: number | null;
  remainingRuns?: number | null;
  agendaJobId?: string | null;
  schedule?: Record<string, any>;
  strategy?: Record<string, any>;
  payment?: Record<string, any>;
  validAfterLedger?: number;
  expiresAtLedger?: number;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  createdAt?: string;
  activatedAt?: string | null;
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
const classNames = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
const idOf = (item: AutomationItem) =>
  String(item.id || item.automationId || "");
const policyOf = (item: AutomationItem) =>
  String(item.policyIdHex || item.expectedPolicyIdHex || "");
const statusOf = (item: AutomationItem) =>
  String(item.state || item.status || "UNKNOWN").toUpperCase();
const shorten = (value?: string | null, start = 10, end = 8) =>
  !value
    ? "—"
    : value.length <= start + end + 1
    ? value
    : `${value.slice(0, start)}…${value.slice(-end)}`;
function formatDate(value?: string | null) {
  return formatDateTime(value, { emptyValue: "Not available" });
}
function normalize(response: any): AutomationItem[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.automations)) return response.automations;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
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
  return status === "ACTIVE"
    ? "Running"
    : status.toLowerCase().replace(/_/g, " ");
}
function strategyTypeOf(item: AutomationItem) {
  return String(item.type || "").toUpperCase();
}
function strategySummary(item: AutomationItem) {
  switch (strategyTypeOf(item)) {
    case "DCA":
      return "Makes recurring purchases according to the configured amount and schedule.";
    case "REBALANCE":
      return "Adjusts configured portfolio assets toward their target allocations.";
    case "DISBURSEMENT":
      return "Sends configured amounts to approved recipients on the selected schedule.";
    default:
      return "Runs a scheduled strategy using a limited wallet authorization.";
  }
}
function maximumExecutions(item: AutomationItem) {
  return item.scheduledRunLimit ?? item.maxUses ?? null;
}
function amountLimit(item: AutomationItem, key: string) {
  const value = item.strategy?.[key];
  return value == null || value === "" ? null : `${String(value)} atomic units`;
}
function perRunLimit(item: AutomationItem) {
  if (strategyTypeOf(item) === "DCA") return amountLimit(item, "amountPerRun");
  if (strategyTypeOf(item) === "REBALANCE")
    return amountLimit(item, "maxTradeAmount");
  return null;
}
function maximumAuthorization(item: AutomationItem) {
  return amountLimit(item, "maxTotalAmount");
}
function scopeSummary(item: AutomationItem) {
  if (strategyTypeOf(item) === "DISBURSEMENT") {
    const recipients = item.strategy?.recipients;
    return Array.isArray(recipients)
      ? `${recipients.length} approved recipient${recipients.length === 1 ? "" : "s"}`
      : null;
  }
  if (strategyTypeOf(item) === "REBALANCE") {
    const assets = item.strategy?.allowedAssets;
    return Array.isArray(assets)
      ? `${assets.length} allowed asset${assets.length === 1 ? "" : "s"}`
      : null;
  }
  if (strategyTypeOf(item) === "DCA") {
    return item.strategy?.inputAsset && item.strategy?.outputAsset
      ? "2 configured assets"
      : null;
  }
  return null;
}
function explorerUrl(network: Network, transactionHash: string) {
  return `https://stellar.expert/explorer/${
    network === "PUBLIC" ? "public" : "testnet"
  }/tx/${transactionHash}`;
}
function hexToBytes(value: string) {
  const normalized = String(value || "")
    .trim()
    .replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(normalized))
    throw new Error("This automation has an invalid session policy ID");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < normalized.length; i += 2)
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  return bytes;
}
const policyIdArgXdr = (policyIdHex: string) =>
  nativeToScVal(hexToBytes(policyIdHex), { type: "bytes" }).toXDR("base64");

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#EAECF0] py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <p className="text-sm font-medium text-[#667085]">{label}</p>
      <div
        className={classNames(
          "min-w-0 text-sm font-semibold text-[#101828] sm:max-w-[70%] sm:text-right",
          mono && "break-all font-mono text-xs"
        )}
      >
        {value}
      </div>
    </div>
  );
}
function CancelDialog({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close cancellation dialog"
        className="absolute inset-0 bg-[#101828]/45 backdrop-blur-[2px]"
        onClick={busy ? undefined : onClose}
      />
      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-[#EAECF0] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#EAECF0] px-5 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FEF3F2] text-[#D92D20]">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#101828]">
                Cancel automation?
              </h2>
              <p className="mt-1 text-sm text-[#667085]">
                This permanently stops future scheduled executions.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#667085] transition hover:bg-[#F2F4F7]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">
          <div className="rounded-2xl border border-[#FECDCA] bg-[#FEF3F2] p-4">
            <p className="text-sm font-semibold text-[#B42318]">
              Future executions will stop permanently.
            </p>
            <p className="mt-1 text-sm leading-6 text-[#B42318]">
              The limited wallet permission is revoked on-chain first, then
              AutoLayer cancels its server-side schedule. Funds already held
              by your account are not transferred or withdrawn.
            </p>
          </div>
        </div>
        <div className="flex gap-3 border-t border-[#EAECF0] bg-[#FCFCFD] px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054]"
          >
            Keep automation
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#D92D20] px-4 text-sm font-semibold text-white disabled:bg-[#FDA29B]"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Cancelling…
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" /> Cancel automation
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function AutomationDetailsPage() {
  const navigate = useNavigate();
  const { automationId = "" } = useParams();
  const socketfi = useSocketFi();
  const {
    address: connectedEvmAddress,
    connector: connectedEvmConnector,
    isConnected: isEvmConnected,
  } = useAccount();
  const evmConnectors = useConnectors();
  const { reconnectAsync: reconnectEvmAsync } = useReconnect();
  const { signMessageAsync } = useSignMessage();
  const { activeSession, selectedNetwork, toast } = useStates();
  const network = selectedNetwork as Network;
  const accessToken = activeSession?.accessToken || "";
  const wallet = activeSession?.userProfile?.address?.[network] || "";
  const authMethod = getSocketFiAuthMethod(activeSession);
  const stellarSigner = getSocketFiStellarSigner(activeSession);
  const evmSigner = getSocketFiEvmSigner(activeSession);
  const evmConnectorId = String(
    activeSession?.evmConnectorId ||
      activeSession?.userProfile?.evmConnectorId ||
      activeSession?.userProfile?.evmAccount?.connectorId ||
      ""
  ).trim();
  const evmConnectorType = String(
    activeSession?.evmConnectorType ||
      activeSession?.userProfile?.evmConnectorType ||
      activeSession?.userProfile?.evmAccount?.connectorType ||
      ""
  ).trim();
  const evmConnectorName = String(
    activeSession?.evmConnectorName ||
      activeSession?.userProfile?.evmConnectorName ||
      activeSession?.userProfile?.evmAccount?.connectorName ||
      ""
  ).trim();

  const [item, setItem] = useState<AutomationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!wallet || !automationId) {
        setItem(null);
        setLoadError("");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      quiet ? setRefreshing(true) : setLoading(true);
      setLoadError("");
      try {
        const response = await AutoLayer.fetchAll(wallet, { network });
        const found =
          normalize(response).find((entry) => idOf(entry) === automationId) ||
          null;
        if (!found) throw new Error("Automation not found");
        setItem(found);
      } catch (error) {
        const message = errorMessage(error, "Unable to load automation");
        setLoadError(message);
        toast.error(message);
        setItem(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [automationId, network, toast, wallet]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const status = item ? statusOf(item) : "";
  const policyId = item ? policyOf(item) : "";
  const canCancel = status === "ACTIVE" || status === "PAUSED";
  const strategyLabel = useMemo(
    () =>
      item
        ? item.name ||
          STRATEGY_LABELS[String(item.type || "").toUpperCase()] ||
          item.type ||
          "Automation"
        : "Automation",
    [item]
  );

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  }

  async function cancelAutomation() {
    if (!item) return;
    if (!wallet)
      return toast.error("Connect your SocketFi account before cancelling");
    if (!accessToken) return toast.error("Your SocketFi session has expired");
    if (!policyId)
      return toast.error("This automation does not have a valid policy ID");

    setCancelling(true);
    try {
      const revokeResponse = await signAndSubmitSmartAccountInvocation({
        authMethod,
        network,
        walletAddress: wallet,
        contractId: wallet,
        callFunction: { name: "revoke_session" },
        argsXdr: [policyIdArgXdr(policyId)],
        accessToken,
        stellarSigner,
        evmSigner,
        connectedEvmAddress,
        isEvmConnected,
        signMessageAsync,
        evmConnectors,
        connectedEvmConnector,
        reconnectEvmAsync,
        evmConnectorId,
        evmConnectorType,
        evmConnectorName,
        socketfi,
        display: {
          description: `Revoke the scoped session for ${strategyLabel}`,
          values: [
            { automationId: idOf(item) },
            { policyId },
            { action: "Cancel automation and revoke future execution" },
          ],
        },
      });
      if (!revokeResponse)
        throw new Error("The session-revocation transaction was not submitted");
      await AutoLayer.cancel(idOf(item));
      setItem((current) =>
        current
          ? {
              ...current,
              status: "REVOKED",
              state: "CANCELLED",
              isCancelled: true,
              isTerminal: true,
            }
          : current
      );
      setShowCancel(false);
      toast.success("Automation cancelled and session revoked on-chain");
    } catch (error) {
      toast.error(
        errorMessage(error, "Unable to cancel and revoke this automation")
      );
      await load(true);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--color-canvas)] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-5" role="status" aria-label="Loading automation details">
          <div className="h-28 animate-pulse rounded-[var(--radius-panel)] bg-[var(--color-surface-subtle)]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((key) => <div key={key} className="h-28 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-subtle)]" />)}
          </div>
          <span className="sr-only">Loading automation details…</span>
        </div>
      </main>
    );
  }

  if (!item) {
    const disconnected = !wallet;
    return (
      <main className="min-h-screen bg-[var(--color-canvas)] px-4 py-10 sm:px-6">
        <Card className="mx-auto max-w-3xl text-center" padding="lg">
          <AlertCircle className="mx-auto h-8 w-8 text-[var(--color-danger)]" />
          <h1 className="mt-4 text-xl font-semibold text-[var(--color-text-primary)]">
            {disconnected ? "Connect your SocketFi account" : loadError ? "Unable to load automation" : "Automation not found"}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {disconnected
              ? "Connect the wallet that owns this automation, then try again."
              : loadError || "It may belong to another wallet or network."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {!disconnected && loadError ? <Button variant="secondary" leadingIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Try again</Button> : null}
            <Button leadingIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/automations")}>Back to automations</Button>
          </div>
        </Card>
      </main>
    );
  }

  const typeLabel = STRATEGY_LABELS[strategyTypeOf(item)] || item.type || "Automation";
  const maxExecutions = maximumExecutions(item);
  const paymentHash = String(item.payment?.transactionHash || "");
  const itemNetwork = item.network || network;

  return (
    <main className="min-h-screen bg-[var(--color-canvas)]">
      <div className="mx-auto w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Button variant="quiet" size="sm" leadingIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/automations")}>
          Back to automations
        </Button>

        <PageHeader
          eyebrow={typeLabel}
          title={strategyLabel}
          description={strategySummary(item)}
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <StatusBadge tone={statusTone(status)} className="min-h-9 px-3 capitalize">{statusLabel(status)}</StatusBadge>
              <Button variant="secondary" size="sm" disabled={refreshing} leadingIcon={<RefreshCw className={classNames("h-4 w-4", refreshing && "animate-spin")} />} onClick={() => void load(true)}>
                {refreshing ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
          }
        />

        {loadError ? <InlineAlert tone="danger" title="Refresh failed" icon={<AlertCircle className="h-5 w-5" />}>{loadError}</InlineAlert> : null}

        <Section title="Overview" description="Current timing, execution progress, and wallet permission.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card padding="sm"><p className="text-xs font-medium text-[var(--color-text-muted)]">Next run</p><p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatDate(item.nextRunAt || item.metadata?.scheduling?.firstRunAt)}</p></Card>
            <Card padding="sm"><p className="text-xs font-medium text-[var(--color-text-muted)]">Last execution</p><p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatDate(item.lastRunAt)}</p></Card>
            <Card padding="sm"><p className="text-xs font-medium text-[var(--color-text-muted)]">Executions</p><p className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">{Number(item.runCount || 0)}{maxExecutions != null ? ` of ${maxExecutions}` : ""}</p></Card>
            <Card padding="sm"><p className="text-xs font-medium text-[var(--color-text-muted)]">Permission expires</p><p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{item.expiresAtLedger != null ? `Ledger ${item.expiresAtLedger}` : "Not available"}</p></Card>
            {item.remainingRuns != null ? <Card padding="sm"><p className="text-xs font-medium text-[var(--color-text-muted)]">Remaining executions</p><p className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">{item.remainingRuns}</p></Card> : null}
          </div>
        </Section>

        <Section surface title="Schedule and limits" description="The scheduler and authorization boundaries configured for this automation.">
          <dl className="grid gap-x-8 sm:grid-cols-2">
            <DetailRow label="Schedule" value={item.schedule?.expression || "Not available"} />
            <DetailRow label="Timezone" value={item.schedule?.timezone || "UTC"} />
            <DetailRow label="Maximum executions" value={maxExecutions ?? "Not available"} />
            <DetailRow label="Maximum per run" value={perRunLimit(item) || "Not available"} />
            <DetailRow label="Maximum authorization" value={maximumAuthorization(item) || "Not available"} />
            <DetailRow label="Allowed scope" value={scopeSummary(item) || "Not available"} />
          </dl>
        </Section>

        <Section surface title="Actions" description="Manage future scheduling and the limited wallet permission.">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {canCancel ? "Cancel future executions" : "No cancellation action is available"}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                {canCancel
                  ? "Cancellation revokes this automation’s limited wallet permission and permanently stops its AutoLayer schedule. Funds already held by your account are not automatically transferred or withdrawn."
                  : "This automation is already in a terminal state. Funds held by your account remain in the account."}
              </p>
            </div>
            {canCancel ? <Button variant="danger" leadingIcon={<XCircle className="h-4 w-4" />} onClick={() => setShowCancel(true)}>Cancel automation</Button> : null}
          </div>
        </Section>

        <details className="group rounded-[var(--radius-panel)] border border-[var(--color-border-default)] bg-[var(--color-surface)] shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)] sm:p-6 [&::-webkit-details-marker]:hidden">
            <div><h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Technical details</h2><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Policy, backend identifiers, ledger bounds, and raw configuration.</p></div>
            <ChevronDown className="h-5 w-5 shrink-0 text-[var(--color-text-muted)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-[var(--color-border-default)] p-5 sm:p-6">
            <div className="grid gap-x-8 lg:grid-cols-2">
              <DetailRow label="Automation ID" value={idOf(item)} mono />
              <DetailRow label="Network" value={itemNetwork} />
              <DetailRow label="Wallet" value={shortenAddress(item.walletAddress || wallet)} mono />
              <DetailRow label="Policy ID" value={<span className="inline-flex items-center gap-2"><span>{policyId || "—"}</span>{policyId ? <button type="button" aria-label="Copy policy ID" onClick={() => void copy(policyId, "Policy ID")} className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"><Copy className="h-4 w-4" /></button> : null}</span>} mono />
              <DetailRow label="Delegate" value={item.delegatePublicKey || "—"} mono />
              <DetailRow label="Valid after ledger" value={item.validAfterLedger ?? "—"} />
              <DetailRow label="Expires at ledger" value={item.expiresAtLedger ?? "—"} />
              <DetailRow label="Agenda job ID" value={item.agendaJobId || "—"} mono />
              <DetailRow label="Session authorization limit" value={item.sessionAuthorizationLimit ?? "—"} />
              <DetailRow label="Payment status" value={item.payment?.status || "—"} />
              <DetailRow label="Payment transaction" value={paymentHash ? <a href={explorerUrl(itemNetwork, paymentHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[var(--color-information)] hover:underline">{shorten(paymentHash, 12, 10)}<ExternalLink className="h-3.5 w-3.5" /></a> : "—"} mono />
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {[{ title: "Raw strategy JSON", value: item.strategy }, { title: "Raw schedule JSON", value: item.schedule }].map((entry) => <div key={entry.title} className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-default)]"><h3 className="border-b border-[var(--color-border-default)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)]">{entry.title}</h3><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words bg-[var(--color-surface-subtle)] p-4 text-xs leading-6 text-[var(--color-text-secondary)]">{JSON.stringify(entry.value || {}, null, 2)}</pre></div>)}
            </div>
          </div>
        </details>
      </div>
      {showCancel ? <CancelDialog busy={cancelling} onClose={() => { if (!cancelling) setShowCancel(false); }} onConfirm={() => void cancelAutomation()} /> : null}
    </main>
  );
}
