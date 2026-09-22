import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { calculateAccrual, calculateRedemption } from "@/lib/services/financialCalculationService";
import { mapLedgerRpcError } from "@/lib/services/ledgerService";
import type { InvestmentPositionsRow, InvestmentProductsRow, RedemptionQuotesRow } from "@/types/database";

const QUOTE_TTL_MINUTES = 5;
/** Early-redemption penalty, in basis points of current value. Configurable in one place. */
const EARLY_REDEMPTION_PENALTY_BPS = 500; // 5%

/**
 * The frontend never computes a redemption amount — it only displays what
 * this function (server-side, authoritative) returns. The quote is persisted
 * with an expiry so `fn_process_redemption` can enforce it atomically even if
 * the user's browser lies about the current time.
 */
export async function createRedemptionQuote(
  position: InvestmentPositionsRow,
  product: InvestmentProductsRow,
  now: Date = new Date()
): Promise<RedemptionQuotesRow> {
  const supabase = getSupabaseAdmin();

  const accrual = calculateAccrual({
    principal: BigInt(position.principal_minor_units),
    startDate: new Date(position.start_date),
    currentDate: now,
    maturityDate: new Date(position.maturity_date),
    annualRateBps: product.target_annual_rate_bps,
  });

  const totalCycleDays = Math.max(
    Math.round((new Date(position.maturity_date).getTime() - new Date(position.start_date).getTime()) / 86_400_000),
    1
  );

  const redemption = calculateRedemption({
    currentValue: accrual.currentValue,
    elapsedDays: accrual.elapsedDays,
    totalCycleDays,
    earlyRedemptionPenaltyBps: EARLY_REDEMPTION_PENALTY_BPS,
  });

  const expiresAt = new Date(now.getTime() + QUOTE_TTL_MINUTES * 60_000);

  const { data, error } = await supabase
    .from("redemption_quotes")
    .insert({
      investment_position_id: position.id,
      current_value_minor_units: redemption.currentValue.toString(),
      liquidity_adjustment_minor_units: redemption.liquidityAdjustment.toString(),
      redemption_value_minor_units: redemption.redemptionValue.toString(),
      expires_at: expiresAt.toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getRedemptionQuote(quoteId: string): Promise<RedemptionQuotesRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("redemption_quotes").select("*").eq("id", quoteId).maybeSingle();
  if (error) throw error;
  return data;
}

export interface ConfirmRedemptionResult {
  position: InvestmentPositionsRow;
  cashBalance: string;
}

export async function confirmRedemption(quoteId: string, userId: string): Promise<ConfirmRedemptionResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("fn_process_redemption", {
    p_quote_id: quoteId,
    p_user_id: userId,
  });

  if (error) mapLedgerRpcError(error);
  const result = data as { position: InvestmentPositionsRow; cash_balance: number | string };
  return { position: result.position, cashBalance: String(result.cash_balance) };
}
