import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "./types.js";

export async function signUserOp(userOpHash: Hex, privateKey: Hex): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  return account.signMessage({ message: { raw: userOpHash } });
}
