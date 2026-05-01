import "dotenv/config";
import Fastify from "fastify";
import { toHex } from "viem";

import { EP_ABI } from "./entrypoint.js";
import { mempool } from "./mempool.js";
import { flush } from "./executor.js";
import { estimateGas, getGasPrice } from "./estimator.js";
import { toPackedOp } from "./packer.js";
import { publicClient, bundlerAccount } from "./client.js";
import type { Hex, UserOpRpc } from "./types.js";

const PORT       = process.env.BUNDLER_PORT ? parseInt(process.env.BUNDLER_PORT) : 4337;
const ENTRYPOINT = process.env.ENTRYPOINT_ADDRESS as Hex;

// Ask the EntryPoint for the canonical hash — used as the mempool key
async function getUserOpHash(op: UserOpRpc): Promise<Hex> {
  return publicClient.readContract({
    address:      ENTRYPOINT,
    abi:          EP_ABI,
    functionName: "getUserOpHash",
    args:         [toPackedOp(op) as never],
  }) as Promise<Hex>;
}

// Flush every 2 seconds
setInterval(flush, 2_000);

// ─── JSON-RPC server ──────────────────────────────────────────────────────────

const app = Fastify({ logger: false });

app.post("/", async (req, reply) => {
  const { jsonrpc, id, method, params } = req.body as {
    jsonrpc: string;
    id: number;
    method: string;
    params: unknown[];
  };

  const ok  = (result: unknown) => reply.send({ jsonrpc, id, result });
  const err = (code: number, message: string) =>
    reply.send({ jsonrpc, id, error: { code, message } });

  try {
    switch (method) {

      // ── eth_sendUserOperation ──────────────────────────────────────────────
      // Validate, add to mempool, return userOpHash.
      case "eth_sendUserOperation": {
        const [userOp, entryPoint] = params as [UserOpRpc, Hex];

        if (entryPoint.toLowerCase() !== ENTRYPOINT.toLowerCase())
          return err(-32602, `Unsupported entryPoint: ${entryPoint}`);
        if (!userOp.sender || !userOp.signature || userOp.signature === "0x")
          return err(-32602, "Invalid UserOp: missing sender or signature");

        const hash = await getUserOpHash(userOp);
        if (mempool.has(hash))
          return err(-32602, "UserOp already in mempool");

        mempool.add(hash, { userOp, entryPoint, submittedAt: Date.now() });
        console.log(`[mempool] +${hash.slice(0, 10)}…  (total: ${mempool.size()})`);
        return ok(hash);
      }

      // ── eth_estimateUserOperationGas ──────────────────────────────────────
      case "eth_estimateUserOperationGas": {
        const [userOp] = params as [UserOpRpc];
        return ok(estimateGas(userOp));
      }

      // ── eth_getUserOperationByHash ─────────────────────────────────────────
      case "eth_getUserOperationByHash": {
        const [hash] = params as [string];
        const entry  = mempool.get(hash);
        if (!entry) return ok(null);
        return ok({
          userOp:          entry.userOp,
          entryPoint:      entry.entryPoint,
          transactionHash: entry.txHash ?? null,
          blockNumber:     null,
        });
      }

      // ── eth_getUserOperationReceipt ────────────────────────────────────────
      case "eth_getUserOperationReceipt": {
        const [hash] = params as [string];
        const entry  = mempool.get(hash);
        if (!entry?.txHash) return ok(null);

        const receipt = await publicClient.getTransactionReceipt({ hash: entry.txHash });
        return ok({
          userOpHash:    hash,
          sender:        entry.userOp.sender,
          nonce:         entry.userOp.nonce,
          actualGasCost: toHex(receipt.gasUsed * receipt.effectiveGasPrice),
          actualGasUsed: toHex(receipt.gasUsed),
          success:       receipt.status === "success",
          receipt: {
            transactionHash: receipt.transactionHash,
            blockNumber:     toHex(receipt.blockNumber),
          },
        });
      }

      // ── pimlico_getUserOperationGasPrice (drop-in replacement) ────────────
      case "pimlico_getUserOperationGasPrice":
      case "eth_getUserOperationGasPrice": {
        return ok(await getGasPrice());
      }

      default:
        return err(-32601, `Method not found: ${method}`);
    }

  } catch (e: any) {
    console.error(`[rpc] ${method} error:`, e.message);
    return err(-32000, e.message);
  }
});

app.listen({ port: PORT, host: "0.0.0.0" }, () => {
  console.log(`\nAnam Bundler RPC  →  http://localhost:${PORT}`);
  console.log(`Signer            →  ${bundlerAccount.address}`);
  console.log(`EntryPoint        →  ${ENTRYPOINT}\n`);
});
