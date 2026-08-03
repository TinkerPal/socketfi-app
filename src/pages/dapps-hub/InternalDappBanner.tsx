// @ts-nocheck
import React, { useState } from "react";

export default function InternalDappBanner() {
  return (
    <section className="relative lg:col-span-2 flex   h-full">
      <div className="w-full h-full  ">
        <div className="relative mx-auto ">
          <div className="absolute -inset-4">
            <div
              className="w-full h-full mx-auto opacity-30 blur-lg filter"
              style={{
                background:
                  "linear-gradient(90deg, #44ff9a -0.55%, #44b0ff 22.86%, #8b44ff 48.36%, #ff6644 73.33%, #ebff70 99.34%)",
              }}
            ></div>
          </div>

          <div className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl">
            <div className="p-6 md:px-10 md:py-9">
              <div className="space-y-9 ">
                <div className="flex items-center">
                  <div className="inline-flex items-center justify-center flex-shrink-0 w-10 h-10 bg-white border border-gray-200 rounded-full">
                    <svg
                      className="w-5 h-5 text-gray-900"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4 ">
                    <p className="text-lg font-bold text-gray-900 font-pj">
                      Seamless access to dApps
                    </p>
                    <p className="mt-1 text-sm font-normal text-gray-600 font-pj">
                      Up to 100GB for works
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="inline-flex items-center justify-center flex-shrink-0 w-10 h-10 bg-white border border-gray-200 rounded-full">
                    <svg
                      className="w-5 h-5 text-gray-900"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-lg font-bold text-gray-900 font-pj">
                      API Access
                    </p>
                    <p className="mt-1 text-sm font-normal text-gray-600 font-pj">
                      Create anything you want
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="inline-flex items-center justify-center flex-shrink-0 w-10 h-10 bg-white border border-gray-200 rounded-full">
                    <svg
                      className="w-5 h-5 text-gray-900"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-lg font-bold text-gray-900 font-pj">
                      Live Chat
                    </p>
                    <p className="mt-1 text-sm font-normal text-gray-600 font-pj">
                      Connect with your customers
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
