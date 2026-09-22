import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminWalletAddresses } from "@/lib/env";
import type {
  ActorType,
  InvestmentProductsRow,
  DepositsRow,
  WithdrawalsRow,
  UsersRow,
  TransactionsRow,
} from "@/types/database";

export function isAdminWallet(walletAddress: string): boolean {
  const allowlist = getAdminWalletAddresses();
  return allowlist.includes(walletAddress);
}

export class ForbiddenError extends Error {
  constructor(message = "This wallet is not authorized for admin access") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function requireAdminWallet(walletAddress: string): void {
  if (!isAdminWallet(walletAddress)) {
    throw new ForbiddenError();
  }
}

export interface AuditLogInput {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Every money-relevant state transition and every admin config change must call this. */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("audit_logs").insert({
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });
  if (error) throw error;
}

export interface AdminMetrics {
  totalUsers: number;
  totalDepositsMinorUnits: string;
  totalPortfolioValueMinorUnits: string;
  totalEarningsMinorUnits: string;
  pendingDeposits: number;
  pendingWithdrawals: number;
  activePositions: number;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const supabase = getSupabaseAdmin();

  const [usersCount, deposits, positions, earningsAccounts, pendingDeposits, pendingWithdrawals, activePositions] =
    await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("deposits").select("actual_amount_minor_units").eq("status", "confirmed"),
      supabase.from("investment_positions").select("principal_minor_units").eq("status", "active"),
      supabase.from("ledger_accounts").select("balance_minor_units").eq("account_type", "earnings"),
      supabase.from("deposits").select("id", { count: "exact", head: true }).in("status", [
        "pending",
        "submitted",
        "confirming",
        "verifying",
      ]),
      supabase.from("withdrawals").select("id", { count: "exact", head: true }).in("status", [
        "pending",
        "processing",
      ]),
      supabase.from("investment_positions").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);

  const totalDeposits = (deposits.data ?? []).reduce(
    (sum, d) => sum + BigInt(d.actual_amount_minor_units ?? "0"),
    0n
  );
  const totalPortfolioValue = (positions.data ?? []).reduce(
    (sum, p) => sum + BigInt(p.principal_minor_units),
    0n
  );
  const totalEarnings = (earningsAccounts.data ?? []).reduce(
    (sum, a) => sum + BigInt(a.balance_minor_units),
    0n
  );

  return {
    totalUsers: usersCount.count ?? 0,
    totalDepositsMinorUnits: totalDeposits.toString(),
    totalPortfolioValueMinorUnits: totalPortfolioValue.toString(),
    totalEarningsMinorUnits: totalEarnings.toString(),
    pendingDeposits: pendingDeposits.count ?? 0,
    pendingWithdrawals: pendingWithdrawals.count ?? 0,
    activePositions: activePositions.count ?? 0,
  };
}

export async function listRecentDeposits(limit = 25): Promise<DepositsRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("deposits")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listRecentWithdrawals(limit = 25): Promise<WithdrawalsRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listRecentUsers(limit = 25): Promise<UsersRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listRecentTransactions(limit = 25): Promise<TransactionsRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listProducts(): Promise<InvestmentProductsRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("investment_products")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface UpdateProductParamsInput {
  productId: string;
  adminWallet: string;
  targetAnnualRateBps?: number;
  cycleDays?: number;
  status?: InvestmentProductsRow["status"];
}

/** Admin parameter changes are only ever applied here, and always audited. */
export async function updateProductParams(input: UpdateProductParamsInput): Promise<InvestmentProductsRow> {
  const supabase = getSupabaseAdmin();

  const { data: before, error: beforeError } = await supabase
    .from("investment_products")
    .select("*")
    .eq("id", input.productId)
    .single();
  if (beforeError) throw beforeError;

  const updates: Record<string, unknown> = {};
  if (input.targetAnnualRateBps !== undefined) updates.target_annual_rate_bps = input.targetAnnualRateBps;
  if (input.cycleDays !== undefined) updates.cycle_days = input.cycleDays;
  if (input.status !== undefined) updates.status = input.status;

  const { data: after, error } = await supabase
    .from("investment_products")
    .update(updates)
    .eq("id", input.productId)
    .select("*")
    .single();
  if (error) throw error;

  await recordAuditLog({
    actorType: "admin",
    actorId: input.adminWallet,
    action: "product.params_updated",
    entityType: "investment_product",
    entityId: input.productId,
    metadata: { before, after: updates },
  });

  return after;
}
