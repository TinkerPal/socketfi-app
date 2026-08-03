// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  ExternalLink,
  Filter,
  Globe,
  Info,
  Link2,
  MessageSquareText,
  PanelLeftClose,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  Shield,
  Sparkles,
  Wallet,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import SocketMetricCard from "./SocketMetricCard";

export default function TopStats({ data = [] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {data.map((stat) => {
        const Icon = stat.icon;

        return (
          <SocketMetricCard
            key={stat?.id}
            label={stat?.label}
            value={stat?.value} // also fix this
            icon={<Icon className="h-5 w-5" />}
          />
        );
      })}
      <SocketMetricCard
        label="Incoming intents"
        value={summary.incomingCount}
        icon={<ArrowDownLeft className="h-5 w-5" />}
      />
      <SocketMetricCard
        label="Outgoing intents"
        value={summary.outgoingCount}
        icon={<ArrowUpRight className="h-5 w-5" />}
      />
      <SocketMetricCard
        label="Settled volume"
        value={summary.settledVolume}
        icon={<Wallet className="h-5 w-5" />}
      />
    </section>
  );
}
