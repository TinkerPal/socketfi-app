export type SocketFiNetwork = "PUBLIC" | "TESTNET";

export type SupportedEvmChain = {
  chainId: number;
  blockchain: string;
  label: string;
  nativeSymbol: string;
};

export type NearIntentAsset = {
  chainId: number;
  assetId: string;
  blockchain: string;
  symbol: string;
  decimals: number;
  contractAddress: `0x${string}`;
};

export type NearIntentQuote = {
  quoteId?: string | null;
  depositAddress: `0x${string}`;
  depositMemo?: string | null;
  amountIn: string;
  amountInFormatted: string;
  amountOut: string;
  amountOutFormatted: string;
  deadline: string;
  timeEstimateSeconds?: number | null;
  sourceAsset: NearIntentAsset;
  destinationAsset: {
    assetId: string;
    blockchain: string;
    symbol: string;
    decimals: number;
    contractAddress?: string | null;
  };
};

export type NearIntentStatus =
  | "PENDING_DEPOSIT"
  | "KNOWN_DEPOSIT_TX"
  | "PROCESSING"
  | "SUCCESS"
  | "INCOMPLETE_DEPOSIT"
  | "REFUNDED"
  | "FAILED";

export type NearIntentExecution = {
  status: NearIntentStatus;
  swapDetails?: {
    originChainTxHashes?: string[];
    destinationChainTxHashes?: string[];
  };
};

export const SUPPORTED_EVM_CHAINS: readonly SupportedEvmChain[] = [
  {
    chainId: 1,
    blockchain: "eth",
    label: "Ethereum",
    nativeSymbol: "ETH",
  },
  {
    chainId: 8453,
    blockchain: "base",
    label: "Base",
    nativeSymbol: "ETH",
  },
  {
    chainId: 42161,
    blockchain: "arb",
    label: "Arbitrum",
    nativeSymbol: "ETH",
  },
  {
    chainId: 137,
    blockchain: "pol",
    label: "Polygon",
    nativeSymbol: "POL",
  },
] as const;
