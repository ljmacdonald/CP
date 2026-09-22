import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapLedgerRpcError } from "@/lib/services/ledgerService";
import { isAddress } from "@solana/kit";
import type { WithdrawalsRow } from "@/types/database";

export class InvalidDestinationError extends Error {
  constructor() {
    super("Destination wallet address is not valid");
    this.name = "InvalidDestinationError";
  }
}

/**
 * Debits the user's cash ledger balance atomically (see fn_request_withdrawal)
 * and records a withdrawal request. Actual on-chain payout execution is a
 * clearly separated concern — see README "Known limitations" — a production
 * deployment wires a treasury signing service into `executeOnChainPayout`
 * without touching this function's contract.
 */
export async function requestWithdrawal(
  userId: string,
  amountMinorUnits: bigint,
  destinationWallet: string
): Promise<WithdrawalsRow> {
  if (!isAddress(destinationWallet.trim())) {
    throw new InvalidDestinationError();
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("fn_request_withdrawal", {
    p_user_id: userId,
    p_amount_minor_units: amountMinorUnits.toString(),
    p_destination_wallet: destinationWallet.trim(),
    p_asset: "USDC",
  });

  if (error) mapLedgerRpcError(error);
  return data as WithdrawalsRow;
}

export async function listWithdrawals(userId: string): Promise<WithdrawalsRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Placeholder extension point for a real treasury payout (e.g. a custody
 * service or multisig signer executing a devnet USDC transfer). Not invoked
 * automatically in the prototype — see README.
 */
export async function executeOnChainPayout(_withdrawal: WithdrawalsRow): Promise<never> {
  throw new Error(
    "On-chain payout execution requires a treasury signing service, which is out of scope for this prototype."
  );
}
