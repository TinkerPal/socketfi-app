// @ts-nocheck
import { useState } from "react";

export default function DappMessageModal({
  onClick = () => {},
  setUpdateInProgress,
  selectedDapp,
}) {
  if (!selectedDapp?.trigger) return null;

  return (
    <div
      onClick={() => setUpdateInProgress((pre) => !pre)}
      className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm flex items-center justify-center"
    >
      <div className="text-center px-6 py-4 bg-white/80 rounded-xl shadow-xl">
        <p className="text-lg font-semibold text-gray-900">
          {selectedDapp?.statusMessage}
        </p>
      </div>
    </div>
  );
}
