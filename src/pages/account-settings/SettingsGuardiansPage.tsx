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
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Address, nativeToScVal } from "@stellar/stellar-sdk";
import { useAccount, useConnectors, useReconnect, useSignMessage } from "wagmi";
import { useSocketFi } from "@socketfi/react";

import { useStates } from "../../context/StatesContext";
import {
  getSocketFiAuthMethod,
  getSocketFiEvmSigner,
  getSocketFiStellarSigner,
  signAndSubmitSmartAccountInvocation,
} from "../../services/automationWalletSigning";
import { guardianApi } from "../../client/guardian.client";
import {
  Button,
  Card,
  InlineAlert,
  PageHeader,
  Section,
  StatusBadge,
} from "../../components/ui";
import { shortenAddress } from "../../utils/formatters";

type GuardianStatus = "ACTIVE" | "PENDING_REMOVAL" | string;
type Guardian = {
  address: string;
  status?: GuardianStatus;
  canFinalize?: boolean;
  removalAvailableAt?: string | number | null;
  [key: string]: unknown;
};

type ReviewAction =
  | { kind: "ADD"; guardian: Guardian }
  | { kind: "SCHEDULE"; guardian: Guardian }
  | { kind: "FINALIZE"; guardian: Guardian };

type TransactionStage =
  | "IDLE"
  | "PREPARING"
  | "AWAITING_APPROVAL"
  | "SUBMITTING"
  | "CONFIRMING"
  | "COMPLETE"
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

function readableError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Unable to complete the request";
}

