// @ts-nocheck
import React, { useState } from "react";

export default function AquaAmm() {
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [tokenFrom, setTokenFrom] = useState("AQUA");
  const [tokenTo, setTokenTo] = useState(
    "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA"
  );

  const handleSwap = () => {
    // Logic for swapping tokens would go here
    console.log("Swapping", inputAmount, tokenFrom, "for", tokenTo);
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-400 to-purple-600 flex items-center justify-center py-8">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Swap Tokens
        </h1>

        {/* From Token Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From
          </label>
          <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg border border-gray-300">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="w-full bg-transparent text-xl outline-none"
              placeholder="0.0"
            />
            <div className="relative">
              <select
                value={tokenFrom}
                onChange={(e) => setTokenFrom(e.target.value)}
                className="w-24 p-2 bg-transparent border border-gray-300 rounded-md"
              >
                <option value="AQUA">AQUA</option>
                <option value="ETH">ETH</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
          </div>
        </div>

        {/* To Token Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To
          </label>
          <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-lg border border-gray-300">
            <input
              type="text"
              value={outputAmount}
              disabled
              className="w-full bg-transparent text-xl outline-none"
              placeholder="0.0"
            />
            <div className="relative">
              <select
                value={tokenTo}
                onChange={(e) => setTokenTo(e.target.value)}
                className="w-24 p-2 bg-transparent border border-gray-300 rounded-md"
              >
                <option value="AQUA">AQUA</option>
                <option value="ETH">ETH</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <div className="mb-6">
          <button
            onClick={handleSwap}
            className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 ease-in-out transform hover:scale-105"
          >
            Swap
          </button>
        </div>

        {/* Additional Details (Transaction Fee, Slippage, etc.) */}
        <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
          <div className="flex items-center space-x-2">
            <span>Slippage</span>
            <input
              type="number"
              placeholder="1.0"
              className="w-16 p-1 border border-gray-300 rounded-md text-center"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span>Transaction Fee: 0.1%</span>
          </div>
        </div>

        {/* Connect Wallet Button (Placeholder for now) */}
        <div className="mt-6">
          <button className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600 transition-all duration-200 ease-in-out">
            Connect Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
