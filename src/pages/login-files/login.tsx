// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useStates } from "../../context/StatesContext";
import Button from "../../components/Button";

import SavedAccounts from "./SavedAccounts";

import { getRequest, postRequest } from "../../utils/fetch-functions";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { addAccountStore } from "../../storage/indexdb-store";
import { saveAuthSession } from "../../storage/indexdb-session-store";
import { ArrowLeft2 } from "iconsax-react";

export default function Login() {
  const [isLoading, setIsloading] = useState(false);

  const [search, setSearch] = useState("");

  const [newAccountBody, setNewAccountBody] = useState({
    username: "",
    platform: "",
  });

  const [emailDeviceLogin, setEmailDeviceLogin] = useState("");

  const [usernameError, setUsernameError] = useState("");
  const [accountExist, setAccountExist] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const {
    newLogin,
    setNewLogin,
    loginIsOpen,
    setLoginIsOpen,
    getSavedAccount,
    savedLoginList,
    updateSession,
    triggerUpdate,
    selectedNetwork,
    sessionId,
    setSessionId,
  } = useStates();

  async function selectAccountHandler(id) {
    if (!id) return;
    const selectedAccount = savedLoginList.find((account) => account.id === id);

    setSelectedAccount(selectedAccount);
  }

  useEffect(() => {
    async function checkAccountExist() {
      const res = await getRequest(
        "get-account",
        `username=${newAccountBody?.username}`
      );

      setAccountExist(res);
    }

    if (usernameError === "" && newAccountBody.username !== "") {
      checkAccountExist();
    }
  }, [newAccountBody?.username]);

  if (!loginIsOpen) return null;

  const fieldsToSearch = ["username", "platform"];
  let filteredAccounts = [
    ...savedLoginList,

    {
      id: 100,
      username: "Use New Account",
      platform: "login",
    },
  ]?.filter((value) =>
    fieldsToSearch.some((field) =>
      value[field]?.toLowerCase().includes(search.toLowerCase())
    )
  );

  function backButtonHandler() {
    if (newLogin && emailDeviceLogin !== "") {
      setEmailDeviceLogin("");
    } else if (savedLoginList?.length > 0 && newLogin) {
      setNewLogin(false);
    } else {
      setLoginIsOpen(false);
    }
  }

  async function selectAccountHandler(id) {
    if (usernameError || !id) return;
    const selectedAccount = filteredAccounts.find(
      (account) => account.id === id
    );

    if (id === 100) {
      setNewLogin(true);
      setNewAccountBody((prev) => ({
        ...prev,

        username: "",
      }));
    } else {
      setSelectedAccount(selectedAccount);
      setNewAccountBody((prev) => ({
        ...prev,

        username: selectedAccount.username,
      }));

      setNewLogin(false);
    }
  }

  async function loginHandler() {
    if (usernameError) return;

    try {
      if (newAccountBody?.username !== "") {
        setIsloading(true);

        const initRes = await postRequest("init-auth", {
          ...newAccountBody,
          network: selectedNetwork,
        });

        // console.log(initRes);

        let authData;

        if (initRes.existingUser) {
          authData = await startAuthentication({
            optionsJSON: initRes.options,
          });
        } else {
          authData = await startRegistration({
            optionsJSON: initRes.options,
          });
        }

        setSessionId(initRes.id);
        const authRes = await postRequest("verify-auth", {
          authData,
          id: initRes.id,
          network: selectedNetwork,
        });

        console.log("account creation response", authRes);
        setIsloading(false);

        await addAccountStore(newAccountBody);

        await saveAuthSession(authRes.userProfile, authRes.accessToken);

        setIsloading(false);
        setLoginIsOpen(false);
        setNewLogin(false);
        await getSavedAccount();
        await triggerUpdate();
      }

      setNewAccountBody({
        username: "",
        platform: "",
      });

      updateSession();
      setSelectedAccount(null);
    } catch (e) {
      setSessionId("");
    }
  }

  const handleUsernameChange = (e) => {
    const value = e.target.value.toLowerCase();

    // Validation: minimum 6 characters, no spaces
    if (value.length === 0) {
      setUsernameError("");
      setAccountExist(null);
    } else if (value.length < 6) {
      setUsernameError("Username must be at least 6 characters.");
    } else if (/\s/.test(value)) {
      setUsernameError("Username must not contain spaces.");
    } else {
      setUsernameError("");
    }

    setNewAccountBody((prev) => ({
      ...prev,

      username: value,
    }));
  };

  return (
    <section className="py-8  h-screen">
      <div
        onClick={backButtonHandler}
        className="cursor-pointer flex px-4 items-center text-center gap-1 text-gray-600 "
      >
        <ArrowLeft2 variant="Bold" className=" h-5" />{" "}
        <span className="font-bold">back</span>
      </div>

      <div className="px-4 mx-auto sm:px-6 lg:px-8 h-full mt-16 flex lg:mt-44 max-w-7xl">
        {!sessionId && (
          <div className="max-w-sm mx-auto ">
            <div className="text-center">
              <h1 className="text-3xl font-medium text-gray-900">
                Login to SocketFi
              </h1>
              <p className="mt-4 text-sm font-medium text-slate-600">
                The smart wallet super app built on Soroban and the Stellar
                ecosystem.
              </p>
            </div>

            {
              <>
                {" "}
                <div className="mt-4 space-y-2 ">
                  {newLogin ? (
                    <div>
                      <input
                        type="text"
                        onChange={handleUsernameChange}
                        placeholder="Enter a username to sign up or log in"
                        value={newAccountBody?.username}
                        className={`block border w-full px-4 py-3    focus:ring-0 border-gray-400  placeholder-gray-500 rounded-sm  sm:text-sm  ${
                          usernameError || accountExist?.isReserved
                            ? "border-red-500 focus:border-red-500 focus:ring-0"
                            : "focus:border-gray-400"
                        }     ${
                          accountExist &&
                          (accountExist?.existingUser
                            ? "border-gray-700 focus:border-gray-700"
                            : "focus:border-gray-700")
                        }`}
                      />

                      {/* <p
                        className={`mt-1 text-sm ${
                          usernameError ||
                          (accountExist?.isReserved && "text-red-600")
                        }

                    ${
                      accountExist &&
                      accountExist?.existingUser &&
                      "text-gray-700"
                    }

                    ${
                      accountExist &&
                      !accountExist?.existingUser &&
                      "text-green-700"
                    }

                    ${
                      usernameError ||
                      (accountExist?.isReserved && "text-red-600")
                    }
                    
                    
                    `}
                      >
                        {usernameError
                          ? usernameError
                          : accountExist
                          ? accountExist?.description
                          : "\u00A0"}
                      </p> */}
                      {/* <p className="mt-1 text-sm text-red-600">
                    {accountExist?.description || "\u00A0"}
                  </p> */}
                    </div>
                  ) : (
                    <div>
                      <SavedAccounts
                        loginHandler={loginHandler}
                        selectAccountHandler={selectAccountHandler}
                        filteredAccounts={filteredAccounts}
                        search={search}
                        setSearch={setSearch}
                        selectedAccount={selectedAccount}
                      />

                      <p
                        className={`mt-1 text-sm ${
                          (usernameError || accountExist?.isReserved) &&
                          "text-red-600"
                        }

                    ${
                      accountExist &&
                      accountExist?.existingUser &&
                      "text-gray-700"
                    }

                    ${
                      accountExist &&
                      !accountExist?.existingUser &&
                      "text-green-700"
                    }

                    ${
                      (usernameError || accountExist?.isReserved) &&
                      "text-red-600"
                    }
                    
                    
                    `}
                      >
                        {usernameError || accountExist?.isReserved
                          ? usernameError
                          : accountExist
                          ? accountExist?.description
                          : "\u00A0"}
                      </p>
                      {/* <p className="mt-1 text-sm text-red-600">
                    {accountExist?.description || "\u00A0"}
                  </p> */}
                    </div>
                  )}

                  {
                    <div className={`${usernameError && "disabled:"}`}>
                      <Button
                        message="Signing in..."
                        onClick={() => loginHandler(100)}
                        isLoading={isLoading}
                        disable={
                          usernameError ||
                          accountExist?.isReserved ||
                          !accountExist
                        }
                      >
                        {!accountExist
                          ? "Onboard"
                          : accountExist?.existingUser
                          ? "Log in"
                          : "Sign up"}
                      </Button>
                    </div>
                  }
                </div>
              </>
            }
          </div>
        )}
      </div>
    </section>
  );
}
