import type { MempoolEntry } from "./types.js";

// In-memory mempool: userOpHash → MempoolEntry
const store = new Map<string, MempoolEntry>();

export const mempool = {
  add(hash: string, entry: MempoolEntry) {
    store.set(hash, entry);
  },

  get(hash: string): MempoolEntry | undefined {
    return store.get(hash);
  },

  has(hash: string): boolean {
    return store.has(hash);
  },

  delete(hash: string) {
    store.delete(hash);
  },

  // All entries that have not yet been submitted on-chain
  pending(): Array<[string, MempoolEntry]> {
    return [...store.entries()].filter(([, e]) => !e.txHash);
  },

  size(): number {
    return store.size;
  },
};
