import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { buildUserOp, getCounterfactual } from "./builder.js";
import { sendToBundler } from "./bundler.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

// GET /api/userop/counterfactual?owner=0x...
app.get("/api/userop/counterfactual", async (request, reply) => {
  const { owner, salt } = request.query as { owner: `0x${string}`; salt?: string };
  if (!owner) return reply.status(400).send({ error: "owner is required" });

  const result = await getCounterfactual(owner, salt ? BigInt(salt) : 0n);
  return reply.send(result);
});

// POST /api/userop/build  — builds UserOp and returns hash for client to sign
app.post("/api/userop/build", async (request, reply) => {
  const { owner, to, amount, salt } = request.body as {
    owner: `0x${string}`; to: `0x${string}`; amount: string; salt?: string;
  };
  if (!owner)  return reply.status(400).send({ error: "owner is required" });
  if (!to)     return reply.status(400).send({ error: "to is required" });
  if (!amount) return reply.status(400).send({ error: "amount is required" });

  const result = await buildUserOp(owner, to, amount, salt ? BigInt(salt) : 0n);
  return reply.send(result);
});

// POST /api/userop/submit  — attaches signature and sends to bundler
app.post("/api/userop/submit", async (request, reply) => {
  const { userOp, signature } = request.body as { userOp: object; signature: `0x${string}` };
  if (!userOp)    return reply.status(400).send({ error: "userOp is required" });
  if (!signature) return reply.status(400).send({ error: "signature is required" });

  const userOpHash = await sendToBundler({ ...userOp, signature });
  return reply.send({ userOpHash });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen({ port, host: "0.0.0.0" }, () => {
  console.log(`Anam API server running on port ${port}`);
});
