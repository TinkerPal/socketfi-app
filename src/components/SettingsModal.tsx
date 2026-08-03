// @ts-nocheck
import React, { useState } from "react";
import { useStates } from "../context/StatesContext";
import { postRequest } from "../utils/fetch-functions";
import { v4 as uuidv4 } from "uuid";

import { startAuthentication } from "@simplewebauthn/browser";
import SettingsTransact from "./SettingsTransact";

export default function SettingsModal({ modalOpen, setModalOpen }) {
  const [isTransacting, setIsTransacting] = useState(false);
  const [inputParams, setInputParams] = useState("");

  const {
    walletFunctions,
    activeSession,

    triggerUpdate,

    setIsOpenSend,

    activeButton,

    selectedNetwork,
    toast,
    accountSettings,

    setSessionId,
  } = useStates();

  async function accountAllowanceHandler() {
    try {
      setIsTransacting(true);
      const sId = uuidv4();
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
        walletContractId: activeSession?.userProfile?.address[selectedNetwork],
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
          args: selectedFunc.inputs.slice(0, -1),
          txDetails: txDetails,
          sId: sId,
        },
        activeSession?.accessToken
      );

      if (tx) {
        setInputParams("");
        setModalOpen(false);
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

  if (!modalOpen) return null;

  const topStat =
    activeButton === "account"
      ? {
          title: "Current G Acccount settings",
          value: accountSettings?.g_account || "******",
        }
      : activeButton === "allowance"
      ? {
          title: "Current Max Allowance",
          value: accountSettings?.default_allowance || "0.00",
        }
      : null;

  // const topStat = null;

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center h-full bg-gray-900 bg-opacity-25 px-3 xl:px-64"
      onClick={() => setModalOpen(false)}
    >
      <SettingsTransact
        isLoading={isTransacting}
        onClickButton={accountAllowanceHandler}
        onClick={(e) => e.stopPropagation()}
        isModal={true}
        onCloseModal={() => {
          setModalOpen(false);
        }}
        description={description}
        topStat={topStat}
        inputParams={inputParams}
        setInputParams={setInputParams}
      />
    </div>
  );
}
