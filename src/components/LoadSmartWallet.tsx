// @ts-nocheck
import Button from "./Button";

import { useStates } from "../context/StatesContext";
import { useState } from "react";
import { postRequest } from "../utils/fetch-functions";
import { Tab, TabGroup, TabList } from "@headlessui/react";
import clsx from "clsx";

import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function LoadSmartWallet({ onClickButton, buttonMessage }) {
  const {
    setLoadedSmartWallet,
    smartWalletId,
    selectedNetwork,
    setSmartWalletId,
  } = useStates();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingOption, setLoadingOption] = useState("contractId");

  const navigate = useNavigate();

  function validateUsername(username) {
    const cleaned = username.trim().toLowerCase();

    if (/\s/.test(cleaned)) {
      toast.error("Username cannot contain spaces.");
      return { valid: false, error: "Username cannot contain spaces." };
    }

    if (cleaned.length < 6) {
      toast.error("Username must be at least 6 characters long.");
      return {
        valid: false,
        error: "Username must be at least 6 characters long.",
      };
    }
    return cleaned;
  }

  async function loadContractHandler() {
    try {
      setIsLoading(true);
      if (
        smartWalletId?.address?.length > 0 &&
        loadingOption === "contractId"
      ) {
        const spec = await postRequest("access-load-wallet", {
          wallet: smartWalletId?.address,
          network: selectedNetwork,
        });

        if (spec?.spec) {
          setLoadedSmartWallet({
            specs: spec?.spec,
            address: spec?.wallet,
            username: "",
          });
          navigate(
            `./${selectedNetwork.toLowerCase()}/wallet/${
              smartWalletId?.address
            }`
          );
        }
      } else if (
        smartWalletId?.username?.length > 0 &&
        loadingOption === "socialId"
      ) {
        const username = validateUsername(smartWalletId?.username);

        const spec = await postRequest("access-load-wallet", {
          username: username,
          network: selectedNetwork,
        });

        if (spec?.spec) {
          setLoadedSmartWallet({
            specs: spec?.spec,
            address: spec?.wallet,
            username: username,
          });
          navigate(`./${selectedNetwork.toLowerCase()}/username/${username}`);
        }
      }
    } catch (e) {
      console.log(e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="relative mt-4 overflow-hidden rounded-[22px] border border-[#dbe3ef] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:col-span-7"
    >
      <main>
        <div>
          <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-5">
            <div className="mt-4 rounded-[20px]">
              <div className="px-0 py-1 sm:p-4">
                <div className="grid grid-cols-1 gap-y-8 lg:grid-cols-7 lg:gap-x-24">
                  <div className="px-0 lg:col-span-7 lg:px-16">
                    <div className="rounded-[20px] border border-[#dbe3ef] bg-[#fcfdff] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                      <div className="p-4 sm:p-5">
                        <div className="flex items-center">
                          <div>
                            <span className="hidden">
                              <svg
                                className="h-6 w-6 text-gray-300"
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

                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 shadow-sm">
                              <svg
                                className="h-4 w-4 text-white"
                                viewBox="0 0 140 140"
                                fill="currentColor"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path d="M87.4974 70.0026L116.664 46.6693L87.4974 23.3359V40.8301H11.6641V52.4968H87.4974V70.0026ZM128.331 87.5026H52.4974V70.0026L23.3307 93.3359L52.4974 116.669V99.1693H128.331V87.5026Z" />
                              </svg>
                            </div>
                          </div>

                          <div className="ml-4 flex w-full items-center justify-between gap-4">
                            <p className="text-[15px] font-semibold tracking-tight text-slate-900 sm:text-base">
                              {loadingOption === "contractId" &&
                                "Account Address"}
                              {loadingOption === "socialId" && "Social ID"}
                            </p>
                          </div>

                          <TabGroup
                            onChange={(index) => {
                              if (index === 0) setLoadingOption("contractId");
                              else if (index === 1)
                                setLoadingOption("socialId");

                              setSmartWalletId(null);
                              setLoadedSmartWallet(null);
                            }}
                          >
                            <TabList className="flex rounded-full border border-[#dbe3ef] bg-slate-50 p-1 shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)]">
                              <Tab
                                className={({ selected }) =>
                                  clsx(
                                    "mx-auto w-[120px] rounded-full px-3 py-2 text-sm font-medium leading-5 transition-all duration-200 focus:outline-none",
                                    selected
                                      ? "bg-slate-900 text-white shadow-sm"
                                      : "text-slate-600 hover:text-slate-900"
                                  )
                                }
                              >
                                Contract ID
                              </Tab>
                              <Tab
                                className={({ selected }) =>
                                  clsx(
                                    "mx-auto w-[120px] rounded-full px-3 py-2 text-sm font-medium leading-5 transition-all duration-200 focus:outline-none",
                                    selected
                                      ? "bg-slate-900 text-white shadow-sm"
                                      : "text-slate-600 hover:text-slate-900"
                                  )
                                }
                              >
                                Social ID
                              </Tab>
                            </TabList>
                          </TabGroup>
                        </div>

                        {loadingOption === "socialId" && (
                          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                            <div className="col-span-2 sm:col-span-4">
                              <div className="mt-2">
                                <input
                                  type="text"
                                  name=""
                                  value={smartWalletId?.username || ""}
                                  placeholder="john***"
                                  className="block w-full appearance-none rounded-2xl border border-[#dbe3ef] bg-white px-4 py-3 pr-8 text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      setSmartWalletId((prev) => ({
                                        ...prev,
                                        username: e.target.value,
                                      }));
                                    } else {
                                      setSmartWalletId(null);
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {loadingOption === "contractId" && (
                          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                            <div className="col-span-2 sm:col-span-4">
                              <div className="mt-2">
                                <input
                                  type="text"
                                  name=""
                                  value={smartWalletId?.address || ""}
                                  placeholder="C****"
                                  className="block w-full appearance-none rounded-2xl border border-[#dbe3ef] bg-white px-4 py-3 pr-8 text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      setSmartWalletId((prev) => ({
                                        ...prev,
                                        address: e.target.value,
                                      }));
                                    } else {
                                      setSmartWalletId(null);
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {smartWalletId && (
                          <div className="col-span-4 mt-5 flex w-full flex-col justify-end">
                            <Button
                              isLoading={isLoading}
                              onClick={loadContractHandler}
                              message="Wallet Loading..."
                            >
                              Load Smart Wallet
                            </Button>
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
      </main>
    </div>
  );
}
