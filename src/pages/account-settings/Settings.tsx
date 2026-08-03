// @ts-nocheck
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Network,
  Shield,
  ShieldCheck,
  UserRoundCheck,
  Wallet,
} from "lucide-react";

import { useStates } from "../../context/StatesContext";
import { getAuthSession } from "../../utils/localStorage";

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function short(value?: string, start = 12, end = 10) {
  if (!value) return "—";
  if (value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  to,
  tone = "indigo",
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  to: string;
  tone?: "indigo" | "emerald" | "amber";
  badge?: string;
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <Link
      to={to}
      className="group rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={classNames(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1",
            tones[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        {badge ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {badge}
          </span>
        ) : null}
      </div>

      <h2 className="mt-5 text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>

      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
        Open settings
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { activeSession, selectedNetwork } = useStates();

  const localSession = useMemo(() => getAuthSession(), []);
  const accessToken =
    activeSession?.accessToken || localSession?.accessToken || "";
  const wallet =
    activeSession?.userProfile?.address?.[selectedNetwork] ||
    localSession?.userProfile?.address?.[selectedNetwork] ||
    "";

  useEffect(() => {
    if (!accessToken) navigate("/", { replace: true });
  }, [accessToken, navigate]);

  if (!accessToken) return null;

  return (
    <main className="mx-auto min-h-screen w-full  space-y-5 px-0 py-4 sm:px-6 md:px-8">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef2ff_55%,#f8fafc_100%)] p-5 shadow-sm sm:p-7">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="absolute -bottom-20 left-12 h-44 w-44 rounded-full bg-sky-200/20 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              Account security
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Manage delegated sessions and recovery guardians for your SocketFi
              smart account. Every sensitive change requires wallet
              authorization.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[390px]">
            <div className="rounded-[20px] border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                <Wallet className="h-4 w-4" />
                Wallet
              </div>
              <p className="mt-2 break-all font-mono text-sm font-semibold text-slate-950">
                {short(wallet)}
              </p>
            </div>

            <div className="rounded-[20px] border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                <Network className="h-4 w-4" />
                Network
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {selectedNetwork === "PUBLIC"
                  ? "Stellar Mainnet"
                  : "Stellar Testnet"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <SettingsCard
          icon={KeyRound}
          title="Manage sessions"
          description="Review active delegated policies, inspect permissions and usage, revoke an individual session, or invalidate all existing sessions."
          to="/settings/sessions"
          tone="indigo"
        />

        <SettingsCard
          icon={UserRoundCheck}
          title="Manage guardians"
          description="Add recovery guardians, begin delayed removal, and finalize removal when the contract-defined delay has elapsed."
          to="/settings/guardians"
          tone="emerald"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: LockKeyhole,
            title: "Owner-authorized",
            text: "Session revocation and guardian administration require account-owner authorization.",
          },
          {
            icon: Shield,
            title: "Scoped access",
            text: "Delegated sessions are limited by expiry, usage count, allowed calls, and spend policy.",
          },
          {
            icon: CheckCircle2,
            title: "On-chain state",
            text: "Security changes are submitted to the SocketFi account contract and recorded by the indexer.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <Icon className="h-5 w-5 text-slate-400" />
            <h3 className="mt-4 text-sm font-semibold text-slate-950">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
