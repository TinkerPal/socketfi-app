// @ts-nocheck
import { InfoCircle } from "iconsax-react";
import React, { useState } from "react";

export default function ProfileDetail({
  twiterAccount,
  smartAccountIds,
  smartAllowance,
  smartOwner,
}) {
  // console.log("the twitter account connected is", twiterAccount);
  // console.log("smart account ids", smartAccountIds);
  return (
    <div className="overflow-hidden bg-white  rounded-xl lg:col-span-4 relative">
      <div className="flex flex-col flex-1 ">
        <main>
          <div className="py-6">
            <div className="px-4 mx-auto mt-8 sm:px-6 md:px-">
              <div className="mt-6">
                <p className="text-base font-bold text-gray-900">
                  Account details and settings
                </p>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Your account details are as follows
                </p>
              </div>

              <div className="max-w-3xl mt-12">
                <div className="space-y-8">
                  <div className="sm:grid sm:grid-cols-3 sm:gap-5 sm:items-start">
                    <label className="block text-sm font-bold text-gray-900 sm:mt-px sm:pt-2">
                      {" "}
                      Owner Profile
                    </label>
                    <div className="mt-2 sm:mt-0 sm:col-span-2">
                      <div className="flex items-center  space-x-2">
                        <img
                          className="flex-shrink-0 rounded-full object-cover w-8 h-auto "
                          src={twiterAccount?.profileImageUrl}
                          alt=""
                        />

                        <button
                          type="button"
                          className="text-sm font-semibold text-indigo-600 transition-all duration-200 bg-white rounded-md hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                        >
                          {smartAccountIds[0]?.owner}
                        </button>
                        {/* <button>
                          <InfoCircle className="h-5 w-auto " />
                        </button> */}
                      </div>
                    </div>
                  </div>

                  <div className="sm:grid sm:grid-cols-3 sm:gap-5 sm:items-start">
                    <label className="block text-sm font-bold text-gray-900 sm:mt-px sm:pt-2">
                      {" "}
                      Smart Account ID
                    </label>
                    <div className="mt-2 sm:mt-0 text-[13px]">
                      {smartAccountIds[0]?.accountId}
                    </div>
                  </div>

                  <div className="sm:grid sm:grid-cols-3 sm:gap-5 sm:items-start">
                    <label className="block text-sm font-bold text-gray-900 sm:mt-px sm:pt-2">
                      {" "}
                      Owner's G account
                    </label>
                    <div className="mt-2 sm:mt-0 sm:col-span-2 text-[13px]">
                      {smartOwner
                        ? smartOwner
                        : "Owner wallet has not been set"}
                    </div>
                  </div>

                  <div className="sm:grid sm:grid-cols-3 sm:gap-5 sm:items-start">
                    <label className="block text-sm font-bold text-gray-900 sm:mt-px sm:pt-2">
                      {" "}
                      Smart wallet Allowance
                    </label>
                    <div className="mt-2 sm:mt-0 sm:col-span-2">
                      {smartAllowance}
                    </div>
                  </div>
                </div>

                {/* <div className="mt-6 sm:mt-12">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold leading-5 text-white transition-all duration-200 bg-indigo-600 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 hover:bg-indigo-500"
                  >
                    Update
                  </button>
                </div> */}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
