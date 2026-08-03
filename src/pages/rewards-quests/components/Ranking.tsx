// @ts-nocheck
import { Award, BuyCrypto, Ranking as OverallRank } from "iconsax-react";
import React from "react";

export default function Ranking() {
  return (
    <div className="overflow-hidden bg-white border border-gray-200 rounded-xl lg:col-span-2">
      <div className="px-4 py-5 sm:p-6">
        <div>
          <p className="text-base font-bold text-gray-900">Ranking & Points</p>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Your ranking and points are as follows:
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between space-x-5">
            <div className="flex items-center flex-1 min-w-0">
              <Award size="32" color="#555555" />
              <div className="flex-1 min-w-0 ml-4">
                <p className="text-sm font-bold text-gray-900">
                  Engagement Points
                </p>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Total engagement points accumulated.
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">124,030 LP</p>
              <p className="mt-1 text-sm font-medium text-gray-500 truncate">
                54 quests
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between space-x-5">
            <div className="flex items-center flex-1 min-w-0">
              <OverallRank size="32" color="#555555" />
              <div className="flex-1 min-w-0 ml-4">
                <p className="text-sm font-bold text-gray-900">
                  Overal Ranking
                </p>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Ranking relative to other users
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">111</p>
              <p className="mt-1 text-sm font-medium text-gray-500 truncate">
                Position
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between space-x-5">
            <div className="flex items-center flex-1 min-w-0">
              <BuyCrypto size="32" color="#555555" />
              <div className="flex-1 min-w-0 ml-4">
                <p className="text-sm font-bold text-gray-900">
                  Total Earnings:
                </p>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Total earnings accumulated
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">$450.75</p>
              <p className="mt-1 text-sm font-medium text-gray-500 truncate">
                Estimate
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <a
            href="#"
            title=""
            className="inline-flex items-center text-xs font-semibold tracking-widest text-gray-500 uppercase hover:text-gray-900"
          >
            View all details
            <svg
              className="w-4 h-4 ml-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              ></path>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
