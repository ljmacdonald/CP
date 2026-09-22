import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getDepositWalletAddress } from "@/lib/env";
import { minorUnitsToUsdcBaseUnits } from "@/lib/solana/usdc";
import { verifyUsdcTransferTransaction } from "@/lib/services/transactionVerificationService";
import { getDefaultProduct } from "@/lib/services/investmentService";
import { mapLedgerRpcError } from "@/lib/services/ledgerService";
import { recordAuditLog } from "@/lib/services/adminService";
import type { DepositsRow, InvestmentPositionsRow } from "@/types/database";

export class DepositError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "DepositError";
  }
}

export interface DepositIntent {
  deposit: DepositsRow;
  destinationWallet: string;
  expectedUsdcBaseUnits: string;
}

/** requestedAmountMinorUnits is a UI intent only — never trusted for crediting. */
export async function createDepositIntent(
  userId: string,
  walletAddress: string,
  requestedAmountMinorUnits: bigint
): Promise<DepositIntent> {
  if (requestedAmountMinorUnits <= 0n) {
    throw new DepositError("Deposit amount must be greater than zero", "invalid_amount");
  }

  const supabase = getSupabaseAdmin();
  const destinationWallet = getDepositWalletAddress();
  const expectedUsdcBaseUnits = minorUnitsToUsdcBaseUnits(requestedAmountMinorUnits);

  const { data, error } = await supabase
    .from("deposits")
    .insert({
      user_id: userId,
      wallet_address: walletAddress,
      requested_amount_minor_units: requestedAmountMinorUnits.toString(),
      asset: "USDC",
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw error;

  return { deposit: data, destinationWallet, expectedUsdcBaseUnits: expectedUsdcBaseUnits.toString() };
}

export async function getDeposit(depositId: string, userId: string): Promise<DepositsRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("deposits")
    .select("*")
    .eq("id", depositId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Called once the wallet has broadcast the transaction, before confirmation is known. */
export async function recordSubmittedSignature(
  depositId: string,
  userId: string,
  transactionSignature: string
): Promise<DepositsRow> {
  const supabase = getSupabaseAdmin();

  const existingForSignature = await supabase
    .from("deposits")
    .select("id, status")
    .eq("transaction_signature", transactionSignature)
    .maybeSingle();

  if (existingForSignature.data && existingForSignature.data.id !== depositId) {
    throw new DepositError("This transaction has already been submitted", "deposit_already_credited");
  }

  const { data, error } = await supabase
    .from("deposits")
    .update({ status: "confirming", transaction_signature: transactionSignature })
    .eq("id", depositId)
    .eq("user_id", userId)
    .in("status", ["pending", "submitted", "confirming"])
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export interface VerifyAndConfirmResult {
  deposit: DepositsRow;
  position: InvestmentPositionsRow;
  credited: boolean;
}

/**
 * The backend-only path that turns a signed, broadcast transaction into a
 * ledger credit. Runs full on-chain verification (destination, sender,
 * amount, success, commitment) before calling the atomic SQL function that
 * applies the credit — see requirements enumerated in transactionVerificationService.
 */
export async function verifyAndConfirmDeposit(
  depositId: string,
  userId: string
): Promise<VerifyAndConfirmResult> {
  const supabase = getSupabaseAdmin();

  const { data: deposit, error } = await supabase
    .from("deposits")
    .select("*")
    .eq("id", depositId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;

  if (deposit.status === "confirmed") {
    const { data: position } = await supabase
      .from("investment_positions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return { deposit, position: position as InvestmentPositionsRow, credited: false };
  }

  if (!deposit.transaction_signature) {
    throw new DepositError("No transaction has been submitted for this deposit yet", "transaction_pending");
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("wallet_address")
    .eq("id", userId)
    .single();
  if (userError) throw userError;

  const verification = await verifyUsdcTransferTransaction({
    transactionSignature: deposit.transaction_signature,
    expectedDestinationWallet: getDepositWalletAddress(),
    expectedSenderWallet: user.wallet_address,
  });

  if (!verification.ok) {
    const retryableReasons = new Set(["transaction_not_found", "rpc_error"]);
    if (!retryableReasons.has(verification.reason)) {
      await supabase.from("deposits").update({ status: "rejected" }).eq("id", depositId);
      await recordAuditLog({
        actorType: "system",
        actorId: userId,
        action: "deposit.rejected",
        entityType: "deposit",
        entityId: depositId,
        metadata: { reason: verification.reason },
      });
    }
    throw new DepositError(describeVerificationFailure(verification.reason), verification.reason);
  }

  const product = await getDefaultProduct();

  const { data: rpcResult, error: rpcError } = await supabase.rpc("fn_confirm_deposit", {
    p_deposit_id: depositId,
    p_actual_amount_minor_units: verification.amountMinorUnits.toString(),
    p_transaction_signature: deposit.transaction_signature,
    p_product_id: product.id,
    p_cycle_days: product.cycle_days,
    p_annual_rate_bps: product.target_annual_rate_bps,
  });

  if (rpcError) mapLedgerRpcError(rpcError);

  const result = rpcResult as { credited: boolean; deposit: DepositsRow; position: InvestmentPositionsRow };
  return { deposit: result.deposit, position: result.position, credited: result.credited };
}

function describeVerificationFailure(reason: string): string {
  switch (reason) {
    case "transaction_failed":
      return "The transaction failed on-chain.";
    case "wrong_destination":
    case "no_matching_transfer":
      return "We could not find a matching transfer to the deposit address.";
    case "wrong_sender":
      return "The transaction sender does not match your connected wallet.";
    case "zero_amount":
      return "The transaction amount was zero.";
    case "invalid_signature_format":
      return "That does not look like a valid transaction signature.";
    default:
      return "We could not verify this transaction. Please try again.";
  }
}
