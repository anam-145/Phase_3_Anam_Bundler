import "dotenv/config";
import { concat, encodeFunctionData, parseUnits, toHex } from "viem";
import { publicClient } from "./client.js";
import type { Hex } from "./types.js";

// Points to our own bundler, not Pimlico
const BUNDLER_RPC = process.env.BUNDLER_RPC ?? "http://localhost:4337";
const ENTRYPOINT  = process.env.ENTRYPOINT_ADDRESS as Hex;
const FACTORY     = process.env.FACTORY_ADDRESS    as Hex;
const PAYMASTER   = process.env.PAYMASTER_ADDRESS  as Hex;

const DUMMY_SIG = "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as const;

const FACTORY_ABI = [
  { name: "getAddress",    type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "salt", type: "uint256" }],
    outputs: [{ type: "address" }] },
  { name: "createAccount", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "owner", type: "address" }, { name: "salt", type: "uint256" }],
    outputs: [{ type: "address" }] },
] as const;

function packUint128(high: bigint, low: bigint): Hex {
  return toHex((high << 128n) | low, { size: 32 });
}

function buildPaymasterAndData(paymaster: Hex, verGas = 50_000n, postOpGas = 50_000n): Hex {
  return concat([paymaster, toHex(verGas, { size: 16 }), toHex(postOpGas, { size: 16 })]) as Hex;
}

async function getSenderAndInitCode(owner: Hex, salt: bigint) {
  const sender     = await publicClient.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "getAddress", args: [owner, salt] });
  const code       = await publicClient.getCode({ address: sender });
  const isDeployed = !!(code && code !== "0x");

  if (isDeployed) return { sender, initCode: "0x" as Hex, isDeployed };

  const factoryData = encodeFunctionData({ abi: FACTORY_ABI, functionName: "createAccount", args: [owner, salt] });
  return { sender, initCode: concat([FACTORY, factoryData]) as Hex, isDeployed };
}

async function getNonce(sender: Hex): Promise<bigint> {
  return publicClient.readContract({
    address: ENTRYPOINT,
    abi: [{ name: "getNonce", type: "function", stateMutability: "view",
      inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }],
      outputs: [{ type: "uint256" }] }],
    functionName: "getNonce",
    args: [sender, 0n],
  });
}

function buildCallData(to: Hex, amount: string): Hex {
  const transferData = encodeFunctionData({
    abi: [{ name: "transfer", type: "function", stateMutability: "nonpayable",
      inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
      outputs: [{ name: "", type: "bool" }] }],
    functionName: "transfer",
    args: [to, parseUnits(amount, 6)],
  });

  return encodeFunctionData({
    abi: [{ name: "execute", type: "function", stateMutability: "nonpayable",
      inputs: [{ name: "dest", type: "address" }, { name: "value", type: "uint256" }, { name: "func", type: "bytes" }],
      outputs: [] }],
    functionName: "execute",
    args: [process.env.USDC_ADDRESS as Hex, 0n, transferData],
  });
}

