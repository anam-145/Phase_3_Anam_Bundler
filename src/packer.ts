import { concat, toHex, hexToBigInt } from "viem";
import type { Hex, UserOpRpc } from "./types.js";

// Pack two uint128 values into one bytes32: [ high (16 bytes) | low (16 bytes) ]
function packUint128(high: bigint, low: bigint): Hex {
  return toHex((high << 128n) | low, { size: 32 });
}

/**
 * Convert the unpacked bundler RPC format into the PackedUserOperation
 * struct expected by EntryPoint v0.7's handleOps() and getUserOpHash().
 */
export function toPackedOp(op: UserOpRpc) {
  // initCode = factory address (20 bytes) + factory calldata
  const initCode: Hex = op.factory && op.factory !== "0x"
    ? concat([op.factory, op.factoryData ?? "0x"]) as Hex
    : "0x";

  // paymasterAndData = paymaster (20) + verGasLimit (16) + postOpGasLimit (16) + data
  const paymasterAndData: Hex = op.paymaster && op.paymaster !== "0x"
    ? concat([
        op.paymaster,
        toHex(hexToBigInt(op.paymasterVerificationGasLimit ?? "0x0"), { size: 16 }),
        toHex(hexToBigInt(op.paymasterPostOpGasLimit        ?? "0x0"), { size: 16 }),
        op.paymasterData ?? "0x",
      ]) as Hex
    : "0x";

  return {
    sender:             op.sender,
    nonce:              hexToBigInt(op.nonce),
    initCode,
    callData:           op.callData,
    accountGasLimits:   packUint128(hexToBigInt(op.verificationGasLimit), hexToBigInt(op.callGasLimit)),
    preVerificationGas: hexToBigInt(op.preVerificationGas),
    gasFees:            packUint128(hexToBigInt(op.maxPriorityFeePerGas), hexToBigInt(op.maxFeePerGas)),
    paymasterAndData,
    signature:          op.signature,
  };
}
