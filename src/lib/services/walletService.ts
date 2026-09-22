import "server-only";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { isAddress } from "@solana/kit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { UsersRow } from "@/types/database";
import { recordAuditLog } from "@/lib/services/adminService";

export class InvalidWalletAddressError extends Error {
  constructor() {
    super("Invalid Solana wallet address");
    this.name = "InvalidWalletAddressError";
  }
}

export class InvalidSignatureError extends Error {
  constructor() {
    super("Wallet signature could not be verified");
    this.name = "InvalidSignatureError";
  }
}

/** Validates and returns the canonical (trimmed) form of a base58 Solana address. */
export function normalizeWalletAddress(rawAddress: string): string {
  const trimmed = rawAddress.trim();
  if (!isAddress(trimmed)) {
    throw new InvalidWalletAddressError();
  }
  return trimmed;
}

/**
 * Verifies an ed25519 signature produced by the connected wallet over the
 * challenge message (Sign-In-With-Solana style). This is what lets the
 * backend trust a wallet address instead of accepting it at face value from
 * the request body, which would let anyone impersonate any wallet.
 */
export function verifyWalletSignature(params: {
  walletAddress: string;
  message: string;
  signature: string;
}): boolean {
  try {
    const publicKeyBytes = bs58.decode(params.walletAddress);
    const signatureBytes = bs58.decode(params.signature);
    const messageBytes = new TextEncoder().encode(params.message);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

export function buildChallengeMessage(params: {
  walletAddress: string;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    "YIELD wants you to sign in with your Solana wallet.",
    "",
    `Wallet: ${params.walletAddress}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    "",
    "This request will not trigger a blockchain transaction or cost any gas.",
  ].join("\n");
}

/** Gets the existing user for a wallet address or creates one. Wallet address is the only identity primitive — no email/password. */
export async function getOrCreateUserByWallet(walletAddress: string): Promise<UsersRow> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select("*")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({ wallet_address: walletAddress })
    .select("*")
    .single();

  if (insertError) throw insertError;

  await recordAuditLog({
    actorType: "system",
    actorId: walletAddress,
    action: "user.created",
    entityType: "user",
    entityId: created.id,
    metadata: { wallet_address: walletAddress },
  });

  return created;
}
