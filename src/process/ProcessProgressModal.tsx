// @ts-nocheck
"use client";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { BASE_URL, useStates } from "../context/StatesContext";

const API_BASE = BASE_URL;

export default function ProcessProgressModal() {
  const { sessionId, setSessionId, selectedNetwork } = useStates();

  const [isLoading, setIsloading] = useState(false);

  const esRef = useRef(null);
  const [last, setLast] = useState(null);
  const [key, setKey] = useState("");

  const txId = last?.eid;

  const txHash = txId?.startsWith("txHash_")
    ? txId?.slice("txHash_".length)
    : "";

  function openTxInExplorerHandler() {
    const url = `https://stellar.expert/explorer/${selectedNetwork?.toLowerCase()}/tx/${txHash}`;
    window.open(url, "_blank");
  }

  useEffect(() => {
    setIsloading(false);

    const delayAndClear = async () => {
      if (last?.status === "sse_error" || last?.status === "error") {
        setSessionId("");
        setLast(null);
      } else if (last?.status === "done") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setSessionId("");
        setLast(null);
      }
    };

    delayAndClear();
  }, [last?.status, setSessionId]);

  useEffect(() => {
    if (!sessionId || sessionId === "") return;

    const url = `${API_BASE}/process/progress/${encodeURIComponent(sessionId)}`;

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    const handler = (e) => {
      try {
        setLast(JSON.parse(e.data));
        setKey(uuidv4());
      } catch {}
    };

    es.addEventListener("step", handler);
    es.onerror = () =>
      setLast({
        step: "connection",
        status: "error",
        detail: "sse_error",
        ts: Date.now(),
      });

    return () => {
      es.removeEventListener("step", handler);
      es.close();
      esRef.current = null;
    };
  }, [sessionId]);

  const isError = last?.status === "error";
  const isDone =
    !isError &&
    (last?.isDone === true ||
      last?.status === "done" ||
      last?.step === "done" ||
      /done|success|complete/i.test(
        `${last?.step ?? ""} ${last?.detail ?? last?.description ?? ""}`
      ));

  const headline = isError
    ? "Something went wrong"
    : isDone
    ? "Completed"
    : "Processing…";

  const subtext =
    last?.detail ??
    last?.description ??
    (isError ? "Please try again." : isDone ? "All set!" : "Working on it…");

  if (!sessionId) return null;

  return (
    <div
      onClick={(e) => {
        setSessionId("");
        setIsloading(false);
        e.stopPropagation();
      }}
      className="fixed inset-0 z-50 flex h-full items-center justify-center bg-slate-900/30 px-4 backdrop-blur-[6px]"
    >
      <div
        key={key}
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-[28px] border border-[#dbe3ef] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
      >
        <button
          type="button"
          onClick={() => {
            setSessionId("");
            setIsloading(false);
          }}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e6edf5] bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:bg-slate-50 hover:text-slate-700"
        >
          <span className="text-xl leading-none">×</span>
        </button>

        <div className="p-6 sm:p-8">
          <div className="text-center">
            {isDone && !isError ? (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-emerald-50 ring-1 ring-emerald-100">
                <svg
                  className="h-10 w-10 text-emerald-600"
                  viewBox="0 0 144 144"
                  fill="none"
                >
                  <path
                    d="M54.11 100c1.556 2.333 3.889 3.111 6.222 3.111s4.667-.778 6.222-3.111l35-46.666c2.333-3.111 1.555-8.556-1.556-10.889-3.111-2.333-8.555-1.555-10.889 1.556L60.333 82.111l-5.444-7c-2.333-3.111-7.778-3.889-10.889-1.556-3.111 2.333-3.889 7.778-1.556 10.889L54.11 100Z"
                    fill="currentColor"
                  />
                  <path
                    d="M72 142c38.889 0 70-31.111 70-70S110.889 2 72 2 2 33.111 2 72s31.111 70 70 70Zm0-124.444c30.333 0 54.444 24.111 54.444 54.444S102.333 126.444 72 126.444 17.556 102.333 17.556 72 41.667 17.556 72 17.556Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
            ) : isError ? (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-rose-50 ring-1 ring-rose-100">
                <svg
                  className="h-10 w-10 text-rose-600"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 8l8 8M16 8l-8 8"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            ) : (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-slate-100 ring-1 ring-slate-200">
                <svg
                  className="h-10 w-10 animate-spin text-slate-900"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            )}

            <p className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
              {headline}
            </p>

            <p className="mx-auto mt-3 max-w-[300px] text-sm leading-6 text-slate-500 sm:text-base">
              {subtext}
            </p>

            {last && (
              <div
                key={key}
                className="mt-6 rounded-[20px] border border-[#e6edf5] bg-[#f8fafc] px-4 py-4 text-center"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Current step
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {last?.step}
                </p>

                {last?.detail ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                    {last?.detail}
                  </p>
                ) : null}

                {txHash && (
                  <div className="mt-5">
                    <button
                      onClick={openTxInExplorerHandler}
                      className="inline-flex min-h-[46px] w-full items-center justify-center rounded-2xl border border-[#dbe3ef] bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      View on explorer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
