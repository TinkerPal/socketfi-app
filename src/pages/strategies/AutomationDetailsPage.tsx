// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { AutoLayer } from "@autolayer/sdk";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  RefreshCw,
  ShieldCheck,
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
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "Not available";
}
function normalize(response: any): AutomationItem[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.automations)) return response.automations;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}
function statusClasses(status: string) {
  switch (status) {
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
  value: React.ReactNode;
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
function JsonCard({
  title,
  value,
}: {
  title: string;
  value?: Record<string, any>;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[#EAECF0] bg-white shadow-sm">
      <div className="border-b border-[#EAECF0] px-5 py-4">
        <h2 className="text-base font-semibold text-[#101828]">{title}</h2>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words bg-[#FCFCFD] p-5 text-xs leading-6 text-[#344054]">
        {JSON.stringify(value || {}, null, 2)}
      </pre>
    </section>
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
                This permanently stops future execution.
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
              The wallet session will be revoked first.
            </p>
            <p className="mt-1 text-sm leading-6 text-[#B42318]">
              After the on-chain revocation succeeds, AutoLayer will cancel its
              server-side schedule.
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
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!wallet || !automationId) {
        setItem(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      quiet ? setRefreshing(true) : setLoading(true);
      try {
        const response = await AutoLayer.fetchAll(wallet, { network });
        const found =
          normalize(response).find((entry) => idOf(entry) === automationId) ||
          null;
        if (!found) throw new Error("Automation not found");
        setItem(found);
      } catch (error) {
        toast.error(errorMessage(error, "Unable to load automation"));
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

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-7 w-7 animate-spin text-[#2F0FD1]" />
      </main>
    );
  if (!item)
    return (
      <main className="min-h-screen bg-[#F8FAFC]">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
          <section className="rounded-3xl border border-[#EAECF0] bg-white p-8 text-center shadow-sm">
            <AlertCircle className="mx-auto h-8 w-8 text-[#D92D20]" />
            <h1 className="mt-4 text-xl font-semibold text-[#101828]">
              Automation not found
            </h1>
            <p className="mt-2 text-sm text-[#667085]">
              It may belong to another wallet or network.
            </p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#2F0FD1] px-4 text-sm font-semibold text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to automations
            </button>
          </section>
        </div>
      </main>
    );

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto w-full  space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-[#EAECF0] bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#475467] transition hover:text-[#101828]"
              >
                <ArrowLeft className="h-4 w-4" /> Back to automations
              </button>
              <div className="mt-5 flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#2F0FD1]">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight text-[#101828]">
                      {strategyLabel}
                    </h1>
                    <span
                      className={classNames(
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                        statusClasses(status)
                      )}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#667085]">
                    {STRATEGY_LABELS[String(item.type || "").toUpperCase()] ||
                      item.type}
                  </p>
                  <p className="mt-2 break-all font-mono text-[11px] text-[#98A2B3]">
                    {idOf(item)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={refreshing}
                onClick={() => void load(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3.5 text-sm font-semibold text-[#344054]"
              >
                <RefreshCw
                  className={classNames(
                    "h-4 w-4",
                    refreshing && "animate-spin"
                  )}
                />{" "}
                Refresh
              </button>
              {canCancel ? (
                <button
                  type="button"
                  onClick={() => setShowCancel(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#FECDCA] bg-white px-3.5 text-sm font-semibold text-[#B42318] transition hover:bg-[#FEF3F2]"
                >
                  <XCircle className="h-4 w-4" /> Cancel automation
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#EAECF0] bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium text-[#667085]">Runs</p>
            <p className="mt-1 text-xl font-semibold text-[#101828]">
              {Number(item.runCount || 0)}
              {item.scheduledRunLimit != null
                ? ` / ${item.scheduledRunLimit}`
                : ""}
            </p>
            <p className="mt-0.5 text-xs text-[#98A2B3]">
              Successful executions
            </p>
          </div>
          <div className="rounded-2xl border border-[#EAECF0] bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium text-[#667085]">Remaining</p>
            <p className="mt-1 text-xl font-semibold text-[#101828]">
              {item.remainingRuns == null ? "Unlimited" : item.remainingRuns}
            </p>
            <p className="mt-0.5 text-xs text-[#98A2B3]">Scheduled runs</p>
          </div>
          <div className="rounded-2xl border border-[#EAECF0] bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium text-[#667085]">Schedule</p>
            <p className="mt-1 truncate text-sm font-semibold text-[#101828]">
              {item.schedule?.expression || "One time"}
            </p>
            <p className="mt-1 text-xs text-[#98A2B3]">
              {item.schedule?.timezone || "UTC"}
            </p>
          </div>
          <div className="rounded-2xl border border-[#EAECF0] bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-medium text-[#667085]">Wallet access</p>
            <div className="mt-1 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#027A48]" />
              <p className="text-sm font-semibold text-[#101828]">
                Scoped session
              </p>
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-[#98A2B3]">
              {shorten(item.walletAddress || wallet, 12, 10)}
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <section className="overflow-hidden rounded-3xl border border-[#EAECF0] bg-white shadow-sm">
            <div className="border-b border-[#EAECF0] px-5 py-4">
              <h2 className="text-base font-semibold text-[#101828]">
                Automation details
              </h2>
            </div>
            <div className="px-5">
              <DetailRow label="Network" value={item.network || network} />
              <DetailRow label="Type" value={item.type || "—"} />
              <DetailRow
                label="Next run"
                value={formatDate(
                  item.nextRunAt || item.metadata?.scheduling?.firstRunAt
                )}
              />
              <DetailRow
                label={item.lastRunAt ? "Last run" : "Activated at"}
                value={formatDate(item.lastRunAt ?? item.activatedAt)}
              />
              <DetailRow
                label="Valid after ledger"
                value={item.validAfterLedger ?? "—"}
              />
              <DetailRow
                label="Expires at ledger"
                value={item.expiresAtLedger ?? "—"}
              />
              <DetailRow label="Spent amount" value={item.spentAmount ?? "0"} />
              <DetailRow
                label="Agenda job"
                value={item.agendaJobId || "Not scheduled"}
                mono
              />
            </div>
          </section>
          <section className="overflow-hidden rounded-3xl border border-[#EAECF0] bg-white shadow-sm">
            <div className="border-b border-[#EAECF0] px-5 py-4">
              <h2 className="text-base font-semibold text-[#101828]">
                Authorization
              </h2>
            </div>
            <div className="px-5">
              <DetailRow
                label="Policy ID"
                value={
                  <span className="inline-flex items-center justify-end gap-2">
                    <span className="break-all">{policyId || "—"}</span>
                    {policyId ? (
                      <button
                        type="button"
                        onClick={() => void copy(policyId, "Policy ID")}
                        className="shrink-0 rounded-lg p-1.5 text-[#667085] hover:bg-[#F2F4F7]"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    ) : null}
                  </span>
                }
                mono
              />
              <DetailRow
                label="Delegate public key"
                value={item.delegatePublicKey || "—"}
                mono
              />
              <DetailRow
                label="Session authorization limit"
                value={item.sessionAuthorizationLimit ?? "Unlimited"}
              />
              <DetailRow
                label="Payment status"
                value={item.payment?.status || "—"}
              />
              <DetailRow
                label="Payment amount"
                value={item.payment?.amount || "—"}
              />
              <DetailRow
                label="Payment transaction"
                value={item.payment?.transactionHash || "—"}
                mono
              />
            </div>
          </section>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <JsonCard title="Strategy configuration" value={item.strategy} />
          <JsonCard title="Schedule configuration" value={item.schedule} />
        </section>

        <section className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className={classNames(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                status === "ACTIVE"
                  ? "bg-[#ECFDF3] text-[#027A48]"
                  : status === "FAILED"
                  ? "bg-[#FEF3F2] text-[#D92D20]"
                  : "bg-[#F2F4F7] text-[#667085]"
              )}
            >
              {status === "ACTIVE" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : status === "FAILED" ? (
                <AlertCircle className="h-5 w-5" />
              ) : status === "EXPIRED" ? (
                <Clock3 className="h-5 w-5" />
              ) : (
                <CalendarClock className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#101828]">
                Current execution state
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#667085]">
                {status === "ACTIVE"
                  ? "AutoLayer can execute this strategy according to its configured schedule and scoped wallet policy."
                  : status === "PAUSED"
                  ? "Future executions are paused, but the automation has not been permanently cancelled."
                  : status === "CANCELLED" || status === "REVOKED"
                  ? "Future AutoLayer execution has been permanently cancelled."
                  : status === "COMPLETED"
                  ? "This automation reached its configured run limit."
                  : status === "EXPIRED"
                  ? "The wallet session validity window has ended."
                  : status === "FAILED"
                  ? "The latest execution failed. Review the strategy and execution logs."
                  : "This automation is not currently executing."}
              </p>
            </div>
          </div>
        </section>
      </div>
      {showCancel ? (
        <CancelDialog
          busy={cancelling}
          onClose={() => {
            if (!cancelling) setShowCancel(false);
          }}
          onConfirm={() => void cancelAutomation()}
        />
      ) : null}
    </main>
  );
}
