import { toHex } from "viem";
import { publicClient } from "./client.js";
import type { UserOpRpc } from "./types.js";

/**
 * Gas estimation for ERC-4337 v0.7 UserOps with SimpleAccount + AnamPaymaster.
 *
 * preVerificationGas — exact formula: base tx cost + per-byte calldata cost.
 * verificationGasLimit — generous fixed values (SimpleAccount ECDSA + Paymaster validation).
 *                        Higher for first-time accounts that include factory deployment.
 * callGasLimit — covers a USDC transfer via SimpleAccount.execute() with room to spare.
 *
 * All three values stay under AnamPaymaster's maxGasCost (0.005 ETH) at typical
 * Sepolia gas prices (< 10 gwei).
 */
export function estimateGas(op: UserOpRpc) {
  const bytes    = Buffer.from(op.callData.slice(2), "hex");
  const zeros    = bytes.filter(b => b === 0).length;
  const nonZeros = bytes.length - zeros;

  // Standard EIP-4337 preVerificationGas formula
  const preVerificationGas = toHex(BigInt(21_000 + zeros * 4 + nonZeros * 16 + 5_000));

  const isNewAccount       = !!(op.factory && op.factory !== "0x");
  const verificationGasLimit = toHex(isNewAccount ? 400_000n : 150_000n);
  const callGasLimit         = toHex(100_000n);

  return { preVerificationGas, verificationGasLimit, callGasLimit };
}

/**
 * Fetch current network gas prices and return them in the
 * pimlico_getUserOperationGasPrice format (slow / standard / fast).
 */
export async function getGasPrice() {
  const feeHistory = await publicClient.getFeeHistory({
    blockCount: 3,
    rewardPercentiles: [50],
    blockTag: "latest",
  });

  const baseFee            = feeHistory.baseFeePerGas.at(-1) ?? 1_000_000_000n;
  const maxPriorityFeePerGas = 1_500_000_000n;            // 1.5 gwei
  const maxFeePerGas         = baseFee * 2n + maxPriorityFeePerGas;

  const price = {
    maxFeePerGas:         toHex(maxFeePerGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
  };

  return { slow: price, standard: price, fast: price };
}
