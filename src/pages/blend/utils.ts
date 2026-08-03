import { Address, xdr } from "@stellar/stellar-sdk";
import type { AppNetwork, BlendAction, Pool } from "./types";

export const networkOf = (value: unknown): AppNetwork =>
  String(value || "PUBLIC").toUpperCase() === "TESTNET" ? "TESTNET" : "PUBLIC";

export const usd = (value?: number | null) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        notation: Math.abs(value as number) >= 100000 ? "compact" : "standard",
        maximumFractionDigits: 2,
      }).format(value as number)
    : "—";

export const percent = (value?: number | null) =>
  Number.isFinite(value)
    ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value as number)}%`
    : "—";

export const compactNumber = (value?: number | null) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, {
        notation: Math.abs(value as number) >= 100000 ? "compact" : "standard",
        maximumFractionDigits: 4,
      }).format(value as number)
    : "—";

export function atomic(value: string, decimals = 7) {
  try {
    const amount = BigInt(value || "0");
    const scalar = 10n ** BigInt(decimals);
    const whole = amount / scalar;
    const fraction = (amount % scalar)
      .toString()
      .padStart(decimals, "0")
      .replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
  } catch {
    return value || "0";
  }
}

export function toAtomic(value: string, decimals: number) {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) throw new Error("Enter a valid amount.");
  const [whole, fraction = ""] = value.trim().split(".");
  if (fraction.length > decimals) throw new Error(`Maximum ${decimals} decimal places.`);
  const result =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (result <= 0n) throw new Error("Amount must be greater than zero.");
  return result;
}

export function extractCall(operationXdr: string) {
  const operation = xdr.Operation.fromXDR(operationXdr, "base64");
  const body = operation.body();
  if (body.switch() !== xdr.OperationType.invokeHostFunction()) {
    throw new Error("Unsupported Blend operation.");
  }
  const host = body.invokeHostFunctionOp().hostFunction();
  if (host.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) {
    throw new Error("Unsupported Blend host function.");
  }
  const invoke = host.invokeContract();
  return {
    contractId: Address.fromScAddress(invoke.contractAddress()).toString(),
    functionName: invoke.functionName().toString(),
    argsXdr: invoke.args()?.map((arg) => arg.toXDR("base64")),
  };
}

export function actionAllowed(pool: Pool | null, action: BlendAction) {
  if (!pool) return false;
  if (action === "supply") return Boolean(pool.canSupply);
  if (action === "withdraw") return Boolean(pool.canWithdraw);
  if (action === "borrow") return Boolean(pool.canBorrow);
  return Boolean(pool.canRepay);
}

export function statusText(status: Pool["statusLabel"]) {
  if (status === "ACTIVE") return "Active";
  if (status === "ON_ICE") return "On ice";
  if (status === "FROZEN") return "Frozen";
  return "Unknown";
}

export function statusBadgeClasses(status: Pool["statusLabel"]) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "ON_ICE") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "FROZEN") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}
