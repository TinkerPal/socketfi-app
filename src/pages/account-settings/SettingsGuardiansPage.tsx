// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
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

function transactionHash(response: any): string | undefined {
  return (
    response?.txHash ||
    response?.hash ||
    response?.transactionHash ||
    response?.data?.txHash ||
    response?.data?.hash
  );
}

function short(value?: string, start = 12, end = 10): string {
  if (!value) return "—";
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
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

  const [guardians, setGuardians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [guardianAddress, setGuardianAddress] = useState("");

  const load = useCallback(async () => {
    if (!token || !wallet) {
      setGuardians([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await guardianApi.list({
        network: selectedNetwork,
        walletAddress: wallet,
        accessToken: token,
      });
      setGuardians(Array.isArray(result) ? result : result?.items || []);
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setLoading(false);
    }
  }, [selectedNetwork, toast, token, wallet]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () =>
      guardians.filter((guardian) => guardian.status === "PENDING_REMOVAL")
        .length,
    [guardians]
  );

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
      evmConnectorId: activeSession?.evmConnectorId,
      evmConnectorType: activeSession?.evmConnectorType,
      evmConnectorName: activeSession?.evmConnectorName,
      socketfi,
      display: {
        description,
        values: [{ guardian }, { network: selectedNetwork }],
      },
    });
  }

  async function addGuardian() {
    const guardian = guardianAddress.trim();
    if (!guardian) return;
    if (guardian === wallet) {
      toast.error("The account cannot be its own guardian");
      return;
    }

    setWorking("ADD");
    try {
      const response = await signGuardianInvocation(
        "add_guardian",
        guardian,
        "Add account recovery guardian"
      );
      const txHash = transactionHash(response);
      if (!txHash) throw new Error("No transaction hash was returned");

      await guardianApi.confirmAdd({
        network: selectedNetwork,
        walletAddress: wallet,
        guardianAddress: guardian,
        transactionHash: txHash,
        accessToken: token,
      });

      toast.success("Guardian added");
      setGuardianAddress("");
      await load();
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setWorking("");
    }
  }

  async function scheduleRemoval(guardian: any) {
    setWorking(`SCHEDULE:${guardian.address}`);
    try {
      const response = await signGuardianInvocation(
        "schedule_guardian_removal",
        guardian.address,
        "Schedule guardian removal"
      );
      const txHash = transactionHash(response);
      if (!txHash) throw new Error("No transaction hash was returned");

      await guardianApi.confirmScheduleRemoval({
        network: selectedNetwork,
        walletAddress: wallet,
        guardianAddress: guardian.address,
        transactionHash: txHash,
        accessToken: token,
      });

      toast.success("Guardian removal scheduled");
      await load();
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setWorking("");
    }
  }

  async function finalizeRemoval(guardian: any) {
    setWorking(`FINALIZE:${guardian.address}`);
    try {
      const response = await signGuardianInvocation(
        "finalize_guardian_removal",
        guardian.address,
        "Finalize guardian removal"
      );
      const txHash = transactionHash(response);
      if (!txHash) throw new Error("No transaction hash was returned");

      await guardianApi.confirmFinalizeRemoval({
        network: selectedNetwork,
        walletAddress: wallet,
        guardianAddress: guardian.address,
        transactionHash: txHash,
        accessToken: token,
      });

      toast.success("Guardian removed");
      await load();
    } catch (error) {
      toast.error(readableError(error));
    } finally {
      setWorking("");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full space-y-5 px-0 py-4 sm:px-6 md:px-8">
      <button
        type="button"
        onClick={() => navigate("/settings")}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to settings
      </button>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
              <UserRoundCheck className="h-4 w-4" />
              Recovery security
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              Manage guardians
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Guardians participate in account pause and recovery. Removing a
              guardian is intentionally delayed and must be completed with a
              second transaction.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          [
            "Active guardians",
            guardians.filter((g) => g.status === "ACTIVE").length,
          ],
          ["Pending removal", pendingCount],
          ["Network", selectedNetwork === "PUBLIC" ? "Mainnet" : "Testnet"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <ShieldCheck className="h-5 w-5 text-slate-400" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Add guardian
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Add a trusted Stellar account or contract address. Confirm
              ownership and recovery expectations with the guardian before
              adding them.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={guardianAddress}
            onChange={(event) => setGuardianAddress(event.target.value.trim())}
            placeholder="G... or C... guardian address"
            className="h-12 flex-1 rounded-2xl border border-slate-200 px-4 font-mono text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
          <button
            type="button"
            disabled={!guardianAddress || working === "ADD"}
            onClick={() => void addGuardian()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {working === "ADD" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add guardian
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-base font-semibold text-slate-950">
            Current guardians
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Guardian state is loaded from your indexed account-security API.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : guardians.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <UserRoundCheck className="h-9 w-9 text-slate-300" />
            <p className="mt-4 font-semibold text-slate-950">
              No guardians indexed
            </p>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              Add a guardian above. The contract interface you supplied does not
              expose a guardian-list getter, so the list must come from your
              backend/indexer.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {guardians.map((guardian) => {
              const scheduling = working === `SCHEDULE:${guardian.address}`;
              const finalizing = working === `FINALIZE:${guardian.address}`;
              const canFinalize = Boolean(guardian.canFinalize);

              return (
                <div
                  key={guardian.address}
                  className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-all font-mono text-sm font-semibold text-slate-950">
                        {short(guardian.address, 16, 12)}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          guardian.status === "PENDING_REMOVAL"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {guardian.status === "PENDING_REMOVAL"
                          ? "Removal pending"
                          : "Active"}
                      </span>
                    </div>

                    {guardian.status === "PENDING_REMOVAL" ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <Clock3 className="h-4 w-4" />
                        {canFinalize
                          ? "Removal delay complete"
                          : guardian.removalAvailableAt
                          ? `Finalizable ${new Date(
                              guardian.removalAvailableAt
                            ).toLocaleString()}`
                          : "Waiting for removal delay"}
                      </div>
                    ) : null}
                  </div>

                  {guardian.status === "PENDING_REMOVAL" ? (
                    <button
                      type="button"
                      disabled={!canFinalize || finalizing}
                      onClick={() => void finalizeRemoval(guardian)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {finalizing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Finalize removal
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={scheduling}
                      onClick={() => void scheduleRemoval(guardian)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-40"
                    >
                      {scheduling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Clock3 className="h-4 w-4" />
                      )}
                      Start removal
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex items-start gap-3 rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-6">
          Removing guardians reduces the number of trusted parties that can
          pause the account or approve an unpause. Guardians do not participate
          in account recovery.
        </p>
      </section>
    </main>
  );
}
