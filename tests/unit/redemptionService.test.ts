import "../unit/setup";
import { describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";
import type { InvestmentPositionsRow, InvestmentProductsRow } from "@/types/database";

let fake: ReturnType<typeof createFakeSupabase>;

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => fake,
}));

const { createRedemptionQuote, confirmRedemption } = await import("@/lib/services/redemptionService");

const product: InvestmentProductsRow = {
  id: "product-1",
  name: "Growth Portfolio",
  target_annual_rate_bps: 2500,
  cycle_days: 180,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function positionElapsedDays(days: number, totalCycleDays = 180): InvestmentPositionsRow {
  const start = new Date(Date.now() - days * 86_400_000);
  const maturity = new Date(start.getTime() + totalCycleDays * 86_400_000);
  return {
    id: "position-1",
    user_id: "user-1",
    product_id: product.id,
    principal_minor_units: "10000000",
    units: "10000000",
    start_date: start.toISOString(),
    maturity_date: maturity.toISOString(),
    status: "active",
    created_at: start.toISOString(),
    updated_at: start.toISOString(),
  };
}

describe("redemptionService — redemption quote", () => {
  it("generates a server-authoritative quote that expires 5 minutes from now", async () => {
    // Custom fake that echoes back whatever the service inserts, like Postgres's `.select().single()` would.
    const inserted: Record<string, unknown>[] = [];
    fake = {
      from: () => {
        const chain: Record<string, unknown> = {};
        chain.insert = (payload: Record<string, unknown>) => {
          inserted.push(payload);
          return chain;
        };
        chain.select = () => chain;
        chain.single = () => chain;
        chain.then = (resolve: (v: unknown) => void) =>
          Promise.resolve({ data: { id: "quote-1", ...inserted[0] }, error: null }).then(resolve);
        return chain;
      },
      rpc: async () => ({ data: null, error: null }),
      _calls: [],
    } as unknown as ReturnType<typeof createFakeSupabase>;

    const before = Date.now();
    const quote = await createRedemptionQuote(positionElapsedDays(90), product);
    const expiresAt = new Date(quote.expires_at).getTime();

    expect(expiresAt).toBeGreaterThan(before + 4 * 60_000);
    expect(expiresAt).toBeLessThanOrEqual(before + 5 * 60_000 + 1000);
    expect(BigInt(quote.redemption_value_minor_units as unknown as string)).toBeLessThan(
      BigInt(quote.current_value_minor_units as unknown as string)
    );
  });
});

describe("redemptionService — expired redemption quote", () => {
  it("maps the atomic function's quote_expired error to a typed error", async () => {
    fake = createFakeSupabase({
      rpc: { fn_process_redemption: { data: null, error: { code: "P0004", message: "quote_expired" } } },
    });

    await expect(confirmRedemption("quote-1", "user-1")).rejects.toThrow("quote_expired");
  });

  it("maps the atomic function's quote_already_used error to a typed error", async () => {
    fake = createFakeSupabase({
      rpc: { fn_process_redemption: { data: null, error: { code: "P0003", message: "quote_already_used" } } },
    });

    await expect(confirmRedemption("quote-1", "user-1")).rejects.toThrow("quote_already_used");
  });

  it("succeeds and returns the updated cash balance for a still-valid quote", async () => {
    fake = createFakeSupabase({
      rpc: {
        fn_process_redemption: {
          data: { position: positionElapsedDays(180), cash_balance: "10450000" },
          error: null,
        },
      },
    });

    const result = await confirmRedemption("quote-1", "user-1");
    expect(result.cashBalance).toBe("10450000");
  });
});
