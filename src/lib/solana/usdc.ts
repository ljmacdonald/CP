import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

/**
 * USDC uses 6 decimal places on-chain, independent of this app's own
 * "minor unit" convention (2 decimals / cents, see lib/money.ts). One minor
 * unit ($0.01) is always exactly 10,000 USDC base units — an integer ratio,
 * so converting between the two is lossless in the dollars-to-cents
 * direction and exact-floor in the reverse direction.
 */
export const USDC_DECIMALS = 6;
export const USDC_BASE_UNITS_PER_MINOR_UNIT = 10_000n;

export function minorUnitsToUsdcBaseUnits(minorUnits: bigint): bigint {
  return minorUnits * USDC_BASE_UNITS_PER_MINOR_UNIT;
}

export function usdcBaseUnitsToMinorUnits(baseUnits: bigint): bigint {
  return baseUnits / USDC_BASE_UNITS_PER_MINOR_UNIT;
}

/** The associated token account (ATA) that holds `ownerWalletAddress`'s USDC. */
export function getUsdcTokenAccount(ownerWalletAddress: string, mintAddress: string): string {
  return getAssociatedTokenAddressSync(new PublicKey(mintAddress), new PublicKey(ownerWalletAddress)).toBase58();
}
