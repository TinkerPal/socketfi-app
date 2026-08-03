// @ts-nocheck
import React from "react";

export default function Aqua2() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-semibold text-gray-800">Swap AQUA</h1>
          <p className="mt-2 text-lg text-gray-600">
            Swap your AQUA tokens with ease.
          </p>
        </header>

        {/* Swap Form */}
        <div className="bg-white shadow-lg rounded-xl p-6 space-y-6">
          <div className="flex justify-between items-center">
            <label htmlFor="fromToken" className="text-gray-700">
              From
            </label>
            <select
              id="fromToken"
              className="border border-gray-300 rounded-lg p-2 text-gray-700"
            >
              <option value="AQUA">AQUA</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div className="flex justify-between items-center">
            <label htmlFor="toToken" className="text-gray-700">
              To
            </label>
            <select
              id="toToken"
              className="border border-gray-300 rounded-lg p-2 text-gray-700"
            >
              <option value="GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA">
                GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA
              </option>
              <option value="USD">USD</option>
            </select>
          </div>

          {/* Amount Input */}
          <div className="flex justify-between items-center">
            <label htmlFor="amount" className="text-gray-700">
              Amount
            </label>
            <input
              type="number"
              id="amount"
              className="border border-gray-300 rounded-lg p-2 text-gray-700 w-full"
              placeholder="Enter amount"
            />
          </div>

          {/* Swap Button */}
          <button className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition duration-200">
            Swap Now
          </button>

          {/* Info */}
          <div className="text-center mt-4 text-sm text-gray-500">
            <p>Your swap will be processed on the Aqua Network.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
