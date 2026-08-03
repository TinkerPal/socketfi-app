// @ts-nocheck
import { Add, CloseCircle } from "iconsax-react";
import React, { useEffect, useState } from "react";
import { useStates } from "../../context/StatesContext";
import { curatedList } from "../../utils/curated-asset-list";
// import { X } from "lucide-react";

export default function TokenFinderModal({
  onClose = () => {},
  onSelect = () => {},
}) {
  const [search, setSearch] = useState("");

  const [displayTokenList, setDisplayTokenList] = useState(null);
  const {
    swapDappTokenSelectorIsOpen,
    setSwapDappTokenSelectorIsOpen,

    dappTokenIn,
    setDappTokenIn,
    dappTokenOut,
    setDappTokenOut,
    toOrFrom,
    setToOrFrom,
    allTokens,
    selectedTransactToken,
    setSelectedTransactToken,
    activeButton,
    filteredTokens,
    setFilteredTokens,
    path,
    show,
    showTokenFinder,
    setShowTokenFinder,
  } = useStates();

  const fieldsToSearch = [
    "code",
    "issuer",
    "contract",
    "name",
    "org",
    "domain",
  ];

  useEffect(() => {
    if (!search.trim()) {
      // If search is empty or only whitespace, set an empty array
      setDisplayTokenList([]);
      return;
    }

    const result = filteredTokens?.filter((value) =>
      fieldsToSearch.some((field) =>
        value[field]?.toLowerCase().includes(search.toLowerCase())
      )
    );

    setDisplayTokenList(result);
  }, [search, curatedList, filteredTokens, path]);

  useEffect(() => {
    const result = curatedList?.filter((value) => {
      const matchesSearch = fieldsToSearch.some((field) =>
        value[field]?.toLowerCase().includes(search.toLowerCase())
      );
      const isNotAlreadySelected =
        value.contract !== dappTokenIn?.contract &&
        value.contract !== dappTokenOut?.contract;

      return matchesSearch && isNotAlreadySelected;
    });

    // setFilteredTokens(result);
  }, [search, curatedList, dappTokenIn, dappTokenOut]);

  async function handleTokenSelection(id) {
    const selectedToken = filteredTokens?.find(
      (token) => token?.contract === id
    );

    // console.log("what is toOrFrom ", toOrFrom);
    const txToken = allTokens?.find((token) => token?.address === id);

    if (toOrFrom === "from") {
      setDappTokenIn(selectedToken);
      setSelectedTransactToken(txToken);
    } else if (toOrFrom === "to") {
      setDappTokenOut(selectedToken);
    }

    setSwapDappTokenSelectorIsOpen(false);

    setSearch("");
  }

  if (!showTokenFinder) return null;

  return (
    <div
      className="pt-32 fixed inset-0 z-50 bg-gray-400 lg:pt-60 bg-opacity-40 flex  justify-center "
      onClick={() => setShowTokenFinder(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#2f184b] w-[95%] max-w-lg rounded-xl p-6 absolute"
      >
        <button
          onClick={() => setShowTokenFinder(false)}
          className="absolute top-4 right-4 text-white dark:text-white"
        >
          <CloseCircle className="h-5 w-auto text-gray-700" />
        </button>
        <h2 className="text-2xl font-normal mb-4 text-indigo-700 dark:text-white">
          Search for asset or token
        </h2>
        <div className="">
          {" "}
          <input
            type="text"
            placeholder="Search asset or enter home domain"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-2 mb-4 rounded-md border border-gray-300 focus:outline-none"
          />
          <div className="max-h-72 overflow-y-auto pr-2">
            {displayTokenList?.map((token) => (
              <div
                key={token?.contract}
                className="flex items-center justify-between     rounded-md "
                // onClick={() => {
                //   handleTokenSelection(token?.contract);
                // }}
              >
                <div className="flex items-center gap-3 p-3">
                  {" "}
                  <img
                    src={token?.icon}
                    alt={token?.code}
                    className="w-6 h-6"
                  />
                  <div>
                    <div className="font-medium text-purple-900 dark:text-white">
                      {token.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-300">
                      {token.domain}
                    </div>
                  </div>
                </div>

                {false ? (
                  <Add className="cursor-pointer text-gray-700 h-6 w-auto" />
                ) : (
                  <svg
                    className="cursor-pointer text-gray-700 h-4 w-auto"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M18.24 16L26.08 8.16C26.3721 7.86194 26.5348 7.46064 26.5327 7.04332C26.5306 6.62599 26.3638 6.22636 26.0687 5.93126C25.7736 5.63616 25.374 5.46944 24.9567 5.46734C24.5394 5.46523 24.1381 5.6279 23.84 5.92L16 13.76L8.16 5.92C7.86194 5.6279 7.46064 5.46523 7.04332 5.46734C6.62599 5.46944 6.22636 5.63616 5.93126 5.93126C5.63616 6.22636 5.46944 6.62599 5.46734 7.04332C5.46523 7.46064 5.6279 7.86194 5.92 8.16L13.76 16L5.92 23.84C5.6279 24.1381 5.46523 24.5394 5.46734 24.9567C5.46944 25.374 5.63616 25.7736 5.93126 26.0687C6.22636 26.3638 6.62599 26.5306 7.04332 26.5327C7.46064 26.5348 7.86194 26.3721 8.16 26.08L16 18.24L23.84 26.08C24.1381 26.3721 24.5394 26.5348 24.9567 26.5327C25.374 26.5306 25.7736 26.3638 26.0687 26.0687C26.3638 25.7736 26.5306 25.374 26.5327 24.9567C26.5348 24.5394 26.3721 24.1381 26.08 23.84L18.24 16Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
