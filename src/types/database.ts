/**
 * Hand-written mirror of supabase/migrations/0001_init.sql. In a real deploy
 * this would be generated via `supabase gen types typescript`; it's authored
 * manually here since there is no live Supabase project to introspect.
 * All *_minor_units columns are bigint in Postgres and arrive over
 * postgrest/postgres-js as numeric strings — typed as `string` here and
 * converted with BigInt(...) at the service boundary.
 */

export type UserStatus = "active" | "suspended" | "closed";
export type ProductStatus = "active" | "paused" | "retired";
export type PositionStatus = "active" | "matured" | "redeemed" | "cancelled";
export type LedgerAccountType = "cash" | "invested" | "earnings";
export type LedgerEntryType = "credit" | "debit";
export type LedgerReferenceType = "deposit" | "withdrawal" | "accrual" | "redemption" | "adjustment";
export type DepositStatus =
  | "pending"
  | "submitted"
  | "confirming"
  | "verifying"
  | "confirmed"
  | "failed"
  | "expired"
  | "rejected";
export type WithdrawalStatus = "pending" | "processing" | "completed" | "failed" | "rejected";
export type TransactionType = "deposit" | "withdrawal" | "earning" | "redemption";
export type TransactionStatus = "pending" | "confirmed" | "failed" | "rejected";
export type ActorType = "user" | "admin" | "system";

export interface UsersRow {
  id: string;
  wallet_address: string;
  created_at: string;
  updated_at: string;
  status: UserStatus;
}

export interface InvestmentProductsRow {
  id: string;
  name: string;
  target_annual_rate_bps: number;
  cycle_days: number;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface InvestmentPositionsRow {
  id: string;
  user_id: string;
  product_id: string;
  principal_minor_units: string;
  units: string;
  start_date: string;
  maturity_date: string;
  status: PositionStatus;
  created_at: string;
  updated_at: string;
}

export interface LedgerAccountsRow {
  id: string;
  user_id: string;
  account_type: LedgerAccountType;
  currency: string;
  balance_minor_units: string;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntriesRow {
  id: string;
  user_id: string;
  account_id: string;
  entry_type: LedgerEntryType;
  amount_minor_units: string;
  currency: string;
  reference_type: LedgerReferenceType;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface DepositsRow {
  id: string;
  user_id: string;
  wallet_address: string;
  requested_amount_minor_units: string;
  actual_amount_minor_units: string | null;
  asset: string;
  transaction_signature: string | null;
  status: DepositStatus;
  confirmed_at: string | null;
  created_at: string;
}

export interface WithdrawalsRow {
  id: string;
  user_id: string;
  amount_minor_units: string;
  asset: string;
  destination_wallet: string;
  status: WithdrawalStatus;
  transaction_signature: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface DailyAccrualsRow {
  id: string;
  investment_position_id: string;
  date: string;
  opening_value_minor_units: string;
  accrual_amount_minor_units: string;
  closing_value_minor_units: string;
  rate_bps: number;
  created_at: string;
}

export interface RedemptionQuotesRow {
  id: string;
  investment_position_id: string;
  current_value_minor_units: string;
  liquidity_adjustment_minor_units: string;
  redemption_value_minor_units: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface TransactionsRow {
  id: string;
  user_id: string;
  type: TransactionType;
  amount_minor_units: string;
  asset: string;
  status: TransactionStatus;
  blockchain_signature: string | null;
  created_at: string;
}

export interface AuditLogsRow {
  id: string;
  actor_type: ActorType;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

