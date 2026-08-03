import { useEffect, useRef, useState } from "react";
import { useSocketFi } from "@socketfi/react";
import { useSignMessage } from "wagmi";
import {
  ArrowRight2,
  FingerScan,
  ShieldSecurity,
  Wallet3,
} from "iconsax-react";
import { SiEthereum, SiStellar } from "react-icons/si";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";

import { useStates } from "../../context/StatesContext";
import { addAccountStore, saveAuthSession } from "../../utils/localStorage";
import { confirmSocketFiAccountCreated } from "../../utils/accountName";
import { WalletKitService } from "../../wallet-kit/services/global-service";

const DIRECT_API_URL =
  import.meta.env.VITE_SERVER_DIRECT_URL ||
  import.meta.env.VITE_SOCKETFI_DIRECT_API_URL ||
  "http://localhost:3200";

const STELLAR_CONNECTED_EVENT = "socketfi:stellar-wallet-connected";
const EVM_CONNECTED_EVENT = "socketfi:evm-wallet-connected";

const ERROR_DISMISS_MS = 6_000;

type Network = "TESTNET" | "PUBLIC";
type AuthPlatform = "passkey" | "stellar" | "evm";

interface JsonRecord {
  [key: string]: unknown;
}

interface StellarPrepareResponse extends JsonRecord {
  success?: boolean;
  phase?: "prepared" | "complete";
  verified?: boolean;
  created?: boolean;
  intent?: "create" | "signin";
  mode?: "create" | "signin";
  authMethod?: "stellar";
  network?: Network;
  stellarPublicKey?: string;
  expiresInMs?: number;
  sessionId?: string;
  transactionXdr?: string;
  networkPassphrase?: string;
  smartWalletAddress?: string;
  accessToken?: string;
  address?: Partial<Record<Network, string>>;
  user?: {
    userId?: string;
    username?: string;
    address?: Partial<Record<Network, string>>;
    authMethods?: {
      passkey?: boolean;
      stellar?: boolean;
      evm?: boolean;
    };
  };
}

interface StellarConnectedDetail {
  address: string;
  productId?: string;
  productName?: string;
}

interface EvmConnectedDetail {
  address: `0x${string}`;
  connectorId?: string;
  connectorName?: string;
}

interface EvmPrepareResponse extends JsonRecord {
  sessionId?: string;
  challengeHex?: `0x${string}`;
  evmAddress?: `0x${string}`;
  intent?: "create" | "signin";
  expiresInMs?: number;
}

interface EvmCompleteResponse extends JsonRecord {
  created?: boolean;
  intent?: "create" | "signin";
  smartWalletAddress?: string;
  accessToken?: string;
  evmAddress?: `0x${string}`;
  address?: Partial<Record<Network, string>>;
  user?: {
    userId?: string;
    username?: string;
    address?: Partial<Record<Network, string>>;
  };
}

interface AuthStatus {
  type: "idle" | "loading" | "success";
  message: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : typeof body.message === "string"
        ? body.message
        : `Request failed with status ${response.status}`
    );
  }

  return body as T;
}

function getSignedTransactionXdr(result: unknown): string {
  const response = result as {
    signedTxXdr?: string;
    signedTransactionXdr?: string;
    signedXdr?: string;
    xdr?: string;
  };

  const value =
    response?.signedTxXdr ||
    response?.signedTransactionXdr ||
    response?.signedXdr ||
    response?.xdr;

  if (!value) {
    throw new Error(
      "The selected Stellar wallet did not return a signed transaction."
    );
  }

  return value;
}

async function signWithWalletKit({
  transactionXdr,
  networkPassphrase,
  address,
}: {
  transactionXdr: string;
  networkPassphrase: string;
  address: string;
}): Promise<unknown> {
  const service = WalletKitService as unknown as {
    signTransaction?: (
      transactionXdr: string,
      options: {
        networkPassphrase: string;
        address: string;
      }
    ) => Promise<unknown>;

    walletKit?: {
      signTransaction?: (
        transactionXdr: string,
        options: {
          networkPassphrase: string;
          address: string;
        }
      ) => Promise<unknown>;
    };
  };

  if (typeof service.signTransaction === "function") {
    return service.signTransaction(transactionXdr, {
      networkPassphrase,
      address,
    });
  }

  if (typeof service.walletKit?.signTransaction === "function") {
    return service.walletKit.signTransaction(transactionXdr, {
      networkPassphrase,
      address,
    });
  }

  throw new Error("WalletKitService does not expose signTransaction().");
}

