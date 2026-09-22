import "../unit/setup";
import { describe, expect, it, vi, beforeEach } from "vitest";
import bs58 from "bs58";
import { TEST_DEPOSIT_WALLET, TEST_USER_WALLET, TEST_USDC_MINT } from "./setup";
import { getUsdcTokenAccount } from "@/lib/solana/usdc";

const VALID_SIGNATURE = bs58.encode(new Uint8Array(64).fill(7));

const DESTINATION_TOKEN_ACCOUNT = getUsdcTokenAccount(TEST_DEPOSIT_WALLET, TEST_USDC_MINT);

const sendMock = vi.fn();
const getTransactionMock = vi.fn(() => ({ send: sendMock }));

vi.mock("@/lib/solana/rpc", () => ({
  getSolanaRpc: () => ({ getTransaction: getTransactionMock }),
}));

// Imported after the mock so the module under test picks up the mocked RPC.
const { verifyUsdcTransferTransaction } = await import("@/lib/services/transactionVerificationService");

function buildTransaction(opts: {
  err?: unknown;
  destination?: string;
  mint?: string;
  authority?: string;
  amount?: string;
  program?: string;
}) {
  return {
    slot: 12345,
    blockTime: 1700000000,
    meta: { err: opts.err ?? null },
    transaction: {
      message: {
        instructions: [
          {
            program: opts.program ?? "spl-token",
            programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            parsed: {
              type: "transferChecked",
              info: {
                source: "SomeSourceTokenAccount1111111111111111111",
                destination: opts.destination ?? DESTINATION_TOKEN_ACCOUNT,
                mint: opts.mint ?? TEST_USDC_MINT,
                authority: opts.authority ?? TEST_USER_WALLET,
                tokenAmount: { amount: opts.amount ?? "1000000000", decimals: 6 },
              },
            },
          },
        ],
      },
    },
  };
}

describe("transactionVerificationService — never trusts the client", () => {
  beforeEach(() => {
    sendMock.mockReset();
    getTransactionMock.mockClear();
  });

  it("verifies a valid transaction and derives the credited amount from the on-chain token amount", async () => {
    sendMock.mockResolvedValue(buildTransaction({ amount: "1000000000" })); // 1,000 USDC

    const result = await verifyUsdcTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.usdcBaseUnits).toBe(1_000_000_000n);
      // 1,000 USDC == 100,000 minor units ($0.01 = 10,000 base units)
      expect(result.amountMinorUnits).toBe(100_000n);
    }
  });

  it("rejects a transaction that failed on-chain", async () => {
    sendMock.mockResolvedValue(buildTransaction({ err: { InstructionError: [0, "Custom"] } }));

    const result = await verifyUsdcTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "transaction_failed" });
  });

  it("rejects when the transaction cannot be found (not yet confirmed)", async () => {
    sendMock.mockResolvedValue(null);

    const result = await verifyUsdcTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "transaction_not_found" });
  });

  it("rejects a transaction sent to the wrong destination (no matching transfer)", async () => {
    sendMock.mockResolvedValue(
      buildTransaction({ destination: getUsdcTokenAccount(TEST_USER_WALLET, TEST_USDC_MINT) })
    );

    const result = await verifyUsdcTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "no_matching_transfer" });
  });

  it("rejects a transaction from a wallet other than the authenticated sender", async () => {
    sendMock.mockResolvedValue(buildTransaction({ authority: TEST_DEPOSIT_WALLET }));

    const result = await verifyUsdcTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "wrong_sender" });
  });

  it("rejects a transfer of the right shape but the wrong SPL token mint", async () => {
    sendMock.mockResolvedValue(buildTransaction({ mint: "So11111111111111111111111111111111111111112" }));

    const result = await verifyUsdcTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "unsupported_asset" });
  });

  it("rejects malformed signature strings without calling the RPC", async () => {
    const result = await verifyUsdcTransferTransaction({
      transactionSignature: "not-a-real-signature",
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_signature_format" });
    expect(getTransactionMock).not.toHaveBeenCalled();
  });
});
