import {
  AllbridgeCoreSdk,
  AmountFormat,
  ChainSymbol,
  ChainType,
  FeePaymentMethod,
  Messenger,
  nodeRpcUrlsDefault,
  type ChainDetailsMap,
  type RawEvmTransaction,
  type TokenWithChainDetails,
} from "@allbridge/bridge-core-sdk";
import type { WalletClient } from "viem";

export type BridgeQuote = {
  amountToReceive: string;
  fee: string;
  feePaymentMethod: FeePaymentMethod;
};

export type BridgeTransferInput = {
  account: `0x${string}`;
  amount: string;
  destinationAccount: string;
  destinationToken: TokenWithChainDetails;
  sourceToken: TokenWithChainDetails;
  walletClient: WalletClient;
  waitForReceipt: (hash: `0x${string}`) => Promise<unknown>;
};

const explicitRpcConfig = {
  ETH: import.meta.env.VITE_RPC_ETHEREUM,
  BSC: import.meta.env.VITE_RPC_BSC,
  BASE: import.meta.env.VITE_RPC_BASE,
  POLYGON: import.meta.env.VITE_RPC_POLYGON,
  ARBITRUM: import.meta.env.VITE_RPC_ARBITRUM,
  AVALANCHE: import.meta.env.VITE_RPC_AVALANCHE,
  CELO: import.meta.env.VITE_RPC_CELO,
  OPTIMISM: import.meta.env.VITE_RPC_OPTIMISM,
  SONIC: import.meta.env.VITE_RPC_SONIC,
  UNICHAIN: import.meta.env.VITE_RPC_UNICHAIN,
  LINEA: import.meta.env.VITE_RPC_LINEA,
  SRB: import.meta.env.VITE_RPC_STELLAR,
};

const customRpcOverrides = Object.fromEntries(
  Object.entries(explicitRpcConfig).filter(
    (entry): entry is [string, string] => {
      const url = entry[1];
      return typeof url === "string" && url.trim().length > 0;
    }
  )
);

export const sdk = new AllbridgeCoreSdk({
  ...nodeRpcUrlsDefault,
  ...customRpcOverrides,
});

const MESSENGER = Messenger.ALLBRIDGE;
const GAS_FEE_PAYMENT_METHOD = FeePaymentMethod.WITH_NATIVE_CURRENCY;

/*
 * Classic Allbridge transfers pay source-chain gas with the connected
 * chain's native currency. Do not call getGasFeeOptions() for this route:
 * that method calls /receive-fee, which is not used by Messenger.ALLBRIDGE.
 */
const BRIDGE_RECEIVE_FEE = "0";

let chainMapPromise: Promise<ChainDetailsMap> | undefined;

export function getAllbridgeChainMap(): Promise<ChainDetailsMap> {
  chainMapPromise ??= sdk.chainDetailsMap();
  return chainMapPromise;
}

export async function getEvmSourceChain(chainId: number) {
  const chains = await getAllbridgeChainMap();
  const hexadecimalChainId = `0x${chainId.toString(16)}`.toLowerCase();
  const decimalChainId = String(chainId);

  return Object.values(chains).find((chain) => {
    if (chain.chainType !== ChainType.EVM || chain.chainId == null) {
      return false;
    }

    const configuredChainId = String(chain.chainId).toLowerCase();
    return (
      configuredChainId === hexadecimalChainId ||
      configuredChainId === decimalChainId
    );
  });
}

export async function getSorobanDestination() {
  const chains = await getAllbridgeChainMap();
  return chains[ChainSymbol.SRB];
}

export async function quoteAllbridgeTransfer(
  amount: string,
  sourceToken: TokenWithChainDetails,
  destinationToken: TokenWithChainDetails
): Promise<BridgeQuote> {
  if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error("Enter a valid transfer amount.");
  }

  if (!sourceToken || !destinationToken) {
    throw new Error("Select both source and destination tokens.");
  }

  if (sourceToken.chainSymbol === destinationToken.chainSymbol) {
    throw new Error("Source and destination chains must be different.");
  }

  try {
    console.log("QUOTE DEBUG", {
      amount: "10",
      source: {
        symbol: sourceToken?.symbol,
        chainSymbol: sourceToken?.chainSymbol,
        tokenAddress: sourceToken?.tokenAddress,
        decimals: sourceToken?.decimals,
      },
      destination: {
        symbol: destinationToken?.symbol,
        chainSymbol: destinationToken?.chainSymbol,
        tokenAddress: destinationToken?.tokenAddress,
        decimals: destinationToken?.decimals,
      },
    });
    const amountToReceive = await sdk.getAmountToBeReceived(
      "10",
      sourceToken,
      destinationToken,
      MESSENGER
    );

    return {
      amountToReceive,
      fee: BRIDGE_RECEIVE_FEE,
      feePaymentMethod: GAS_FEE_PAYMENT_METHOD,
    };
  } catch (error) {
    console.log("the error is", error);
    const wrapped = new Error("Allbridge operation failed");
    (wrapped as Error & { cause?: unknown }).cause = error;
    throw wrapped;
  }
}

