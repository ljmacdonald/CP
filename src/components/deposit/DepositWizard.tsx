"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatMinorUnits, toMinorUnits } from "@/lib/money";
import { projectInvestment } from "@/lib/services/financialCalculationService";
import { explorerTxUrl, clientEnv } from "@/lib/env.client";
import { USDC_DECIMALS } from "@/lib/solana/usdc";
import type { InvestmentProductsRow } from "@/types/database";

type Step = "amount" | "confirm" | "submitting" | "confirming" | "verifying" | "success" | "error";

interface DepositIntentResponse {
  depositId: string;
  destinationWallet: string;
  expectedUsdcBaseUnits: string;
  requestedAmountMinorUnits: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Something went wrong. Please try again.");
  }
  return json as T;
}

export function DepositWizard() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [product, setProduct] = useState<InvestmentProductsRow | null>(null);
  const [pausedMessage, setPausedMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("amount");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [intent, setIntent] = useState<DepositIntentResponse | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [creditedAmount, setCreditedAmount] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products/active", { credentials: "same-origin" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPausedMessage(json?.error?.message ?? "New investments are temporarily unavailable.");
          return;
        }
        setProduct(json.product ?? null);
      })
      .catch(() => setPausedMessage("Could not load investment details. Please try again."));
  }, []);

  const projection = useMemo(() => {
    if (!product || !amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) return null;
    try {
      const principal = toMinorUnits(amount);
      return projectInvestment({
        principal,
        annualRateBps: product.target_annual_rate_bps,
        cycleDays: product.cycle_days,
      });
    } catch {
      return null;
    }
  }, [amount, product]);

  const handleContinue = async () => {
    setErrorMessage("");
    try {
      const result = await postJson<DepositIntentResponse>("/api/deposits/intent", { amount });
      setIntent(result);
      setStep("confirm");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not start this deposit.");
    }
  };

  const handleSignAndSend = async () => {
    if (!intent || !publicKey) return;
    setErrorMessage("");
    setStep("submitting");
    setStatusMessage("Waiting for your wallet...");

    try {
      const mint = new PublicKey(clientEnv.usdcMintAddress);
      const destinationOwner = new PublicKey(intent.destinationWallet);
      const sourceAta = await getAssociatedTokenAddress(mint, publicKey);
      const destinationAta = await getAssociatedTokenAddress(mint, destinationOwner);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

      const transaction = new Transaction({
        feePayer: publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(
        // Idempotent: creates the deposit wallet's USDC account if this is
        // its first-ever USDC deposit, no-ops otherwise. The depositor pays
        // the (tiny, one-time) rent — the deposit wallet's own key is never
        // needed for this.
        createAssociatedTokenAccountIdempotentInstruction(publicKey, destinationAta, destinationOwner, mint),
        createTransferCheckedInstruction(
          sourceAta,
          mint,
          destinationAta,
          publicKey,
          BigInt(intent.expectedUsdcBaseUnits),
          USDC_DECIMALS
        )
      );

      const sig = await sendTransaction(transaction, connection);
      setSignature(sig);

      await postJson("/api/deposits/submit", { depositId: intent.depositId, transactionSignature: sig });

      setStep("confirming");
      setStatusMessage("Transaction submitted. Waiting for blockchain confirmation...");

      await waitForConfirmation(connection, sig);

      setStatusMessage("Transaction confirmed. Deposit being verified...");
      setStep("verifying");

      const verifyResult = await postJson<{ deposit: { actual_amount_minor_units: string | null } }>(
        "/api/deposits/verify",
        { depositId: intent.depositId }
      );

      setCreditedAmount(verifyResult.deposit.actual_amount_minor_units);
      setStep("success");
    } catch (error) {
      setErrorMessage(mapClientError(error));
      setStep("error");
    }
  };

  if (step === "amount") {
    if (pausedMessage) {
      return (
        <Card className="mx-auto max-w-md p-7 sm:p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-ink">New investments are paused</h1>
          <p className="mt-2 text-sm text-ink-muted">{pausedMessage}</p>
          <Button className="mt-7 w-full" size="lg" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </Card>
      );
    }
    return (
      <Card className="mx-auto max-w-md p-7 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink">How much would you like to invest?</h1>

        <div className="mt-6">
          <label className="text-xs font-medium uppercase tracking-wider text-ink-faint">Amount</label>
          <div className="mt-2 flex items-center rounded-xl border border-border-strong bg-bg px-4 py-3.5 focus-within:border-ink">
            <span className="mr-1 text-xl font-semibold text-ink-faint">$</span>
            <input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-full bg-transparent text-xl font-semibold text-ink outline-none font-tabular"
            />
          </div>
          {errorMessage && <p className="mt-2 text-xs text-negative">{errorMessage}</p>}
        </div>

        {product && (
          <dl className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-bg p-4 text-sm">
            <Row label="Target annualized return" value={`${(product.target_annual_rate_bps / 100).toFixed(1)}%`} />
            <Row label="Investment period" value={`${product.cycle_days} days`} />
            <Row
              label="Estimated earnings"
              value={projection ? formatMinorUnits(projection.estimatedEarnings) : "—"}
            />
            <Row
              label="Estimated maturity value"
              value={projection ? formatMinorUnits(projection.estimatedMaturityValue) : "—"}
              emphasize
            />
          </dl>
        )}

        <Button className="mt-7 w-full" size="lg" disabled={!projection} onClick={handleContinue}>
          Continue
        </Button>
      </Card>
    );
  }

  if (step === "confirm" && intent) {
    const usdcAmount = (Number(intent.expectedUsdcBaseUnits) / 1_000_000).toFixed(6);
    return (
      <Card className="mx-auto max-w-md p-7 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Confirm deposit</h1>
        <p className="mt-2 text-sm text-ink-muted">
          You&apos;ll be asked to approve this transaction in your wallet. Funds move directly from your wallet — YIELD
          never holds your keys.
        </p>

        <dl className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-bg p-4 text-sm">
          <Row label="Destination address" value={truncateMiddle(intent.destinationWallet)} mono />
          <Row label="Asset" value="USDC (Solana devnet)" />
          <Row label="Exact amount" value={`${usdcAmount} USDC`} emphasize />
          <Row label="Investing" value={formatMinorUnits(intent.requestedAmountMinorUnits)} />
        </dl>

        <div className="mt-7 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setStep("amount")}>
            Back
          </Button>
          <Button className="flex-1" onClick={handleSignAndSend} disabled={!publicKey}>
            Confirm &amp; sign
          </Button>
        </div>
      </Card>
    );
  }

  if (step === "submitting" || step === "confirming" || step === "verifying") {
    return (
      <Card className="mx-auto max-w-md p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
          <svg className="h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
        <p className="mt-5 text-sm font-medium text-ink">{statusMessage}</p>
        {signature && (
          <a
            href={explorerTxUrl(signature)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs text-accent underline underline-offset-2"
          >
            View on Explorer
          </a>
        )}
      </Card>
    );
  }

  if (step === "success") {
    return (
      <Card className="mx-auto max-w-md p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg">
          <CheckIcon />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-ink">Deposit complete</h1>
        <p className="mt-2 text-sm text-ink-muted">Your portfolio has been updated.</p>
        {creditedAmount && (
          <p className="font-tabular mt-4 text-2xl font-semibold text-accent">{formatMinorUnits(creditedAmount)}</p>
        )}
        {signature && (
          <a
            href={explorerTxUrl(signature)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs text-ink-faint underline underline-offset-2"
          >
            View transaction on Explorer
          </a>
        )}
        <Button className="mt-7 w-full" size="lg" onClick={() => router.push("/dashboard")}>
          View portfolio
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-md p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-negative-soft text-negative">
        <CloseIcon />
      </div>
      <h1 className="mt-5 text-xl font-semibold text-ink">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-muted">{errorMessage}</p>
      <div className="mt-7 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
        <Button className="flex-1" onClick={() => setStep("confirm")}>
          Try again
        </Button>
      </div>
    </Card>
  );
}

async function waitForConfirmation(
  connection: ReturnType<typeof useConnection>["connection"],
  signature: string
): Promise<void> {
  const start = Date.now();
  const timeoutMs = 90_000;

  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatus(signature);
    if (value?.err) throw new Error("Transaction failed on-chain.");
    if (value?.confirmationStatus === "confirmed" || value?.confirmationStatus === "finalized") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }

  throw new Error("Transaction confirmation timed out. It may still confirm — check the Explorer link.");
}

const NEEDS_DEVNET_SOL_MESSAGE =
  "Your wallet needs a small amount of devnet SOL to cover the network fee — this is separate from the USDC you're depositing, and every Solana transaction requires it. Get free devnet SOL from faucet.solana.com and try again.";

function mapClientError(error: unknown): string {
  if (error instanceof Error) {
    if (/reject/i.test(error.message)) return "Transaction rejected. You can try again whenever you're ready.";
    // Wallets surface an insufficient-SOL-for-fees failure in inconsistent
    // ways: some report it directly ("insufficient", "not enough SOL"),
    // others only say their preflight "simulation" failed, and some (Phantom
    // included, observed in practice) fall all the way back to wrapping it
    // in wallet-adapter's generic "Unexpected error" with no further detail.
    if (/insufficient|not enough sol|simulate|^unexpected error$/i.test(error.message)) {
      return NEEDS_DEVNET_SOL_MESSAGE;
    }
    if (/network|fetch/i.test(error.message)) return "Network unavailable. Please check your connection and try again.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function truncateMiddle(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function Row({
  label,
  value,
  emphasize = false,
  mono = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-muted">{label}</span>
      <span
        className={`text-right ${mono ? "font-tabular text-xs" : ""} ${emphasize ? "font-semibold text-ink" : "text-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}
