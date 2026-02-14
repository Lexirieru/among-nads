import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { http } from "wagmi";
import {
  rabbyWallet,
  metaMaskWallet,
  walletConnectWallet,
  rainbowWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad Mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "Monad",
    symbol: "MON",
  },
  rpcUrls: {
    default: { http: ["https://monad-mainnet.drpc.org"] },
  },
  blockExplorers: {
    default: {
      name: "Monad Explorer",
      url: "https://monadexplorer.com",
      apiUrl: "https://monadexplorer.com/api",
    },
  },
  testnet: false,
  iconUrl: "https://avatars.githubusercontent.com/u/108920141?s=200&v=4",
});

export const config = getDefaultConfig({
  appName: "Among Nads",
  projectId: "4553a4639c46b13a8f3da08c527a28e5",
  chains: [monadMainnet],
  transports: {
    [monadMainnet.id]: http(),
  },
  ssr: true,
  wallets: [
    {
      groupName: "Popular",
      wallets: [
        rabbyWallet,
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet,
        injectedWallet,
      ],
    },
  ],
});
