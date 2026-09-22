import "../unit/setup";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./fakeSupabase";
import { TEST_DEPOSIT_WALLET, TEST_USER_WALLET } from "./setup";

let fake: ReturnType<typeof createFakeSupabase>;

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => fake,
}));

const { createDepositIntent, recordSubmittedSignature, DepositError } = await import(
  "@/lib/services/depositService"
);

describe("depositService — deposit intent", () => {
  beforeEach(() => {
    fake = createFakeSupabase({});
  });

  it("rejects a zero or negative amount before touching the database", async () => {
    await expect(createDepositIntent("user-1", TEST_USER_WALLET, 0n)).rejects.toThrow(DepositError);
    await expect(createDepositIntent("user-1", TEST_USER_WALLET, -100n)).rejects.toThrow(DepositError);
    expect(fake._calls.length).toBe(0);
  });

  it("creates a pending deposit row and returns the destination wallet + expected USDC base units", async () => {
    fake = createFakeSupabase({
      from: {
        deposits: [
          {
            data: {
              id: "deposit-1",
              user_id: "user-1",
              wallet_address: TEST_USER_WALLET,
              requested_amount_minor_units: "10000000", // $100,000.00
              actual_amount_minor_units: null,
              asset: "USDC",
              transaction_signature: null,
              status: "pending",
              confirmed_at: null,
              created_at: new Date().toISOString(),
            },
            error: null,
          },
        ],
      },
    });

    const intent = await createDepositIntent("user-1", TEST_USER_WALLET, 10_000_000n);

    expect(intent.destinationWallet).toBe(TEST_DEPOSIT_WALLET);
    expect(intent.deposit.status).toBe("pending");
    // $100,000.00 == 10,000,000 minor units; USDC has 6 decimals, so 1 minor
    // unit (=$0.01) is exactly 10,000 base units.
    expect(BigInt(intent.expectedUsdcBaseUnits)).toBe(100_000_000_000n);
  });
});

describe("depositService — duplicate transaction rejection", () => {
  beforeEach(() => {
    fake = createFakeSupabase({});
  });

  it("rejects a signature that was already submitted for a different deposit", async () => {
    fake = createFakeSupabase({
      from: {
        deposits: [
          // lookup by transaction_signature finds it already attached to deposit-OTHER
          { data: { id: "deposit-OTHER", status: "confirmed" }, error: null },
        ],
      },
    });

    await expect(
      recordSubmittedSignature("deposit-THIS", "user-1", "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi")
    ).rejects.toMatchObject({ code: "deposit_already_credited" });
  });

  it("accepts a signature that is not attached to any other deposit", async () => {
    fake = createFakeSupabase({
      from: {
        deposits: [
          { data: null, error: null }, // no existing deposit has this signature
          {
            data: {
              id: "deposit-THIS",
              status: "confirming",
              transaction_signature: "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi",
            },
            error: null,
          },
        ],
      },
    });

    const result = await recordSubmittedSignature(
      "deposit-THIS",
      "user-1",
      "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi"
    );
    expect(result.status).toBe("confirming");
  });
});
