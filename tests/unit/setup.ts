// Well-known, real Solana program addresses used purely as valid-shaped
// base58/32-byte fixtures — not used to interact with any program.
export const TEST_DEPOSIT_WALLET = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TEST_ADMIN_WALLET = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const TEST_USER_WALLET = "11111111111111111111111111111111";

process.env.NEXT_PUBLIC_SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
process.env.NEXT_PUBLIC_SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
process.env.NEXT_PUBLIC_SOLANA_EXPLORER = process.env.NEXT_PUBLIC_SOLANA_EXPLORER ?? "https://explorer.solana.com";
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret-do-not-use-in-prod-0000";
process.env.DEPOSIT_WALLET_ADDRESS = process.env.DEPOSIT_WALLET_ADDRESS ?? TEST_DEPOSIT_WALLET;
process.env.ADMIN_WALLET_ADDRESSES = process.env.ADMIN_WALLET_ADDRESSES ?? TEST_ADMIN_WALLET;
process.env.SOL_TO_NGN_RATE_MINOR_UNITS = process.env.SOL_TO_NGN_RATE_MINOR_UNITS ?? "150000000";
