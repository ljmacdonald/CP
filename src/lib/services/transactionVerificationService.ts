import "server-only";
import { z } from "zod";
import { isSignature, signature as toSignature } from "@solana/kit";
import { getSolanaRpc } from "@/lib/solana/rpc";
import { getUsdcMintAddress } from "@/lib/env";
import { getUsdcTokenAccount, usdcBaseUnitsToMinorUnits } from "@/lib/solana/usdc";

export type VerificationFailureReason =
  | "invalid_signature_format"
  | "transaction_not_found"
  | "transaction_failed"
  | "unsupported_asset"
  | "no_matching_transfer"
  | "wrong_destination"
  | "wrong_sender"
  | "zero_amount"
  | "rpc_error";

export interface VerificationSuccess {
  ok: true;
  usdcBaseUnits: bigint;
  amountMinorUnits: bigint;
  slot: string;
  blockTime: number | null;
}

export interface VerificationFailure {
  ok: false;
  reason: VerificationFailureReason;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;

const transferCheckedInfoSchema = z.object({
  source: z.string(),
  destination: z.string(),
  mint: z.string(),
  authority: z.string().optional(),
  tokenAmount: z.object({
    amount: z.string(),
    decimals: z.number(),
  }),
});

export interface VerifyDepositParams {
  transactionSignature: string;
  /** The deposit wallet's own address — its USDC associated token account is derived from this. */
  expectedDestinationWallet: string;
  expectedSenderWallet: string;
  /** Required commitment level before the deposit can be trusted. */
  commitment?: "confirmed" | "finalized";
}

/**
 * The one place in the codebase allowed to say a deposit happened. Re-derives
 * everything from the chain itself rather than trusting any client-supplied
 * amount: destination, sender, asset (mint), and amount all come from the
 * parsed on-chain instruction, never from the request body. Only the SPL
 * Token program's `transferChecked` instruction is accepted (not the
 * Token-2022 program, and not the older unchecked `transfer` instruction,
 * which doesn't carry the mint) — a documented, narrow surface for this
 * prototype's single supported asset (devnet USDC).
 */
export async function verifyUsdcTransferTransaction(
  params: VerifyDepositParams
): Promise<VerificationResult> {
  const { transactionSignature, expectedDestinationWallet, expectedSenderWallet } = params;
  const commitment = params.commitment ?? "confirmed";

  if (!isSignature(transactionSignature)) {
    return { ok: false, reason: "invalid_signature_format" };
  }

  const rpc = getSolanaRpc();

  let transaction;
  try {
    transaction = await rpc
      .getTransaction(toSignature(transactionSignature), {
        encoding: "jsonParsed",
        commitment,
        maxSupportedTransactionVersion: 0,
      })
      .send();
  } catch {
    return { ok: false, reason: "rpc_error" };
  }

  if (!transaction) {
    return { ok: false, reason: "transaction_not_found" };
  }

  if (transaction.meta?.err) {
    return { ok: false, reason: "transaction_failed" };
  }

  const mintAddress = getUsdcMintAddress();
  const expectedDestinationTokenAccount = getUsdcTokenAccount(expectedDestinationWallet, mintAddress);

  const instructions = transaction.transaction.message.instructions;

  for (const instruction of instructions) {
    if (!("parsed" in instruction)) continue;
    if (instruction.program !== "spl-token") continue;
    const parsed = instruction.parsed as { type: string; info?: unknown };
    if (parsed.type !== "transferChecked") continue;

    const infoResult = transferCheckedInfoSchema.safeParse(parsed.info);
    if (!infoResult.success) continue;
    const info = infoResult.data;

    if (info.destination !== expectedDestinationTokenAccount) {
      continue;
    }
    if (info.mint !== mintAddress) {
      return { ok: false, reason: "unsupported_asset" };
    }
    if (!info.authority || info.authority !== expectedSenderWallet) {
      return { ok: false, reason: "wrong_sender" };
    }

    const usdcBaseUnits = BigInt(info.tokenAmount.amount);
    if (usdcBaseUnits <= 0n) {
      return { ok: false, reason: "zero_amount" };
    }

    return {
      ok: true,
      usdcBaseUnits,
      amountMinorUnits: usdcBaseUnitsToMinorUnits(usdcBaseUnits),
      slot: transaction.slot.toString(),
      blockTime: transaction.blockTime !== null ? Number(transaction.blockTime) : null,
    };
  }

  return { ok: false, reason: "no_matching_transfer" };
}
