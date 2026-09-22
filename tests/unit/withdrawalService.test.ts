import "../unit/setup";
import { describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";
import { TEST_USER_WALLET } from "./setup";

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => fake,
}));

let fake: ReturnType<typeof createFakeSupabase>;

const { requestWithdrawal, InvalidDestinationError } = await import("@/lib/services/withdrawalService");
const { InsufficientBalanceError } = await import("@/lib/services/ledgerService");

describe("withdrawalService — withdrawal + negative balance prevention", () => {
  it("rejects an invalid destination wallet address without calling the database", async () => {
    fake = createFakeSupabase({});
    await expect(requestWithdrawal("user-1", 1_000_00n, "not-a-wallet")).rejects.toThrow(
      InvalidDestinationError
    );
    expect(fake._calls.length).toBe(0);
  });

  it("processes a withdrawal when the cash balance is sufficient", async () => {
    fake = createFakeSupabase({
      rpc: {
        fn_request_withdrawal: {
          data: {
            id: "withdrawal-1",
            user_id: "user-1",
            amount_minor_units: "1000000",
            asset: "SOL",
            destination_wallet: TEST_USER_WALLET,
            status: "processing",
            transaction_signature: null,
            created_at: new Date().toISOString(),
            completed_at: null,
          },
          error: null,
        },
      },
    });

    const result = await requestWithdrawal("user-1", 10_000_00n, TEST_USER_WALLET);
    expect(result.status).toBe("processing");
  });

  it("never allows a negative balance — the atomic ledger function's insufficient_balance error surfaces as InsufficientBalanceError", async () => {
    fake = createFakeSupabase({
      rpc: {
        fn_request_withdrawal: { data: null, error: { code: "P0006", message: "insufficient_balance" } },
      },
    });

    await expect(requestWithdrawal("user-1", 999_999_00n, TEST_USER_WALLET)).rejects.toThrow(
      InsufficientBalanceError
    );
  });
});
