import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { calculateAccrual } from "@/lib/services/financialCalculationService";
import type { InvestmentPositionsRow, InvestmentProductsRow } from "@/types/database";

/**
 * Backfills/updates the daily_accruals snapshot row for a single position up
 * to `asOf`. Intended to be invoked by a scheduled job (cron, Supabase Edge
 * Function, or admin-triggered endpoint in this prototype) once per day per
 * active position — see /api/admin/accruals/run.
 */
export async function runDailyAccrualForPosition(
  position: InvestmentPositionsRow,
  product: InvestmentProductsRow,
  asOf: Date = new Date()
): Promise<number> {
  const supabase = getSupabaseAdmin();
  const start = new Date(position.start_date);
  const maturity = new Date(position.maturity_date);
  const cappedAsOf = asOf < maturity ? asOf : maturity;

  const totalElapsed = calculateAccrual({
    principal: BigInt(position.principal_minor_units),
    startDate: start,
    currentDate: cappedAsOf,
    maturityDate: maturity,
    annualRateBps: product.target_annual_rate_bps,
  }).elapsedDays;

  let rowsWritten = 0;
  let previousClosing = BigInt(position.principal_minor_units);

  for (let day = 1; day <= totalElapsed; day++) {
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + day);
    const isoDate = dayDate.toISOString().slice(0, 10);

    const result = calculateAccrual({
      principal: BigInt(position.principal_minor_units),
      startDate: start,
      currentDate: dayDate,
      maturityDate: maturity,
      annualRateBps: product.target_annual_rate_bps,
    });

    const opening = previousClosing;
    const closing = result.currentValue;
    const accrualAmount = closing - opening;

    const { error } = await supabase.from("daily_accruals").upsert(
      {
        investment_position_id: position.id,
        date: isoDate,
        opening_value_minor_units: opening.toString(),
        accrual_amount_minor_units: accrualAmount.toString(),
        closing_value_minor_units: closing.toString(),
        rate_bps: product.target_annual_rate_bps,
      },
      { onConflict: "investment_position_id,date" }
    );

    if (error) throw error;

    previousClosing = closing;
    rowsWritten++;
  }

  return rowsWritten;
}

export async function runDailyAccrualForAllActivePositions(asOf: Date = new Date()): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data: positions, error } = await supabase
    .from("investment_positions")
    .select("*")
    .eq("status", "active");
  if (error) throw error;

  const { data: products, error: productsError } = await supabase.from("investment_products").select("*");
  if (productsError) throw productsError;
  const productsById = new Map(products?.map((p) => [p.id, p]));

  let total = 0;
  for (const position of positions ?? []) {
    const product = productsById.get(position.product_id);
    if (!product) continue;
    total += await runDailyAccrualForPosition(position, product, asOf);
  }
  return total;
}
