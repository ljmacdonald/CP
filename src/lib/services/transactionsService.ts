import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { TransactionsRow, TransactionType } from "@/types/database";

export interface ListTransactionsParams {
  userId: string;
  type?: TransactionType;
  limit?: number;
}

export async function listTransactions(params: ListTransactionsParams): Promise<TransactionsRow[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 100);

  if (params.type) {
    query = query.eq("type", params.type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