function guardianAddressXdr(address: string): string {
  try {
    return nativeToScVal(Address.fromString(address), {
      type: "address",
    }).toXDR("base64");
  } catch {
    throw new Error(
      "Enter a valid Stellar G... or contract C... guardian address"
    );
  }
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

function removalTime(value?: string | number | null) {
  if (value == null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function actionCopy(action: ReviewAction) {
  if (action.kind === "ADD") {
    return {
      title: "Add this guardian?",
      description:
        "This adds the address to your account’s guardian set after you approve the on-chain transaction.",
      button: "Approve and add",
      success: "Guardian added",
    };
  }
  if (action.kind === "SCHEDULE") {
    return {
      title: "Start guardian removal?",
      description:
        "This begins the contract-defined waiting period. A second on-chain transaction will still be required after the delay.",
      button: "Approve removal schedule",
      success: "Guardian removal scheduled",
    };
  }
  return {
    title: "Finalize guardian removal?",
    description:
      "The indexed service reports that the delay is complete. Approving the on-chain transaction removes this address from the guardian set.",
    button: "Approve final removal",
    success: "Guardian removed",
  };
}

export default function SettingsGuardiansPage() {
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

  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [working, setWorking] = useState("");
  const [guardianAddress, setGuardianAddress] = useState("");
  const [inputError, setInputError] = useState("");
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [transactionStage, setTransactionStage] =
    useState<TransactionStage>("IDLE");
  const [transactionError, setTransactionError] = useState("");
  const [submittedHash, setSubmittedHash] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!token || !wallet) {
        setGuardians([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      quiet ? setRefreshing(true) : setLoading(true);
      setFetchError("");
      try {
        const result = await guardianApi.list({
          network: selectedNetwork,
          walletAddress: wallet,
          accessToken: token,
        });
        const next = Array.isArray(result) ? result : result?.items || [];
        setGuardians(next as Guardian[]);
      } catch (error) {
        const message = readableError(error);
        setFetchError(message);
        toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedNetwork, toast, token, wallet]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const activeGuardians = useMemo(
    () => guardians.filter((guardian) => guardian.status === "ACTIVE"),
    [guardians]
  );
  const pendingGuardians = useMemo(
    () =>
      guardians.filter((guardian) => guardian.status === "PENDING_REMOVAL"),
    [guardians]
  );
  const unknownGuardians = useMemo(
    () =>
      guardians.filter(
        (guardian) =>
          guardian.status !== "ACTIVE" &&
          guardian.status !== "PENDING_REMOVAL"
      ),
    [guardians]
  );
  const operationPending = Boolean(working);

  useEffect(() => {
    if (reviewAction) window.setTimeout(() => dialogRef.current?.focus(), 0);
    else lastTriggerRef.current?.focus();
  }, [reviewAction]);

  useEffect(() => {
    if (!reviewAction) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !operationPending) setReviewAction(null);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [operationPending, reviewAction]);

  async function signGuardianInvocation(
    functionName: string,
    guardian: string,
    description: string
  ) {
    return signAndSubmitSmartAccountInvocation({
      authMethod,
      network: selectedNetwork,
      walletAddress: wallet,
      contractId: wallet,
      callFunction: { name: functionName },
      argsXdr: [guardianAddressXdr(guardian)],
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
      display: {
        description,
        values: [{ guardian }, { network: selectedNetwork }],
      },
    });
  }

  async function addGuardian(guardian: string) {
    const response = await signGuardianInvocation(
      "add_guardian",
      guardian,
      "Add account guardian"
    );
    setTransactionStage("SUBMITTING");
    const txHash = transactionHash(response);
    if (!txHash) throw new Error("No transaction hash was returned");
    setSubmittedHash(txHash);
    setTransactionStage("CONFIRMING");
    await guardianApi.confirmAdd({
      network: selectedNetwork,
      walletAddress: wallet,
      guardianAddress: guardian,
      transactionHash: txHash,
      accessToken: token,
    });
    setGuardianAddress("");
  }

  async function scheduleRemoval(guardian: Guardian) {
    const response = await signGuardianInvocation(
      "schedule_guardian_removal",
      guardian.address,
      "Schedule guardian removal"
    );
    setTransactionStage("SUBMITTING");
    const txHash = transactionHash(response);
    if (!txHash) throw new Error("No transaction hash was returned");
    setSubmittedHash(txHash);
    setTransactionStage("CONFIRMING");
    await guardianApi.confirmScheduleRemoval({
      network: selectedNetwork,
      walletAddress: wallet,
      guardianAddress: guardian.address,
      transactionHash: txHash,
      accessToken: token,
    });
  }

  async function finalizeRemoval(guardian: Guardian) {
    const response = await signGuardianInvocation(
      "finalize_guardian_removal",
      guardian.address,
      "Finalize guardian removal"
    );
    setTransactionStage("SUBMITTING");
    const txHash = transactionHash(response);
    if (!txHash) throw new Error("No transaction hash was returned");
    setSubmittedHash(txHash);
    setTransactionStage("CONFIRMING");
    await guardianApi.confirmFinalizeRemoval({
      network: selectedNetwork,
      walletAddress: wallet,
      guardianAddress: guardian.address,
      transactionHash: txHash,
      accessToken: token,
    });
  }

  function openReview(action: ReviewAction, trigger: HTMLElement) {
    lastTriggerRef.current = trigger;
    setTransactionStage("IDLE");
    setTransactionError("");
    setSubmittedHash("");
    setReviewAction(action);
  }

  function reviewAdd(trigger: HTMLButtonElement) {
    const guardian = guardianAddress.trim();
    setInputError("");
    if (!guardian) return;
    if (guardian === wallet) {
      const message = "The account cannot be its own guardian";
      setInputError(message);
      toast.error(message);
      return;
    }
    try {
      guardianAddressXdr(guardian);
    } catch (error) {
      const message = readableError(error);
      setInputError(message);
      return;
    }
    openReview(
      { kind: "ADD", guardian: { address: guardian, status: "ACTIVE" } },
      trigger
    );
  }

  async function executeReviewedAction() {
    if (!reviewAction) return;
    const workingKey = `${reviewAction.kind}:${reviewAction.guardian.address}`;
    setWorking(workingKey);
    setTransactionError("");
    try {
      if (submittedHash) {
        setTransactionStage("CONFIRMING");
        if (reviewAction.kind === "ADD") {
          await guardianApi.confirmAdd({
            network: selectedNetwork,
            walletAddress: wallet,
            guardianAddress: reviewAction.guardian.address,
            transactionHash: submittedHash,
            accessToken: token,
          });
          setGuardianAddress("");
        } else if (reviewAction.kind === "SCHEDULE") {
          await guardianApi.confirmScheduleRemoval({
            network: selectedNetwork,
            walletAddress: wallet,
            guardianAddress: reviewAction.guardian.address,
            transactionHash: submittedHash,
            accessToken: token,
          });
        } else {
          await guardianApi.confirmFinalizeRemoval({
            network: selectedNetwork,
            walletAddress: wallet,
            guardianAddress: reviewAction.guardian.address,
            transactionHash: submittedHash,
            accessToken: token,
          });
        }
      } else {
        setSubmittedHash("");
        setTransactionStage("PREPARING");
        setTransactionStage("AWAITING_APPROVAL");
        if (reviewAction.kind === "ADD") {
          await addGuardian(reviewAction.guardian.address);
        } else if (reviewAction.kind === "SCHEDULE") {
          await scheduleRemoval(reviewAction.guardian);
        } else {
          await finalizeRemoval(reviewAction.guardian);
        }
      }
      setTransactionStage("COMPLETE");
      toast.success(actionCopy(reviewAction).success);
      await load(true);
    } catch (error) {
      const message = readableError(error);
      setTransactionError(message);
      setTransactionStage("FAILED");
      toast.error(message);
    } finally {
      setWorking("");
    }
  }

  const groups = [
    {
      title: "Active guardians",
      description: "Addresses currently recorded in the guardian set.",
      guardians: activeGuardians,
    },
    {
      title: "Pending removal",
      description:
        "Guardians waiting for the contract-defined removal delay or final transaction.",
      guardians: pendingGuardians,
    },
    ...(unknownGuardians.length
      ? [
          {
            title: "Other statuses",
            description:
              "Guardian records with a status this interface does not classify.",
            guardians: unknownGuardians,
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-screen bg-[var(--color-canvas)]">
      <div className="mx-auto w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Button
          variant="quiet"
          size="sm"
          leadingIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate("/settings")}
        >
          Back to settings
        </Button>

        <PageHeader
          eyebrow="Account security"
          title="Guardians"
          description="Manage the trusted addresses recorded in your account’s guardian set. Guardian removal requires a waiting period and a second transaction."
          actions={
            <Button
              variant="secondary"
              disabled={loading || refreshing}
              leadingIcon={
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
              }
              onClick={() => void load(true)}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          }
        />

        {fetchError ? (
          <InlineAlert
            tone="danger"
            title="Unable to load guardians"
            icon={<AlertCircle className="h-5 w-5" />}
          >
            <p>{fetchError}</p>
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

        <Section surface title="Security overview">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card padding="md" className="shadow-none">
              <ShieldCheck className="h-5 w-5 text-[var(--color-success)]" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                Active guardians
              </p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
                {activeGuardians.length}
              </p>
            </Card>
            <Card padding="md" className="shadow-none">
              <Clock3 className="h-5 w-5 text-[var(--color-warning)]" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                Pending removal
              </p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
                {pendingGuardians.length}
              </p>
            </Card>
            <Card padding="md" className="shadow-none">
              <UserRoundCheck className="h-5 w-5 text-[var(--color-text-muted)]" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                Network
              </p>
              <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)]">
                {selectedNetwork === "PUBLIC" ? "Mainnet" : "Testnet"}
              </p>
            </Card>
          </div>
          <InlineAlert
            className="mt-4"
            tone="information"
            title="Verified scope"
          >
            <p>
              This interface can verify guardian membership and delayed removal.
              It does not expose guardian pause, unpause, or recovery controls.
            </p>
          </InlineAlert>
        </Section>

        <Section
          surface
          title="Add a guardian"
          description="Add a trusted Stellar account or contract address after reviewing the exact address and network."
        >
          <label htmlFor="guardian-address" className="text-sm font-semibold text-[var(--color-text-primary)]">
            Guardian address
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="guardian-address"
              value={guardianAddress}
              onChange={(event) => {
                setGuardianAddress(event.target.value.trim());
                setInputError("");
              }}
              aria-describedby={inputError ? "guardian-address-error" : "guardian-address-help"}
              aria-invalid={Boolean(inputError)}
              placeholder="G... or C... guardian address"
              className="min-h-12 flex-1 rounded-[var(--radius-control)] border border-[var(--color-border-default)] bg-[var(--color-surface)] px-4 font-mono text-sm outline-none focus:border-[var(--color-action-primary)] focus:ring-2 focus:ring-[var(--color-action-primary)]"
            />
            <Button
              disabled={!guardianAddress || operationPending}
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={(event) => reviewAdd(event.currentTarget)}
            >
              Review guardian
            </Button>
          </div>
          {inputError ? (
            <p id="guardian-address-error" role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
              {inputError}
            </p>
          ) : (
            <p id="guardian-address-help" className="mt-2 text-xs text-[var(--color-text-muted)]">
              Confirm the full address with its owner before approving the transaction.
            </p>
          )}
        </Section>

        {loading && !guardians.length ? (
          <div className="grid gap-3" role="status" aria-label="Loading guardians">
            {[0, 1].map((key) => (
              <div
                key={key}
                className="h-32 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-subtle)] motion-reduce:animate-none"
              />
            ))}
            <span className="sr-only">Loading guardians…</span>
          </div>
        ) : guardians.length === 0 ? (
          <Card padding="lg" className="text-center">
            <UserRoundCheck className="mx-auto h-9 w-9 text-[var(--color-text-muted)]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--color-text-primary)]">
              No guardians recorded
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--color-text-secondary)]">
              Add a trusted address when you are ready. Guardian information is
              supplied by the account-security index for this network.
            </p>
          </Card>
        ) : (
          groups.map((group) => (
            <Section
              key={group.title}
              title={`${group.title} (${group.guardians.length})`}
              description={group.description}
            >
              {group.guardians.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {group.guardians.map((guardian) => {
                    const availableAt = removalTime(guardian.removalAvailableAt);
                    const pending = guardian.status === "PENDING_REMOVAL";
                    const canFinalize = Boolean(guardian.canFinalize);
                    return (
                      <Card key={guardian.address} padding="md" className="flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-[var(--color-text-muted)]">Guardian address</p>
                              <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                                {shortenAddress(guardian.address)}
                              </p>
                            </div>
                            <StatusBadge tone={pending ? "warning" : guardian.status === "ACTIVE" ? "success" : "neutral"}>
                              {pending ? "Removal pending" : guardian.status || "Unknown"}
                            </StatusBadge>
                          </div>
                          {pending ? (
                            <div className="mt-4 rounded-[var(--radius-card)] bg-[var(--color-warning-surface)] p-3">
                              <div className="flex gap-3">
                                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
                                <div>
                                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                    {canFinalize ? "Ready for final transaction" : "Waiting period in progress"}
                                  </p>
                                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    {canFinalize
                                      ? "The indexed service reports that removal can now be finalized."
                                      : availableAt
                                        ? `Expected to be finalizable ${availableAt}.`
                                        : "The indexed service has not supplied a completion time."}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-5">
                          {pending ? (
                            <Button
                              className="w-full"
                              variant="danger"
                              disabled={!canFinalize || operationPending}
                              leadingIcon={<Trash2 className="h-4 w-4" />}
                              onClick={(event) =>
                                openReview({ kind: "FINALIZE", guardian }, event.currentTarget)
                              }
                            >
                              {canFinalize ? "Review final removal" : "Waiting period active"}
                            </Button>
                          ) : guardian.status === "ACTIVE" ? (
                            <Button
                              className="w-full"
                              variant="secondary"
                              disabled={operationPending}
                              leadingIcon={<Clock3 className="h-4 w-4" />}
                              onClick={(event) =>
                                openReview({ kind: "SCHEDULE", guardian }, event.currentTarget)
                              }
                            >
                              Review removal schedule
                            </Button>
                          ) : null}
                        </div>
                        <details className="group mt-4 border-t border-[var(--color-border-default)] pt-3">
                          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] [&::-webkit-details-marker]:hidden">
                            Technical details
                            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                          </summary>
                          <dl className="mt-3 space-y-2 text-xs">
                            <div><dt className="text-[var(--color-text-muted)]">Full address</dt><dd className="mt-1 break-all font-mono">{guardian.address}</dd></div>
                            <div><dt className="text-[var(--color-text-muted)]">Indexed status</dt><dd className="mt-1 font-mono">{guardian.status || "—"}</dd></div>
                            {guardian.removalAvailableAt != null ? <div><dt className="text-[var(--color-text-muted)]">Removal available value</dt><dd className="mt-1 break-all font-mono">{String(guardian.removalAvailableAt)}</dd></div> : null}
                          </dl>
                        </details>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card padding="md" className="text-center shadow-none">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    No guardians are in this group.
                  </p>
                </Card>
              )}
            </Section>
          ))
        )}

        <Section
          surface
          title="Danger zone"
          description="Security-sensitive actions that change the guardian set."
          className="border-[var(--color-danger-border)]"
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-danger)]" />
            <div className="text-sm leading-6 text-[var(--color-text-secondary)]">
              <p className="font-semibold text-[var(--color-text-primary)]">
                Removal is deliberately a two-step process.
              </p>
              <p className="mt-1">
                Scheduling starts the waiting period. The guardian remains listed
                as pending until a separate finalization transaction succeeds.
                This interface has no cancel-removal operation.
              </p>
            </div>
          </div>
        </Section>
      </div>

      {reviewAction ? (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close guardian transaction review"
            disabled={operationPending}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm disabled:cursor-not-allowed"
            onClick={() => setReviewAction(null)}
          />
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="guardian-review-title"
            aria-describedby="guardian-review-description"
            onKeyDown={focusTrap}
            className="relative w-full max-w-lg rounded-[var(--radius-panel)] bg-[var(--color-surface)] p-6 shadow-2xl outline-none"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-subtle)]">
                {reviewAction.kind === "ADD" ? <UserRoundCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5 text-[var(--color-danger)]" />}
              </div>
              <button
                type="button"
                aria-label="Close guardian transaction review"
                disabled={operationPending}
                onClick={() => setReviewAction(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border-default)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)] disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h2 id="guardian-review-title" className="mt-4 text-xl font-semibold text-[var(--color-text-primary)]">
              {actionCopy(reviewAction).title}
            </h2>
            <p id="guardian-review-description" className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              {actionCopy(reviewAction).description}
            </p>

            <dl className="mt-5 rounded-[var(--radius-card)] bg-[var(--color-surface-subtle)] p-4 text-sm">
              <div><dt className="text-xs text-[var(--color-text-muted)]">Guardian address</dt><dd className="mt-1 break-all font-mono text-xs text-[var(--color-text-primary)]">{reviewAction.guardian.address}</dd></div>
              <div className="mt-3"><dt className="text-xs text-[var(--color-text-muted)]">Network</dt><dd className="mt-1 font-semibold text-[var(--color-text-primary)]">{selectedNetwork === "PUBLIC" ? "Mainnet" : "Testnet"}</dd></div>
            </dl>

            {transactionStage !== "IDLE" ? (
              <div
                role={transactionStage === "FAILED" ? "alert" : "status"}
                aria-live="polite"
                className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-border-default)] p-4"
              >
                <div className="flex items-center gap-2">
                  {operationPending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {{
                      IDLE: "",
                      PREPARING: "Preparing transaction…",
                      AWAITING_APPROVAL: "Awaiting wallet approval and submission…",
                      SUBMITTING: "Submitting transaction…",
                      CONFIRMING: "Confirming indexed guardian status…",
                      COMPLETE: actionCopy(reviewAction).success,
                      FAILED: "Transaction needs attention",
                    }[transactionStage]}
                  </p>
                </div>
                {transactionError ? <p className="mt-2 text-sm text-[var(--color-danger)]">{transactionError}</p> : null}
                {submittedHash ? <p className="mt-2 break-all font-mono text-xs text-[var(--color-text-muted)]">Transaction: {submittedHash}</p> : null}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                disabled={operationPending}
                onClick={() => setReviewAction(null)}
              >
                {transactionStage === "COMPLETE" ? "Close" : "Go back"}
              </Button>
              {transactionStage !== "COMPLETE" ? (
                <Button
                  variant={reviewAction.kind === "ADD" ? "primary" : "danger"}
                  disabled={operationPending}
                  onClick={() => void executeReviewedAction()}
                >
                  {operationPending ? "Processing…" : transactionStage === "FAILED" && submittedHash ? "Retry status confirmation" : actionCopy(reviewAction).button}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
