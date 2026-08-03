import { Bot, KeyRound, ShieldCheck, Sparkles } from "lucide-react";

const features = [
  {
    title: "Native smart-account access",
    description: "Authorize dApp actions without exposing private keys.",
    icon: KeyRound,
  },
  {
    title: "Session-ready",
    description: "Use scoped sessions for supported recurring actions.",
    icon: Bot,
  },
  {
    title: "Verified transaction flow",
    description: "Review and approve every action through SocketFi.",
    icon: ShieldCheck,
  },
];

export default function InternalDappBanner() {
  return (
    <section className="relative h-full overflow-hidden rounded-[24px] border border-indigo-100 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-5 text-white shadow-lg">
      <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-indigo-500/30 blur-3xl" />
      <div className="absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="relative flex h-full flex-col">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold text-indigo-100 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" />
          Built for SocketFi
        </div>

        <h2 className="mt-4 text-xl font-semibold tracking-tight">
          One wallet experience across supported dApps
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          Interact through your smart account with consistent authorization,
          session controls, and transaction tracking.
        </p>

        <div className="mt-5 space-y-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-indigo-100">
                  <Icon className="h-4.5 w-4.5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    {feature.title}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-300">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
