import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import { signUserOp } from "./signer.js";

const SERVER = process.env.SERVER_URL ?? "http://localhost:3000";

// Usage: npm run send -- 0xRECIPIENT AMOUNT_IN_USDC
async function main(to: `0x${string}`, amount: string) {
  const privateKey = process.env.EOA_PRIVATE_KEY as `0x${string}`;
  const owner = privateKeyToAccount(privateKey).address;

  // 1. Server builds the UserOp — private key never sent
  const buildRes = await fetch(`${SERVER}/api/userop/build`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ owner, to, amount }),
  });
  if (!buildRes.ok) throw new Error(`build failed: ${await buildRes.text()}`);

  const { userOp, userOpHash, sender, isDeployed } = await buildRes.json();
  console.log(`Sender: ${sender} | deployed: ${isDeployed}`);

  // 2. Sign locally — key never leaves this machine
  const signature = await signUserOp(userOpHash, privateKey);

  // 3. Submit signed UserOp via server → our bundler → EntryPoint
  const submitRes = await fetch(`${SERVER}/api/userop/submit`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ userOp, signature }),
  });
  if (!submitRes.ok) throw new Error(`submit failed: ${await submitRes.text()}`);

  const { userOpHash: finalHash } = await submitRes.json();
  console.log("UserOp hash:", finalHash);
}

main(
  process.argv[2] as `0x${string}`,
  process.argv[3],
).catch(console.error);
