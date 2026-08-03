// @ts-nocheck
import { useEffect, useState } from "react";
import Logo from "../assets/sorobuildlogo.svg";
import { Link } from "react-router-dom";
import { ConnectWallet } from "../utils/soroban";

import { useMediaQuery } from "react-responsive";

export default function Header({
  setUserKey,
  setNetwork,
  userKey,
  isWalletInstalled,
  connecting,
  setConnecting,
  openHandler,
}) {
  const isLargeScreen = useMediaQuery({ minWidth: 1024 });
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    setExpanded((prevExpanded) => !prevExpanded);
  };

  useEffect(() => {
    if (isLargeScreen) {
      setExpanded(false);
    }
  }, [isLargeScreen]);

  // async function handleConnect() {
  //   setConnecting(() => true);
  //   await ConnectWallet(setUserKey, setNetwork);
  //   setConnecting(() => false);
  // }

  return (
    <header
      className=" relative py-4 md:py-6 bg-gray-100"
      x-data="{expanded: false}"
    >
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between ">
          <div className="flex-shrink-0">
            <Link
              to="/"
              title=""
              className="flex rounded items-center outline-none   font-bold text-xl gap-1 "
            >
              {/* <img className="w-auto h-10 " src={Logo} alt="" /> */}
              <p>SocketFi</p>
            </Link>
          </div>

          <div className="flex lg:hidden">
            <button
              type="button"
              className="text-black"
              onClick={toggleExpanded}
            >
              {!expanded ? (
                <span aria-hidden="true">
                  <svg
                    className="w-7 h-7"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </span>
              ) : (
                <span aria-hidden="true">
                  <svg
                    className="w-7 h-7"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </span>
              )}
            </button>
          </div>

          {/* <div className="hidden lg:flex lg:ml-16 lg:items-center lg:justify-center lg:space-x-10 xl:space-x-16">
            <Link
              to="/contracts"
              title=""
              className="text-base font-medium  transition-all duration-200 rounded font-pj hover:text-opacity-50"
            >
              {" "}
              Smart Contracts
            </Link>

            <Link
              to="/playground"
              title=""
              className="text-base font-medium  transition-all duration-200 rounded font-pj hover:text-opacity-50 "
            >
              {" "}
              dApp Playground
            </Link>

            <Link
              to="/sorobuild-ui"
              title=""
              className="text-base font-medium  transition-all duration-200 rounded font-pj hover:text-opacity-50 "
            >
              {" "}
              SoroBuild UI
            </Link>
          </div> */}

          <div className="hidden lg:ml-auto lg:flex lg:items-center lg:space-x-10">
            {/* <a
              href="https://docs.sorobuild.io/"
              title=""
              className="text-base font-medium  transition-all duration-200 rounded font-pj hover:text-opacity-50 "
              target="_blank"
            >
              {" "}
              Documentation
            </a> */}

            {!isWalletInstalled ? (
              <a
                href="https://www.freighter.app/"
                className="
                text-center
                        
                            py-2
                            text-base
                            font-semibold
                            leading-7
                           
                            transition-all
                            duration-200
                        
                            border border-gray-900
                            rounded-xl
                            font-pj
                           min-w-[160px]
                           bg-gray-900 text-white

                          
                        "
                target="_blank"
              >
                Install Freighter
              </a>
            ) : connecting ? (
              <div
                className="
                text-center
                        
                            py-2
                            text-base
                            font-semibold
                            leading-7
                           
                            transition-all
                            duration-200
                        
                            border border-gray-900
                            rounded-xl
                            font-pj
                           min-w-[160px]
                           bg-gray-700 text-white

                          
                        "
              >
                Connecting...
              </div>
            ) : userKey?.length > 0 ? (
              <button
                className="
                        
                            py-2
                            text-base
                            font-semibold
                            leading-7
                           
                            transition-all
                            duration-200
                        
                            border border-gray-900
                            rounded-xl
                            font-pj
                           min-w-[160px]
                           bg-gray-900 text-white
                          
                        "
                role="button"
                onClick={openHandler}
              >
                {userKey?.slice(0, 4)}...{userKey?.slice(-4)}
              </button>
            ) : (
              <button
                className="
                      
                            py-2
                            text-base
                            font-semibold
                            leading-7
                            text-gray-900
                            transition-all
                            duration-200
                            bg-transparent
                            border border-gray-900
                            rounded-xl
                            font-pj
                            min-w-[160px]
                            
                            hover:bg-gray-900 hover:text-white
                          
                        "
                role="button"
                onClick={openHandler}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {expanded && (
          <nav x-show="expanded" x-collapse>
            <div className="px-1 py-8">
              <div className="grid gap-y-7">
                <Link
                  onClick={toggleExpanded}
                  to="/contracts"
                  title=""
                  className="flex items-center p-3 -m-3 text-base font-medium text-gray-900 transition-all duration-200 rounded-xl hover:bg-gray-50 font-pj "
                >
                  {" "}
                  Smart Contracts
                </Link>

                <Link
                  onClick={toggleExpanded}
                  to="/playground"
                  title=""
                  className="flex items-center p-3 -m-3 text-base font-medium text-gray-900 transition-all duration-200 rounded-xl hover:bg-gray-50  font-pj "
                >
                  dApp Playground
                </Link>

                <Link
                  onClick={toggleExpanded}
                  to="/sorobuild-ui"
                  title=""
                  className="flex items-center p-3 -m-3 text-base font-medium text-gray-900 transition-all duration-200 rounded-xl hover:bg-gray-50 font-pj "
                >
                  {" "}
                  SoroBuild UI
                </Link>

                <a
                  onClick={toggleExpanded}
                  href="https://docs.sorobuild.io/"
                  title=""
                  className="text-base font-medium  transition-all duration-200 rounded font-pj hover:text-opacity-50 "
                  target="_blank"
                >
                  {" "}
                  Documentation
                </a>

                {!isWalletInstalled ? (
                  <a
                    onClick={toggleExpanded}
                    href="https://www.freighter.app/"
                    className="
                text-center
                        
                            py-2
                            text-base
                            font-semibold
                            leading-7
                           
                            transition-all
                            duration-200
                        
                            border border-gray-900
                            rounded-xl
                            font-pj
                           min-w-[160px]
                           bg-gray-900 text-white

                          
                        "
                    target="_blank"
                  >
                    Install Freighter
                  </a>
                ) : connecting ? (
                  <div
                    className="
                text-center
                        
                            py-2
                            text-base
                            font-semibold
                            leading-7
                           
                            transition-all
                            duration-200
                        
                            border border-gray-900
                            rounded-xl
                            font-pj
                           min-w-[160px]
                           bg-gray-700 text-white

                          
                        "
                  >
                    Connecting...
                  </div>
                ) : userKey?.length > 0 ? (
                  <button
                    className="
                        
                            py-2
                            text-base
                            font-semibold
                            leading-7
                           
                            transition-all
                            duration-200
                        
                            border border-gray-900
                            rounded-xl
                            font-pj
                           min-w-[160px]
                           bg-gray-900 text-white
                          
                        "
                    role="button"
                    onClick={openHandler}
                  >
                    {userKey?.slice(0, 4)}...{userKey?.slice(-4)}
                  </button>
                ) : (
                  <button
                    className="
                      
                            py-2
                            text-base
                            font-semibold
                            leading-7
                            text-gray-900
                            transition-all
                            duration-200
                            bg-transparent
                            border border-gray-900
                            rounded-xl
                            font-pj
                            min-w-[160px]
                            
                            hover:bg-gray-900 hover:text-white
                          
                        "
                    role="button"
                    onClick={openHandler}
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
