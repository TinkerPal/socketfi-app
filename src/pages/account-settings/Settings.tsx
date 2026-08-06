import { useEffect, useMemo, type ComponentType } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  KeyRound,
  Network,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCheck,
  Wallet,
} from "lucide-react";

import { Card, PageHeader, Section, StatusBadge } from "../../components/ui";
import { useStates } from "../../context/StatesContext";
import { shortenAddress } from "../../utils/formatters";
import { getAuthSession } from "../../utils/localStorage";

type SettingsDestinationProps = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  to: string;
  actionLabel: string;
};

function SettingsDestination({
  actionLabel,
  description,
  icon: Icon,
  title,
  to,
}: SettingsDestinationProps) {
  return (
    <Link
      to={to}
      className="group rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-surface)] p-5 shadow-sm outline-none transition hover:border-[var(--color-border-strong)] hover:shadow-md focus-visible:ring-2 focus-visible:ring-[var(--color-action-primary)]"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-information-surface)] text-[var(--color-information)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[var(--color-text-primary)]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        {description}
      </p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-action-primary)]">
        {actionLabel}
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { activeSession, selectedNetwork } = useStates();

  const localSession = useMemo(() => getAuthSession(), []);
  const accessToken =
    activeSession?.accessToken || localSession?.accessToken || "";
  const profile = activeSession?.userProfile || localSession?.userProfile;
  const wallet = profile?.address?.[selectedNetwork] || "";
  const username = profile?.username || "SocketFi account";

  useEffect(() => {
    if (!accessToken) navigate("/", { replace: true });
  }, [accessToken, navigate]);

  if (!accessToken) return null;

  return (
    <main className="min-h-screen bg-[var(--color-canvas)]">
      <div className="mx-auto w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Account preferences"
          title="Settings"
          description="Review your account and network, manage visible assets, and control automation permissions and account guardians."
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <Section
            surface
            title="Account"
            description="The SocketFi account currently connected to this application."
          >
            <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface-subtle)] p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {username}
                </p>
                <p
                  className="mt-1 truncate font-mono text-xs text-[var(--color-text-secondary)]"
                  title={wallet}
                >
                  {shortenAddress(wallet, { start: 12, end: 10 })}
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                  Account connection and disconnect controls remain available in
                  the main navigation.
                </p>
              </div>
            </div>
          </Section>

          <Section
            surface
            title="Network and assets"
            description="See the active network and manage which assets appear in your wallet."
          >
            <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface-subtle)] p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm">
                <Network className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {selectedNetwork === "PUBLIC"
                      ? "Stellar Mainnet"
                      : "Stellar Testnet"}
                  </p>
                  <StatusBadge tone="information">Current network</StatusBadge>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                  Watched assets, balance refresh, and wallet display preferences
                  remain in Quick Settings.
                </p>
              </div>
              <SlidersHorizontal
                className="mt-1 h-4 w-4 shrink-0 text-[var(--color-text-muted)]"
                aria-hidden="true"
              />
            </div>
          </Section>
        </div>

        <Section
          title="Security and permissions"
          description="Review limited automation access and the trusted accounts that help protect your SocketFi account."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <SettingsDestination
              icon={KeyRound}
              title="Automation permissions"
              description="Review active, expired, revoked, and invalidated permissions. Inspect allowed actions and limits, or revoke access."
              to="/settings/sessions"
              actionLabel="Manage permissions"
            />
            <SettingsDestination
              icon={UserRoundCheck}
              title="Recovery and guardians"
              description="Review account guardians, add a trusted address, and manage delayed guardian removal."
              to="/settings/guardians"
              actionLabel="Manage guardians"
            />
          </div>
        </Section>

        <Card padding="md" className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Security changes require authorization
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              Revoking permissions and changing guardians require approval from
              the connected account before they are submitted on-chain.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