async function rpc(method: string, params: unknown[]) {
  const res  = await fetch(BUNDLER_RPC, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method} error: ${json.error.message}`);
  return json.result;
}

function toBundlerFormat(
  sender: Hex, nonce: bigint, initCode: Hex, callData: Hex,
  verificationGasLimit: bigint, callGasLimit: bigint, preVerificationGas: bigint,
  maxPriorityFeePerGas: bigint, maxFeePerGas: bigint, signature: Hex,
) {
  const hasInitCode = initCode !== "0x";
  return {
    sender,
    nonce: toHex(nonce),
    ...(hasInitCode && {
      factory:     initCode.slice(0, 42) as Hex,
      factoryData: `0x${initCode.slice(42)}` as Hex,
    }),
    callData,
    callGasLimit:                  toHex(callGasLimit),
    verificationGasLimit:          toHex(verificationGasLimit),
    preVerificationGas:            toHex(preVerificationGas),
    maxFeePerGas:                  toHex(maxFeePerGas),
    maxPriorityFeePerGas:          toHex(maxPriorityFeePerGas),
    paymaster:                     PAYMASTER,
    paymasterVerificationGasLimit: toHex(50_000n),
    paymasterPostOpGasLimit:       toHex(50_000n),
    paymasterData:                 "0x" as Hex,
    signature,
  };
}

async function getUserOpHash(
  sender: Hex, nonce: bigint, initCode: Hex, callData: Hex,
  verificationGasLimit: bigint, callGasLimit: bigint, preVerificationGas: bigint,
  maxPriorityFeePerGas: bigint, maxFeePerGas: bigint, paymasterAndData: Hex,
): Promise<Hex> {
  return publicClient.readContract({
    address: ENTRYPOINT,
    abi: [{ name: "getUserOpHash", type: "function", stateMutability: "view",
      inputs: [{ name: "userOp", type: "tuple", components: [
        { name: "sender", type: "address" }, { name: "nonce", type: "uint256" },
        { name: "initCode", type: "bytes" }, { name: "callData", type: "bytes" },
        { name: "accountGasLimits", type: "bytes32" }, { name: "preVerificationGas", type: "uint256" },
        { name: "gasFees", type: "bytes32" }, { name: "paymasterAndData", type: "bytes" },
        { name: "signature", type: "bytes" },
      ]}],
      outputs: [{ type: "bytes32" }] }],
    functionName: "getUserOpHash",
    args: [{
      sender, nonce, initCode, callData,
      accountGasLimits:   packUint128(verificationGasLimit, callGasLimit),
      preVerificationGas,
      gasFees:            packUint128(maxPriorityFeePerGas, maxFeePerGas),
      paymasterAndData,
      signature: "0x" as Hex,
    } as never],
  }) as Promise<Hex>;
}

export async function buildUserOp(owner: Hex, to: Hex, amount: string, salt = 0n) {
  const { sender, initCode, isDeployed } = await getSenderAndInitCode(owner, salt);
  const nonce    = await getNonce(sender);
  const callData = buildCallData(to, amount);

  // Gas prices from our bundler
  const gasPrices = await rpc("pimlico_getUserOperationGasPrice", []);
  const { maxFeePerGas, maxPriorityFeePerGas } = gasPrices.fast;

  // Gas estimation from our bundler
  const gas = await rpc("eth_estimateUserOperationGas", [
    toBundlerFormat(sender, nonce, initCode, callData, 500_000n, 500_000n, 100_000n,
      BigInt(maxPriorityFeePerGas), BigInt(maxFeePerGas), DUMMY_SIG),
    ENTRYPOINT,
  ]);

  const verificationGasLimit = BigInt(gas.verificationGasLimit);
  const callGasLimit         = BigInt(gas.callGasLimit);
  const preVerificationGas   = BigInt(gas.preVerificationGas);
  const paymasterAndData     = buildPaymasterAndData(PAYMASTER);

  const userOpHash = await getUserOpHash(
    sender, nonce, initCode, callData,
    verificationGasLimit, callGasLimit, preVerificationGas,
    BigInt(maxPriorityFeePerGas), BigInt(maxFeePerGas), paymasterAndData,
  );

  const userOp = toBundlerFormat(
    sender, nonce, initCode, callData,
    verificationGasLimit, callGasLimit, preVerificationGas,
    BigInt(maxPriorityFeePerGas), BigInt(maxFeePerGas), DUMMY_SIG,
  );

  return { userOp, userOpHash, sender, isDeployed };
}

export async function getCounterfactual(owner: Hex, salt = 0n) {
  const sender     = await publicClient.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "getAddress", args: [owner, salt] });
  const code       = await publicClient.getCode({ address: sender });
  const isDeployed = !!(code && code !== "0x");
  return { address: sender, isDeployed };
}
