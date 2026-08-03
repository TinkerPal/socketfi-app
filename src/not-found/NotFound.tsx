// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { EmojiSad, ArrowLeft, Home2 } from "iconsax-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f4f7fb] flex items-center justify-center px-4">
      <div className="w-full max-w-[520px]">
        <div className="rounded-[28px] border border-[#dbe3ef] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6 sm:p-8 text-center">
          {/* Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-100 text-slate-700">
            <EmojiSad size="34" />
          </div>

          {/* Title */}
          <h1 className="mt-6 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
            Page not found
          </h1>

          {/* Description */}
          <p className="mt-3 text-sm sm:text-base text-slate-500 leading-6 max-w-[360px] mx-auto">
            The page you’re looking for doesn’t exist or may have been moved.
            You can return to the homepage or continue exploring.
          </p>

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Home2 size="18" />
              Go to homepage
            </Link>

            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft size="18" />
              Go back
            </button>
          </div>

          {/* Subtle helper */}
          <div className="mt-6 rounded-[18px] bg-[#f7f9fc] px-4 py-3 text-xs sm:text-sm text-slate-500">
            If you believe this is an error, try refreshing the page or
            navigating from the main app.
          </div>
        </div>
      </div>
    </div>
  );
}
