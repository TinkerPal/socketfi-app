// @ts-nocheck
import { Information } from "iconsax-react";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function QuestPage({
  selectedQuest,
  setSelectedQuest,
  allQuests,
  isWinner,
  hasClaimed,
}) {
  const { id } = useParams();

  // console.log("tthe current id is", id);

  //   console.log("all queasts are", allQuests);

  useEffect(() => {
    setSelectedQuest(allQuests.find((q) => q.id === Number(id)));
  }, [id]);

  const navigate = useNavigate();

  function handleNavigate(route) {
    navigate(route);
  }

  return (
    // <section className="py-12 bg-white sm:py-16 lg:py-20">

    <div className="px-4 mx-auto sm:px-6 lg:px-8 max-w-7xl w-full lg:col-span-5">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1  lg:grid-cols-5 lg:items-start xl:grid-cols-6  ">
          <div className="lg:order-1 lg:col-span-5 xl:col-span-6">
            <div className="flow-root">
              <div className="divide-y divide-gray-200 -my-7">
                <div className="py-7">
                  <div className="mt-2 space-y-4">
                    <div className="bg-white border-2 border-gray-900 rounded-md">
                      <div className="px-4 py-5 sm:p-6">
                        <div className="flex items-center">
                          <div>
                            <span className="hidden">
                              <svg
                                className="w-6 h-6 text-gray-300"
                                viewBox="0 0 22 22"
                                fill="none"
                                stroke="currentColor"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <circle
                                  cx="11"
                                  cy="11"
                                  r="10.25"
                                  strokeWidth="1.5"
                                />
                              </svg>
                            </span>

                            <span>
                              <Information className="h-8 w-auto text-gray-900" />
                            </span>
                          </div>

                          <div className="ml-4">
                            <p className="text-base font-bold text-gray-900">
                              {/* Quest {id} Details and Instructions */}
                              {selectedQuest?.title} Quest/Task
                            </p>
                            <p className="mt-1 text-sm font-medium text-gray-500">
                              SocketFi quests and bounties description
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 mt-5 sm:grid-cols-4 gap-x-6 gap-y-5">
                          <div className="col-span-2 sm:col-span-4">
                            <div className="mt-2">
                              <div className="">{selectedQuest?.details}</div>
                            </div>
                          </div>

                          <div className="col-span-2 sm:col-span-4">
                            <div className="mt-2">
                              {selectedQuest?.additionalDetails}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <h2 className="text-base font-bold text-gray-900">
                      {isWinner
                        ? "You WON, claim your price now"
                        : "Complete all the quests to win"}
                    </h2>

                    <div
                      disabled={hasClaimed}
                      onClick={
                        selectedQuest?.onClick === "navigate"
                          ? () => handleNavigate(selectedQuest?.route)
                          : selectedQuest?.onClick
                      }
                      className={`"bg-white border-2  ${
                        hasClaimed
                          ? "pointer-events-none"
                          : "cursor-pointer hover:bg-gray-200"
                      }  border-gray-200 rounded-md`}
                    >
                      <div className="px-4 py-5 sm:p-6">
                        <div className="flex items-center">
                          <div>
                            {true ? (
                              <div className="h-7 w-7 flex border text-white bg-gray-600 border-gray-400 rounded-full text-center justify-center">
                                {/* <svg
                                className="w-6 h-6 text-gray-300"
                                viewBox="0 0 22 22"
                                fill="none"
                                stroke="currentColor"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <circle
                                  cx="11"
                                  cy="11"
                                  r="10.25"
                                  strokeWidth="1.5"
                                />
                              </svg> */}
                                1
                              </div>
                            ) : (
                              <span className="">
                                <svg
                                  className="w-7 h-7"
                                  viewBox="0 0 22 22"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <circle
                                    cx="11"
                                    cy="11"
                                    r="11"
                                    fill="#18181B"
                                  />
                                  <path
                                    d="M6.91699 11.5833L9.25033 13.9166L15.0837 8.08331"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                            )}
                          </div>

                          <div className="ml-4 ">
                            <p className="text-base font-bold text-gray-900">
                              {hasClaimed
                                ? "You have already claimed your reward"
                                : selectedQuest?.title}
                            </p>
                            <p className="mt-1 text-sm font-medium text-gray-500">
                              Click here to complete this quest
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedQuest?.id < allQuests.length && (
                      <div className="bg-white border-2 border-gray-200 rounded-md">
                        <div className="px-4 py-5 sm:p-6">
                          <div className="flex items-center">
                            <div>
                              {true ? (
                                <div className="h-7 w-7 flex border text-white bg-gray-600 border-gray-400 rounded-full text-center justify-center">
                                  2
                                </div>
                              ) : (
                                <span className="">
                                  <svg
                                    className="w-7 h-7"
                                    viewBox="0 0 22 22"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <circle
                                      cx="11"
                                      cy="11"
                                      r="11"
                                      fill="#18181B"
                                    />
                                    <path
                                      d="M6.91699 11.5833L9.25033 13.9166L15.0837 8.08331"
                                      stroke="white"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </span>
                              )}
                            </div>

                            <div className="ml-4">
                              <p className="text-base font-bold text-gray-900">
                                Claim points
                              </p>
                              <p className="mt-1 text-sm font-medium text-gray-500">
                                Click here to claim earned points and rewards
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
