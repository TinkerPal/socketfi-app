// @ts-nocheck
import { useEffect, useState } from "react";
import { useStates } from "../context/StatesContext";

export default function NetworkSelector() {
  const {
    contractIds,
    selectedTransactToken,
    setSelectedTransactToken,
    allTokens,
    prices,
    triggerUpdate,
    activeButton,

    setTokenList,
    selectedNetwork,
    setSelectedNetwork,
    activeSession,
  } = useStates();

  const networkOptions = ["TESTNET", "PUBLIC"];
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
      <div className="relative w-[125px] flex items-center">
        <div className="absolute inset-y-0 left-2 flex items-center pr-1 pointer-events-none">
          {selectedNetwork === "TESTNET" && (
            <svg
              className={`h-3 w-3 text-red-600`}
              fill="currentColor"
              viewBox="0 0 8 8"
            >
              <circle cx="4" cy="4" r="3"></circle>
            </svg>
          )}
          {selectedNetwork === "PUBLIC" && (
            <svg
              className={`h-3 w-3 text-green-600`}
              fill="currentColor"
              viewBox="0 0 8 8"
            >
              <circle cx="4" cy="4" r="3"></circle>
            </svg>
          )}
        </div>
        <select
          disabled={import.meta.env.VITE_ENV !== "PRODUCTION"}
          className={` block w-full px-4  cursor-pointer   py-1.5 text-xs text-center font-medium  pr-8  placeholder-gray-500 transition-all duration-200 border  rounded-full appearance-none focus:outline-none focus:ring-0 ${
            selectedNetwork === "TESTNET" &&
            " text-red-900 bg-red-200 border-red-500"
          }  ${
            selectedNetwork === "PUBLIC" &&
            " text-green-900 bg-green-200 border-green-600"
          }`}
          id="type-select"
          value={selectedNetwork}
          onChange={(e) => {
            const selected = e.target.value;

            localStorage.setItem("selectedNetwork", selected);

            setSelectedNetwork(selected);
            triggerUpdate();
          }}
        >
          {networkOptions?.map((network) => (
            <option key={network} value={network}>
              {network}
            </option>
          ))}
        </select>

        {/* Custom icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pl-2 pointer-events-none">
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
