// @ts-nocheck
import { useStates } from "../../context/StatesContext";

export default function SwapHistory() {
  const { transactionStats, selectedNetwork } = useStates();

  function formatTimestamp(timestamp) {
    // Convert the timestamp to a Date object
    const date = new Date(Number(timestamp));

    // Format the date to the user's local time with day, month, hour, and minute
    const localDate = date.toLocaleString("en-US", {
      year: "numeric", // Year (e.g., "2025")
      month: "long", // Full month name (e.g., "April")
      day: "numeric", // Day of the month (e.g., "10")
      hour: "2-digit", // Hour (e.g., "11")
      minute: "2-digit", // Minute (e.g., "24")
      hour12: true, // 12-hour format (AM/PM)
    });

    return localDate;
  }

  function truncateString(input) {
    const startLength = 8; // Fixed number of characters to keep at the start
    const endLength = 4; // Fixed number of characters to keep at the end
    const mask = "****"; // Fixed mask for the middle part

    // Ensure the input is long enough for truncation
    if (input.length <= startLength + endLength) {
      return input; // Return the original string if it's too short to truncate
    }

    const start = input.slice(0, startLength);
    const end = input.slice(-endLength);

    return `${start} ${mask} ${end}`;
  }

  function openTxInExplorerHandler(txId) {
    // Construct the URL using the provided txId
    const url = `https://stellar.expert/explorer/${selectedNetwork?.toLowerCase()}/tx/${txId}`;

    // Open the URL in a new tab
    window.open(url, "_blank");
  }

  const aquaTxs =
    transactionStats?.transactions?.filter((tx) => tx.type === "swap/AQUA") ||
    [];

  return (
    <div className="overflow-hidden bg-white border border-gray-200 rounded-xl lg:col-span-2">
      <div className="px-4 py-5 sm:p-6">
        <div className="sm:flex sm:items-start sm:justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">
              Aqua Swap History
            </p>
            <p className="mt-1 text-sm font-medium text-gray-500">
              Your 5 most recent transactions are as follows
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {aquaTxs
          ?.reverse()
          ?.slice(0, 5)
          ?.map((tx) => (
            <div
              onClick={() => openTxInExplorerHandler(tx?.txId)}
              key={tx?._id}
              className="grid grid-cols-5 py-1 px-2 cursor-pointer hover:bg-gray-100 gap-y-4 lg:gap-0 "
            >
              {/* <div className="col-span-2 px-4 lg:py-4 sm:px-6 lg:col-span-1">
                <span
                  className={`text-xs font-medium ${
                    tx?.type === "deposit" || tx?.type === "payment"
                      ? "text-green-900 bg-green-100"
                      : tx?.type === "approve"
                      ? "text-cyan-900 bg-cyan-100"
                      : "text-orange-900 bg-orange-100"
                  }  rounded-full inline-flex items-center px-2.5 py-1`}
                >
                  <svg
                    className={`-ml-1 mr-1.5 h-2.5 w-2.5 ${
                      tx?.type === "deposit" || tx?.type === "payment"
                        ? "text-green-500"
                        : tx?.type === "approve"
                        ? "text-cyan-500 "
                        : "text-500-500"
                    }`}
                    fill="currentColor"
                    viewBox="0 0 8 8"
                  >
                    <circle cx="4" cy="4" r="3"></circle>
                  </svg>
                  {tx?.type}
                </span>
              </div> */}

              <div className="px-2 text-right lg:py-4  lg:order-last">
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-8 h-8 text-gray-400 transition-all duration-200 bg-white rounded-full hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                >
                  <svg
                    className="w-4 h-auto ml-2 "
                    viewBox="0 0 49 49"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M33.8328 0L30.2974 3.5444L38.929 12.1859H17.98C8.0549 12.1859 0 20.2475 0 30.1722C0 40.0979 8 48.1684 18 48.1684V43.1685C11 43.1685 5.0001 37.3365 5.0001 30.1677C5.0001 22.9998 10.8221 17.1688 17.9902 17.1688C25.9417 17.1683 30.9282 17.1679 38.9253 17.1673L30.3065 25.784L33.8405 29.3191L48.4955 14.663L33.8328 0Z"
                      fill="#565D64"
                    />
                  </svg>
                </button>
              </div>

              <div className="px-2 lg:py-4 lg:col-span-2">
                <p className="text-sm font-bold text-gray-900">
                  {(!tx?.type.startsWith("swap") && truncateString(tx?.to)) ||
                    truncateString(tx?.from)}
                  {tx?.type.startsWith("swap") &&
                    `${tx?.amount?.toString()?.slice(0, 5)} ${
                      tx?.symbol
                    } -> ${tx?.amountOut?.toString()?.slice(0, 5)} ${
                      tx?.symbolOut
                    }`}
                </p>

                <div className="flex gap-2 items-center">
                  {tx?.type === "send" && (
                    <svg
                      className="h-4 w-auto text-red-500"
                      viewBox="0 0 90 90"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M75.9473 80.8984H14.3262C9.17969 80.8984 5 76.7188 5 71.5723V55.6055H10.8594V71.5723C10.8594 73.4863 12.4121 75.0391 14.3262 75.0391H75.9473C77.8613 75.0391 79.4141 73.4863 79.4141 71.5723V55.6055H85.2734V71.5723C85.2734 76.7188 81.0938 80.8984 75.9473 80.8984Z"
                        fill="currentColor"
                      />
                      <path
                        d="M25.1465 32.373L45.1367 10L65.127 32.373H48.0664V62.2559H42.207V32.373H25.1465Z"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                  {tx?.type === "receive" && (
                    <svg
                      className="h-4 w-auto text-green-700"
                      viewBox="0 0 90 90"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M75.9473 80.8984H14.3262C9.17969 80.8984 5 76.7188 5 71.5723V55.6055H10.8594V71.5723C10.8594 73.4863 12.4121 75.0391 14.3262 75.0391H75.9473C77.8613 75.0391 79.4141 73.4863 79.4141 71.5723V55.6055H85.2734V71.5723C85.2734 76.7188 81.0938 80.8984 75.9473 80.8984Z"
                        fill="currentColor"
                      />
                      <path
                        d="M65.127 39.8828L45.1367 62.2559L25.1465 39.8828H42.207V10H48.0664V39.8828H65.127Z"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                  <p className="mt-1 text-sm font-medium text-gray-500">
                    {tx?.type === "receive" && "Receive from"}
                    {tx?.type === "send" && "Send to"}
                  </p>{" "}
                </div>
              </div>

              <div className="px-2 lg:py-4 lg:col-span-2 ">
                <p className="mt-1 text-sm font-medium text-gray-500">
                  {formatTimestamp(tx?.timestamp)}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
