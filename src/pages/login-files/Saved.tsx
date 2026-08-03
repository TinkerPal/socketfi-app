// @ts-nocheck
import React, { useState } from "react";
import { useStates } from "../../context/StatesContext";
import { IoClose } from "react-icons/io5";

import {
  deleteAccountStore,
  getAccounts,
} from "../../utils/localStorage";

export default function Saved({
  selectedAccount,
  selectAccountHandler,
  setSelectedAccount,
}) {
  const { savedLoginList, setSavedLoginList } = useStates();

  const formatTimestamp = (timestamp) => {
    if (!timestamp) {
      return null;
    }
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour12: false,
    }).format(new Date(timestamp));
  };

  function deleteLoginOptionHandler(id) {
    deleteAccountStore(id);
    const list = getAccounts();
    setSavedLoginList(list);
    setSelectedAccount(null);
  }

  return (
    <div className="max-w-md mx-auto overflow-hidden bg-gray-100 rounded-xl">
      <div className="mt-2  space-y-3">
        {savedLoginList?.map((account) => (
          <div
            onClick={() => {
              selectAccountHandler(account.id);
            }}
            key={account?.id}
            className={`border cursor-pointer  overflow-hidden bg-white shadow-sm rounded-xl ${
              account?.username === selectedAccount?.username
                ? "border-indigo-700"
                : "hover:border-indigo-300"
            }`}
          >
            <div className="px-4 py-3 ">
              <div className="flex items-center justify-between space-x-5">
                <div className="flex items-center flex-1">
                  <svg
                    className={`flex-shrink-0 object-cover w-10 h-10 rounded-full  ${
                      account?.username === selectedAccount?.username
                        ? "opacity-100"
                        : "opacity-75"
                    }`}
                    viewBox="0 0 361 361"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M180.5 361C80.8099 361 0 280.19 0 180.5C0 80.8099 80.8099 0 180.5 0C280.19 0 361 80.8099 361 180.5C361 280.19 280.19 361 180.5 361ZM216.6 144.4V216.6H252.7V144.4H216.6ZM108.3 144.4V216.6H144.4V144.4H108.3Z"
                      fill="#2800AA"
                    />
                  </svg>
                  <div className="flex-1 min-w-0 ml-4">
                    <p className="text-lg font-bold text-gray-900 truncate">
                      {account?.username}
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-500 truncate">
                      Last used:{" "}
                      <span className="font-light">
                        {" "}
                        {formatTimestamp(account?.time)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3">
                  <div className="bg-gray-50 p-[2px] rounded-full">
                    <IoClose
                      onClick={() => deleteLoginOptionHandler(account?.id)}
                      className=" cursor-pointer w-6 h-6 text-gray-400 opacity-100 "
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
