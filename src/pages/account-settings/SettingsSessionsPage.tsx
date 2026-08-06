import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldOff,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { useAccount, useConnectors, useReconnect, useSignMessage } from "wagmi";
import { useSocketFi } from "@socketfi/react";

import { useStates } from "../../context/StatesContext";
import {
  api,
  type SessionStatus,
} from "../../services/sessionAutomation.client";
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
import { shortenAddress } from "../../utils/formatters";

type PermissionStatus = "ACTIVE" | "EXPIRED" | "REVOKED" | "INVALIDATED" | string;
type AllowedInvocation = { contractId?: string; functionName?: string };
type UsageEvent = { executionId?: string; status?: string; [key: string]: unknown };
type AutomationPermission = {
  status?: PermissionStatus;
  policyIdHex?: string;
  expectedPolicyIdHex?: string;
  delegatePublicKey?: string;
  label?: string;
  automationId?: string;
  network?: string;
  useCount?: number;
  maxUses?: number | null;
  validAfterLedger?: number | null;
  expiresAtLedger?: number | null;
  sessionEpoch?: number | null;
  allowedInvocations?: AllowedInvocation[];
  usageEvents?: UsageEvent[];
  scopes?: unknown;
  policy?: unknown;
  [key: string]: unknown;
};

type RevokeStage =
  | "IDLE"
  | "PREPARING"
  | "AWAITING_APPROVAL"
  | "SUBMITTING"
  | "CONFIRMING"
  | "REVOKED"
  | "FAILED";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function transactionHash(response: unknown): string | undefined {
  const value = response as {
    txHash?: unknown;
    hash?: unknown;
    transactionHash?: unknown;
    data?: { txHash?: unknown; hash?: unknown };
  } | null;
  const hash =
    value?.txHash ||
    value?.hash ||
    value?.transactionHash ||
    value?.data?.txHash ||
    value?.data?.hash;
  return typeof hash === "string" && hash ? hash : undefined;
}

function bytesFromHex(value: string): Buffer {
  const normalized = String(value || "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("Permission policy ID must be a 32-byte hexadecimal value");
  }
  return Buffer.from(
    normalized.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) || []
  );
}

function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Unable to complete the request";
}

function statusTone(status?: string): StatusBadgeTone {
  if (status === "ACTIVE") return "success";
  if (status === "EXPIRED") return "warning";
  if (status === "REVOKED" || status === "INVALIDATED") return "danger";
  return "neutral";
}

function permissionName(permission: AutomationPermission) {
  return permission.label || permission.automationId || "Automation permission";
}

function allowedActionSummary(permission: AutomationPermission) {
  const actions = permission.allowedInvocations || [];
  if (!actions.length) return "Allowed actions are not indexed";
  if (actions.length === 1 && actions[0]?.functionName) {
    return `Allows ${actions[0].functionName}`;
  }
  return `${actions.length} allowed actions`;
}

function executionProgress(permission: AutomationPermission) {
  const used = Number(permission.useCount || 0);
  return permission.maxUses == null ? `${used} used` : `${used} of ${permission.maxUses}`;
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

function PermissionCard({
  permission,
  network,
  onOpen,
}: {
  permission: AutomationPermission;
  network: string;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => onOpen(event.currentTarget)}
      className="grid w-full gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-surface)] p-4 text-left shadow-sm outline-none transition hover:border-[var(--color-border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_130px] sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {permissionName(permission)}
          </h3>
          <StatusBadge tone={statusTone(permission.status)}>
            {permission.status || "Unknown"}
          </StatusBadge>
        </div>
        <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">
          {allowedActionSummary(permission)}
        </p>
      </div>
      <div>
        <p className="text-xs text-[var(--color-text-muted)]">Executions</p>
        <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
          {executionProgress(permission)}
        </p>
      </div>
      <div>
        <p className="text-xs text-[var(--color-text-muted)]">Permission expiration</p>
        <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
          {permission.expiresAtLedger == null
            ? "Not available"
            : `Ledger ${permission.expiresAtLedger}`}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {permission.network || network}
        </p>
      </div>
    </button>
  );
}

