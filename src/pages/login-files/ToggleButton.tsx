// @ts-nocheck
import React, { useState } from "react";

export default function ToggleButton({ id, label, checked, onChange }) {
  return (
    <div className="flex items-center gap-2 ">
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-600 cursor-pointer select-none"
      >
        {label}
      </label>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-11 flex-shrink-0 items-center rounded-full border transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          checked
            ? "bg-indigo-600 border-indigo-600"
            : "bg-gray-300 border-gray-300"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

const DataSaver = () => {
  const [dataSaverOff, setDataSaverOff] = useState(false);
  const [dataSaverOn, setDataSaverOn] = useState(true);

  return (
    <div className="bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-sm">
          <div className="space-y-4">
            <ToggleRow
              id="data-saver-off"
              label={`Data Saver ${dataSaverOff ? "On" : "Off"}`}
              checked={dataSaverOff}
              onChange={setDataSaverOff}
            />

            <ToggleRow
              id="data-saver-on"
              label={`Data Saver ${dataSaverOn ? "On" : "Off"}`}
              checked={dataSaverOn}
              onChange={setDataSaverOn}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
