import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ChevronDown,
  Coins,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

export type StrategyType =
  | "DISBURSEMENT"
  | "DCA"
  | "REBALANCE"
  | "AMPLIDEX_LONG"
  | "AMPLIDEX_SHORT";

export type StrategyOption = {
  id: StrategyType;
  label: string;
  description: string;
  example: string;
  usefulFor: string;
  howItWorks: string;
};

export const STRATEGY_TYPES: StrategyOption[] = [
  {
    id: "DCA",
    label: "Dollar-cost averaging",
    description: "Invest a set amount into an asset on a recurring schedule.",
    example: "Example: Buy 25 USDC of XLM every week.",
    usefulFor: "Useful for people who want to build a position gradually instead of timing the market.",
    howItWorks: "You choose what to spend, what to buy, the amount per run, and a schedule. Each run uses only the wallet authorization you approve.",
  },
  {
    id: "REBALANCE",
    label: "Portfolio rebalancing",
    description: "Adjust a portfolio toward the asset percentages you choose.",
    example: "Example: Maintain a portfolio target of 60% XLM and 40% USDC.",
    usefulFor: "Useful for people who want their portfolio to stay near a planned allocation over time.",
    howItWorks: "You choose at least two assets, their target percentages, a maximum trade amount, and a schedule. The targets must add up to 100%.",
  },
  {
    id: "DISBURSEMENT",
    label: "Scheduled distribution",
    description: "Send scheduled payments to one or more recipients.",
    example: "Example: Send a monthly USDC payment to contractors or contributors.",
    usefulFor: "Useful for teams or individuals making recurring payouts to known recipients.",
    howItWorks: "You choose a payment token, add recipient addresses and amounts, then set when the distribution should run.",
  },
];

export const STRATEGY_ICONS: Record<StrategyType, LucideIcon> = {
  DCA: CalendarClock,
  REBALANCE: RefreshCw,
  DISBURSEMENT: Coins,
  AMPLIDEX_LONG: ArrowRight,
  AMPLIDEX_SHORT: ArrowLeft,
};

export type StrategyChooserProps = {
  onSelect: (type: StrategyType) => void;
};

export function StrategyChooser({ onSelect }: StrategyChooserProps) {
  return (
    <section aria-labelledby="strategy-chooser-title" className="rounded-3xl border border-[#EAECF0] bg-white p-5 shadow-sm sm:p-6">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2F0FD1]">Step 1</p>
        <h2 id="strategy-chooser-title" className="mt-2 text-xl font-semibold tracking-tight text-[#101828] sm:text-2xl">What would you like to automate?</h2>
        <p className="mt-2 text-sm leading-6 text-[#667085]">Choose a strategy to see its configuration. You can come back and choose another without losing information you already entered.</p>
      </div>
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
        {STRATEGY_TYPES.map((strategy) => {
          const Icon = STRATEGY_ICONS[strategy.id];
          return (
            <article key={strategy.id} className="flex h-full flex-col rounded-2xl border border-[#EAECF0] bg-white p-5 transition hover:border-[#BDB4FE] hover:shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#2F0FD1]"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-4 text-base font-semibold text-[#101828]">{strategy.label}</h3>
              <p className="mt-2 text-sm leading-6 text-[#667085]">{strategy.description}</p>
              <div className="mt-4 space-y-3 rounded-xl bg-[#F8FAFC] p-3.5 text-sm leading-5">
                <p className="font-medium text-[#344054]">{strategy.example}</p>
                <p className="text-[#667085]">{strategy.usefulFor}</p>
              </div>
              <details className="group mt-4 border-t border-[#EAECF0] pt-3">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg py-1 text-sm font-semibold text-[#475467] outline-none focus-visible:ring-2 focus-visible:ring-[#2F0FD1] [&::-webkit-details-marker]:hidden">How it works<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
                <p className="mt-2 text-sm leading-6 text-[#667085]">{strategy.howItWorks}</p>
              </details>
              <button type="button" onClick={() => onSelect(strategy.id)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2F0FD1] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2409B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F0FD1] focus-visible:ring-offset-2">Choose {strategy.label}<ArrowRight className="h-4 w-4" /></button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
