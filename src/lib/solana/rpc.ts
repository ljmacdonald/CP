import "server-only";
import { createSolanaRpc } from "@solana/kit";
import { getSolanaRpcUrl } from "@/lib/env";

let rpcClient: ReturnType<typeof createSolanaRpc> | null = null;

export function getSolanaRpc() {
  if (rpcClient) return rpcClient;
  rpcClient = createSolanaRpc(getSolanaRpcUrl());
  return rpcClient;
}

export const LAMPORTS_PER_SOL = 1_000_000_000n;
