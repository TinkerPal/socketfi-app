// @ts-nocheck
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  findSwapPath,
  fromBaseUnits,
  getRequest,
  postRequest,
  toBaseUnits,
} from "../utils/fetch-functions";
import { getAuthSession, removeAuthSession } from "../utils/localStorage";
import { clearAccountStore, getAccounts } from "../utils/localStorage";
import contractIds from "../utils/contract-ids.json";

import { bStroopToXlm } from "../utils/soroban";
import { v4 as uuidv4 } from "uuid";
import { useLocation } from "react-router-dom";

import { toast } from "sonner";
import { curatedList } from "../utils/curated-asset-list";
import { formatPortfolio } from "../utils/helper-functions";
// import { SOCKETFI_NETWORK } from "../config/tenant.config";

import {
  SOCKETFI_NETWORK,
  socketFiTenant,
  type SocketFiNetwork,
} from "../config/tenant.config";

export type SocketFiNetwork = "TESTNET" | "PUBLIC";

export interface SocketFiUserProfile {
  username?: string;
  userId?: string;
  network?: SocketFiNetwork;
  address?: Partial<Record<SocketFiNetwork, string>>;
  [key: string]: unknown;
}

export interface SocketFiAuthSession {
  accessToken?: string;
  dateExpire?: string | number;
  userProfile?: SocketFiUserProfile;
  [key: string]: unknown;
}

