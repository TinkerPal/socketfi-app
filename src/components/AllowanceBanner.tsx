// @ts-nocheck
import { useStates } from "../context/StatesContext";
import { bStroopToXlm } from "../utils/soroban";

export default function AllowanceBanner() {
  const { allAllowance, userKey } = useStates();
  return (
    <div className="relative lg:col-span-2 flex  h-full">
      <div className="absolute -inset-2">
        <div
          className="w-full h-full mx-auto rotate-180 opacity-30 blur-lg filter"
          style={{
            background:
              "linear-gradient(90deg, #44ff9a -0.55%, #44b0ff 22.86%, #8b44ff 48.36%, #ff6644 73.33%, #ebff70 99.34%)",
          }}
        ></div>
      </div>
      <div className="relative lg:col-span-2    flex  flex-col w-full overflow-hidden transition-all duration-200 transform border border-gray-100 shadow bg-white group rounded-xl hover:shadow-lg hover:-translate-y-1">
        <div className=" px-4 py-5 sm:p-6">
          <a href="#" title="" className="">
            <p className="text-lg font-bold text-gray-900">
              SocketFi Access Portal
            </p>
            <p className="mt-3 text-sm font-normal leading-6 text-gray-500 line-clamp-3">
              Interact and transact seamlessly with loaded smart wallets using
              your connected external wallet.
            </p>
          </a>
        </div>
        <>
          {" "}
          <div className="  relative bg px-4 py-4 mt-auto border-t border-gray-100 sm:px-6">
            <div className=" mb-3">
              <a href="#" title="" className="">
                <p className="text-lg font-bold text-gray-900">
                  Connected Wallet
                </p>
                <p className="mt-3 text-sm font-normal leading-6 text-gray-500 line-clamp-3">
                  {userKey !== "" &&
                    `${userKey.slice(0, 10)}**********${userKey.slice(-10)}`}
                </p>
              </a>
            </div>
          </div>
          <div className="  flex-1 relative bg px-4 py-4 mt-auto border-t border-gray-100 sm:px-6">
            <div className=" mb-3">
              <a href="#" title="" className="">
                <p className="text-lg font-bold text-gray-900">
                  Current allowances
                </p>
                <p className="mt-3 text-sm font-normal leading-6 text-gray-500 line-clamp-3">
                  Your spending allowance from the loaded smart wallet are:
                </p>
              </a>
            </div>
            {allAllowance?.map((allowance) => (
              <div
                key={allowance?.address}
                className="flex cursor-pointer hover:bg-gray-100 p-2 rounded-sm items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-gray-900">
                    <a href="#" title="" className="">
                      {bStroopToXlm(allowance?.allowance)}
                    </a>
                  </p>

                  <p className="text-sm font-medium text-gray-900">
                    <a href="#" title="" className="">
                      {allowance?.symbol}
                    </a>
                  </p>
                </div>
                <a href="#" title="" className="" role="button">
                  <svg
                    className="w-5 h-5 text-gray-300 transition-all duration-200 group-hover:text-gray-900"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <line x1="17" y1="7" x2="7" y2="17"></line>
                    <polyline points="8 7 17 7 17 16"></polyline>
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </>
      </div>
    </div>
  );
}
