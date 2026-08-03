// @ts-nocheck
import { useEffect, useState } from "react";
import { useStates } from "../context/StatesContext";

export default function DappTokenSelectorTrigger({ which = "from" }) {
  const {
    contractIds,
    setSelectedTransactToken,
    allTokens,
    prices,
    activeButton,
    filteredTokens,
    setTokenList,
    selectedNetwork,

    setSwapDappTokenSelectorIsOpen,
    dappTokenIn,
    setDappTokenIn,
    dappTokenOut,

    setToOrFrom,
  } = useStates();

  useEffect(() => {
    async function updateTokenList() {
      try {
        const whitelistedTokens = contractIds.TOKENS[selectedNetwork].map(
          (token) => ({
            ...token,
            price: prices[token?.address] || "0",
          })
        );

        const tokenMap = new Map();

        // Add all existing tokens
        allTokens.forEach((token) => {
          tokenMap.set(token?.address, token);
        });

        // Add only new tokens from whitelist
        whitelistedTokens.forEach((token) => {
          if (!tokenMap.has(token?.address)) {
            tokenMap.set(token?.address, token);
          }
        });

        const tokenList =
          activeButton === "deposit" || activeButton === "pay"
            ? Array.from(tokenMap.values())
            : allTokens;

        setTokenList(tokenList);

        if (tokenList.length > 0) {
          setSelectedTransactToken(tokenList[0]);
          const defaultIn = filteredTokens.find(
            (asset) => asset?.contract === tokenList[0]?.address
          );
          setDappTokenIn(defaultIn);
        } else {
          setSelectedTransactToken(null);
        }
      } catch (e) {
        console.log(e);
      }
    }

    if (prices) {
      updateTokenList();
    }
  }, [prices, allTokens, activeButton]);

  return (
    <div className="">
      <div
        onClick={() => {
          setSwapDappTokenSelectorIsOpen(true);
          setToOrFrom(which);
        }}
        className="relative pl-2 cursor-pointer justify-start bg-gray-100 border border-gray-300 rounded-md   inline-flex items-center"
      >
        {/* <div className=" flex items-center  w-full ">
          {" "}
          <div className="absolute inset-y-0 left-2 flex items-center pr-1 pointer-events-none">
            {which === "from" && dappTokenIn && (
              <img
                className={`h-[22px] w-[22px] text-gray-500`}
                src={dappTokenIn?.icon}
              />
            )}
            {which === "to" && dappTokenOut && (
              <img
                className={`h-[22px] w-[22px]  text-gray-500`}
                src={dappTokenOut?.icon}
              />
            )}
          </div>
          <button
            onClick={() => {
              setSwapDappTokenSelectorIsOpen(true);
              setToOrFrom(which);
            }}
            className={`block w-full px-4    py-1.5 text-md text-center font-medium  pr-8  placeholder-gray-500 transition-all duration-200 border  rounded-md appearance-none focus:outline-none focus:ring-0 focus:border-gray-300 text-gray-900 bg-gray-100 border-gray-300
            `}
            id="type-select"
          >
            {which === "from" && dappTokenIn?.code}
            <span className="pl-2">
              {which === "to" && (dappTokenOut ? dappTokenOut?.code : "Select")}
            </span>
          </button>
        </div> */}

        <div className="flex items-center gap-0     ">
          <div className="flex items-center pointer-events-none">
            {which === "from" && dappTokenIn && (
              <img
                className="h-[22px] w-[22px] text-gray-500"
                src={dappTokenIn?.icon}
              />
            )}
            {which === "to" && dappTokenOut && (
              <img
                className="h-[22px] w-[22px] text-gray-500"
                src={dappTokenOut?.icon}
              />
            )}
          </div>

          <div
            className="px-2 py-1.5 text-md text-center font-medium pr-3 placeholder-gray-500 transition-all duration-200  appearance-none focus:outline-none focus:ring-0 focus:border-gray-300 text-gray-900 "
            id="type-select"
          >
            {which === "from" && dappTokenIn?.code}
            <span className="pl-2">
              {which === "to" && (dappTokenOut ? dappTokenOut?.code : "Select")}
            </span>
          </div>
        </div>

        {/* Custom icon */}
        <div className=" flex  items-center pl-2 pointer-events-none">
          <svg
            className="w-10 h-auto text-gray-900"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 12l-3-3h6l-3 3z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
