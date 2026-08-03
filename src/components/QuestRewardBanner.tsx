// @ts-nocheck
import { BuyCrypto, MedalStar } from "iconsax-react";
import React from "react";

export default function QuestRewardBanner() {
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

      <div className="relative overflow-hidden bg-gray-50 border border-gray-200 rounded-2xl h-full">
        <div className="lg:sticky lg:order-2 ">
          <div className="overflow-hidden rounded ">
            <div className="p-6 lg:p-8">
              <h3 className="text-xl font-bold text-gray-900">
                Points & Rewards
              </h3>

              <div className="flow-root mt-8">
                <ul className="divide-y divide-gray-200 -my-7">
                  <li className="flex items-stretch justify-between space-x-5 py-7">
                    <div className="flex-shrink-0">
                      <MedalStar className="h-12 w-auto text-gray-900" />
                    </div>

                    <div className="flex flex-col justify-between flex-1 ml-5">
                      <div className="flex-1">
                        <p className="text-base font-bold text-gray-900">
                          1500 loyalty points
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-500">
                          Points received after quest completion
                        </p>
                      </div>
                      <p className="mt-2 text-sm font-bold text-gray-900">
                        on-chain loyalty points
                      </p>
                    </div>
                  </li>

                  <li className="flex items-stretch justify-between space-x-5 py-7">
                    <div className="flex-shrink-0">
                      <BuyCrypto className="h-12 w-auto text-gray-900" />
                    </div>

                    <div className="flex flex-col justify-between flex-1 ml-5">
                      <div className="flex-1">
                        <p className="text-base font-bold text-gray-900">
                          20 XLM (*FCFS)
                        </p>
                        <p className="mt-1 text-sm font-medium text-gray-500">
                          Token reward for first 100 participants (FCFS)
                        </p>
                      </div>
                      <p className="mt-2 text-sm font-bold text-gray-900">
                        Instantly claimable reward
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
