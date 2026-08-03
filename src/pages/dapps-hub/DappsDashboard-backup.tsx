// @ts-nocheck
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Blocks,
  CheckCircle2,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import DappMessageModal from "../../components/DappMessageModal";
import { useStates } from "../../context/StatesContext";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizeStatus(status) {
  return String(status || "available").toLowerCase();
}

function getStatusMeta(status) {
  const value = normalizeStatus(status);

  if (value === "live" || value === "active") {
    return {
      label: "Live",
      className:
        "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
      dot: "bg-emerald-500",
    };
  }

  if (value === "coming soon" || value === "coming-soon" || value === "soon") {
    return {
      label: "Coming soon",
      className: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
      dot: "bg-amber-500",
    };
  }

  return {
    label: status || "Available",
    className: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
    dot: "bg-slate-400",
  };
}

export default function DappsDashboard() {
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  const { supportedDapps, selectedDapp, setSelectedDapp, setActiveButton } =
    useStates();

  const filteredDapps = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return supportedDapps || [];
    }

    return (supportedDapps || []).filter((dapp) => {
      const searchable = [
        dapp?.name,
        dapp?.description,
        dapp?.category,
        dapp?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [search, supportedDapps]);

  const liveCount = useMemo(
    () =>
      (supportedDapps || []).filter((dapp) =>
        ["live", "active"].includes(normalizeStatus(dapp?.status))
      ).length,
    [supportedDapps]
  );

  function handleSelectDapp(id) {
    const clickedDapp = supportedDapps?.find((dapp) => dapp.id === id);

    if (!clickedDapp) {
      return;
    }

    setSelectedDapp(clickedDapp);
    setActiveButton(clickedDapp?.defaultAction || "swap");

    if (clickedDapp?.trigger) {
      setUpdateInProgress(true);
      return;
    }

    navigate(`/dapps/${clickedDapp.id}`);
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

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Connected applications
              </p>

              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                Explore integrations
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select an app to open its SocketFi-native interaction flow.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dApps"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100"
              />
            </div>
          </div>

          {filteredDapps.length === 0 ? (
            <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
              <Search className="h-8 w-8 text-slate-300" />

              <h3 className="mt-4 text-base font-semibold text-slate-900">
                No dApps found
              </h3>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Try another name, category, or integration status.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredDapps.map((dapp) => {
                const status = getStatusMeta(dapp?.status);
                const isTriggerOnly = Boolean(dapp?.trigger);

                return (
                  <button
                    key={dapp?.id}
                    type="button"
                    onClick={() => handleSelectDapp(dapp?.id)}
                    className="group flex h-full min-h-[360px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-slate-100"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                      <img
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        src={dapp?.imgUrl}
                        alt={dapp?.name || "dApp"}
                        loading="lazy"
                      />

                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/25 to-transparent" />

                      <div className="absolute left-3 top-3">
                        <span
                          className={classNames(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur",
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

                      {dapp?.category ? (
                        <span className="absolute bottom-3 left-3 rounded-full bg-slate-950/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
                          {dapp.category}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold tracking-tight text-slate-950">
                            {dapp?.name}
                          </h3>

                          {dapp?.subtitle ? (
                            <p className="mt-1 truncate text-xs font-medium text-slate-400">
                              {dapp.subtitle}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition group-hover:bg-slate-950 group-hover:text-white">
                          <ArrowUpRight className="h-4 w-4" />
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-slate-500">
                        {dapp?.description}
                      </p>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                        <span className="text-sm font-semibold text-slate-800">
                          {isTriggerOnly
                            ? "View integration"
                            : `Open ${dapp?.name}`}
                        </span>

                        <Sparkles className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500" />
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
