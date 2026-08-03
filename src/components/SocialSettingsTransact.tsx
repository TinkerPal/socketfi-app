// @ts-nocheck
import { Back, CloseCircle } from "iconsax-react";
import Button from "./Button";
import { useStates } from "../context/StatesContext";

export default function SocialSettingsTransact({
  description = null,
  defaultDescription = "Social Acount Binding",

  onCloseModal = () => {},
  isLoading,
  onClickButton,
  inputParams,
  setInputParams,
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="overflow-hidden w-full sm:w-3/4   bg-white border border-gray-200 rounded-xl lg:col-span-7 relative px-0 mx-auto mt-0 sm:px-6 md:px-8 lg:mt-6 "
    >
      <main>
        <div className="">
          <div className="px-4 pt-5 sm:px-6 pb-3 ">
            <div className="px-3 py-2 bg-white  items-center flex justify-between  ">
              <div>
                <p className=" text-xl font-semibold text-gray-900">
                  {description === null
                    ? defaultDescription
                    : description?.long}
                </p>
              </div>

              <CloseCircle
                onClick={onCloseModal}
                className="text-gray-700 cursor-pointer h-7 w-auto absolute  right-4 top-4"
              />

              {/* Other content here */}
            </div>
            <div className="my-2 px-4 text-gray-700">
              Social media binding unlocks intent-based interactions with your
              wallet—enabling seamless actions across platforms.
            </div>

            <div className="mt-2 bg-white border border-gray-200 rounded-xl">
              <div className="px-4">
                <div className="grid grid-cols-1 lg:grid-cols-7 lg:gap-x-24 gap-y-8">
                  <div className="lg:col-span-7   ">
                    <div className="p-4 ">
                      <div className="flex items-center ">
                        <div>
                          <span className="hidden">
                            <svg
                              className="w-6 h-6 text-gray-300"
                              viewBox="0 0 22 22"
                              fill="none"
                              stroke="currentColor"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle
                                cx="11"
                                cy="11"
                                r="10.25"
                                strokeWidth="1.5"
                              />
                            </svg>
                          </span>

                          <div className="w-6 h-6 rounded-full  bg-black flex items-center justify-center ">
                            <svg
                              className="w-4 h-4 text-white"
                              viewBox="0 0 140 140"
                              fill="currentColor"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M87.4974 70.0026L116.664 46.6693L87.4974 23.3359V40.8301H11.6641V52.4968H87.4974V70.0026ZM128.331 87.5026H52.4974V70.0026L23.3307 93.3359L52.4974 116.669V99.1693H128.331V87.5026Z"
                                fill="currentColor"
                              />
                            </svg>

                            {/* <svg
                              className="w-6 h-6"
                              viewBox="0 0 22 22"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle
                                cx="11"
                                cy="11"
                                r="11"
                                fill="#18181B"
                              />
                              <path
                                d="M6.91699 11.5833L9.25033 13.9166L15.0837 8.08331"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg> */}
                          </div>
                        </div>

                        <div className="ml-4">
                          <p className="text-base font-bold text-gray-900">
                            Enter Email
                          </p>
                          {/* <p className="mt-1 text-sm font-medium text-gray-500">
                            Visa, Mastercard, American Amex
                          </p> */}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 mt-5 sm:grid-cols-4 gap-x-6 gap-y-5">
                        <div className="col-span-4 ">
                          <label className="text-sm font-medium text-gray-600">
                            {" "}
                            {description?.button}
                          </label>
                          <div className="mt-2 ">
                            <input
                              onChange={(e) => {
                                const value = e.target.value;

                                setInputParams(value);
                              }}
                              type="text"
                              name=""
                              id=""
                              value={inputParams || ""}
                              placeholder={description?.placeholder}
                              className="block w-full px-4 py-3 text-sm font-normal text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-md caret-gray-900 focus:ring-gray-900 focus:border-gray-900"
                            />
                          </div>
                        </div>

                        <div className="col-span-4 flex w-full flex-col justify-end">
                          <Button isLoading={isLoading} onClick={onClickButton}>
                            Continue
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
