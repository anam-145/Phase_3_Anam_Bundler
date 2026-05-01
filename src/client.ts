import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});

export const bundlerAccount = privateKeyToAccount(
  process.env.BUNDLER_PRIVATE_KEY as `0x${string}`,
);

export const walletClient = createWalletClient({
  account: bundlerAccount,
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});
