import { Login, ShieldTick } from "iconsax-react";

import { useStates } from "../context/StatesContext";

export default function LoginComponent() {
  const { activeSession, setLoginIsOpen } = useStates();

  if (activeSession) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-50/80 via-cyan-50/40 to-transparent" />

      <div className="relative mx-auto flex min-h-[520px] max-w-2xl flex-col items-center justify-center px-5 py-12 text-center sm:px-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-slate-950 text-white shadow-lg shadow-slate-950/15">
          <ShieldTick size="30" variant="Bulk" />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
          SocketFi Wallet
        </p>

        <h1 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          One wallet. Two simple ways to continue.
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
          Use a passkey for the simplest SocketFi experience, or connect an
          existing Stellar wallet.
        </p>

        <button
          type="button"
          onClick={() => setLoginIsOpen(true)}
          className="mt-8 inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <Login size="18" />
          Continue
        </button>

        <p className="mt-5 max-w-md text-xs leading-5 text-slate-400">
          Your wallet opens here after you continue. SocketFi never asks for
          your private key.
        </p>
      </div>
    </section>
  );
}
