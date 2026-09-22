"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatMinorUnits } from "@/lib/money";
import { useAuth } from "@/hooks/useAuth";
import type { RedemptionQuotesRow } from "@/types/database";

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong. Please try again.");
  return json as T;
}

type Phase = "idle" | "quoting" | "quoted" | "confirming" | "done" | "withdrawing" | "withdrawn" | "error";

export function RedemptionPanel({ positionId, autoOpen = false }: { positionId: string; autoOpen?: boolean }) {
  const router = useRouter();
  const { walletAddress } = useAuth();
  const [open, setOpen] = useState(autoOpen);
  const [phase, setPhase] = useState<Phase>(autoOpen ? "quoting" : "idle");
  const [quote, setQuote] = useState<RedemptionQuotesRow | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [cashBalance, setCashBalance] = useState<string | null>(null);

  // Pure fetch with no state set before the await, so it's safe to invoke
  // from an effect (auto-open on mount) as well as from a click handler.
  const fetchQuote = useCallback(async () => {
    try {
      const result = await postJson<{ quote: RedemptionQuotesRow }>("/api/redemption/quote", { positionId });
      setQuote(result.quote);
      setPhase("quoted");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not generate a redemption quote.");
      setPhase("error");
    }
  }, [positionId]);

  const requestQuote = useCallback(() => {
    setOpen(true);
    setPhase("quoting");
    setErrorMessage("");
    void fetchQuote();
  }, [fetchQuote]);

  useEffect(() => {
    if (!autoOpen) return;
    let cancelled = false;
    postJson<{ quote: RedemptionQuotesRow }>("/api/redemption/quote", { positionId })
      .then((result) => {
        if (cancelled) return;
        setQuote(result.quote);
        setPhase("quoted");
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "Could not generate a redemption quote.");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount for the auto-open case
  }, [autoOpen]);

  useEffect(() => {
    if (!quote) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(quote.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [quote]);

  const expired = quote !== null && secondsLeft <= 0;

  const confirmRedemption = async () => {
    if (!quote) return;
    setPhase("confirming");
    setErrorMessage("");
    try {
      const result = await postJson<{ cashBalance: string }>("/api/redemption/confirm", { quoteId: quote.id });
      setCashBalance(result.cashBalance);
      setPhase("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not complete this redemption.");
      setPhase("error");
    }
  };

  const withdrawToWallet = async () => {
    if (!cashBalance || !walletAddress) return;
    setPhase("withdrawing");
    setErrorMessage("");
    try {
      const majorAmount = (Number(cashBalance) / 100).toFixed(2);
      await postJson("/api/withdrawals", { amount: majorAmount, destinationWallet: walletAddress });
      setPhase("withdrawn");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not process this withdrawal.");
      setPhase("error");
    }
  };

  const minutesLabel = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [secondsLeft]);

  if (!open) {
    return (
      <Card className="p-6 sm:p-7">
        <h3 className="text-sm font-semibold text-ink">Redemption</h3>
        <p className="mt-1.5 text-sm text-ink-muted">
          Request a redemption quote to see your current value and any early-redemption liquidity adjustment.
        </p>
        <Button className="mt-5" variant="secondary" onClick={requestQuote}>
          Withdraw
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-7">
      <h3 className="text-sm font-semibold text-ink">Redemption</h3>

      {phase === "quoting" && <p className="mt-4 text-sm text-ink-muted">Generating your redemption quote…</p>}

      {(phase === "quoted" || phase === "confirming") && quote && (
        <>
          <dl className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-bg p-4 text-sm">
            <Row label="Current value" value={formatMinorUnits(quote.current_value_minor_units)} />
            <Row
              label="Liquidity adjustment"
              value={`- ${formatMinorUnits(quote.liquidity_adjustment_minor_units)}`}
              negative={quote.liquidity_adjustment_minor_units !== "0"}
            />
            <Row
              label="Estimated redemption value"
              value={formatMinorUnits(quote.redemption_value_minor_units)}
              emphasize
            />
          </dl>
          <p className="mt-3 text-xs text-ink-faint">
            Early redemption may be subject to an applicable liquidity adjustment. This quote is authoritative and
            generated by the server — it cannot be altered from the browser.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              Quote valid for <span className={`font-tabular ${expired ? "text-negative" : "text-ink"}`}>{minutesLabel}</span>
            </span>
          </div>
          {expired ? (
            <Button className="mt-4 w-full" onClick={requestQuote}>
              Request a new quote
            </Button>
          ) : (
            <div className="mt-4 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={confirmRedemption} disabled={phase === "confirming"}>
                {phase === "confirming" ? "Processing…" : "Confirm redemption"}
              </Button>
            </div>
          )}
        </>
      )}

      {(phase === "done" || phase === "withdrawing" || phase === "withdrawn") && (
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-ink">Redemption complete.</p>
          <p className="font-tabular mt-2 text-2xl font-semibold text-accent">
            {cashBalance ? formatMinorUnits(cashBalance) : ""}
          </p>
          <p className="mt-1 text-xs text-ink-muted">available in your cash balance</p>
          {phase === "withdrawn" ? (
            <p className="mt-4 text-sm text-accent-strong">Withdrawal requested to your connected wallet.</p>
          ) : (
            <Button className="mt-5 w-full" onClick={withdrawToWallet} disabled={phase === "withdrawing"}>
              {phase === "withdrawing" ? "Processing…" : "Withdraw to my wallet"}
            </Button>
          )}
          <Button variant="ghost" className="mt-2 w-full" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      )}

      {phase === "error" && (
        <div className="mt-4">
          <p className="text-sm text-negative">{errorMessage}</p>
          <Button className="mt-4 w-full" onClick={requestQuote}>
            Try again
          </Button>
        </div>
      )}
    </Card>
  );
}

function Row({
  label,
  value,
  emphasize = false,
  negative = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span
        className={`font-tabular ${emphasize ? "font-semibold text-ink" : negative ? "text-negative" : "text-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}
