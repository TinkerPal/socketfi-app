// @ts-nocheck
import React, { useEffect, useState } from "react";
import { useStates } from "../../context/StatesContext";
import Button from "../../components/Button";
import axios from "axios";
import freighterIcon from "../../assets/socketIcon.svg";
import metamaskIcon from "../../assets/socketIcon.svg";
import walletconnectIcon from "../../assets/socketIcon.svg";
import SavedAccounts from "./SavedAccounts";
import {
  clearAccountStore,
  getAccounts,
  addAccountStore,
  saveAuthSession,
} from "../../utils/localStorage";
import { postRequest } from "../../utils/fetch-functions";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { ArrowLeft, ArrowLeft2 } from "iconsax-react";
import OtpInput from "./OtpInput";
// import VerificationSent from "./VerificationSent";

export default function LoginModal() {
  const [isLoading, setIsloading] = useState(false);
  const [isVerified, setIsVerified] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [emailVerificationToken, setEmailVerificationToken] = useState(null);
  const [newAccountBody, setNewAccountBody] = useState({
    username: "",
    platform: "",
  });

  const [platformUsed, setPlatformUsed] = useState("");

  const [options, setOptions] = useState(null);

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
  } = useStates();

  // if (!loginIsOpen) return null;

  const fieldsToSearch = ["username", "platform"];
  let filteredAccounts = [
    ...savedLoginList,

    {
      id: 100,
      username: "Use new account",
      platform: "login",
    },
  ]?.filter((value) =>
    fieldsToSearch.some((field) =>
      value[field]?.toLowerCase().includes(search.toLowerCase())
    )
  );

  function useTwitterHandler() {
    setIsloading(true);
    localStorage.setItem("platformUsed", "x");
    const twitterAuthUrl = "https://twitter.socket.fi/auth/twitter";
    window.location.href = twitterAuthUrl;
  }

  async function loginHandler(id) {
    const selectedAccount = filteredAccounts.find(
      (account) => account.id === id
    );
    setSelectedAccount(selectedAccount);

    if (id === 100) {
      setNewLogin(true);
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
          if (initRes?.emailOtpSent) {
            setEmailVerificationToken(initRes?.verificationToken);
            setOptions(initRes.options);
            setIsloading(false);
            return;
          }
          authData = await startRegistration({
            optionsJSON: initRes.options,
          });
        }

        const authRes = await postRequest("verify-auth", {
          authData,
          network: selectedNetwork,
        });

        await addAccountStore(newAccountBody);

        await saveAuthSession(authRes.userProfile, authRes.accessToken);
        // console.log(authRes);
        setIsloading(false);
        setLoginIsOpen(false);
        setNewLogin(false);
        await getSavedAccount();
        await triggerUpdate();
      }
    } else {
      setIsloading(true);
      const body = {
        username: selectedAccount.username,
        platform: selectedAccount.platform,
        network: selectedNetwork,
      };

      const initRes = await postRequest("init-auth", body);

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
      const authRes = await postRequest("verify-auth", {
        authData,
        network: selectedNetwork,
      });

      await saveAuthSession(authRes.userProfile, authRes.accessToken);

      sendLoginAccessToken(authRes);

      // console.log(authRes);
      setIsloading(false);
      setLoginIsOpen(false);
    }

    setNewAccountBody({
      username: "",
      platform: "",
    });

    updateSession();
    setSelectedAccount(null);
    triggerUpdate();
  }

  // console.log(emailVerificationToken);

  async function emailVerifyAndLogin() {
    try {
      setIsloading(true);
      const otpRes = await postRequest(
        "verify-email",
        {
          email: newAccountBody.username,
          otp: enteredOtp,
        },
        emailVerificationToken
      );

      let authData;
      if (otpRes?.emailVerified) {
        authData = await startRegistration({
          optionsJSON: options,
        });

        const authRes = await postRequest("verify-auth", {
          authData,
          network: selectedNetwork,
        });

        await addAccountStore(newAccountBody);

        await saveAuthSession(authRes.userProfile, authRes.accessToken);
        // console.log(authRes);

        setLoginIsOpen(false);
        setNewLogin(false);
        setEmailVerificationToken(null);
        setNewAccountBody({ username: "", platform: "" });
        await getSavedAccount();
        await updateSession();
        await triggerUpdate();
      }
    } catch (e) {
      console.log(e);
    } finally {
      setIsloading(false);
    }
  }

  const closeLoginModal = () => {
    window.parent.postMessage({ type: "close-connection-modal" }, "*");
  };

  const sendLoginAccessToken = (session) => {
    window.parent.postMessage({ type: "socketfi-connected", session }, "*");
  };

  return (
    <section className="py-12   sm:py-16 lg:py-20 h-screen">
      <div
        onClick={closeLoginModal}
        className="cursor-pointer flex px-4 items-center text-center gap-1 text-gray-600 "
      >
        <ArrowLeft2 variant="Bold" className=" h-5" />{" "}
        <span className="font-bold">back</span>
      </div>

      <div className="px-4 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <div className="max-w-sm mx-auto">
          <div className="text-center">
            <h1 className="mt-12 text-3xl font-bold text-gray-900">
              Login to SocketFi
            </h1>
            <p className="mt-4 text-sm font-medium text-gray-500">
              The smart wallet super app built on Soroban and the Stellar
              ecosystem.
            </p>
          </div>

          {newLogin ? (
            <>
              {" "}
              <div className="mt-3 space-y-3">
                <button
                  onClick={useTwitterHandler}
                  className="relative inline-flex items-center justify-center w-full px-4 py-3 text-base font-semibold text-gray-700 transition-all duration-200 bg-white border-2 border-gray-200 rounded-md hover:bg-gray-100 focus:bg-gray-100 hover:text-black focus:text-black focus:outline-none"
                >
                  <div className="absolute inset-y-0 left-0 p-4">
                    {isLoading ? (
                      <svg
                        className="w-6 h-auto mx-auto text-gray-800 animate-spin "
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    ) : (
                      <svg
                        className="w-6 h-6 text-rose-500"
                        viewBox="0 0 1230 1230"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M713.19 533.838L1099.26 85H1007.77L672.549 474.719L404.808 85H96L500.877 674.325L96 1145H187.491L541.495 733.443L824.249 1145H1133.06L713.167 533.838H713.19ZM587.881 679.517L546.858 620.833L220.456 153.883H360.981L624.391 530.727L665.414 589.41L1007.82 1079.25H867.291L587.881 679.539V679.517Z"
                          fill="black"
                        />
                      </svg>
                    )}
                  </div>
                  Sign in with X
                </button>

                <button
                  disabled={true}
                  className="relative inline-flex items-center justify-center w-full px-4 py-3 text-base font-semibold text-gray-700 transition-all duration-200 bg-white border-2 border-gray-200 rounded-md hover:bg-gray-100 focus:bg-gray-100 hover:text-black focus:text-black focus:outline-none"
                >
                  <div className="absolute inset-y-0 left-0 p-4">
                    <svg
                      className="w-6 h-6 text-[#6563ff]"
                      viewBox="0 0 1230 1230"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M807.235 918.575C834.51 952.762 867.203 991.246 867.203 991.246C1067.84 984.895 1145 854.87 1145 854.87C1142.01 672.798 1097.27 493.841 1014.23 331.782C940.79 275.28 851.782 242.676 759.223 238.374L746.519 252.759C900.83 299.463 972.568 366.717 972.568 366.717C887.93 320.669 795.184 291.425 699.441 280.594C638.492 273.988 576.976 274.615 516.174 282.462C510.961 282.637 505.773 283.262 500.668 284.331C429.675 292.235 360.345 311.143 295.169 340.376C260.795 356.068 241.179 366.343 241.179 366.343C241.179 366.343 315.906 295.54 479.931 248.835L470.777 238C378.219 242.303 289.21 274.907 215.772 331.409C132.728 493.467 87.9888 672.424 85 854.496C85 854.496 161.221 985.268 361.863 990.873C361.863 990.873 395.49 950.52 422.765 916.146C307.499 882.145 263.971 810.408 263.971 810.408C263.971 810.408 273.125 816.759 289.378 825.726C290.397 826.801 291.599 827.687 292.927 828.342C295.73 830.21 298.345 830.957 301.147 832.825C322.535 844.473 344.693 854.648 367.467 863.277C410.679 880.101 455.323 892.981 500.855 901.761C578.529 916.186 658.196 916.186 735.871 901.761C780.776 893.917 824.647 881.006 866.643 863.277C903.326 849.626 938.356 831.892 971.073 810.408C971.073 810.408 926.237 885.508 807.235 918.575ZM470.964 793.594C420.523 793.594 379.05 747.45 379.05 691.031C377.499 678.053 378.716 664.894 382.621 652.421C386.527 639.947 393.033 628.444 401.709 618.668C410.385 608.893 421.035 601.068 432.957 595.709C444.878 590.35 457.8 587.58 470.871 587.58C483.941 587.58 496.863 590.35 508.785 595.709C520.706 601.068 531.356 608.893 540.032 618.668C548.709 628.444 555.214 639.947 559.12 652.421C563.026 664.894 564.243 678.053 562.691 691.031C563.422 703.833 561.617 716.652 557.379 728.753C553.141 740.855 546.553 751.999 537.995 761.547C529.437 771.095 519.076 778.858 507.509 784.389C495.941 789.921 483.395 793.113 470.59 793.781L470.964 793.594ZM799.575 793.594C748.948 793.781 708.222 748.384 708.222 691.218C710.17 673.465 717.218 656.656 728.513 642.821C739.808 628.987 754.868 618.72 771.873 613.259C788.878 607.799 807.1 607.38 824.338 612.053C841.575 616.725 857.091 626.289 869.011 639.59C880.93 652.89 888.743 669.358 891.506 687.003C894.268 704.647 891.862 722.715 884.578 739.022C877.294 755.329 865.444 769.178 850.459 778.895C835.474 788.612 817.996 793.782 800.136 793.781L799.575 793.594Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  Sign in with Discord (Soon)
                </button>

                <button
                  disabled={true}
                  className="relative inline-flex items-center justify-center w-full px-4 py-3 text-base font-semibold text-gray-700 transition-all duration-200 bg-white border-2 border-gray-200 rounded-md hover:bg-gray-100 focus:bg-gray-100 hover:text-black focus:text-black focus:outline-none"
                >
                  <div className="absolute inset-y-0 left-0 p-4">
                    <svg
                      className="w-6 h-6 text-[#009eeb]"
                      viewBox="0 0 1230 1230"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1170.83 105.629C1158.83 95.464 1144.31 88.7394 1128.79 86.1698C1113.28 83.6003 1097.36 85.2819 1082.73 91.036L84.9933 482.888C67.4931 489.556 52.6699 501.791 42.806 517.71C32.9421 533.629 28.5845 552.349 30.4042 570.988C32.0277 589.619 39.6473 607.222 52.1205 621.157C64.5937 635.091 81.2481 644.607 99.5864 648.277L353.074 698.542V1015.27C353.065 1032.4 358.147 1049.15 367.673 1063.39C377.2 1077.64 390.742 1088.73 406.583 1095.26C417.066 1099.48 428.252 1101.68 439.552 1101.74C450.91 1101.78 462.162 1099.56 472.649 1095.2C483.136 1090.84 492.648 1084.42 500.627 1076.34L641.153 936.356L853.565 1123.36C869.246 1137.19 889.407 1144.87 910.316 1144.98C919.51 1145.17 928.664 1143.71 937.34 1140.66C951.603 1136.15 964.44 1127.99 974.583 1116.99C984.726 1106 991.823 1092.54 995.172 1077.96L1198.39 190.485C1201.95 175.172 1201.26 159.179 1196.4 144.228C1191.54 129.277 1182.7 115.932 1170.83 105.629ZM910.856 1058.51L465.496 666.654L1107.05 203.457L910.856 1058.51Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  Sign in with Telegram (Soon)
                </button>
              </div>
              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>

                <div className="relative flex justify-center">
                  <span className="px-2 text-sm text-gray-400 bg-white">
                    {" "}
                    or{" "}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <div className="space-y-4 ">
                  <div className="">
                    <div className="flex">
                      {" "}
                      <label className="text-sm font-bold  text-gray-900">
                        {" "}
                        {emailVerificationToken
                          ? "Enter OTP sent to your email"
                          : "Signin with your email"}
                      </label>
                    </div>
                    {emailVerificationToken ? (
                      <div className="mt-2">
                        <OtpInput setEnteredOtp={setEnteredOtp} />
                      </div>
                    ) : (
                      <div className="mt-2">
                        <input
                          type="email"
                          onChange={(e) =>
                            setNewAccountBody((prev) => ({
                              ...prev,
                              platform: "email",
                              username: e.target.value.toLowerCase(),
                            }))
                          }
                          placeholder="Email address"
                          value={newAccountBody?.username}
                          className="block w-full px-4 py-3 placeholder-gray-500 border-gray-300 rounded-lg focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm caret-indigo-600"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    {emailVerificationToken ? (
                      <Button
                        message="Signing in..."
                        onClick={emailVerifyAndLogin}
                        isLoading={isLoading}
                      >
                        Verify and confirm
                      </Button>
                    ) : (
                      <Button
                        message="Signing in..."
                        onClick={() => loginHandler(100)}
                        isLoading={isLoading}
                      >
                        Sign In
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-8">
              <SavedAccounts
                loginHandler={loginHandler}
                filteredAccounts={filteredAccounts}
                search={search}
                setSearch={setSearch}
                selectedAccount={selectedAccount}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
