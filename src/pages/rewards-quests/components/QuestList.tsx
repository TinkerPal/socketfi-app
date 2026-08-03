// @ts-nocheck
import { TimerStart } from "iconsax-react";
import React, { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

export default function QuestList({
  smartAccountIds,
  userPoints,
  setSelectedQuest,
  allQuests,
  setAllQuests,
}) {
  // console.log("all quests with status is", updatedQuests);
  return (
    <section className="overflow-hidden bg-white border border-gray-200 rounded-xl lg:col-span-5 pb-6">
      <div className="px-4 py-5 sm:p-6">
        <div className="sm:flex sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">
              Quests & Bounties
            </p>
            <p className="mt-1 text-sm font-medium text-gray-500">
              The top quests and bounties are as follows
            </p>
          </div>

          <div className="mt-4 sm:mt-0">
            <a
              href="#"
              title=""
              className="inline-flex items-center text-xs font-semibold tracking-widest text-gray-500 uppercase hover:text-gray-900"
            >
              View all Quests
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
      <div className="px-4 mx-auto sm:px-6 lg:px-6 max-w-7xl">
        <div className="grid grid-cols-1 gap-4 mt-4 sm:grid-cols-2 xl:grid-cols-3 ">
          {allQuests.map((quest, index) => (
            <NavLink
              key={quest.id}
              to={`/quests/${quest.id}`}
              title=""
              className="relative overflow-hidden transition-all duration-200 bg-gray-100 rounded-xl hover:bg-gray-200"
              onClick={() =>
                setSelectedQuest(allQuests.find((q) => q.id === quest.id))
              }
            >
              <div className="p-6  lg:py-8">
                <div className="flex items-center justify-start space-x-8">
                  {quest?.status ? (
                    <svg
                      className="w-10 h-auto text-green-700"
                      viewBox="0 0 141 141"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M52.6113 98.5002C54.1668 100.833 56.5002 101.611 58.8335 101.611C61.1668 101.611 63.5002 100.833 65.0557 98.5002L100.056 51.8335C102.389 48.7224 101.611 43.2779 98.5002 40.9446C95.389 38.6113 89.9446 39.389 87.6113 42.5001L58.8335 80.6113L53.389 73.6113C51.0557 70.5001 45.6113 69.7224 42.5001 72.0557C39.389 74.389 38.6113 79.8335 40.9446 82.9446L52.6113 98.5002Z"
                        fill="currentColor"
                      />
                      <path
                        d="M70.5 140.5C109.389 140.5 140.5 109.389 140.5 70.5C140.5 31.6111 109.389 0.5 70.5 0.5C31.6111 0.5 0.5 31.6111 0.5 70.5C0.5 109.389 31.6111 140.5 70.5 140.5ZM70.5 16.0556C100.833 16.0556 124.944 40.1667 124.944 70.5C124.944 100.833 100.833 124.944 70.5 124.944C40.1667 124.944 16.0556 100.833 16.0556 70.5C16.0556 40.1667 40.1667 16.0556 70.5 16.0556Z"
                        fill="currentColor"
                      />
                    </svg>
                  ) : (
                    <TimerStart className="w-10 h-auto text-gray-500" />
                  )}
                  {/* <svg
                    className="flex-shrink-0 w-10 h-10 text-gray-600 md:w-12 md:h-12"
                    viewBox="0 0 60 60"
                    fill="none"
                    stroke="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M37.75 10C37.75 14.51 34.06 18.2 29.55 18.2C25.04 18.2 21.35 14.51 21.35 10H15.2L7 14.1V26.4H15.2V51H43.9V26.4H52.1V14.1L43.9 10H37.75Z"
                      strokeWidth="2"
                      stroke-miterlimit="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg> */}
                  <div className="flex-shrink-0 w-px h-12 bg-gray-200"></div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 sm:text-base lg:text-lg">
                      <div>
                        {quest.title}
                        <span
                          className="absolute inset-0"
                          aria-hidden="true"
                        ></span>
                      </div>
                    </h3>
                    <p className="mt-2 text-sm font-medium text-gray-500">
                      {quest.earn}
                    </p>
                  </div>
                </div>
              </div>
            </NavLink>
          ))}
        </div>
      </div>
    </section>
  );
}
