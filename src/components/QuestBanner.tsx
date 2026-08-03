// @ts-nocheck
import React from "react";

export default function QuestBanner() {
  return (
    <div className="relative lg:col-span-2">
      <div className="absolute -inset-2">
        <div
          className="w-full h-full mx-auto rotate-180 opacity-30 blur-lg filter"
          style={{
            background:
              "linear-gradient(90deg, #44ff9a -0.55%, #44b0ff 22.86%, #8b44ff 48.36%, #ff6644 73.33%, #ebff70 99.34%)",
          }}
        ></div>
      </div>

      <div className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl">
        <div className="p-6 md:p-8">
          <p className="text-lg font-bold text-gray-900 font-pj">
            {" "}
            User-Friendly dApp Hub
          </p>
          <p className="mt-4 text-base font-normal leading-7 text-gray-600 font-pj">
            Seamless access multiple dApps from a single platform. Enjoy gasless
            interactions with dApps, eliminating the need to pay gas fees in
            native tokens.
          </p>
          <p className="mt-1 text-lg font-bold text-gray-900 font-pj">tags</p>

          <a
            href="#"
            title=""
            className="
                                  relative
                                  inline-flex
                                  items-center
                                  justify-center
                                  px-8
                                  py-3.5
                                  mt-5
                                  text-base
                                  font-bold
                                  text-white
                                  transition-all
                                  duration-200
                                  bg-gray-900
                                  border border-transparent
                                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900
                                  font-pj
                                  hover:bg-opacity-90
                                  rounded-xl
                              "
            role="button"
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
    // <div className="overflow-hidden w-full bg-white border border-gray-200 rounded-2xl lg:col-span-2">
    //   <div className="p-6 md:p-10">
    //     <p className="text-lg font-bold text-gray-900 font-pj">
    //       User-Friendly dApp Hub
    //     </p>
    //     <p className="mt-4 text-base font-normal leading-7 text-gray-600 font-pj">
    //       Seamless access multiple dApps from a single platform. Enjoy gasless
    //       interactions with dApps, eliminating the need to pay gas fees in
    //       native tokens.
    //     </p>
    //     <div className="flex gap-2 mt-8">
    //       <p className=" text-xl font-bold text-gray-900 font-pj">
    //         social login
    //       </p>
    //       <p className="text-xl font-bold text-gray-900 font-pj">$228/year</p>
    //     </div>
    //     <a
    //       href="#"
    //       title=""
    //       className="
    //                       inline-flex
    //                       items-center
    //                       justify-center
    //                       px-8
    //                       py-3.5
    //                       mt-10
    //                       text-base
    //                       font-bold
    //                       text-gray-900
    //                       transition-all
    //                       duration-200
    //                       border-2 border-gray-400
    //                       rounded-xl
    //                       font-pj
    //                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900
    //                       hover:bg-gray-900
    //                       focus:bg-gray-900
    //                       hover:text-white
    //                       focus:text-white
    //                       hover:border-gray-900
    //                       focus:border-gray-900
    //                   "
    //       role="button"
    //     >
    //       Learn more
    //     </a>
    //   </div>
    // </div>
  );
}
