// @ts-nocheck
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Blocks,
  CheckCircle2,
  ChevronRight,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";

import DappMessageModal from "../../components/DappMessageModal";
import { useStates } from "../../context/StatesContext";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

function normalizeStatus(status) {
  return normalize(status || "available");
}

function getStatusMeta(status) {
  const value = normalizeStatus(status);

  if (value === "live" || value === "active" || value === "available") {
    return {
      label: "Live",
      className: "border-emerald-200/80 bg-emerald-50/95 text-emerald-700",
      dot: "bg-emerald-500",
    };
  }

  if (
    value === "coming-soon" ||
    value === "soon" ||
    value === "in-development"
  ) {
    return {
      label: "Coming soon",
      className: "border-amber-200/80 bg-amber-50/95 text-amber-700",
      dot: "bg-amber-500",
    };
  }

  return {
    label: String(status || "Available"),
    className: "border-slate-200/80 bg-white/90 text-slate-600",
    dot: "bg-slate-400",
  };
}

const APP_DEFINITIONS = [
  {
    key: "aquarius",
    aliases: [
      "aquarius",
      "aquarius-amm",
      "aqua-amm",
      "aqua",
      "aquarius protocol",
    ],
    accent: "from-cyan-500/20 via-blue-500/10 to-transparent",
    glow: "bg-cyan-400/20",
    label: "Liquidity & swaps",
  },
  {
    key: "blend",
    aliases: [
      "blend",
      "blend-capital",
      "blend-protocol",
      "blend capital",
      "blend protocol",
      "blend lending",
    ],
    accent: "from-violet-500/20 via-fuchsia-500/10 to-transparent",
    glow: "bg-violet-400/20",
    label: "Lending markets",
  },
  {
    key: "soroswap",
    aliases: [
      "soroswap",
      "soroswap-finance",
      "soroswap finance",
      "soroswap protocol",
    ],
    accent: "from-amber-500/20 via-orange-500/10 to-transparent",
    glow: "bg-amber-400/20",
    label: "DEX aggregation",
  },
];

function getDappDefinition(dapp) {
  const candidates = [
    dapp?.id,
    dapp?.slug,
    dapp?.key,
    dapp?.name,
    dapp?.title,
    dapp?.subtitle,
    dapp?.category,
    dapp?.protocol,
  ]
    .filter(Boolean)
    .map(normalize);

  return APP_DEFINITIONS.find((definition) =>
    definition.aliases.some((alias) => {
      const normalizedAlias = normalize(alias);

      return candidates.some(
        (candidate) =>
          candidate === normalizedAlias ||
          candidate.includes(normalizedAlias) ||
          normalizedAlias.includes(candidate)
      );
    })
  );
}

function isAllowedDapp(dapp) {
  return Boolean(getDappDefinition(dapp));
}

function getDappImage(dapp) {
  return (
    dapp?.imgUrl ||
    dapp?.image ||
    dapp?.imageUrl ||
    dapp?.logo ||
    dapp?.icon ||
    ""
  );
}

function getDappKey(dapp, index) {
  return String(
    dapp?.id ||
      dapp?.slug ||
      dapp?.key ||
      dapp?.name ||
      `supported-dapp-${index}`
  );
}

