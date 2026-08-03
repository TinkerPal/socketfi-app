// @ts-nocheck
import React from "react";

import Button from "../../components/Button";
// import { FaUser } from "react-icons/fa";
// import { IoMdSwap } from "react-icons/io";
// import { RiSettings3Line } from "react-icons/ri";

export default function AquaSwapPage() {
  return (
    <div className="overflow-hidden max-w-[1135px] bg-white border border-gray-200 rounded-xl lg:col-span-5 relative ">
      {/* Swap Card */}
      <div className=" rounded-3xl shadow-xl p-6 w-full   relative">
        <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          {/* <RiSettings3Line size={20} /> */}
        </button>

        {/* Sell Section */}
        <div className="mb-4">
          <label className="block text-sm text-gray-500 mb-1">Sell</label>
          <div className="flex items-center justify-between bg-gray-100 rounded-xl px-4 py-3">
            <input
              type="number"
              placeholder="0"
              className="bg-transparent w-full text-lg font-semibold focus:outline-none"
            />
            <button className="flex items-center gap-2 text-sm font-semibold">
              <img src="/xlm.svg" alt="XLM" className="h-5 w-5" /> XLM ▾
            </button>
          </div>
          <div className="text-xs text-gray-400 mt-1">$0</div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center my-2">
          <div className="bg-gray-200 p-2 rounded-full">
            {/* <IoMdSwap size={18} className="text-gray-600" /> */}
          </div>
        </div>

        {/* Buy Section */}
        <div className="mb-6">
          <label className="block text-sm text-gray-500 mb-1">Buy</label>
          <div className="flex items-center justify-between bg-gray-100 rounded-xl px-4 py-3">
            <input
              type="number"
              placeholder="0"
              className="bg-transparent w-full text-lg font-semibold focus:outline-none"
            />
            <button className="flex items-center gap-2 text-sm font-semibold">
              <img src="/aqua.svg" alt="AQUA" className="h-5 w-5" /> AQUA ▾
            </button>
          </div>
          <div className="text-xs text-gray-400 mt-1">$0</div>
        </div>

        {/* Connect Wallet */}

        <Button>Confirm Swap</Button>
      </div>
    </div>
  );
}
