// @ts-nocheck
// import React from "react";
import dappIcon from "../assets/dappiconnew.svg";

import React from "react";

export default function DappBanner() {
  return (
    <div className="relative lg:col-span-2 h-full">
      <div className="absolute -inset-2">
        <div
          className="w-full h-full mx-auto rotate-180 opacity-30 blur-lg filter"
          style={{
            background:
              "linear-gradient(90deg, #44ff9a -0.55%, #44b0ff 22.86%, #8b44ff 48.36%, #ff6644 73.33%, #ebff70 99.34%)",
          }}
        ></div>
      </div>

      <div className="relative lg:col-span-2    flex flex-col w-full overflow-hidden transition-all duration-200 transform bg-white border border-gray-100 shadow  group rounded-xl hover:shadow-lg hover:-translate-y-1">
        <a
          href="#"
          title=""
          className="flex shrink-0 aspect-w-4 aspect-h-3 items-center justify-center pt-5"
        >
          <img
            className="object-cover w-[250px] transition-all duration-200 transform group-hover:scale-110"
            src={dappIcon}
            alt="thumbnail-1"
          />
        </a>
        <div className="flex-1 px-4 py-5 sm:p-6">
          <a href="#" title="" className="">
            <p className="text-xl font-bold text-center text-gray-900">
              User-Friendly dApp Hub
            </p>
            <p className="mt-3 text-sm font-normal leading-6 text-gray-500 line-clamp-3">
              Seamless access multiple dApps from a single platform. Enjoy
              gasless interactions with dApps, eliminating the need to pay gas
              fees in native tokens.
            </p>
          </a>
        </div>
        <div className="px-4 mt-auto border-t border-gray-100 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <div className="col-span-2 lg:py-2 lg:col-span-1">
                <span className="text-xs font-bold text-green-900 bg-green-100 rounded-full inline-flex items-center px-3 py-1">
                  Dex
                </span>
              </div>
              <div className="col-span-2 lg:py-2 lg:col-span-1">
                <span className="text-xs font-bold text-pink-900 bg-pink-100 rounded-full inline-flex items-center px-3 py-1">
                  DeFi
                </span>
              </div>

              <div className="col-span-2 lg:py-2 lg:col-span-1">
                <span className="text-xs font-bold text-blue-900 bg-blue-100 rounded-full inline-flex items-center px-3 py-1">
                  DeFi
                </span>
              </div>
            </div>

            <a href="#" title="" className="" role="button">
              <svg
                className="w-5 h-5 text-gray-300 transition-all duration-200 group-hover:text-gray-900"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                <line x1="17" y1="7" x2="7" y2="17"></line>
                <polyline points="8 7 17 7 17 16"></polyline>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
