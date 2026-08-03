import { createConfig, http } from "wagmi";
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  bscTestnet,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "wagmi/chains";
import {
  coinbaseWallet,
  injected,
  metaMask,
  walletConnect,
} from "wagmi/connectors";

const walletConnectProjectId = String(
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ""
).trim();

if (!walletConnectProjectId) {
  console.warn(
    "[wagmi] VITE_WALLETCONNECT_PROJECT_ID is missing. WalletConnect will not be configured."
  );
}

const configuredConnectors = [
  /*
   * EIP-6963 allows installed browser wallets such as Rabby,
   * Phantom EVM, Brave Wallet and others to advertise themselves
   * individually instead of all appearing as "Injected".
   */
  injected({
    shimDisconnect: true,
  }),

  metaMask({
    dappMetadata: {
      name: "SocketFi",
      url:
        typeof window !== "undefined"
          ? window.location.origin
          : "https://socketfi.app",
    },
  }),

  coinbaseWallet({
    appName: "SocketFi",
    appLogoUrl: "/socketfi-logo.png",
    preference: {
      options: "all",
    },
  }),

  ...(walletConnectProjectId
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          metadata: {
            name: "SocketFi",
            description:
              "Connect an EVM wallet to your SocketFi smart account.",
            url:
              typeof window !== "undefined"
                ? window.location.origin
                : "https://socketfi.app",
            icons: [
              `${
                typeof window !== "undefined"
                  ? window.location.origin
                  : "https://socketfi.app"
              }/socketfi-logo.png`,
            ],
          },
          showQrModal: true,
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [
    mainnet,
    base,
    arbitrum,
    optimism,
    polygon,
    bsc,
    avalanche,
    sepolia,
    bscTestnet,
  ],

  connectors: configuredConnectors,

  /*
   * Keep EIP-6963 provider discovery enabled. This is what lets
   * wagmi discover multiple installed browser wallets.
   */
  multiInjectedProviderDiscovery: true,

  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [avalanche.id]: http(),
    [sepolia.id]: http(),
    [bscTestnet.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
