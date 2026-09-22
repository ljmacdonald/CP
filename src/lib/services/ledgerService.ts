import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { LedgerAccountType } from "@/types/database";

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Insufficient balance for this operation");
    this.name = "InsufficientBalanceError";
  }
}

/** Maps Postgres function error codes raised by the ledger functions to typed errors. */
export function mapLedgerRpcError(error: { code?: string; message?: string } | null): never | void {
  if (!error) return;
  const code = error.code;
  if (code === "P0006") throw new InsufficientBalanceError();
  if (code === "P0004") throw new Error("quote_expired");
  if (code === "P0003") throw new Error("quote_already_used");
  if (code === "P0002") throw new Error("not_found");
  if (code === "P0005") throw new Error("position_not_active");
  if (code === "P0001") throw new Error("invalid_amount");
  throw new Error(error.message ?? "ledger_operation_failed");
}

export async function getLedgerBalances(
  userId: string
): Promise<Record<LedgerAccountType, string>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ledger_accounts")
    .select("account_type, balance_minor_units")
    .eq("user_id", userId);

  if (error) throw error;

  const balances: Record<LedgerAccountType, string> = {
    cash: "0",
    invested: "0",
    earnings: "0",
  };
  for (const row of data ?? []) {
    balances[row.account_type as LedgerAccountType] = row.balance_minor_units as string;
  }
  return balances;
}