export default function DappsDashboard() {
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  const { supportedDapps, selectedDapp, setSelectedDapp, setActiveButton } =
    useStates();

  const visibleDapps = useMemo(() => {
    const allowed = (supportedDapps || []).filter(isAllowedDapp);

    return [...allowed].sort((first, second) => {
      const firstDefinition = getDappDefinition(first);
      const secondDefinition = getDappDefinition(second);

      const firstIndex = APP_DEFINITIONS.findIndex(
        (item) => item.key === firstDefinition?.key
      );
      const secondIndex = APP_DEFINITIONS.findIndex(
        (item) => item.key === secondDefinition?.key
      );

      return firstIndex - secondIndex;
    });
  }, [supportedDapps]);

  const filteredDapps = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return visibleDapps;
    }

    return visibleDapps.filter((dapp) => {
      const definition = getDappDefinition(dapp);

      const searchable = [
        dapp?.id,
        dapp?.slug,
        dapp?.name,
        dapp?.title,
        dapp?.subtitle,
        dapp?.description,
        dapp?.category,
        dapp?.status,
        definition?.key,
        definition?.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [search, visibleDapps]);

  const liveCount = useMemo(
    () =>
      visibleDapps.filter((dapp) =>
        ["live", "active", "available"].includes(normalizeStatus(dapp?.status))
      ).length,
    [visibleDapps]
  );

  function handleSelectDapp(dapp) {
    if (!dapp) {
      return;
    }

    setSelectedDapp(dapp);
    setActiveButton(dapp?.defaultAction || "swap");

    if (dapp?.trigger) {
      setUpdateInProgress(true);
      return;
    }

    const routeId = dapp?.id || dapp?.slug || getDappDefinition(dapp)?.key;

    if (!routeId) {
      return;
    }

    navigate(`/dapps/${routeId}`);
  }

  return (
    <div className="relative min-h-full">
      {updateInProgress ? (
        <DappMessageModal
          setUpdateInProgress={setUpdateInProgress}
          selectedDapp={selectedDapp}
        />
      ) : null}

      <div className="mx-auto w-full space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
            <div className="flex min-w-0 flex-col justify-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                <Blocks className="h-3.5 w-3.5" />
                SocketFi dApp Hub
              </div>

              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Use Stellar dApps without leaving your smart account
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">
                Discover supported Soroban applications, review what each
                integration does, and authorize transactions through the same
                SocketFi wallet experience.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Smart-account authorization
                </div>

                <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                  {liveCount} live integration{liveCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            {/* <InternalDappBanner /> */}
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200/80 bg-white p-4 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Applications
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-slate-950">
                Explore the ecosystem
              </h2>

              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                Select a protocol to open its SocketFi-native workspace.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search integrations"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-50"
              />

              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {filteredDapps.length === 0 ? (
            <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Search className="h-5 w-5 text-slate-400" />
              </div>

              <h3 className="mt-4 text-base font-semibold text-slate-950">
                No matching integrations
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Search for Aquarius, Blend, or Soroswap.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredDapps.map((dapp, index) => {
                const status = getStatusMeta(dapp?.status);
                const definition = getDappDefinition(dapp);
                const isTriggerOnly = Boolean(dapp?.trigger);
                const image = getDappImage(dapp);

                return (
                  <button
                    key={getDappKey(dapp, index)}
                    type="button"
                    onClick={() => handleSelectDapp(dapp)}
                    className="group relative flex min-h-[390px] flex-col overflow-hidden rounded-[26px] border border-slate-200/90 bg-white text-left shadow-[0_12px_40px_-28px_rgba(15,23,42,0.45)] outline-none transition duration-300 hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-[0_26px_60px_-30px_rgba(15,23,42,0.5)] focus-visible:ring-4 focus-visible:ring-indigo-100"
                  >
                    <div className="relative h-48 overflow-hidden bg-slate-950">
                      <div
                        className={classNames(
                          "absolute inset-0 bg-gradient-to-br",
                          definition?.accent ||
                            "from-indigo-500/20 via-slate-900 to-slate-950"
                        )}
                      />

                      <div
                        className={classNames(
                          "absolute -right-10 -top-12 h-40 w-40 rounded-full blur-3xl",
                          definition?.glow || "bg-indigo-400/20"
                        )}
                      />

                      {image ? (
                        <img
                          src={image}
                          alt={dapp?.name || "dApp"}
                          loading="lazy"
                          className="relative z-10 h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-[1.045] group-hover:opacity-100"
                        />
                      ) : (
                        <div className="relative z-10 flex h-full items-center justify-center">
                          <div className="flex h-20 w-20 items-center justify-center rounded-[24px] border border-white/15 bg-white/10 text-3xl font-semibold text-white shadow-2xl backdrop-blur">
                            {String(dapp?.name || definition?.key || "D")
                              .slice(0, 1)
                              .toUpperCase()}
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-0 z-20 bg-gradient-to-t from-slate-950/80 via-slate-950/5 to-transparent" />

                      <div className="absolute left-4 top-4 z-30">
                        <span
                          className={classNames(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-md",
                            status.className
                          )}
                        >
                          <span
                            className={classNames(
                              "h-1.5 w-1.5 rounded-full",
                              status.dot
                            )}
                          />
                          {status.label}
                        </span>
                      </div>

                      <div className="absolute bottom-4 left-4 right-4 z-30 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
                            {definition?.label ||
                              dapp?.category ||
                              "Soroban application"}
                          </p>

                          <h3 className="mt-1 truncate text-2xl font-semibold tracking-[-0.03em] text-white">
                            {dapp?.name || definition?.key}
                          </h3>
                        </div>

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white backdrop-blur-md transition duration-300 group-hover:translate-x-0.5 group-hover:bg-white group-hover:text-slate-950">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      {dapp?.subtitle ? (
                        <p className="text-xs font-semibold text-indigo-600">
                          {dapp.subtitle}
                        </p>
                      ) : null}

                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                        {dapp?.description ||
                          `Access ${
                            dapp?.name || definition?.key
                          } through your SocketFi smart account.`}
                      </p>

                      <div className="mt-auto pt-5">
                        <div className="h-px bg-slate-100" />

                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900">
                            {isTriggerOnly
                              ? "View integration"
                              : `Open ${dapp?.name || definition?.key}`}
                          </span>

                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition group-hover:text-indigo-600">
                            Launch
                            <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
