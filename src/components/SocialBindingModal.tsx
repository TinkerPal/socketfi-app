// @ts-nocheck
import React, { useState } from "react";
import { useStates } from "../context/StatesContext";
import { postRequest } from "../utils/fetch-functions";
import { v4 as uuidv4 } from "uuid";

import { startAuthentication } from "@simplewebauthn/browser";
import SocialSettingsTransact from "./SocialSettingsTransact";

export default function SocialBindingModal({
  socialModalOpen,
  setSocialModalOpen,
}) {
  const [isTransacting, setIsTransacting] = useState(false);
  const [inputParams, setInputParams] = useState("");

  const [selectedToken, setSelectedToken] = useState("");

  const {
    walletFunctions,
    activeSession,

    triggerUpdate,

    setIsOpenSend,

    activeButton,
    setActiveButton,
    prices,
    selectedNetwork,
    toast,

    recipientSpender,
    dappTokenIn,

    setSessionId,
  } = useStates();

  // console.log("the active session is", activeSession);
  async function bindSocialHandler() {
    try {
      console.log("discord res", activeSession?.accessToken);

      if (activeButton === "discord") {
        setIsTransacting(true);
        const sId = uuidv4();

        window.location.href = `https://server.socket.fi/init-discord-auth?token=${activeSession?.accessToken}`;

        return;

        let selectedFunc = walletFunctions?.find(
          (func) => func.name === "set_external_wallet"
        );

        selectedFunc.inputs[0].value = inputParams;

        setSessionId(sId);

        const sigOptions = await postRequest(
          "init-sign-transaction",
          {
            contractId: activeSession?.userProfile?.address[selectedNetwork],
            network: selectedNetwork,
            callFunction: selectedFunc,
            sId: sId,
          },
          activeSession?.accessToken
        );

        const sigData = await startAuthentication({
          optionsJSON: sigOptions.options,
        });

        const txDetails = {
          id: activeSession?.userProfile?.userId,
          walletContractId:
            activeSession?.userProfile?.address[selectedNetwork],
          type: "Set Access",

          to: inputParams,
          from: activeSession?.userProfile?.address[selectedNetwork],
          network: selectedNetwork,
        };

        const tx = await postRequest(
          "any-invoke-with-sig",
          {
            contractId: activeSession?.userProfile?.address[selectedNetwork],
            network: selectedNetwork,
            callFunction: selectedFunc,
            sigData: sigData,
            txDetails: txDetails,
            sId: sId,
          },
          activeSession?.accessToken
        );

        if (tx) {
          console.log("set access tx", tx);
          setInputParams("");
          setSocialModalOpen(false);
        }
      } else if (activeButton === "allowance") {
        setIsTransacting(true);
        const sId = uuidv4();
        let selectedFunc = walletFunctions?.find(
          (func) => func.name === "update_max_tx_allowance"
        );

        selectedFunc.inputs[0].value = inputParams;

        setSessionId(sId);

        const sigOptions = await postRequest(
          "init-sign-transaction",
          {
            contractId: activeSession?.userProfile?.address[selectedNetwork],
            network: selectedNetwork,
            callFunction: selectedFunc,
            sId: sId,
          },
          activeSession?.accessToken
        );

        const sigData = await startAuthentication({
          optionsJSON: sigOptions.options,
        });

        const txDetails = {
          id: activeSession?.userProfile?.userId,
          walletContractId:
            activeSession?.userProfile?.address[selectedNetwork],
          type: "Set Max Allowance",

          to: inputParams,
          from: activeSession?.userProfile?.address[selectedNetwork],
          network: selectedNetwork,
        };

        const tx = await postRequest(
          "any-invoke-with-sig",
          {
            contractId: activeSession?.userProfile?.address[selectedNetwork],
            network: selectedNetwork,
            callFunction: selectedFunc,
            sigData: sigData,
            txDetails: txDetails,
            sId: sId,
          },
          activeSession?.accessToken
        );

        if (tx) {
          console.log("set access tx", tx);
          setInputParams("");
          setSocialModalOpen(false);
        }
      }
      setIsOpenSend(false);
      triggerUpdate();
    } catch (e) {
      console.log("the error is", e);
      if (e?.message) {
        toast.error(e?.message);
      } else {
        toast.error(e);
      }
      setSessionId("");
    } finally {
      setSelectedToken("");
      // setAmount("");
      setIsTransacting(false);
    }
  }

  const description =
    activeButton === "account"
      ? {
          long: "Set the entered G account as Admin, giving it full access to your wallet",
          short: "Set G Account",
          button: "Enter G Account",
          placeholder: "G6******",
        }
      : activeButton === "allowance"
      ? {
          long: "Set your wallets default allowance. This limit the amount of any asset that can be transacted at ones",
          short: "Set Max Allowance",
          button: "Enter Max Allowance (Number)",
          placeholder: "Ex: 10000",
        }
      : null;

  if (!socialModalOpen) return null;

  // if (true) return null;

  const topStat =
    activeButton === "account"
      ? {
          title: "Current G Acccount settings",
          value: "G6044-334",
        }
      : activeButton === "allowance"
      ? {
          title: "Current Max Allowance",
          value: "1000",
        }
      : null;

  // const topStat = null;

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center h-full bg-gray-900 bg-opacity-25 px-3 xl:px-64"
      onClick={() => setSocialModalOpen(false)}
    >
      <SocialSettingsTransact
        isLoading={isTransacting}
        onClickButton={bindSocialHandler}
        onClick={(e) => e.stopPropagation()}
        isModal={true}
        onCloseModal={() => {
          setSocialModalOpen(false);
        }}
        // buttons={buttons}
        description={description}
        inputParams={inputParams}
        setInputParams={setInputParams}
      />
    </div>
  );
}
