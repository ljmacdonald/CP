import "../unit/setup";
import { describe, expect, it, vi, beforeEach } from "vitest";
import bs58 from "bs58";
import { TEST_DEPOSIT_WALLET, TEST_USER_WALLET } from "./setup";

const VALID_SIGNATURE = bs58.encode(new Uint8Array(64).fill(7));

const sendMock = vi.fn();
const getTransactionMock = vi.fn(() => ({ send: sendMock }));

vi.mock("@/lib/solana/rpc", () => ({
  getSolanaRpc: () => ({ getTransaction: getTransactionMock }),
  LAMPORTS_PER_SOL: 1_000_000_000n,
}));

// Imported after the mock so the module under test picks up the mocked RPC.
const { verifySolTransferTransaction } = await import("@/lib/services/transactionVerificationService");

function buildTransaction(opts: {
  err?: unknown;
  destination?: string;
  source?: string;
  lamports?: number;
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
            program: opts.program ?? "system",
            programId: "11111111111111111111111111111111",
            parsed: {
              type: "transfer",
              info: {
                source: opts.source ?? TEST_USER_WALLET,
                destination: opts.destination ?? TEST_DEPOSIT_WALLET,
                lamports: opts.lamports ?? 1_000_000_000,
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

  it("verifies a valid transaction and derives the credited amount from on-chain lamports", async () => {
    sendMock.mockResolvedValue(buildTransaction({ lamports: 1_000_000_000 })); // 1 SOL

    const result = await verifySolTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lamports).toBe(1_000_000_000n);
      // 1 SOL * rate(150000000 minor units / SOL) = 150000000 minor units
      expect(result.amountMinorUnits).toBe(150_000_000n);
    }
  });

  it("rejects a transaction that failed on-chain", async () => {
    sendMock.mockResolvedValue(buildTransaction({ err: { InstructionError: [0, "Custom"] } }));

    const result = await verifySolTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "transaction_failed" });
  });

  it("rejects when the transaction cannot be found (not yet confirmed)", async () => {
    sendMock.mockResolvedValue(null);

    const result = await verifySolTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "transaction_not_found" });
  });

  it("rejects a transaction sent to the wrong destination (no matching transfer)", async () => {
    sendMock.mockResolvedValue(buildTransaction({ destination: TEST_USER_WALLET }));

    const result = await verifySolTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "no_matching_transfer" });
  });

  it("rejects a transaction from a wallet other than the authenticated sender", async () => {
    sendMock.mockResolvedValue(buildTransaction({ source: TEST_DEPOSIT_WALLET }));

    const result = await verifySolTransferTransaction({
      transactionSignature: VALID_SIGNATURE,
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "wrong_sender" });
  });

  it("rejects malformed signature strings without calling the RPC", async () => {
    const result = await verifySolTransferTransaction({
      transactionSignature: "not-a-real-signature",
      expectedDestinationWallet: TEST_DEPOSIT_WALLET,
      expectedSenderWallet: TEST_USER_WALLET,
    });

    expect(result).toEqual({ ok: false, reason: "invalid_signature_format" });
    expect(getTransactionMock).not.toHaveBeenCalled();
  });
});
