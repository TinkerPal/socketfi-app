// @ts-nocheck
import { useStates } from "../../context/StatesContext";

import { useEffect, useState } from "react";

import LoadSmartWallet from "../../components/LoadSmartWallet";

export default function WalletAccessLanding() {
  const {
    loadedSmartWallet,
    userKey,
    openHandler,
    setLoadedSmartWallet,
    activeButton,
    setActiveButton,
  } = useStates();

  const [isTransacting] = useState(false);
  const [hasExtra, setHasExtra] = useState(false);

  console.log("the loaded smart wallet", loadedSmartWallet);

  useEffect(() => {
    setLoadedSmartWallet(null);
  }, []);

  const buttons = [
    {
      id: "pay",
      name: "Pay Tokens",
      onClick: () => {
        setActiveButton("pay");
        setHasExtra(false);
      },
    },
    {
      id: "spend",
      name: "Spend Tokens",
      onClick: () => {
        setActiveButton("spend");
        setHasExtra(true);
      },
    },
  ];

  return (
    <div className="pt-6 px-0 mx-auto mt-0 sm:px-6 md:px-8">
      <div className="mx-auto flex flex-col lg:flex-row gap-4 ">
        <div className="max-w-4xl">
          <h1 className="text-lg font-bold mb-6 text-gray-900">
            {" "}
            Load SocketFi Smart Wallet
          </h1>
          <p className="mt-2 text-sm font-medium leading-6 text-gray-500">
            Load any SocketFi smart wallet here and interact with it. From your
            connected external wallet, you can make token payments to the wallet
            or spend tokens from the wallet within the allowance amount approved
            by the owner.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-7 ">
        {/* Start here */}

        <LoadSmartWallet
          isLoading={isTransacting}
          onClickButton={userKey?.length === 0 && openHandler}
          buttonMessage={
            userKey?.length === 0 ? "Connecting..." : "Confirming..."
          }
          activeButton={activeButton}
          buttons={buttons}
        />

        {/* <AllowanceBanner /> */}
      </div>
    </div>
  );
}
