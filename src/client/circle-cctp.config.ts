export type SocketFiNetwork = "PUBLIC" | "TESTNET";

export type CircleChainConfig = {
  chainId: number;
  circleChain: string;
  label: string;
  network: SocketFiNetwork;
};

const BUILTIN_CHAINS: Record<number, CircleChainConfig> = {
  1: {
    chainId: 1,
    circleChain: "Ethereum",
    label: "Ethereum",
    network: "PUBLIC",
  },
  11155111: {
    chainId: 11155111,
    circleChain: "Ethereum_Sepolia",
    label: "Ethereum Sepolia",
    network: "TESTNET",
  },

  // BNB Smart Chain
  56: {
    chainId: 56,
    circleChain: "BNB_Smart_Chain",
    label: "BNB Smart Chain",
    network: "PUBLIC",
  },
  97: {
    chainId: 97,
    circleChain: "BNB_Smart_Chain_Testnet",
    label: "BNB Smart Chain Testnet",
    network: "TESTNET",
  },

  42161: {
    chainId: 42161,
    circleChain: "Arbitrum",
    label: "Arbitrum",
    network: "PUBLIC",
  },
  421614: {
    chainId: 421614,
    circleChain: "Arbitrum_Sepolia",
    label: "Arbitrum Sepolia",
    network: "TESTNET",
  },
  43114: {
    chainId: 43114,
    circleChain: "Avalanche",
    label: "Avalanche",
    network: "PUBLIC",
  },
  43113: {
    chainId: 43113,
    circleChain: "Avalanche_Fuji",
    label: "Avalanche Fuji",
    network: "TESTNET",
  },
  8453: {
    chainId: 8453,
    circleChain: "Base",
    label: "Base",
    network: "PUBLIC",
  },
  84532: {
    chainId: 84532,
    circleChain: "Base_Sepolia",
    label: "Base Sepolia",
    network: "TESTNET",
  },
  10: {
    chainId: 10,
    circleChain: "Optimism",
    label: "OP Mainnet",
    network: "PUBLIC",
  },
  11155420: {
    chainId: 11155420,
    circleChain: "Optimism_Sepolia",
    label: "OP Sepolia",
    network: "TESTNET",
  },
  137: {
    chainId: 137,
    circleChain: "Polygon",
    label: "Polygon PoS",
    network: "PUBLIC",
  },
  80002: {
    chainId: 80002,
    circleChain: "Polygon_Amoy_Testnet",
    label: "Polygon Amoy",
    network: "TESTNET",
  },
  130: {
    chainId: 130,
    circleChain: "Unichain",
    label: "Unichain",
    network: "PUBLIC",
  },
  1301: {
    chainId: 1301,
    circleChain: "Unichain_Sepolia",
    label: "Unichain Sepolia",
    network: "TESTNET",
  },
  59144: {
    chainId: 59144,
    circleChain: "Linea",
    label: "Linea",
    network: "PUBLIC",
  },
  59141: {
    chainId: 59141,
    circleChain: "Linea_Sepolia",
    label: "Linea Sepolia",
    network: "TESTNET",
  },
  480: {
    chainId: 480,
    circleChain: "World_Chain",
    label: "World Chain",
    network: "PUBLIC",
  },
  4801: {
    chainId: 4801,
    circleChain: "World_Chain_Sepolia",
    label: "World Chain Sepolia",
    network: "TESTNET",
  },
  146: {
    chainId: 146,
    circleChain: "Sonic",
    label: "Sonic",
    network: "PUBLIC",
  },
  57054: {
    chainId: 57054,
    circleChain: "Sonic_Testnet",
    label: "Sonic Testnet",
    network: "TESTNET",
  },
  57073: {
    chainId: 57073,
    circleChain: "Ink",
    label: "Ink",
    network: "PUBLIC",
  },
  763373: {
    chainId: 763373,
    circleChain: "Ink_Testnet",
    label: "Ink Testnet",
    network: "TESTNET",
  },
  50: {
    chainId: 50,
    circleChain: "XDC",
    label: "XDC",
    network: "PUBLIC",
  },
  51: {
    chainId: 51,
    circleChain: "XDC_Apothem",
    label: "XDC Apothem",
    network: "TESTNET",
  },
  1329: {
    chainId: 1329,
    circleChain: "Sei",
    label: "Sei",
    network: "PUBLIC",
  },
  1328: {
    chainId: 1328,
    circleChain: "Sei_Testnet",
    label: "Sei Testnet",
    network: "TESTNET",
  },
  143: {
    chainId: 143,
    circleChain: "Monad",
    label: "Monad",
    network: "PUBLIC",
  },
  10143: {
    chainId: 10143,
    circleChain: "Monad_Testnet",
    label: "Monad Testnet",
    network: "TESTNET",
  },
  2818: {
    chainId: 2818,
    circleChain: "Morph",
    label: "Morph",
    network: "PUBLIC",
  },
  2810: {
    chainId: 2810,
    circleChain: "Morph_Testnet",
    label: "Morph Testnet",
    network: "TESTNET",
  },
  25: {
    chainId: 25,
    circleChain: "Cronos",
    label: "Cronos",
    network: "PUBLIC",
  },
};

function parseEnvironmentChains(): Record<number, CircleChainConfig> {
  const raw = import.meta.env.VITE_CCTP_CHAIN_MAP_JSON;
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      Omit<CircleChainConfig, "chainId">
    >;

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([id, value]) => {
        const chainId = Number(id);

        if (
          !Number.isInteger(chainId) ||
          chainId <= 0 ||
          !value ||
          typeof value.circleChain !== "string" ||
          typeof value.label !== "string" ||
          (value.network !== "PUBLIC" && value.network !== "TESTNET")
        ) {
          return [];
        }

        return [[chainId, { chainId, ...value }]];
      })
    );
  } catch (error) {
    console.error("[circle-cctp/config] invalid JSON", error);
    return {};
  }
}

const ENV_CHAINS = parseEnvironmentChains();

export function getCircleChain(chainId: number): CircleChainConfig | null {
  return ENV_CHAINS[chainId] ?? BUILTIN_CHAINS[chainId] ?? null;
}

export function getDestinationCircleChain(
  network: SocketFiNetwork
): "Stellar" | "Stellar_Testnet" {
  return network === "PUBLIC" ? "Stellar" : "Stellar_Testnet";
}
