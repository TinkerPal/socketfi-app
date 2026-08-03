// @ts-nocheck
import { useStates } from "../../context/StatesContext";

import { useEffect, useState } from "react";

import { postRequest } from "../../utils/fetch-functions";
import { signTransaction } from "@stellar/freighter-api";

import DappTransact from "../../components/DappTransact";

import { useNavigate, useParams } from "react-router-dom";

import { startAuthentication } from "@simplewebauthn/browser";
import axios from "axios";
import DappTransactionHistory from "../../components/DappTransactionHistory";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { formatValue } from "../../utils/helper-functions";

export default function DappInteractionDisplay() {
  const {
    loadedSmartWallet,
    userKey,

    selectedTransactToken,

    selectedNetwork,

    recipientSpender,
    setRecipientSpender,

    triggerUpdate,
    setLoadedSmartWallet,
    setSmartWalletId,
    activeButton,
    setActiveButton,
    prices,
    activeSession,
    setSelectedDapp,
    supportedDapps,
    transactingSymbol,

    dappTokenIn,
    dappTokenOut,
    setDappTokenOut,
    swapChainData,

    transactTokenBalance,
    setSessionId,
    allTokens,
  } = useStates();

  const [isTransacting, setIsTransacting] = useState(false);
  const [hasExtra, setHasExtra] = useState(false);

  const [extra, setExtra] = useState({
    name: "Recipient's Wallet",
    onChange: (e) => setRecipientSpender(e.target.value),
  });

  // console.log("transaction details", dappTokenIn, dappTokenOut, selectedDapp);
  const needWalletConnect = true;

  const { id } = useParams();

  const navigate = useNavigate();

  const buttons =
    id === "liquidsfi"
      ? [
          {
            id: "bridge",
            name: "Bridge Tokens",
            onClick: () => {
              setActiveButton("bridge");
              setHasExtra(false);
            },
          },
        ]
      : [
          {
            id: "swap",
            name: "Swap Tokens",
            onClick: () => {
              setActiveButton("swap");
              setHasExtra(false);
            },
          },
        ];

  useEffect(() => {
    const loadedDapp = supportedDapps?.find((dapp) => dapp.id === id);
    if (selectedNetwork) {
      if (loadedDapp && !loadedDapp?.trigger) {
        setSelectedDapp(loadedDapp);
      } else {
        navigate("/dapps");
      }
    }
  }, [id, selectedNetwork]);

  // async function handleSelectDapp(id) {
  //   const clickedDapp = supportedDapps?.find((dapp) => dapp.id === id);

  //   setSelectedDapp(clickedDapp);
  //   navigate(`/dapps/${clickedDapp?.id}`);
  // }

  async function swapBridgeHandler() {
    let transactingAmount;
    let transactingToken;
    try {
      console.log("this function is being used");
      if (selectedNetwork === "TESTNET") {
        transactingToken = selectedTransactToken?.address;
        transactingAmount = selectedTransactToken?.amount;
      } else if (selectedNetwork === "PUBLIC") {
        transactingToken = dappTokenIn?.contract;
        transactingAmount = dappTokenIn?.amount;
      }

      if (!dappTokenIn || !dappTokenOut || !dappTokenIn?.amount) {
        toast.error('You must enter token "from", token "in" and an amount');
        return;
      }
      const sId = uuidv4();
      if (activeButton === "swap") {
        setIsTransacting(true);
        let selectedFunc = "dapp_invoker";

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

        const price = formatValue(
          allTokens?.find((token) => token?.contract === transactingToken)
            ?.price?.selectedPrice || 0
        );

        let type;
        let route;
        if (id === "aqua-amm") {
          type = "swap/AQUA";
          route = "aqua-swap-with-sig";
        } else if (id === "soroswap") {
          type = "swap/SOROSWAP";
          route = "soroswap-swap-with-sig";
        }

        const txDetails = {
          id: activeSession?.userProfile?.userId,
          walletContractId:
            activeSession?.userProfile?.address[selectedNetwork],
          priceOut: price,
          amountOut: dappTokenIn?.amount,

          type: type,
          network: selectedNetwork,
        };

        const tx = await postRequest(
          route,
          {
            contractId: activeSession?.userProfile?.address[selectedNetwork],
            network: selectedNetwork,
            callFunction: selectedFunc,
            sigData: sigData,
            tokenIn: dappTokenIn,
            tokenOut: dappTokenOut,
            swapData: swapChainData,
            txDetails: txDetails,
            sId: sId,
          },
          activeSession?.accessToken
        );

        console.log(tx);

        if (tx) {
          // processEnd("Swap Successful!", tx?.data?.txHash);
        }
      }

      triggerUpdate();
      setDappTokenOut(null);
    } catch (e) {
      console.log("the error is", e);
      if (e?.message) {
        toast.error(e?.message);
      } else {
        toast.error(e);
      }
      setSessionId("");
    }

    // setAmount("");
    setIsTransacting(false);
  }

  async function paySpendHandler() {
    try {
      if (activeButton === "pay") {
        // processStart("Deposit processing...");
        setIsTransacting(true);

        let selectedFunc = loadedSmartWallet?.specs?.find(
          (func) => func.name === "deposit"
        );

        // activeSession?.userProfile?.address

        selectedFunc.inputs[0].value = userKey;
        selectedFunc.inputs[1].value = selectedTransactToken?.address;
        selectedFunc.inputs[2].value = selectedTransactToken?.amount;

        const tx = await postRequest("any-invoke", {
          pubKey: userKey,
          contractId: loadedSmartWallet?.address,
          network: selectedNetwork,
          callFunction: selectedFunc,
          memo: "pay",
        });

        const signedXdr = await signTransaction(tx.xdr, {
          network: selectedNetwork,
        });
        const txDetails = {
          userId: null,
          type: "payment",
          amount: selectedTransactToken?.amount,
          price: prices[selectedTransactToken?.address] || 0,
          token: selectedTransactToken?.address,
          from: userKey,
          address: loadedSmartWallet?.address,
        };

        const submitRes = await postRequest("submit-transaction", {
          signedTx: signedXdr,
          network: selectedNetwork,
          txDetails: txDetails,
        });

        console.log("pay res", submitRes);

        if (submitRes) {
          // processEnd("Payment Successful!", submitRes?.data?.txHash);
        }
      } else if (activeButton === "spend") {
        setIsTransacting(true);

        let selectedFunc = loadedSmartWallet?.specs?.find(
          (func) => func.name === "spend"
        );

        selectedFunc.inputs[0].value = selectedTransactToken?.address;
        selectedFunc.inputs[1].value = userKey;
        selectedFunc.inputs[2].value = selectedTransactToken?.amount;
        selectedFunc.inputs[3].value = recipientSpender;

        const tx = await postRequest("any-invoke", {
          pubKey: userKey,
          contractId: loadedSmartWallet?.address,
          network: selectedNetwork,
          callFunction: selectedFunc,
          memo: "spend",
        });

        const signedXdr = await signTransaction(tx.xdr, {
          network: selectedNetwork,
        });
        const txDetails = {
          userId: null,
          type: "spend",
          amount: selectedTransactToken?.amount,
          price: prices[selectedTransactToken?.address] || 0,
          token: selectedTransactToken?.address,
          to: userKey,
          address: loadedSmartWallet?.address,
        };

        const submitRes = await postRequest("submit-transaction", {
          signedTx: signedXdr,
          network: selectedNetwork,
          txDetails: txDetails,
        });

        console.log("pay res", submitRes);

        if (submitRes) {
          // processEnd("Payment Successful!", submitRes?.data?.txHash);
        }
      }
    } catch (e) {
      console.log(e.message);
    } finally {
      // setSelectedToken("");
      // setAmount("");

      triggerUpdate();
      setIsTransacting(false);
    }
  }

  async function handleGoBack() {
    setLoadedSmartWallet(null);
    setSmartWalletId(null);
  }

  const topStat =
    activeButton === "swap"
      ? {
          name: "Smart Wallet Bal",
          address: loadedSmartWallet?.address,
          balance: {
            value: transactTokenBalance,
            symbol:
              !selectedTransactToken ||
              selectedTransactToken?.symbol === "Enter Token ID"
                ? ""
                : transactingSymbol,
          },
        }
      : null;

  const description =
    activeButton === "pay"
      ? {
          long: "Deposit (pay) tokens into the loaded smart wallet from connected wallet",
          short: "Pay Tokens",
        }
      : activeButton === "spend"
      ? {
          long: "Spend tokens from the loaded smart wallet (up to the pre-approved allowance)",
          short: "Spend Tokens",
        }
      : null;

  return (
    <>
      <div className="grid  grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-5 px-0 mx-auto mt-8 sm:px-6 md:px-8">
        {/* <AquaSwapPage /> */}
        <DappTransact
          isTransacting={isTransacting}
          onGoBack={handleGoBack}
          hasExtra={hasExtra}
          extra={extra}
          isLoading={isTransacting}
          onClickButton={swapBridgeHandler}
          buttonMessage={
            userKey?.length === 0 && needWalletConnect
              ? "Connecting..."
              : "Confirming..."
          }
          onClick={(e) => e.stopPropagation()}
          buttons={buttons}
          description={description}
          topStat={topStat}
        />
      </div>
      <div className="px-0 mx-auto mt-8 sm:px-6 md:px-8">
        {" "}
        <DappTransactionHistory />
      </div>
    </>
  );
}
