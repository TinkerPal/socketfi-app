import { Globe2, ShieldCheck } from "lucide-react";

import { useStates } from "../context/StatesContext";

type Network = "TESTNET" | "PUBLIC";

interface NetworkIndicatorProps {
  compact?: boolean;
  className?: string;
}

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export default function NetworkIndicator({
  compact = false,
  className,
}: NetworkIndicatorProps) {
  const { selectedNetwork } = useStates();

  const network = selectedNetwork as Network;
  const isMainnet = network === "PUBLIC";

  return (
    <div
      className={classNames(
        "inline-flex shrink-0 items-center rounded-2xl border shadow-sm",
        isMainnet
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800",
        compact ? "h-10 gap-2 px-3" : "h-11 gap-2.5 px-3.5",
        className
      )}
      role="status"
      aria-label={
        isMainnet
          ? "Connected to Stellar Mainnet"
          : "Connected to Stellar Testnet"
      }
      title={
        isMainnet
          ? "This domain uses Stellar Mainnet"
          : "This domain uses Stellar Testnet"
      }
    >
      <span className="relative flex h-2.5 w-2.5">
        <span
          className={classNames(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-40",
            isMainnet ? "bg-emerald-500" : "bg-amber-500"
          )}
        />
        <span
          className={classNames(
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            isMainnet ? "bg-emerald-500" : "bg-amber-500"
          )}
        />
      </span>

      {!compact ? (
        <div className="leading-none">
          {/* <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-70">
            Network
          </p> */}
          <p className="mt-1 text-xs font-semibold">
            {isMainnet ? "Mainnet" : "Testnet"}
          </p>
        </div>
      ) : (
        <span className="text-xs font-semibold">
          {isMainnet ? "Mainnet" : "Testnet"}
        </span>
      )}

      {isMainnet ? (
        <ShieldCheck className="h-4 w-4 opacity-70" />
      ) : (
        <Globe2 className="h-4 w-4 opacity-70" />
      )}
    </div>
  );
}