export interface WalletToken {
  id?: string;
  address?: string;
  contract?: string;
  symbol?: string;
  code?: string;
  name?: string;
  icon?: string;
  amount?: string;
  balance?: string | number | bigint;
  decimals?: string | number;
  price?: {
    selectedPrice?: string | number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface WalletAction {
  id: string;
  name: string;
  type?: string;
  onClick: () => void;
}

export interface PortfolioDetail {
  total?: string;
  values?: Record<string, string>;
  portfolio?: Record<string, string>;
}

export interface TransactionStats {
  count?: number;
  totalVolume?: number;
  points?: number;
  [key: string]: unknown;
}

export interface ProcessProgress {
  message: string;
  txId: string;
  isDone: boolean;
}

export interface StatesContextValue {
  activeSession: SocketFiAuthSession | null;
  setActiveSession: Dispatch<SetStateAction<SocketFiAuthSession | null>>;

  evmWalletIsOpen: boolean;
  setEvmWalletIsOpen: React.Dispatch<React.SetStateAction<boolean>>;

  loginIsOpen: boolean;
  setLoginIsOpen: Dispatch<SetStateAction<boolean>>;
  updateData: number;
  setLoginIsOpen: Dispatch<SetStateAction<number>>;

  walletKitIsOpen: boolean;
  setWalletKitIsOpen: Dispatch<SetStateAction<boolean>>;

  selectedNetwork: SocketFiNetwork;
  setSelectedNetwork: Dispatch<SetStateAction<SocketFiNetwork>>;

  sessionId: string;
  setSessionId: Dispatch<SetStateAction<string>>;

  userKey: string;
  setUserKey: Dispatch<SetStateAction<string>>;

  network: string;
  setNetwork: Dispatch<SetStateAction<string>>;

  evmConnectionOrigin: string;
  setEvmConnectionOrigin: Dispatch<SetStateAction<string>>;

  allTokens: WalletToken[];
  setAllTokens: Dispatch<SetStateAction<WalletToken[]>>;

  selectedTransactToken: WalletToken | null;
  setSelectedTransactToken: Dispatch<SetStateAction<WalletToken | null>>;

  dappTokenIn: WalletToken | null;
  setDappTokenIn: Dispatch<SetStateAction<WalletToken | null>>;

  dappTokenOut: WalletToken | null;
  setDappTokenOut: Dispatch<SetStateAction<WalletToken | null>>;

  filteredTokens: WalletToken[];
  setFilteredTokens: Dispatch<SetStateAction<WalletToken[]>>;

  buttons: WalletAction[];
  portfolioDetail: PortfolioDetail;

  transactionStats: TransactionStats | null;
  setTransactionStats: Dispatch<SetStateAction<TransactionStats | null>>;

  isOpenSend: boolean;
  setIsOpenSend: Dispatch<SetStateAction<boolean>>;

  isFetching: boolean;
  setIsFetching: Dispatch<SetStateAction<boolean>>;

  isFetchingAmountOut: boolean;
  setIsFetchingAmountOut: Dispatch<SetStateAction<boolean>>;

  processProgress: ProcessProgress;
  setProcessProgress: Dispatch<SetStateAction<ProcessProgress>>;

  getSavedAccount: () => void;
  updateSession: () => void;
  triggerUpdate: () => void;
  loginOpenHandler: () => void;
  openHandler: () => void;
  onCloseSend: () => void;
  processEnd: (message: string, txId: string) => void;
  buttonSwitchHandler: (id: string) => void;

  setSessionId: Dispatch<SetStateAction<string>>;
  tenant: SocketFiTenant;

  /*
   * The context still exposes many legacy values while the app is migrated
   * file by file. Declaring an index signature keeps those consumers working,
   * while the important authentication and wallet fields above remain typed.
   */
  [key: string]: any;
}

const StatesContext = createContext<StatesContextValue | undefined>(undefined);
// export const BASE_URL =
//   import.meta.env.VITE_ENV === "PRODUCTION"
//     ? "https://server.socket.fi"
//     : "http://localhost:3200";
export const BASE_URL = import.meta.env.VITE_SOCKETFI_DIRECT_API_URL;

export function StatesProvider({ children }: { children: ReactNode }) {
  const [isFetching, setIsFetching] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [txNetwork, setTxNetwork] = useState("");
  const [savedLoginList, setSavedLoginList] = useState([]);
  const [activeSession, setActiveSession] =
    useState<SocketFiAuthSession | null>(null);
  const [loginIsOpen, setLoginIsOpen] = useState(false);
  const [walletFunctions, setWalletFunctions] = useState([]);
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [loadedSmartWallet, setLoadedSmartWallet] = useState(null);
  const [socialIds, setSocialIds] = useState([]);
  const [prices, setPrices] = useState(null);
  const [filteredTokens, setFilteredTokens] = useState(curatedList);
  const [transactTokenBalance, setTransactTokenBalance] = useState("");
  const [versionInfo, setVersionInfo] = useState(null);

  const [swapChainData, setSwapChainData] = useState(null);
  const [evmConnectionOrigin, setEvmConnectionOrigin] = useState("signup");
  const [isFetchingAmountOut, setIsFetchingAmountOut] = useState(false);

  const [walletKitIsOpen, setWalletKitIsOpen] = useState(false);
  const [evmWalletIsOpen, setEvmWalletIsOpen] = useState(false);

  const [selectedNetwork, setSelectedNetworkState] =
    useState<SocketFiNetwork>(SOCKETFI_NETWORK);
  const [showTokenFinder, setShowTokenFinder] = useState(true);
  const [feeQouteData, setFeeQouteData] = useState(null);

  const selectedNetworkActive =
    activeSession?.userProfile?.address?.[selectedNetwork];

  useEffect(() => {
    setSelectedNetworkState(SOCKETFI_NETWORK);

    localStorage.removeItem("selectedNetwork");
  }, []);

  const setSelectedNetwork = (network: SocketFiNetwork) => {
    if (network !== SOCKETFI_NETWORK) {
      console.warn(
        `[tenant] Ignoring network change to ${network}. This deployment is locked to ${SOCKETFI_NETWORK}.`
      );

      return;
    }

    setSelectedNetworkState(SOCKETFI_NETWORK);
  };

  const [swapDappTokenSelectorIsOpen, setSwapDappTokenSelectorIsOpen] =
    useState(false);

  const [transactionStats, setTransactionStats] =
    useState<TransactionStats | null>(null);

  const [allAllowance, setAllAllowance] = useState(null);

  const [update, setUpdate] = useState(0);
  const [isOpenSend, setIsOpenSend] = useState(false);
  const [allTokens, setAllTokens] = useState<WalletToken[]>([]);
  const [isWalletInstalled, setIsWalletInstalled] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [connectedWalletBalance, setConnectedWalletBalance] = useState(null);
  const [recipientSpender, setRecipientSpender] = useState("");
  const [activeButton, setActiveButton] = useState("");
  const [smartWalletId, setSmartWalletId] = useState(null);

  const [toOrFrom, setToOrFrom] = useState("");
  const [sessionId, setSessionId] = useState("");

  const [dappTokenIn, setDappTokenIn] = useState("");
  const [dappTokenOut, setDappTokenOut] = useState("");
  const [hasExtra, setHasExtra] = useState(false);
  const [extra, setExtra] = useState({
    name: "Connected Wallet",
    onChange: (e) => setRecipientSpender(e.target.value),
  });

  const [dataUpdate, setDataUpdate] = useState("");
  const [processProgress, setProcessProgress] = useState({
    message: "",
    txId: "",
    isDone: false,
  });

  const [selectedTransactToken, setSelectedTransactToken] = useState({
    symbol: "",
    address: "",
    amount: "",
  });

  const [selectedDapp, setSelectedDapp] = useState(null);
  const [accountSettings, setAccountSettings] = useState(null);

  const [updateData, setUpdateData] = useState(0);
  const path = useLocation().pathname;

  const [token, setToken] = useState(localStorage.getItem("accessToken"));
  const [userKey, setUserKey] = useState("");
  const [network, setNetwork] = useState("FUTURENET");
  const [userProfile, setUserProfile] = useState(null);
  const isLogin = token !== "undefined" && token?.length > 0;
  const [newLogin, setNewLogin] = useState(true);
  const [needWalletConnect, setNeedWalletConnect] = useState(true);
  const [tokenList, setTokenList] = useState([]);

  const supportedDapps = [
    {
      id: "aqua-amm",
      slug: "aquarius",
      name: "Aquarius",
      subtitle: "Liquidity and asset swaps",
      category: "DEX & Liquidity",
      defaultAction: "swap",
      contractId: "",
      contract: "CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK",
      description:
        "Swap Stellar assets, explore liquidity pools, and manage liquidity through Aquarius using your SocketFi smart account.",
      status: "live",
      imgUrl: "/aquaamm.png",
      trigger: selectedNetwork === "TESTNET",
      statusMessage:
        "Aquarius is currently available on the Stellar Public Network. Switch to the Public Network to continue.",
    },
    {
      id: "blend",
      slug: "blend",
      name: "Blend",
      subtitle: "Decentralized lending markets",
      category: "Lending",
      defaultAction: "supply",
      contractId: "",
      contract: "",
      description:
        "Explore Blend lending pools, supply collateral, borrow assets, repay loans, and manage your positions through SocketFi.",
      status: "live",
      imgUrl: "/blend.png",
      trigger: selectedNetwork === "TESTNET",
      statusMessage:
        "Blend is currently available on the Stellar Public Network. Switch to the Public Network to continue.",
    },
    {
      id: "soroswap",
      slug: "soroswap",
      name: "Soroswap",
      subtitle: "DEX aggregation and routing",
      category: "DEX Aggregator",
      defaultAction: "swap",
      contractId: "",
      contract: "",
      description:
        "Find optimized swap routes across Stellar liquidity sources and execute token swaps through Soroswap using SocketFi.",
      status: "live",
      imgUrl: "/soroswap.png",
      trigger: selectedNetwork === "TESTNET",
      statusMessage:
        "Soroswap is currently available on the Stellar Public Network. Switch to the Public Network to continue.",
    },
  ];
  function loginOpenHandler() {
    setLoginIsOpen(true);
  }

  function updateSession() {
    const curTime = Date.now();
    const session = getAuthSession();

    if (session) {
      if (curTime > Number(session?.dateExpire)) {
        removeAuthSession();
        setActiveSession(null);
      } else {
        setActiveSession(session);
      }
    }
    triggerUpdate();
  }

  useEffect(() => {
    updateSession();
  }, []);

  function parseBalanceData(dataStr) {
    const parsed = JSON.parse(dataStr, (key, value) => {
      if (
        (key === "balance" || key === "allowance") &&
        typeof value === "string" &&
        /^\d+$/.test(value)
      ) {
        return BigInt(value);
      }
      return value;
    });

    return Object.entries(parsed).map(([address, data]) => {
      const base = {
        address,
        symbol: data.symbol ?? "",
      };

      if ("balance" in data) {
        return { ...base, balance: data.balance };
      } else if ("allowance" in data) {
        return { ...base, allowance: data.allowance };
      } else {
        return { ...base };
      }
    });
  }

  const triggerUpdate = () => {
    setUpdateData(uuidv4()); // generate a new UUID to trigger change
  };

  useEffect(() => {
    triggerUpdate();
  }, [path]);

  function getSavedAccount() {
    const list = getAccounts();
    setSavedLoginList(list);
    if (list?.length === 0) {
      clearAccountStore();
      setNewLogin(true);
    } else {
      setNewLogin(false);
    }
  }

  useEffect(() => {
    getSavedAccount();
  }, []);

  useEffect(() => {
    setFilteredTokens(curatedList);
    const defaultIn = curatedList.find(
      (asset) =>
        asset?.contract ===
        "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"
    );
    setDappTokenIn(defaultIn);
    setSelectedTransactToken(defaultIn);
  }, [activeButton, path, updateData]);

  useEffect(() => {
    let tokenBalance = selectedTransactToken?.balance || "0";

    setTransactTokenBalance(bStroopToXlm(tokenBalance));
  }, [selectedTransactToken, selectedNetwork, path, activeButton, dappTokenIn]);

  useEffect(() => {
    if (tokenList.length > 0) {
      setSelectedTransactToken(tokenList[0]);

      const defaultIn = filteredTokens.find(
        (asset) => asset?.contract === tokenList[0]?.address
      );
      setDappTokenIn(defaultIn);
    } else {
      setSelectedTransactToken(null);
    }
  }, [path, activeButton]);

  useEffect(() => {
    let selectedFunc = {
      name: "router_get_amounts_out",
      inputs: [
        { value: "100000", type: "scSpecTypeI128" },
        {
          value: [
            "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
            "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
          ],
          type: "scSpecTypeAddress",
        },
      ],
    };

    async function getTokenOutAmount() {
      try {
        const body = {
          contractId:
            "CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH",
          network: "PUBLIC",
          callFunction: selectedFunc,
        };

        const response = await postRequest("any-get", body);
      } catch (e) {
        console.log(e);
      }
    }

    // getTokenOutAmount();
  }, []);

  const processEnd = (message, txId) => {
    // Run these lines immediately
    setDataUpdate(() => message);
    setProcessProgress((pre) => ({
      ...pre,
      message: message,
      txId: txId,
      isDone: true,
    }));

    // Delay only the onCloseSend() function by 5 seconds
    setTimeout(() => {
      setDataUpdate("");
      setProcessProgress((pre) => ({
        ...pre,
        message: "",
        isDone: false,
      }));
      onCloseSend();
    }, 3500);
  };

  function onCloseSend() {
    setIsOpenSend(() => false);
  }

  useEffect(() => {
    async function getBalance() {
      const response = await postRequest("get-balance", {
        wallet: userKey,
        tokenId: selectedTransactToken?.address,
        network: selectedNetwork,
      });

      setConnectedWalletBalance(bStroopToXlm(response.data));
    }

    if (
      selectedTransactToken &&
      userKey !== "" &&
      selectedTransactToken?.address !== ""
    ) {
      // getBalance();
    } else {
      setConnectedWalletBalance(null);
    }
  }, [
    selectedTransactToken?.address,
    userKey,
    walletFunctions,
    updateData,
    path,
  ]);

  const isTestnet = selectedNetwork === "TESTNET";

  const transactingToken = useMemo(() => {
    return isTestnet
      ? selectedTransactToken?.contract || selectedTransactToken?.address || ""
      : dappTokenIn?.contract || "";
  }, [isTestnet, selectedTransactToken, dappTokenIn]);

  const isPublic = selectedNetwork === "PUBLIC";

  const transactingSymbol = useMemo(() => {
    return isPublic
      ? dappTokenIn?.code || ""
      : selectedTransactToken?.symbol || "";
  }, [isPublic, dappTokenIn, selectedTransactToken]);

  useEffect(() => {
    async function fetchPath() {
      try {
        setIsFetchingAmountOut(true);
        if (selectedDapp?.id === "aqua-amm") {
          const quantity = toBaseUnits(
            dappTokenIn?.amount,
            Number(dappTokenIn?.decimals)
          );

          const res = await findSwapPath(
            dappTokenIn?.contract,
            dappTokenOut?.contract,
            quantity
          );

          if (res) {
            setSwapChainData(res);

            setDappTokenOut((pre) => ({
              ...pre,
              amount: fromBaseUnits(
                res?.amount_with_fee,
                Number(dappTokenOut?.decimals)
              ),
            }));
          }
        } else if (selectedDapp?.id === "soroswap") {
          const res = await postRequest(
            "get-quote",
            {
              protocol: "SOROSWAP",
              tokenIn: dappTokenIn?.contract,
              tokenOut: dappTokenOut?.contract,
              amount: dappTokenIn?.amount,
            },
            activeSession?.accessToken
          );

          if (res) {
            setSwapChainData(res?.data);

            setDappTokenOut((pre) => ({
              ...pre,
              amount: fromBaseUnits(
                res?.data?.amountOut,
                Number(dappTokenOut?.decimals)
              ),
            }));
          }
        }
      } catch (e) {
        setDappTokenOut((pre) => ({ ...pre, amount: "" }));
      } finally {
        setIsFetchingAmountOut(false);
      }
    }

    if (dappTokenIn && dappTokenOut && dappTokenIn?.amount) {
      fetchPath();
    }
  }, [
    dappTokenIn?.contract,
    dappTokenOut?.contract,
    selectedDapp?.id,
    dappTokenIn?.amount,
  ]);

  function capitalizeWords(str) {
    return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  const buttons: WalletAction[] = [
    {
      id: "deposit",
      name: "Deposit Tokens",
      type: "deposit",
      onClick: () => {
        buttonSwitchHandler("deposit");
        setIsOpenSend(true);
      },
    },
    {
      id: "withdraw",
      name: "Withdraw Tokens",
      type: "withdraw",
      onClick: () => {
        buttonSwitchHandler("withdraw");
        setIsOpenSend(true);
      },
    },
  ];

  function buttonSwitchHandler(id) {
    setActiveButton(id);
    // return;
    if (id === "withdraw") {
      setHasExtra(true);
      setExtra({ ...extra, name: "Recipient's Wallet" });
      setNeedWalletConnect(false);
    } else if (id === "approve") {
      setHasExtra(true);
      setExtra({ ...extra, name: "Spender's Wallet" });
      setNeedWalletConnect(false);
    } else {
      setHasExtra(false);
      setNeedWalletConnect(true);
    }
  }

  const openHandler = () => {
    setWalletKitIsOpen(true); // Set modal to open
  };
  const portfolioDetail = formatPortfolio(allTokens, prices);

  return (
    <StatesContext.Provider
      value={
        {
          tenant: socketFiTenant,
          openHandler,
          evmWalletIsOpen,
          setEvmWalletIsOpen,
          userProfile,
          isLogin,
          isFetching,
          savedLoginList,
          setSavedLoginList,
          setIsFetching,
          setUserProfile,
          loginIsOpen,
          setLoginIsOpen,
          token,
          newLogin,
          setNewLogin,
          setToken,
          updateData,
          setUpdateData,
          selectedAccount,
          setSelectedAccount,
          swapChainData,
          setSwapChainData,
          BASE_URL,
          getRequest,
          postRequest,
          activeSession,
          setActiveSession,
          updateSession,
          loginOpenHandler,
          getSavedAccount,
          selectedFunction,
          setSelectedFunction,
          setWalletFunctions,
          walletFunctions,
          contractIds,
          isWalletInstalled,
          setIsWalletInstalled,
          selectedTransactToken,
          setSelectedTransactToken,

          txNetwork,
          setTxNetwork,
          loadedSmartWallet,
          setLoadedSmartWallet,
          dataUpdate,
          setDataUpdate,
          processProgress,
          setProcessProgress,
          isOpenSend,
          setIsOpenSend,
          onCloseSend,
          triggerUpdate,
          processEnd,
          allTokens,
          setAllTokens,
          totalValue,
          setTotalValue,
          connectedWalletBalance,
          setConnectedWalletBalance,
          smartWalletId,
          setSmartWalletId,

          needWalletConnect,
          setNeedWalletConnect,
          prices,
          setPrices,
          allAllowance,
          setAllAllowance,
          socialIds,
          setSocialIds,
          transactionStats,
          setTransactionStats,
          activeButton,
          setActiveButton,
          tokenList,
          setTokenList,
          selectedNetwork,
          setSelectedNetwork,
          swapDappTokenSelectorIsOpen,
          setSwapDappTokenSelectorIsOpen,
          dappTokenIn,
          setDappTokenIn,
          dappTokenOut,
          setDappTokenOut,
          supportedDapps,
          selectedDapp,
          setSelectedDapp,
          curatedList,
          toOrFrom,
          setToOrFrom,
          sessionId,
          setSessionId,
          selectedNetworkActive,
          capitalizeWords,
          toast,
          buttonSwitchHandler,
          hasExtra,
          setHasExtra,
          extra,
          setExtra,
          recipientSpender,
          setRecipientSpender,
          buttons,
          filteredTokens,
          setFilteredTokens,
          portfolioDetail,
          transactTokenBalance,
          setTransactTokenBalance,
          isFetchingAmountOut,
          setIsFetchingAmountOut,
          versionInfo,
          setVersionInfo,
          showTokenFinder,
          setShowTokenFinder,
          accountSettings,
          setAccountSettings,
          walletKitIsOpen,
          setWalletKitIsOpen,
          userKey,
          setUserKey,
          network,
          setNetwork,
          feeQouteData,
          setFeeQouteData,
          transactingToken,
          transactingSymbol,
          evmConnectionOrigin,
          setEvmConnectionOrigin,
        } as StatesContextValue
      }
    >
      {children}
    </StatesContext.Provider>
  );
}

export function useStates(): StatesContextValue {
  const context = useContext(StatesContext);

  if (context === undefined) {
    throw new Error("useStates must be used inside StatesProvider");
  }

  return context;
}
