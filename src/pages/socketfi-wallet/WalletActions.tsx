// @ts-nocheck
import { Add, Send2 } from "iconsax-react";
import { useNavigate } from "react-router-dom";

export default function WalletActions({ setIsOpenSend }) {
  const navigate = useNavigate();
  const actions = [
    {
      action: "Transfer Tokens",
      status: true,
      icon: "Send2",
      onClick: () => {
        setIsOpenSend(true);
      },
    },
    {
      action: "Swap Tokens",
      status: true,
      icon: "",
      onClick: () => {
        navigate("/dapps");
      },
    },
    { action: "Bridge", status: false, icon: "", onClick: () => {} },
    // { action: "Stake", status: false, icon: "", onClick: () => {} },
    // { action: "Lend", status: false, icon: "", onClick: () => {} },
  ];
  return (
    <div className="flex gap-2 pt-3">
      {actions.map((action, index) => (
        <div key={index}>
          <button
            onClick={action.onClick}
            type="button"
            className={`inline-flex items-center justify-center w-full px-5 py-2 text-sm font-semibold leading-5 text-white transition-all duration-200 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 ${
              action.status
                ? "bg-gray-900 hover:-translate-y-[2px] hover:bg-gray-700"
                : "bg-gray-600 cursor-not-allowed"
            }`}
            disabled={!action.status}
          >
            <svg
              className="w-5 h-5 mr-1"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            {/* <Send2 size="20" className="text-gray-100 mr-1" /> */}
            {action?.action}
          </button>
        </div>
      ))}
    </div>
  );
}