function asWagmiTransaction(raw: RawEvmTransaction) {
  if (!raw.to || !raw.data) {
    throw new Error("Allbridge returned an incomplete EVM transaction.");
  }

  return {
    to: raw.to as `0x${string}`,
    data: raw.data as `0x${string}`,
    value: raw.value ? BigInt(raw.value) : 0n,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      response?: {
        status?: unknown;
        statusText?: unknown;
        data?: unknown;
      };
    };

    if (candidate.response) {
      const body =
        typeof candidate.response.data === "string"
          ? candidate.response.data
          : JSON.stringify(candidate.response.data);

      return [
        candidate.response.status
          ? `HTTP ${String(candidate.response.status)}`
          : "",
        typeof candidate.response.statusText === "string"
          ? candidate.response.statusText
          : "",
        body && body !== "{}" ? body : "",
      ]
        .filter(Boolean)
        .join(": ");
    }

    if (typeof candidate.message === "string") return candidate.message;
  }

  return String(error);
}

export async function executeAllbridgeTransfer({
  account,
  amount,
  destinationAccount,
  destinationToken,
  sourceToken,
  walletClient,
  waitForReceipt,
}: BridgeTransferInput): Promise<`0x${string}`> {
  if (!destinationAccount) {
    throw new Error("The destination SocketFi account is missing.");
  }

  /*
   * Quote first to validate the pair and amount. Its fee is deliberately zero
   * for Messenger.ALLBRIDGE; source-chain gas is paid in the native currency.
   */
  const quote = await quoteAllbridgeTransfer(
    amount,
    sourceToken,
    destinationToken
  );

  try {
    const allowanceReady = await sdk.bridge.checkAllowance({
      token: sourceToken,
      owner: account,
      amount,
      messenger: MESSENGER,
      gasFeePaymentMethod: GAS_FEE_PAYMENT_METHOD,
    });

    if (!allowanceReady) {
      const rawApproval = (await sdk.bridge.rawTxBuilder.approve({
        token: sourceToken,
        owner: account,
        amount,
        messenger: MESSENGER,
        gasFeePaymentMethod: GAS_FEE_PAYMENT_METHOD,
      })) as RawEvmTransaction;

      const approvalHash = await walletClient.sendTransaction({
        account,
        chain: walletClient.chain,
        ...asWagmiTransaction(rawApproval),
      });

      await waitForReceipt(approvalHash);
    }

    const rawTransfer = (await sdk.bridge.rawTxBuilder.send({
      amount,
      fromAccountAddress: account,
      toAccountAddress: destinationAccount,
      sourceToken,
      destinationToken,
      messenger: MESSENGER,
      fee: quote.fee,
      feeFormat: AmountFormat.INT,
      gasFeePaymentMethod: GAS_FEE_PAYMENT_METHOD,
    })) as RawEvmTransaction;

    const transferHash = await walletClient.sendTransaction({
      account,
      kzg: undefined,
      ...asWagmiTransaction(rawTransfer),
    });

    await waitForReceipt(transferHash);
    return transferHash;
  } catch (error) {
    const wrapped = new Error("Allbridge operation failed");
    (wrapped as Error & { cause?: unknown }).cause = error;
    throw wrapped;
  }
}

export async function waitForAllbridgeSettlement(
  sourceChainSymbol: string,
  sourceTransactionHash: string,
  timeoutMs = 20 * 60_000
) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const status = await sdk.getTransferStatus(
        sourceChainSymbol,
        sourceTransactionHash
      );

      if (status.receive?.txId || status.receive?.hash) {
        return status;
      }
    } catch (error) {
      // A not-found response is expected while Allbridge indexes the source tx.
      lastError = error;
    }

    await new Promise((resolve) => globalThis.setTimeout(resolve, 10_000));
  }

  throw new Error(
    lastError
      ? `Transfer is still pending: ${errorMessage(lastError)}`
      : "Transfer is still pending. Check it again in Allbridge."
  );
}
