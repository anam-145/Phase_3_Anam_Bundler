import "dotenv/config";
import type { Hex } from "./types.js";

// Points to our own bundler RPC, not Pimlico
const BUNDLER_RPC = process.env.BUNDLER_RPC ?? "http://localhost:4337";
const ENTRYPOINT  = process.env.ENTRYPOINT_ADDRESS as Hex;

export async function sendToBundler(userOp: object): Promise<string> {
  const res  = await fetch(BUNDLER_RPC, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_sendUserOperation", params: [userOp, ENTRYPOINT] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Bundler error [${json.error.code}]: ${json.error.message}`);
  return json.result;
}
