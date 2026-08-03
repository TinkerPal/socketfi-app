// @ts-nocheck
import { CloseCircle } from "iconsax-react";
import React from "react";
import { useStates } from "../context/StatesContext";

export default function LoadingModal() {
  const { isFetching } = useStates();

  if (!isFetching) return null; // Don't render the modal if it's not open

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center h-full bg-gray-900 bg-opacity-60">
      <div className="relative w-full max-w-md mx-auto overflow-hidden ">
        <div className="p-8">
          <div className="text-center">
            <svg
              className="w-52 h-auto mx-auto text-gray-900 animate-spin "
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>

            {/* <p className="mt-8 text-xl font-bold text-gray-900">{children}</p> */}
            {/* <p className="mt-3 text-base text-5xl font-medium text-gray-600">
              Loading...
            </p> */}
          </div>
        </div>
      </div>
    </div>
  );
}
