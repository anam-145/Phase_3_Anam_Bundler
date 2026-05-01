export type Hex = `0x${string}`;

// ERC-4337 v0.7 UserOperation in bundler RPC (unpacked) format
export interface UserOpRpc {
  sender: Hex;
  nonce: Hex;
  factory?: Hex;
  factoryData?: Hex;
  callData: Hex;
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  maxFeePerGas: Hex;
  maxPriorityFeePerGas: Hex;
  paymaster?: Hex;
  paymasterVerificationGasLimit?: Hex;
  paymasterPostOpGasLimit?: Hex;
  paymasterData?: Hex;
  signature: Hex;
}

export interface MempoolEntry {
  userOp:      UserOpRpc;
  entryPoint:  Hex;
  submittedAt: number;
  txHash?:     Hex;
}
