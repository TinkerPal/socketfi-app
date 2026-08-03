// @ts-nocheck
export default function Button2({
  children,
  onClick = () => {},
  isLoading = false,
  message = "Onboard",
  disable = "",
}) {
  function LoadingDisplay({ message }) {
    return (
      <div className="flex items-center gap-2">
        <div className="">
          <svg
            className="w-5  h-auto mx-auto text-gray-300 animate-spin "
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
        </div>
        <div className="">{message}</div>{" "}
      </div>
    );
  }
  return (
    <>
      <button
        disabled={disable}
        onClick={onClick}
        className="inline-flex items-center justify-center w-full px-6 py-3 text-sm font-semibold leading-5 text-white transition-all duration-200 bg-gray-900 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2  hover:bg-gray-700"
      >
        {isLoading ? <LoadingDisplay message={message} /> : children}
      </button>
      {/* <button
        className={`inline-flex items-center justify-center w-full px-4 py-3   text-base font-semibold text-white transition-all duration-200  border border-transparent rounded-full  focus:outline-none  ${
          disable ? "bg-opacity-75 bg-slate-500" : "bg-slate-900 hover:bg-black"
        }`}
      >
        {isLoading ? <LoadingDisplay message={message} /> : children}
      </button> */}
    </>
  );
}
