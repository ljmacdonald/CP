import "server-only";
import { z } from "zod";
import { isSignature, signature as toSignature } from "@solana/kit";
import { getSolanaRpc, LAMPORTS_PER_SOL } from "@/lib/solana/rpc";
import { getSolToNgnRateMinorUnits } from "@/lib/env";
import { bigIntFloorDiv } from "@/lib/money";

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
  lamports: bigint;
  amountMinorUnits: bigint;
  slot: string;
  blockTime: number | null;
}

export interface VerificationFailure {
  ok: false;
  reason: VerificationFailureReason;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;

const parsedTransferInfoSchema = z.object({
  source: z.string(),
  destination: z.string(),
  lamports: z.number().nonnegative(),
});

export interface VerifyDepositParams {
  transactionSignature: string;
  expectedDestinationWallet: string;
  expectedSenderWallet: string;
  /** Required commitment level before the deposit can be trusted. */
  commitment?: "confirmed" | "finalized";
}

/**
 * The one place in the codebase allowed to say a deposit happened. Re-derives
 * everything from the chain itself rather than trusting any client-supplied
 * amount: destination, sender, asset, and amount all come from the parsed
 * on-chain instruction, never from the request body.
 */
export async function verifySolTransferTransaction(
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

  const instructions = transaction.transaction.message.instructions;

  for (const instruction of instructions) {
    if (!("parsed" in instruction)) continue;
    if (instruction.program !== "system") continue;
    const parsed = instruction.parsed as { type: string; info?: unknown };
    if (parsed.type !== "transfer") continue;

    const infoResult = parsedTransferInfoSchema.safeParse(parsed.info);
    if (!infoResult.success) continue;
    const info = infoResult.data;

    if (info.destination !== expectedDestinationWallet) {
      continue;
    }
    if (info.source !== expectedSenderWallet) {
      return { ok: false, reason: "wrong_sender" };
    }
    if (info.lamports <= 0) {
      return { ok: false, reason: "zero_amount" };
    }

    const lamports = BigInt(Math.round(info.lamports));
    const rate = getSolToNgnRateMinorUnits(); // minor units per 1 SOL
    const amountMinorUnits = bigIntFloorDiv(lamports * rate, LAMPORTS_PER_SOL);

    return {
      ok: true,
      lamports,
      amountMinorUnits,
      slot: transaction.slot.toString(),
      blockTime: transaction.blockTime !== null ? Number(transaction.blockTime) : null,
    };
  }

  return { ok: false, reason: "no_matching_transfer" };
}
