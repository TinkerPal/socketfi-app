// @ts-nocheck
export default function Button({
  children,
  onClick = () => {},
  isLoading = false,
  message = "Onboard",
  disable = null,
  noBackground = false,
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
        className={`${
          noBackground
            ? "bg-transparent  border-gray-900 text-gray-900 hover:bg-gray-200"
            : "bg-slate-900 hover:bg-black text-white border-transparent "
        } inline-flex items-center justify-center w-full px-4 py-3   text-base font-semibold  transition-all duration-200  border  rounded-full  focus:outline-none  ${
          disable && "bg-opacity-75 bg-slate-500"
        }`}
      >
        {isLoading ? <LoadingDisplay message={message} /> : children}
      </button>
    </>
  );
}