export default function SettingsSessionsPage() {
  const navigate = useNavigate();
  const socketfi = useSocketFi();
  const { activeSession, selectedNetwork, toast } = useStates();
  const {
    address: connectedEvmAddress,
    connector: connectedEvmConnector,
    isConnected: isEvmConnected,
  } = useAccount();
  const evmConnectors = useConnectors();
  const { reconnectAsync: reconnectEvmAsync } = useReconnect();
  const { signMessageAsync } = useSignMessage();

  const token = activeSession?.accessToken || "";
  const wallet = activeSession?.userProfile?.address?.[selectedNetwork] || "";
  const authMethod = getSocketFiAuthMethod(activeSession);
  const stellarSigner = getSocketFiStellarSigner(activeSession);
  const evmSigner = getSocketFiEvmSigner(activeSession);

  const [items, setItems] = useState<AutomationPermission[]>([]);
  const [selected, setSelected] = useState<AutomationPermission | null>(null);
  const [confirmPermission, setConfirmPermission] =
    useState<AutomationPermission | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [working, setWorking] = useState("");
  const [status, setStatus] = useState<SessionStatus | "">("");
  const [search, setSearch] = useState("");
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [revokeStage, setRevokeStage] = useState<RevokeStage>("IDLE");
  const [revokeError, setRevokeError] = useState("");
  const [revokeTxHash, setRevokeTxHash] = useState("");
  const drawerRef = useRef<HTMLElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!token) {
        setItems([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      quiet ? setRefreshing(true) : setLoading(true);
      setFetchError("");
      try {
        const result = await api.listSessions(
          selectedNetwork,
          token,
          status,
          search.trim()
        );
        const next = Array.isArray(result) ? result : result?.items || [];
        setItems(next as AutomationPermission[]);
      } catch (error) {
        const message = readableError(error);
        setFetchError(message);
        toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, selectedNetwork, status, toast, token]
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const active = useMemo(
    () => items.filter((item) => item.status === "ACTIVE"),
    [items]
  );
  const expired = useMemo(
    () => items.filter((item) => item.status === "EXPIRED"),
    [items]
  );
  const ended = useMemo(
    () =>
      items.filter(
        (item) => item.status === "REVOKED" || item.status === "INVALIDATED"
      ),
    [items]
  );
  const unknown = useMemo(
    () =>
      items.filter(
        (item) =>
          !["ACTIVE", "EXPIRED", "REVOKED", "INVALIDATED"].includes(
            String(item.status || "")
          )
      ),
    [items]
  );

  const operationPending = Boolean(working);

  useEffect(() => {
    if (confirmPermission) {
      window.setTimeout(() => confirmationRef.current?.focus(), 0);
    } else if (selected) {
      window.setTimeout(() => drawerRef.current?.focus(), 0);
    }
  }, [confirmPermission, selected]);

  useEffect(() => {
    if (!selected && !confirmPermission) lastTriggerRef.current?.focus();
  }, [confirmPermission, selected]);

  useEffect(() => {
    if (!selected && !confirmPermission && !confirmAllOpen) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || operationPending) return;
      if (confirmPermission) setConfirmPermission(null);
      else if (confirmAllOpen) setConfirmAllOpen(false);
      else setSelected(null);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [confirmAllOpen, confirmPermission, operationPending, selected]);

  async function signInvocation(
    functionName: string,
    argsXdr: string[],
    description: string,
    values: Array<Record<string, unknown>>
  ) {
    return signAndSubmitSmartAccountInvocation({
      authMethod,
      network: selectedNetwork,
      walletAddress: wallet,
      contractId: wallet,
      callFunction: { name: functionName },
      argsXdr,
      accessToken: token,
      stellarSigner,
      evmSigner,
      connectedEvmAddress,
      isEvmConnected,
      signMessageAsync,
      evmConnectors,
      connectedEvmConnector,
      reconnectEvmAsync,
      evmConnectorId:
        typeof activeSession?.evmConnectorId === "string"
          ? activeSession.evmConnectorId
          : undefined,
      evmConnectorType:
        typeof activeSession?.evmConnectorType === "string"
          ? activeSession.evmConnectorType
          : undefined,
      evmConnectorName:
        typeof activeSession?.evmConnectorName === "string"
          ? activeSession.evmConnectorName
          : undefined,
      socketfi,
      display: { description, values },
    });
  }

  async function revoke(permission: AutomationPermission) {
    if (permission.status !== "ACTIVE" || !permission.policyIdHex) return;
    setWorking(permission.policyIdHex);
    setRevokeError("");
    setRevokeTxHash("");
    setRevokeStage("PREPARING");
    try {
      setRevokeStage("AWAITING_APPROVAL");
      const response = await signInvocation(
        "revoke_session",
        [xdr.ScVal.scvBytes(bytesFromHex(permission.policyIdHex)).toXDR("base64")],
        "Revoke automation permission",
        [
          { policyId: permission.policyIdHex },
          { delegate: permission.delegatePublicKey },
          { uses: permission.useCount || 0 },
        ]
      );
      setRevokeStage("SUBMITTING");
      const txHash = transactionHash(response);
      if (!txHash) throw new Error("No transaction hash was returned");
      setRevokeTxHash(txHash);
      setRevokeStage("CONFIRMING");
      await api.confirmRevoke(
        {
          network: selectedNetwork,
          policyIdHex: permission.policyIdHex,
          transactionHash: txHash,
        },
        token
      );
      setRevokeStage("REVOKED");
      toast.success("Automation permission revoked");
      setSelected(null);
      await load(true);
    } catch (error) {
      const message = readableError(error);
      setRevokeError(message);
      setRevokeStage("FAILED");
      toast.error(message);
    } finally {
      setWorking("");
    }
  }

  async function retryConfirmation() {
    if (!confirmPermission?.policyIdHex || !revokeTxHash) return;
    setWorking(confirmPermission.policyIdHex);
    setRevokeError("");
    setRevokeStage("CONFIRMING");
    try {
      await api.confirmRevoke(
        {
          network: selectedNetwork,
          policyIdHex: confirmPermission.policyIdHex,
          transactionHash: revokeTxHash,
        },
        token
      );
      setRevokeStage("REVOKED");
      toast.success("Automation permission status confirmed");
      setSelected(null);
      await load(true);
    } catch (error) {
      const message = readableError(error);
      setRevokeError(message);
      setRevokeStage("FAILED");
      toast.error(message);
    } finally {
      setWorking("");
    }
  }

  async function revokeAll() {
    if (!active.length) return;
    setWorking("ALL");
    try {
      const response = await signInvocation(
        "revoke_all_sessions",
        [],
        "Invalidate all automation permissions",
        [{ activeSessions: active.length }, { network: selectedNetwork }]
      );
      const txHash = transactionHash(response);
      if (!txHash) throw new Error("No transaction hash was returned");
      await api.confirmRevokeAll(
        {
          network: selectedNetwork,
          walletAddress: wallet,
          transactionHash: txHash,
        },
        token
      );
      toast.success("All active automation permissions invalidated");
      setConfirmAllOpen(false);
      await load();
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setWorking("");
    }
  }

  function openPermission(permission: AutomationPermission, trigger: HTMLButtonElement) {
    lastTriggerRef.current = trigger;
    setSelected(permission);
  }

  function beginConfirmation(permission: AutomationPermission) {
    setRevokeStage("IDLE");
    setRevokeError("");
    setRevokeTxHash("");
    setConfirmPermission(permission);
  }

  const groups = [
    { title: "Active", description: "Permissions that can currently authorize configured actions.", items: active },
    { title: "Expired", description: "Permissions whose ledger validity has ended.", items: expired },
    { title: "Revoked or invalidated", description: "Permissions permanently disabled individually or through account-wide invalidation.", items: ended },
    { title: "Other statuses", description: "Permissions with a status that is not classified by this interface.", items: unknown },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-canvas)]">
      <div className="mx-auto w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Button variant="quiet" size="sm" leadingIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate("/settings")}>Back to settings</Button>
        <PageHeader
          eyebrow="Account security"
          title="Automation permissions"
          description="Review what your automations can do, the limits on each permission, and when access expires."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => navigate("/automations/new")}
              >
                Create automation
              </Button>
              {active.length ? (
                <Button variant="danger" leadingIcon={<ShieldOff className="h-4 w-4" />} disabled={operationPending} onClick={() => setConfirmAllOpen(true)}>
                  Revoke all active ({active.length})
                </Button>
              ) : null}
            </div>
          }
        />

        {fetchError ? <InlineAlert tone="danger" title="Unable to load automation permissions" icon={<AlertCircle className="h-5 w-5" />}><p>{fetchError}</p><Button className="mt-3" size="sm" variant="secondary" leadingIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void load()}>Try again</Button></InlineAlert> : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search automation permissions</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--color-text-muted)]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by automation, permission, or delegate" className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface)] pl-10 pr-3 text-sm outline-none focus:border-[var(--color-action-primary)] focus:ring-2 focus:ring-[var(--color-action-primary)]" />
          </label>
          <select aria-label="Filter automation permissions by status" value={status} onChange={(event) => setStatus(event.target.value as SessionStatus | "")} className="min-h-11 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface)] px-3 text-sm outline-none focus:border-[var(--color-action-primary)] focus:ring-2 focus:ring-[var(--color-action-primary)]">
            <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option><option value="REVOKED">Revoked</option><option value="INVALIDATED">Invalidated</option>
          </select>
          <Button variant="secondary" size="sm" disabled={refreshing || loading} leadingIcon={<RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />} onClick={() => void load(true)}>{refreshing ? "Refreshing…" : "Refresh"}</Button>
        </div>

        {loading && !items.length ? (
          <div className="grid gap-3" role="status" aria-label="Loading automation permissions">{[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-subtle)]" />)}<span className="sr-only">Loading automation permissions…</span></div>
        ) : (
          groups.map((group) => (
            <Section key={group.title} title={`${group.title} (${group.items.length})`} description={group.description}>
              {group.items.length ? <div className="grid gap-3">{group.items.map((permission, index) => <PermissionCard key={permission.policyIdHex || `${group.title}-${index}`} permission={permission} network={selectedNetwork} onOpen={(trigger) => openPermission(permission, trigger)} />)}</div> : <Card padding="md" className="text-center shadow-none"><KeyRound className="mx-auto h-6 w-6 text-[var(--color-text-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">No {group.title.toLowerCase()} permissions</p><p className="mt-1 text-xs text-[var(--color-text-secondary)]">{group.title === "Active" ? "No automation permissions can currently authorize actions." : "There are no permissions in this history group."}</p></Card>}
            </Section>
          ))
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[220]">
          <button type="button" aria-label="Close permission details" disabled={operationPending} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm disabled:cursor-not-allowed" onClick={() => setSelected(null)} />
          <aside ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="permission-drawer-title" aria-describedby="permission-drawer-description" onKeyDown={focusTrap} className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto bg-[var(--color-surface)] shadow-2xl outline-none motion-reduce:transition-none">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--color-border-default)] bg-[var(--color-surface)]/95 p-5 backdrop-blur">
              <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Automation permission</p><h2 id="permission-drawer-title" className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{permissionName(selected)}</h2><p id="permission-drawer-description" className="mt-1 text-sm text-[var(--color-text-secondary)]">Review what this permission allows and the limits applied to it.</p></div>
              <button type="button" aria-label="Close permission details" disabled={operationPending} onClick={() => setSelected(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border-default)] text-[var(--color-text-secondary)] outline-none hover:bg-[var(--color-surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] disabled:opacity-50"><X className="h-5 w-5" /></button>
            </header>
            <div className="space-y-5 p-5">
              <Section surface title="Overview"><dl className="grid gap-3 sm:grid-cols-2"><Card padding="sm" className="shadow-none"><dt className="text-xs text-[var(--color-text-muted)]">Status</dt><dd className="mt-2"><StatusBadge tone={statusTone(selected.status)}>{selected.status || "Unknown"}</StatusBadge></dd></Card><Card padding="sm" className="shadow-none"><dt className="text-xs text-[var(--color-text-muted)]">Associated automation</dt><dd className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{selected.label || selected.automationId || "Not associated"}</dd></Card><Card padding="sm" className="shadow-none"><dt className="text-xs text-[var(--color-text-muted)]">Network</dt><dd className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{selected.network || selectedNetwork}</dd></Card><Card padding="sm" className="shadow-none"><dt className="text-xs text-[var(--color-text-muted)]">Allowed</dt><dd className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{allowedActionSummary(selected)}</dd></Card><Card padding="sm" className="shadow-none"><dt className="text-xs text-[var(--color-text-muted)]">Executions used</dt><dd className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{Number(selected.useCount || 0)}</dd></Card>{selected.maxUses != null ? <Card padding="sm" className="shadow-none"><dt className="text-xs text-[var(--color-text-muted)]">Maximum executions</dt><dd className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{selected.maxUses}</dd></Card> : null}<Card padding="sm" className="shadow-none"><dt className="text-xs text-[var(--color-text-muted)]">Permission expiration</dt><dd className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{selected.expiresAtLedger == null ? "Not available" : `Ledger ${selected.expiresAtLedger}`}</dd></Card></dl></Section>

              <Section surface title="Allowed actions" description="Contract functions indexed for this permission.">{selected.allowedInvocations?.length ? <div className="space-y-2">{selected.allowedInvocations.map((action, index) => <div key={`${action.contractId}-${action.functionName}-${index}`} className="rounded-[var(--radius-card)] bg-[var(--color-surface-subtle)] p-3"><p className="text-sm font-semibold text-[var(--color-text-primary)]">{action.functionName || "Unknown function"}</p><p className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">{action.contractId ? shortenAddress(action.contractId) : "Unknown contract"}</p></div>)}</div> : <p className="text-sm text-[var(--color-text-secondary)]">No allowed-action metadata is indexed for this permission.</p>}</Section>

              <Section surface title="Limits" description="Only count and ledger limits with known meanings are shown."><dl><div className="flex justify-between gap-4 border-b border-[var(--color-border-default)] py-3"><dt className="text-sm text-[var(--color-text-secondary)]">Executions used</dt><dd className="text-sm font-semibold text-[var(--color-text-primary)]">{Number(selected.useCount || 0)}</dd></div>{selected.maxUses != null ? <div className="flex justify-between gap-4 border-b border-[var(--color-border-default)] py-3"><dt className="text-sm text-[var(--color-text-secondary)]">Maximum executions</dt><dd className="text-sm font-semibold text-[var(--color-text-primary)]">{selected.maxUses}</dd></div> : null}<div className="flex justify-between gap-4 py-3"><dt className="text-sm text-[var(--color-text-secondary)]">Permission expiration</dt><dd className="text-sm font-semibold text-[var(--color-text-primary)]">{selected.expiresAtLedger == null ? "Not available" : `Ledger ${selected.expiresAtLedger}`}</dd></div></dl></Section>

              <details className="group rounded-[var(--radius-panel)] border border-[var(--color-border-default)]"><summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold text-[var(--color-text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-action-primary)] [&::-webkit-details-marker]:hidden">Technical details<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary><dl className="border-t border-[var(--color-border-default)] px-4 py-2 text-sm"><div className="py-2"><dt className="text-[var(--color-text-muted)]">Policy ID</dt><dd className="mt-1 break-all font-mono text-xs">{selected.policyIdHex || "—"}</dd></div><div className="py-2"><dt className="text-[var(--color-text-muted)]">Expected policy ID</dt><dd className="mt-1 break-all font-mono text-xs">{selected.expectedPolicyIdHex || "—"}</dd></div><div className="py-2"><dt className="text-[var(--color-text-muted)]">Delegate public key</dt><dd className="mt-1 break-all font-mono text-xs">{selected.delegatePublicKey || "—"}</dd></div><div className="grid gap-3 py-2 sm:grid-cols-3"><div><dt className="text-[var(--color-text-muted)]">Valid after ledger</dt><dd>{selected.validAfterLedger ?? "—"}</dd></div><div><dt className="text-[var(--color-text-muted)]">Expires at ledger</dt><dd>{selected.expiresAtLedger ?? "—"}</dd></div><div><dt className="text-[var(--color-text-muted)]">Session epoch</dt><dd>{selected.sessionEpoch ?? "—"}</dd></div></div><div className="py-2"><dt className="text-[var(--color-text-muted)]">Raw permission data</dt><dd><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--color-surface-subtle)] p-3 text-xs">{JSON.stringify(selected, null, 2)}</pre></dd></div></dl></details>

              {selected.status === "ACTIVE" ? <Section surface title="Revoke permission" description="Permanently prevent this permission from being used again." className="border-[var(--color-danger-border)]"><p className="text-sm leading-6 text-[var(--color-text-secondary)]">An automation depending on this permission may stop working. Revocation does not transfer or withdraw account funds, and completed transactions cannot be reversed.</p><Button className="mt-4 w-full" variant="danger" leadingIcon={<ShieldOff className="h-4 w-4" />} onClick={() => beginConfirmation(selected)}>Review revocation</Button></Section> : null}
            </div>
          </aside>
        </div>
      ) : null}

      {confirmPermission ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-4">
          <button type="button" aria-label="Close revocation confirmation" disabled={operationPending} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm disabled:cursor-not-allowed" onClick={() => setConfirmPermission(null)} />
          <div ref={confirmationRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="revoke-permission-title" aria-describedby="revoke-permission-description" onKeyDown={focusTrap} className="relative w-full max-w-lg rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-6 shadow-2xl outline-none">
            <ShieldOff className="h-7 w-7 text-[var(--color-danger)]" />
            <h2 id="revoke-permission-title" className="mt-4 text-xl font-semibold text-[var(--color-text-primary)]">Revoke this automation permission?</h2>
            <div id="revoke-permission-description" className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-text-secondary)]"><p>This permanently prevents future use of this permission. An automation depending on it may stop working.</p><p>Funds remain in your account, and completed transactions cannot be reversed. You will need to approve an on-chain transaction.</p></div>
            {revokeStage !== "IDLE" ? <div role={revokeStage === "FAILED" ? "alert" : "status"} aria-live="polite" className="mt-4 rounded-[var(--radius-card)] bg-[var(--color-surface-subtle)] p-4"><p className="text-sm font-semibold text-[var(--color-text-primary)]">{{ PREPARING: "Preparing transaction…", AWAITING_APPROVAL: "Awaiting wallet approval and submission…", SUBMITTING: "Transaction submitted…", CONFIRMING: "Confirming permission status…", REVOKED: "Permission revoked", FAILED: "Revocation needs attention", IDLE: "" }[revokeStage]}</p>{revokeError ? <p className="mt-1 text-sm text-[var(--color-danger)]">{revokeError}</p> : null}{revokeTxHash ? <p className="mt-2 break-all font-mono text-xs text-[var(--color-text-muted)]">Transaction: {revokeTxHash}</p> : null}</div> : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="secondary" disabled={operationPending} onClick={() => setConfirmPermission(null)}>{revokeStage === "REVOKED" ? "Close" : "Keep permission"}</Button>{revokeStage === "FAILED" && revokeTxHash ? <Button disabled={operationPending} onClick={() => void retryConfirmation()}>Retry confirmation</Button> : revokeStage !== "REVOKED" ? <Button variant="danger" disabled={operationPending} onClick={() => void revoke(confirmPermission)}>{operationPending ? "Revoking…" : "Approve and revoke"}</Button> : null}</div>
          </div>
        </div>
      ) : null}

      {confirmAllOpen ? (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
          <button type="button" aria-label="Close revoke-all confirmation" disabled={working === "ALL"} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm disabled:cursor-not-allowed" onClick={() => setConfirmAllOpen(false)} />
          <div role="alertdialog" aria-modal="true" aria-labelledby="revoke-all-title" className="relative w-full max-w-md rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-6 shadow-2xl">
            <ShieldOff className="h-7 w-7 text-[var(--color-danger)]" />
            <h2 id="revoke-all-title" className="mt-4 text-xl font-semibold text-[var(--color-text-primary)]">Revoke all {active.length} active permission{active.length === 1 ? "" : "s"}?</h2>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[var(--color-text-secondary)]"><p>Active automations may stop executing. Funds remain in your account, and completed transactions are unaffected.</p><p>This requires account authorization and uses the existing account-wide on-chain invalidation operation.</p></div>
            <div className="mt-6 flex gap-3"><Button className="flex-1" variant="secondary" disabled={working === "ALL"} onClick={() => setConfirmAllOpen(false)}>Keep permissions</Button><Button className="flex-1" variant="danger" disabled={working === "ALL"} onClick={() => void revokeAll()}>{working === "ALL" ? <><Loader2 className="h-4 w-4 animate-spin" /> Revoking…</> : "Approve revoke all"}</Button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