export default function SignUp() {
  const socketfi = useSocketFi();
  const { signMessageAsync } = useSignMessage();

  const [isLoading, setIsLoading] = useState(false);

  const [activeMethod, setActiveMethod] = useState<AuthPlatform | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  const [status, setStatus] = useState<AuthStatus>({
    type: "idle",
    message: "",
  });

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    loginIsOpen,
    setLoginIsOpen,
    setWalletKitIsOpen,
    setEvmWalletIsOpen,
    getSavedAccount,
    updateSession,
    triggerUpdate,
    selectedNetwork,
    setSessionId,
    activeSession,
    evmConnectionOrigin,
    setEvmConnectionOrigin,
  } = useStates();

  const network = selectedNetwork as Network;

  function clearError() {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);

      errorTimerRef.current = null;
    }

    setErrorMessage("");
  }

  function showError(error: unknown) {
    clearError();

    setErrorMessage(getErrorMessage(error));

    errorTimerRef.current = setTimeout(() => {
      setErrorMessage("");
      errorTimerRef.current = null;
    }, ERROR_DISMISS_MS);
  }

  function updateLoadingStatus(method: AuthPlatform, message: string) {
    setActiveMethod(method);

    setStatus({
      type: "loading",
      message,
    });
  }

  useEffect(() => {
    if (!loginIsOpen) {
      clearError();
      setActiveMethod(null);

      setStatus({
        type: "idle",
        message: "",
      });
    }
  }, [loginIsOpen]);

  useEffect(() => {
    if (!loginIsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isLoading) {
        setLoginIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleEscape);
    };
  }, [isLoading, loginIsOpen, setLoginIsOpen]);

  useEffect(() => {
    async function handleConnectedWallet(event: Event) {
      const customEvent = event as CustomEvent<StellarConnectedDetail>;

      const address = customEvent.detail?.address;

      if (!address) {
        setLoginIsOpen(true);

        showError("The selected Stellar wallet did not return an address.");

        return;
      }

      await completeStellarConnection(address);
    }

    window.addEventListener(STELLAR_CONNECTED_EVENT, handleConnectedWallet);

    return () => {
      window.removeEventListener(
        STELLAR_CONNECTED_EVENT,
        handleConnectedWallet
      );
    };
  }, [network]);

  useEffect(() => {
    async function handleConnectedWallet(event: Event) {
      const customEvent = event as CustomEvent<EvmConnectedDetail>;
      const address = customEvent.detail?.address;

      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        setEvmWalletIsOpen(false);
        setLoginIsOpen(true);
        showError("The selected EVM wallet did not return a valid address.");
        return;
      }

      if (evmConnectionOrigin === "signup") {
        await completeEvmConnection(address);
      }
    }

    window.addEventListener(EVM_CONNECTED_EVENT, handleConnectedWallet);

    return () => {
      window.removeEventListener(EVM_CONNECTED_EVENT, handleConnectedWallet);
    };
  }, [network, signMessageAsync]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  /*
   * Show only when the access modal is open
   * and no authenticated session exists.
   */
  if (activeSession) {
    return null;
  }

  async function finishSession({
    userProfile,
    accessToken,
    platform,
  }: {
    userProfile: Record<string, unknown>;
    accessToken: string;
    platform: AuthPlatform;
  }) {
    const username =
      typeof userProfile.username === "string"
        ? userProfile.username
        : platform === "stellar"
        ? "Stellar wallet"
        : platform === "evm"
        ? "EVM wallet"
        : "SocketFi wallet";

    setStatus({
      type: "success",
      message: "Wallet connected successfully.",
    });

    await addAccountStore({
      username,
      platform,
      time: Date.now(),
    });

    await saveAuthSession(userProfile, accessToken);

    setLoginIsOpen(false);
    setWalletKitIsOpen(false);
    setEvmWalletIsOpen(false);
    setSessionId("");

    await getSavedAccount();
    await triggerUpdate();
    await updateSession();

    confirmSocketFiAccountCreated();
  }

  type AuthenticateResponse = {
    verified: boolean;
    code: string;
    session: {
      socketfiAccessToken: string;
      username?: string;
      userProfile?: {
        username?: string;
        [key: string]: unknown;
      };
      address: Partial<Record<"PUBLIC" | "TESTNET", string>>;
    };
  };

  async function continueWithPasskey() {
    try {
      setIsLoading(true);
      clearError();

      updateLoadingStatus("passkey", "");

      const response = (await socketfi.authenticate(
        "signin"
      )) as unknown as AuthenticateResponse;

      console.log("the response is", response);

      const session = response.session;

      if (!session.socketfiAccessToken) {
        throw new Error("SocketFi did not return an access token.");
      }

      const walletAddress = session.address?.[network];

      if (!walletAddress) {
        throw new Error(`SocketFi did not return a ${network} wallet address.`);
      }

      updateLoadingStatus("passkey", "");

      await finishSession({
        userProfile: {
          ...(session.userProfile || {}),
          username:
            session.userProfile?.username ||
            session.username ||
            "Passkey wallet",
          address: session.address,
          authMethod: "passkey",
        },

        accessToken: session.socketfiAccessToken,

        platform: "passkey",
      });
    } catch (error) {
      console.error("[auth/passkey]", error);

      showError(error);
      setSessionId("");
    } finally {
      setIsLoading(false);
      setActiveMethod(null);

      setStatus({
        type: "idle",
        message: "",
      });
    }
  }

  function continueWithStellarWallet() {
    if (isLoading) {
      return;
    }

    clearError();

    setActiveMethod("stellar");

    /*
     * Close this modal and open the
     * existing Stellar Wallet Kit picker.
     */
    setLoginIsOpen(false);
    setWalletKitIsOpen(true);
  }

  function continueWithEvmWallet() {
    if (isLoading) {
      return;
    }

    setEvmConnectionOrigin("signup");
    clearError();
    setActiveMethod("evm");
    setLoginIsOpen(false);
    setWalletKitIsOpen(false);
    setEvmWalletIsOpen(true);
  }

  async function completeEvmConnection(evmAddress: `0x${string}`) {
    try {
      setIsLoading(true);
      clearError();
      updateLoadingStatus("evm", "");

      const normalizedAddress = evmAddress.toLowerCase() as `0x${string}`;

      const prepareResponse = await fetch(`${DIRECT_API_URL}/api/evm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "prepare",
          evmAddress: normalizedAddress,
          network,
          guardians: [],
        }),
      });

      const prepared = await readJsonResponse<EvmPrepareResponse>(
        prepareResponse
      );

      if (!prepared.sessionId || !prepared.challengeHex) {
        throw new Error("SocketFi could not prepare EVM authentication.");
      }

      if (!/^0x[0-9a-fA-F]{64}$/.test(prepared.challengeHex)) {
        throw new Error("SocketFi returned an invalid EVM signing challenge.");
      }

      if (
        prepared.evmAddress &&
        prepared.evmAddress.toLowerCase() !== normalizedAddress
      ) {
        throw new Error("The prepared EVM account does not match your wallet.");
      }

      /*
       * `raw` is critical: the contract verifies EIP-191 personal_sign over
       * exactly 32 bytes, not over the UTF-8 characters of the hex string.
       */
      const signature = await signMessageAsync({
        account: evmAddress,
        message: {
          raw: prepared.challengeHex,
        },
      });

      const submitResponse = await fetch(`${DIRECT_API_URL}/api/evm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "submit",
          sessionId: prepared.sessionId,
          signature,
        }),
      });

      const completed = await readJsonResponse<EvmCompleteResponse>(
        submitResponse
      );

      const smartWalletAddress =
        completed.smartWalletAddress ||
        completed.address?.[network] ||
        completed.user?.address?.[network];

      if (!smartWalletAddress) {
        throw new Error(`SocketFi did not return a ${network} wallet address.`);
      }

      if (!completed.accessToken) {
        throw new Error("SocketFi did not return an access token.");
      }

      if (
        completed.evmAddress &&
        completed.evmAddress.toLowerCase() !== normalizedAddress
      ) {
        throw new Error("The authenticated EVM account does not match.");
      }

      await finishSession({
        userProfile: {
          ...(completed.user || {}),
          username:
            completed.user?.username ||
            `EVM ${normalizedAddress.slice(0, 6)}…${normalizedAddress.slice(
              -4
            )}`,
          address: completed.address ||
            completed.user?.address || {
              [network]: smartWalletAddress,
            },
          evmAddress: normalizedAddress,
          authMethod: "evm",
        },
        accessToken: completed.accessToken,
        platform: "evm",
      });
    } catch (error) {
      console.error("[auth/evm]", error);
      setSessionId("");
      setEvmWalletIsOpen(false);
      setLoginIsOpen(true);
      showError(error);
    } finally {
      setIsLoading(false);
      setActiveMethod(null);
      setStatus({
        type: "idle",
        message: "",
      });
    }
  }

  async function completeStellarConnection(stellarPublicKey: string) {
    try {
      setIsLoading(true);
      setActiveMethod("stellar");
      clearError();

      updateLoadingStatus("stellar", "Connecting Stellar wallet...");

      const prepareResponse = await fetch(`${DIRECT_API_URL}/api/stellar`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          action: "prepare",
          stellarPublicKey,
          network,
          guardians: [],
        }),
      });

      const prepared = await readJsonResponse<StellarPrepareResponse>(
        prepareResponse
      );

      console.log("[auth/stellar/prepare]", prepared);

      /*
       * Both intents require wallet proof:
       * - signin: the backend verifies the signed challenge XDR locally;
       * - create: the backend submits the signed account-creation XDR.
       */
      if (
        !prepared.sessionId ||
        !prepared.transactionXdr ||
        !prepared.networkPassphrase
      ) {
        console.error("[auth/stellar/invalid-prepare]", prepared);

        throw new Error(
          prepared.intent === "signin"
            ? "SocketFi could not prepare Stellar authentication."
            : "SocketFi could not prepare the account creation transaction."
        );
      }

      if (
        prepared.stellarPublicKey &&
        prepared.stellarPublicKey !== stellarPublicKey
      ) {
        throw new Error(
          "The prepared Stellar account does not match your wallet."
        );
      }

      updateLoadingStatus(
        "stellar",
        prepared.intent === "signin"
          ? "Confirm sign-in in your Stellar wallet..."
          : "Confirm the account creation transaction in your wallet..."
      );

      const signed = await signWithWalletKit({
        transactionXdr: prepared.transactionXdr,
        networkPassphrase: prepared.networkPassphrase,
        address: stellarPublicKey,
      });

      const signedTransactionXdr = getSignedTransactionXdr(signed);

      if (!signedTransactionXdr) {
        throw new Error(
          "The Stellar wallet did not return a signed transaction."
        );
      }

      updateLoadingStatus(
        "stellar",
        prepared.intent === "signin"
          ? "Verifying your Stellar wallet..."
          : "Creating your SocketFi account..."
      );

      const submitResponse = await fetch(`${DIRECT_API_URL}/api/stellar`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          action: "submit",
          sessionId: prepared.sessionId,
          signedTransactionXdr,
        }),
      });

      const completed = await readJsonResponse<StellarPrepareResponse>(
        submitResponse
      );

      console.log("[auth/stellar/complete]", completed);

      if (completed.phase && completed.phase !== "complete") {
        throw new Error("SocketFi did not complete Stellar authentication.");
      }

      if (completed.verified === false) {
        throw new Error("SocketFi could not verify the Stellar wallet.");
      }

      if (
        completed.stellarPublicKey &&
        completed.stellarPublicKey !== stellarPublicKey
      ) {
        throw new Error("The authenticated Stellar account does not match.");
      }

      const smartWalletAddress =
        completed.smartWalletAddress ||
        completed.address?.[network] ||
        completed.user?.address?.[network];

      if (!smartWalletAddress) {
        throw new Error(`SocketFi did not return a ${network} wallet address.`);
      }

      if (!completed.accessToken) {
        throw new Error("SocketFi did not return an access token.");
      }

      updateLoadingStatus("stellar", "Opening your SocketFi account...");

      await finishSession({
        userProfile: {
          ...(completed.user || {}),

          username:
            completed.user?.username || `Stellar ${stellarPublicKey.slice(-6)}`,

          address: completed.address ||
            completed.user?.address || {
              [network]: smartWalletAddress,
            },

          stellarPublicKey,
          smartWalletAddress,
          authMethod: "stellar",

          authMethods: completed.user?.authMethods || {
            passkey: false,
            stellar: true,
            evm: false,
          },
        },

        accessToken: completed.accessToken,

        platform: "stellar",
      });
    } catch (error) {
      console.error("[auth/stellar]", error);

      setSessionId("");

      /*
       * Close the wallet picker and reopen the login modal so the error
       * remains visible.
       */
      setWalletKitIsOpen(false);
      setLoginIsOpen(true);

      showError(error);
    } finally {
      setIsLoading(false);
      setActiveMethod(null);

      setStatus({
        type: "idle",
        message: "",
      });
    }
  }

  // if (!loginIsOpen) {
  //   return null;
  // }

  return (
    <section
      className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/50 px-3 py-5 backdrop-blur-md sm:px-6 sm:py-8"
      aria-labelledby="socketfi-access-title"
      aria-describedby="socketfi-access-description"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="relative w-full max-w-[490px] overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_32px_100px_rgba(15,23,42,0.28)]">
          <header className="relative overflow-hidden border-b border-slate-200 px-6 pb-7 pt-10 text-center sm:px-8">
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-50 via-cyan-50/50 to-transparent" />

            <div className="absolute -left-14 top-4 h-32 w-32 rounded-full bg-indigo-100/60 blur-3xl" />
            <div className="absolute -right-12 top-6 h-28 w-28 rounded-full bg-cyan-100/60 blur-3xl" />

            <div className="relative mx-auto flex max-w-sm flex-col items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-950 text-white shadow-lg shadow-slate-950/15">
                <ShieldSecurity size="27" variant="Bulk" />
              </div>

              <h1
                id="socketfi-access-title"
                className="mt-5 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px]"
              >
                Continue to SocketFi
              </h1>

              <p
                id="socketfi-access-description"
                className="mt-2 text-sm leading-6 text-slate-500"
              >
                Create or access your SocketFi smart account using one of the
                following options.
              </p>
            </div>
          </header>

          <div className="space-y-3 px-5 py-6 sm:px-8 sm:py-7">
            <button
              type="button"
              onClick={continueWithPasskey}
              disabled={isLoading}
              className="group flex w-full items-center gap-4 rounded-[20px] bg-slate-950 p-4 text-left text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <FingerScan size="22" variant="Bulk" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  Continue with passkey
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-300">
                  Recommended · Fast and passwordless
                </span>
              </span>

              {isLoading && activeMethod === "passkey" ? (
                <Loader2 className="h-4.5 w-4.5 shrink-0 animate-spin text-white" />
              ) : (
                <ArrowRight2
                  size="18"
                  className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-white"
                />
              )}
            </button>

            <button
              type="button"
              onClick={continueWithStellarWallet}
              disabled={isLoading}
              className="group flex w-full items-center gap-4 rounded-[20px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                <SiStellar className="h-[22px] w-[22px]" aria-hidden="true" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-950">
                  Continue with Stellar wallet
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Freighter, xBull, LOBSTR, and more
                </span>
              </span>

              {isLoading && activeMethod === "stellar" ? (
                <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-indigo-700" />
              ) : (
                <ArrowRight2
                  size="18"
                  className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-700"
                />
              )}
            </button>

            <button
              type="button"
              onClick={continueWithEvmWallet}
              disabled={isLoading}
              className="group flex w-full items-center gap-4 rounded-[20px] border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50/40 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                <SiEthereum className="h-6 w-6" aria-hidden="true" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-950">
                  Continue with EVM wallet
                </span>

                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  MetaMask, Coinbase Wallet, and more
                </span>
              </span>

              {isLoading && activeMethod === "evm" ? (
                <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-violet-700" />
              ) : (
                <ArrowRight2
                  size="18"
                  className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-700"
                />
              )}
            </button>

            {errorMessage ? (
              <div
                role="alert"
                aria-live="assertive"
                className="relative overflow-hidden rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5"
              >
                <div className="flex items-start gap-3 pr-8">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                    <AlertCircle className="h-4 w-4" />
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-rose-800">
                      Unable to continue
                    </p>

                    <p className="mt-1 break-words text-sm leading-5 text-rose-700">
                      {errorMessage}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Dismiss error"
                  onClick={clearError}
                  className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-rose-500 transition hover:bg-rose-100 hover:text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-rose-100">
                  <div
                    className="h-full origin-left bg-rose-400"
                    style={{
                      animation: `socketfi-error-dismiss ${ERROR_DISMISS_MS}ms linear forwards`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            {status.message ? (
              <div
                aria-live="polite"
                className={classNames(
                  "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm",
                  status.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                )}
              >
                {status.type === "success" ? (
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
                ) : (
                  <Loader2 className="h-4.5 w-4.5 shrink-0 animate-spin" />
                )}

                <span className="min-w-0">{status.message}</span>
              </div>
            ) : null}

            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 ring-1 ring-inset ring-slate-100">
              <ShieldSecurity
                size="18"
                className="mt-0.5 shrink-0 text-emerald-700"
              />

              <p className="text-xs leading-5 text-slate-500">
                SocketFi never has access to your private keys, or recovery
                phrase. By continuing, you agree to the{" "}
                <a
                  href="https://www.socket.fi/terms-&-conditions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-slate-700 underline underline-offset-2 transition hover:text-slate-950"
                >
                  Terms &amp; Conditions
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes socketfi-error-dismiss {
            from {
              transform: scaleX(1);
            }

            to {
              transform: scaleX(0);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            [style*="socketfi-error-dismiss"] {
              animation: none !important;
            }
          }
        `}
      </style>
    </section>
  );
}

function classNames(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}
