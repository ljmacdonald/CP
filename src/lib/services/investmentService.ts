import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { calculateAccrual } from "@/lib/services/financialCalculationService";
import type { InvestmentPositionsRow, InvestmentProductsRow } from "@/types/database";

export async function getDefaultProduct(): Promise<InvestmentProductsRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("investment_products")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("No active investment product configured");
  return data;
}

export async function getProductById(productId: string): Promise<InvestmentProductsRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("investment_products")
    .select("*")
    .eq("id", productId)
    .single();
  if (error) throw error;
  return data;
}

export async function getActivePosition(userId: string): Promise<InvestmentPositionsRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("investment_positions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listPositions(userId: string): Promise<InvestmentPositionsRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("investment_positions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getPositionById(
  positionId: string,
  userId: string
): Promise<InvestmentPositionsRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("investment_positions")
    .select("*")
    .eq("id", positionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface PositionWithLiveValue {
  position: InvestmentPositionsRow;
  product: InvestmentProductsRow;
  elapsedDays: number;
  remainingDays: number;
  accruedReturn: string;
  currentValue: string;
  estimatedMaturityValue: string;
}

export async function getPositionWithLiveValue(
  position: InvestmentPositionsRow,
  product: InvestmentProductsRow,
  now: Date = new Date()
): Promise<PositionWithLiveValue> {
  const result = calculateAccrual({
    principal: BigInt(position.principal_minor_units),
    startDate: new Date(position.start_date),
    currentDate: now,
    maturityDate: new Date(position.maturity_date),
    annualRateBps: product.target_annual_rate_bps,
  });

  return {
    position,
    product,
    elapsedDays: result.elapsedDays,
    remainingDays: result.remainingDays,
    accruedReturn: result.accruedReturn.toString(),
    currentValue: result.currentValue.toString(),
    estimatedMaturityValue: result.estimatedMaturityValue.toString(),
  };
}

export interface PerformancePoint {
  date: string;
  value: string;
}

/**
 * Synthesizes a daily performance series for charting. Prefers persisted
 * daily_accruals rows (see accrualService); falls back to computing the
 * series on the fly for positions that haven't had the daily snapshot job
 * run against them yet, so the chart is never empty in the prototype.
 */
export async function getPerformanceSeries(
  position: InvestmentPositionsRow,
  product: InvestmentProductsRow,
  now: Date = new Date()
): Promise<PerformancePoint[]> {
  const supabase = getSupabaseAdmin();
  const { data: persisted, error } = await supabase
    .from("daily_accruals")
    .select("date, closing_value_minor_units")
    .eq("investment_position_id", position.id)
    .order("date", { ascending: true });

  if (error) throw error;

  if (persisted && persisted.length > 0) {
    return persisted.map((row) => ({ date: row.date, value: row.closing_value_minor_units }));
  }

  const start = new Date(position.start_date);
  const points: PerformancePoint[] = [];
  const totalDays = Math.min(
    calculateAccrual({
      principal: BigInt(position.principal_minor_units),
      startDate: start,
      currentDate: now,
      maturityDate: new Date(position.maturity_date),
      annualRateBps: product.target_annual_rate_bps,
    }).elapsedDays,
    365
  );

  for (let day = 0; day <= totalDays; day++) {
    const pointDate = new Date(start);
    pointDate.setDate(pointDate.getDate() + day);
    const result = calculateAccrual({
      principal: BigInt(position.principal_minor_units),
      startDate: start,
      currentDate: pointDate,
      maturityDate: new Date(position.maturity_date),
      annualRateBps: product.target_annual_rate_bps,
    });
    points.push({ date: pointDate.toISOString().slice(0, 10), value: result.currentValue.toString() });
  }

  return points;
}
