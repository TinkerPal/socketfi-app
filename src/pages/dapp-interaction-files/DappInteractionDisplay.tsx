// @ts-nocheck
import { useEffect, useRef } from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import BlendDapp from "../BlendDapp";
import DappTransactionHistory from "../../components/DappTransactionHistory";
import AquariusDapp from "../AquariusDapp";
import { useStates } from "../../context/StatesContext";

const AQUARIUS_IDS = new Set(["aqua-amm", "aquarius", "aquarius-amm"]);
const BLEND_IDS = new Set(["blend", "blend-capital", "blend-protocol"]);

export default function DappInteractionDisplay() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const {
    selectedNetwork,
    supportedDapps,
    selectedDapp,
    setSelectedDapp,
    setActiveButton,
  } = useStates();

  const synchronizedRouteRef = useRef("");

  useEffect(() => {
    if (!selectedNetwork || !id) return;

    const loaded = (supportedDapps || []).find((dapp) => dapp.id === id);
    const isBuiltIn = AQUARIUS_IDS.has(id) || BLEND_IDS.has(id);

    if (!loaded) {
      if (!isBuiltIn) {
        navigate("/dapps", { replace: true });
      }
      return;
    }

    if (loaded.trigger) {
      navigate("/dapps", { replace: true });
      return;
    }

    const nextAction =
      loaded.defaultAction || (BLEND_IDS.has(id) ? "supply" : "swap");

    const syncKey = [id, selectedNetwork, loaded.id, nextAction].join(":");

    if (synchronizedRouteRef.current === syncKey) {
      return;
    }

    synchronizedRouteRef.current = syncKey;

    if (selectedDapp?.id !== loaded.id) {
      setSelectedDapp(loaded);
    }

    setActiveButton(nextAction);
  }, [
    id,
    selectedNetwork,
    supportedDapps,
    selectedDapp?.id,
    navigate,
    setSelectedDapp,
    setActiveButton,
  ]);

  const content = AQUARIUS_IDS.has(id) ? (
    <AquariusDapp />
  ) : BLEND_IDS.has(id) ? (
    <BlendDapp />
  ) : (
    <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <h1 className="text-lg font-semibold text-amber-950">
            Integration unavailable
          </h1>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            This dApp does not yet have a SocketFi-native interaction component.
          </p>
        </div>
      </div>
    </section>
  );

  return (
    <div className="mx-auto w-full space-y-6 px-0 py-6 sm:px-6 md:px-8">
      <button
        type="button"
        onClick={() => navigate("/dapps")}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dApps
      </button>

      {content}

      <DappTransactionHistory
        dappId={id}
        title={`${
          selectedDapp?.name || (AQUARIUS_IDS.has(id) ? "Aquarius" : "Blend")
        } activity`}
      />
    </div>
  );
}
