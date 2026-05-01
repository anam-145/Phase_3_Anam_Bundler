import { mempool } from "./mempool.js";
import { toPackedOp } from "./packer.js";
import { EP_ABI } from "./entrypoint.js";
import { walletClient, bundlerAccount } from "./client.js";
import type { MempoolEntry, Hex } from "./types.js";

const ENTRYPOINT = process.env.ENTRYPOINT_ADDRESS as Hex;

async function submitBundle(entries: MempoolEntry[]): Promise<Hex> {
  const ops = entries.map(e => toPackedOp(e.userOp));
  return walletClient.writeContract({
    address:      ENTRYPOINT,
    abi:          EP_ABI,
    functionName: "handleOps",
    args:         [ops as never, bundlerAccount.address],
  });
}

/**
 * Flush all pending UserOps from the mempool.
 * Tries to submit them as one batch; if the batch reverts (e.g. one bad op),
 * falls back to submitting each individually so the rest still go through.
 */
export async function flush() {
  const pending = mempool.pending();
  if (!pending.length) return;

  try {
    const txHash = await submitBundle(pending.map(([, e]) => e));
    for (const [hash, entry] of pending) {
      entry.txHash = txHash;
      console.log(`[executor] op ${hash.slice(0, 10)}… → tx ${txHash}`);
    }
  } catch (batchErr: any) {
    console.error("[executor] batch failed, retrying individually:", batchErr.message);

    for (const [hash, entry] of pending) {
      try {
        const txHash = await submitBundle([entry]);
        entry.txHash = txHash;
        console.log(`[executor] op ${hash.slice(0, 10)}… → tx ${txHash}`);
      } catch (e: any) {
        console.error(`[executor] op ${hash.slice(0, 10)}… permanently rejected:`, e.message);
        mempool.delete(hash);
      }
    }
  }
}
