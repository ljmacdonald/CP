import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getLedgerBalances } from "@/lib/services/ledgerService";
import { getActivePosition, getPositionWithLiveValue, getDefaultProduct, getProductById } from "@/lib/services/investmentService";
import type { PositionWithLiveValue } from "@/lib/services/investmentService";
import type { DepositsRow, LedgerAccountType, InvestmentProductsRow } from "@/types/database";

export interface DashboardSnapshot {
  balances: Record<LedgerAccountType, string>;
  activePosition: PositionWithLiveValue | null;
  product: InvestmentProductsRow;
  latestDeposit: DepositsRow | null;
  portfolioValueMinorUnits: string;
  totalEarningsMinorUnits: string;
  todaysEarningsMinorUnits: string;
}

export async function getDashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
  const supabase = getSupabaseAdmin();

  const [defaultProduct, position, latestDepositResult] = await Promise.all([
    getDefaultProduct(),
    getActivePosition(userId),
    supabase
      .from("deposits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const balances = await getLedgerBalances(userId);
  const product = position && position.product_id !== defaultProduct.id
    ? await getProductById(position.product_id)
    : defaultProduct;

  const activePosition = position ? await getPositionWithLiveValue(position, product) : null;

  let todaysEarnings = "0";
  if (activePosition) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const positionForYesterday = await getPositionWithLiveValue(position!, product, yesterday);
    const diff =
      BigInt(activePosition.currentValue) -
      BigInt(activePosition.position.principal_minor_units) -
      (BigInt(positionForYesterday.currentValue) - BigInt(positionForYesterday.position.principal_minor_units));
    todaysEarnings = (diff < 0n ? 0n : diff).toString();
  }

  const portfolioValue = activePosition ? BigInt(activePosition.currentValue) : 0n;
  const totalEarnings = BigInt(balances.earnings) + (activePosition ? BigInt(activePosition.accruedReturn) : 0n);

  return {
    balances,
    activePosition,
    product,
    latestDeposit: latestDepositResult.data ?? null,
    portfolioValueMinorUnits: portfolioValue.toString(),
    totalEarningsMinorUnits: totalEarnings.toString(),
    todaysEarningsMinorUnits: todaysEarnings,
  };
}
