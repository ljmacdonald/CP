/**
 * Public, browser-safe environment subset. Only NEXT_PUBLIC_* values may
 * appear here — never import server env.ts from client components.
 */
export const clientEnv = {
  solanaNetwork: (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as
    | "devnet"
    | "testnet"
    | "mainnet-beta",
  solanaRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  solanaExplorer: process.env.NEXT_PUBLIC_SOLANA_EXPLORER ?? "https://explorer.solana.com",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  usdcMintAddress: process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

export function explorerTxUrl(signature: string): string {
  const cluster = clientEnv.solanaNetwork === "mainnet-beta" ? "" : `?cluster=${clientEnv.solanaNetwork}`;
  return `${clientEnv.solanaExplorer}/tx/${signature}${cluster}`;
}

export function explorerAddressUrl(address: string): string {
  const cluster = clientEnv.solanaNetwork === "mainnet-beta" ? "" : `?cluster=${clientEnv.solanaNetwork}`;
  return `${clientEnv.solanaExplorer}/address/${address}${cluster}`;
}
