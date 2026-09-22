import { z } from "zod";

/**
 * Server-only environment schema. Importing this module from client code is a
 * build-time error path (see `env.client.ts` for the public subset) because
 * secrets such as the Supabase service role key must never reach the browser.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SOLANA_NETWORK: z.enum(["devnet", "testnet", "mainnet-beta"]).default("devnet"),
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  NEXT_PUBLIC_SOLANA_EXPLORER: z.string().url().default("https://explorer.solana.com"),
  SOLANA_RPC_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  DEPOSIT_WALLET_ADDRESS: z.string().optional(),
  ADMIN_WALLET_ADDRESSES: z.string().optional(),
  SESSION_SECRET: z.string().min(16).default("dev-only-insecure-secret-change-me-1234"),
  // Circle's official Solana devnet USDC mint by default — see
  // https://developers.circle.com/stablecoins/docs/usdc-on-test-networks
  NEXT_PUBLIC_USDC_MINT_ADDRESS: z.string().default("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}

export function getSolanaRpcUrl(): string {
  const env = getServerEnv();
  return env.SOLANA_RPC_URL ?? env.NEXT_PUBLIC_SOLANA_RPC_URL;
}

export function getAdminWalletAddresses(): string[] {
  const env = getServerEnv();
  return (env.ADMIN_WALLET_ADDRESSES ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

export function getDepositWalletAddress(): string {
  const env = getServerEnv();
  if (!env.DEPOSIT_WALLET_ADDRESS) {
    throw new Error("DEPOSIT_WALLET_ADDRESS is not configured");
  }
  return env.DEPOSIT_WALLET_ADDRESS;
}

export function getUsdcMintAddress(): string {
  return getServerEnv().NEXT_PUBLIC_USDC_MINT_ADDRESS;
}
