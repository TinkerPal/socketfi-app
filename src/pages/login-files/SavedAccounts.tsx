// @ts-nocheck
import { Category, CloseCircle } from "iconsax-react";
import React, { useEffect, useState } from "react";
import { deleteAccountStore, getAccounts } from "../../utils/localStorage";
// import { getAccounts } from "../../storage/indexdb-store";
import { useStates } from "../../context/StatesContext";

export default function SavedAccounts({
  description = "Select from saved accounts",
  loginHandler,
  filteredAccounts,
  search,
  setSearch,
  selectedAccount,
  selectAccountHandler,
}) {
  const [isOpen, setIsOpen] = useState(false);

  //   const [newLogin, setNewLogin] = useState(true);
  const { newLogin, setNewLogin, savedLoginList, setSavedLoginList } =
    useStates();

  function deleteLoginOptionHandler(id) {
    deleteAccountStore(id);
    const list = getAccounts();
    setSavedLoginList(list);
  }

  console.log("filtered accounts", filteredAccounts);

  return (
    <div className="bg-white">
      <div className="mx-auto  max-w-7xl">
        <div className=" mx-auto">
          {isOpen && (
            <div
              className="absolute top-0 left-0 w-full h-screen z-0 bg-transparent"
              onClick={() => setIsOpen(false)}
            ></div>
          )}
          <div className="relative">
            <div className="mt-2">
              <div
                onClick={() => setIsOpen(!isOpen)}
                className="cursor-pointer block border w-full px-4 py-2    focus:ring-0 border-gray-400  placeholder-gray-500 rounded-sm  sm:text-sm "
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2 ">
                    {selectedAccount ? (
                      <img
                        src={`./walletIcon.svg`}
                        className="h-6 text-gray-600"
                      />
                    ) : (
                      <Category className="h-4 w-4 text-gray-400" />
                    )}

                    <span className="text-lg font-normal ">
                      {selectedAccount
                        ? `${
                            selectedAccount?.screenName ||
                            selectedAccount?.username
                          } `
                        : description}
                    </span>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {isOpen && (
              <div className="relative w-full  z-10">
                <div className="border border-gray-300   shadow rounded-lg w-full text-sm px-2 py-2 space-y-2">
                  <div className="relative mt-2">
                    <div className="absolute inset-y-0 left-0 flex items-center  pl-3 pointer-events-none">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>

                    <input
                      type="text"
                      id="country-selector"
                      placeholder="Search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="block w-full py-2 pl-8 pr-2 placeholder-gray-500 border border-gray-300 rounded-lg focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm caret-indigo-600"
                    />
                  </div>
                  <ul className="flex flex-col">
                    {filteredAccounts?.map((account) => (
                      <li
                        key={account?.id}
                        className="w-full flex  rounded-md p-2   "
                      >
                        <div className="font-md text-lg flex items-center cursor-pointer  w-full justify-between">
                          <div
                            className="font-md text-lg  w-full pl-2 mr-3 py-1 rounded-md flex hover:bg-gray-100 items-center gap-2"
                            onClick={() => {
                              selectAccountHandler(account.id);
                              setIsOpen(false);
                            }}
                          >
                            <img
                              src={`./walletIcon.svg`}
                              className="h-6 text-gray-600"
                            />
                            {account?.username}{" "}
                          </div>
                          {account?.platform !== "login" && (
                            <CloseCircle
                              onClick={() =>
                                deleteLoginOptionHandler(account?.id)
                              }
                              className="text-gray-500 cursor-pointer"
                            />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
