// @ts-nocheck
import { useEffect, useState } from "react";
import { useStates } from "../context/StatesContext";

export default function SelectTransactToken() {
  const {
    contractIds,
    selectedTransactToken,
    setSelectedTransactToken,
    allTokens,
    prices,
    triggerUpdate,
    activeButton,
    tokenList,
    setTokenList,
    selectedNetwork,
  } = useStates();

  useEffect(() => {
    async function updateTokenList() {
      try {
        const whitelistedTokens = contractIds.TOKENS[selectedNetwork].map(
          (token) => ({
            ...token,
            price: prices?.[token?.address] || "0",
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

    updateTokenList();
  }, [prices, allTokens, activeButton, selectedNetwork, tokenList?.length > 0]);

  return (
    <div className="">
      <div className="relative w-[200px]">
        <select
          className="block w-full px-4 py-3 pr-8 text-black placeholder-gray-500 transition-all duration-200 bg-white border border-gray-200 rounded-md focus:outline-none focus:border-blue-600 appearance-none"
          id="type-select"
          value={selectedTransactToken?.symbol}
          onChange={(e) => {
            const selectedSymbol = e.target.value;

            const matchingToken = tokenList?.find(
              (token) => token.symbol === selectedSymbol
            );

            setSelectedTransactToken(matchingToken);
          }}
        >
          {tokenList?.map((token) => (
            <option key={token?.symbol} value={token?.symbol}>
              {token?.symbol}
            </option>
          ))}
        </select>

        {/* Custom icon */}
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
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
